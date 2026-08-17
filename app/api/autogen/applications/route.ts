import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireBearerAuth } from "@/lib/auth";

const MAX_CANDIDATES = 200;

/**
 * Tab 2 (Applications) candidate list for the AutoGen extension: applications that
 * still need a resume generated - `status IN ('pending','failed')` - newest first,
 * joined to their template's name so the panel can show it and flag rows with no
 * template assigned (those can't be generated and are disabled in the UI).
 */
export async function GET(request: NextRequest) {
  const session = await requireBearerAuth(request);
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  let query = supabase
    .from("applications")
    .select(
      "id, seq, role, company_name, status, created_at, template_id, error_message, docx_templates(name)"
    )
    .in("status", ["pending", "failed"])
    .order("created_at", { ascending: false })
    .limit(MAX_CANDIDATES);

  if (session.role === "assistant") query = query.eq("created_by", session.userId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  const applications = (data ?? []).map(({ docx_templates, ...rest }) => ({
    ...rest,
    template_name: (docx_templates as unknown as { name: string } | null)?.name ?? null,
  }));

  return NextResponse.json({ applications });
}
