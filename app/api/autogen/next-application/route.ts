import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireBearerAuth } from "@/lib/auth";
import { assembleFullPrompt } from "@/lib/promptBuilder";
import { tryClaimRow, releaseClaim, staleThresholdIso } from "@/lib/autogenClaim";

const MAX_CANDIDATES = 20;

const CANDIDATE_FIELDS =
  "id, seq, role, company_name, job_description, profile_id, template_id, status, autogen_claimed_at, created_at";

/**
 * Auto-claim path: atomically claims and returns the oldest claimable application
 * (`status='pending'`, or a stale abandoned `generating` claim), rendering its
 * prompt against the application's OWN `template_id`. An optional `?templateId=`
 * default template is used as a fallback for applications that have none - when
 * that fallback is supplied, template-less applications are also claimable;
 * otherwise they are ignored.
 */
export async function GET(request: NextRequest) {
  const session = await requireBearerAuth(request);
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const fallbackTemplateId = request.nextUrl.searchParams.get("templateId")?.trim() || "";

  let query = supabase
    .from("applications")
    .select(CANDIDATE_FIELDS)
    .neq("job_description", "")
    .or(`status.eq.pending,and(status.eq.generating,autogen_claimed_at.lt.${staleThresholdIso()})`)
    .order("created_at", { ascending: true })
    .limit(MAX_CANDIDATES);

  // Without a default template, only applications that carry their own template
  // are claimable; with one, template-less applications fall back to it.
  if (!fallbackTemplateId) query = query.not("template_id", "is", null);

  if (session.role === "assistant") query = query.eq("created_by", session.userId);

  const { data: candidates, error } = await query;
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  for (const app of candidates ?? []) {
    const effectiveTemplateId = (app.template_id as string | null) || fallbackTemplateId;
    if (!effectiveTemplateId) continue;
    const claimedAt = await tryClaimRow(app);
    if (!claimedAt) continue; // lost the race to another lane/window

    const prompt = await assembleFullPrompt(effectiveTemplateId, app);
    if (!prompt) {
      await releaseClaim(app.id, "pending");
      continue;
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

  return NextResponse.json({ application: null });
}
