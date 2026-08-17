import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireBearerAuth } from "@/lib/auth";
import { assembleFullPrompt } from "@/lib/promptBuilder";
import { tryClaimRow, releaseClaim, STALE_CLAIM_MS } from "@/lib/autogenClaim";

/**
 * Select-and-run path: claims ONE specific application (chosen in Tab 2) and
 * returns its rendered prompt, built from the application's own `template_id` -
 * falling back to the optional default `templateId` in the request body when the
 * application has none. Claimable when `status IN ('pending','failed')`, or a
 * stale abandoned `generating` claim. The compare-and-swap in tryClaimRow is the
 * cross-lane / cross-window guard against two callers grabbing the same application.
 *
 * Never throws to the caller: returns `{ application }` on success, or
 * `{ application: null, reason }` (no_template | no_job_description | not_claimable)
 * so the lane can mark it skipped and move on.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireBearerAuth(request);
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const fallbackTemplateId = String(body?.templateId ?? "").trim();

  let query = supabase
    .from("applications")
    .select(
      "id, seq, role, company_name, job_description, profile_id, template_id, status, autogen_claimed_at, created_at, created_by"
    )
    .eq("id", id);
  if (session.role === "assistant") query = query.eq("created_by", session.userId);

  const { data: app } = await query.maybeSingle();
  if (!app) return NextResponse.json({ application: null, reason: "not_claimable" });

  const effectiveTemplateId = app.template_id || fallbackTemplateId;
  if (!effectiveTemplateId) return NextResponse.json({ application: null, reason: "no_template" });
  if (!app.job_description?.trim())
    return NextResponse.json({ application: null, reason: "no_job_description" });

  const isStaleGenerating =
    app.status === "generating" &&
    app.autogen_claimed_at != null &&
    Date.now() - new Date(app.autogen_claimed_at).getTime() > STALE_CLAIM_MS;
  const claimable = app.status === "pending" || app.status === "failed" || isStaleGenerating;
  if (!claimable) return NextResponse.json({ application: null, reason: "not_claimable" });

  const priorStatus = app.status;
  const claimedAt = await tryClaimRow(app);
  if (!claimedAt)
    return NextResponse.json({ application: null, reason: "not_claimable" });

  const prompt = await assembleFullPrompt(effectiveTemplateId, app);
  if (!prompt) {
    await releaseClaim(app.id, priorStatus === "failed" ? "failed" : "pending");
    return NextResponse.json({ application: null, reason: "no_template" });
  }

  return NextResponse.json({
    application: {
      id: app.id,
      seq: app.seq,
      company_name: app.company_name,
      role: app.role,
      created_at: app.created_at,
      job_description: app.job_description,
      rendered_prompt: prompt.fullPrompt,
      autogen_claimed_at: claimedAt,
    },
  });
}
