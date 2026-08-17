import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireSession } from "@/lib/auth";

const PAGE_SIZE = 20;

export async function GET(request: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const sp = request.nextUrl.searchParams;

  const page      = Math.max(1, parseInt(sp.get("page") ?? "1", 10));
  const pageSize  = Math.min(500, Math.max(1, parseInt(sp.get("pageSize") ?? String(PAGE_SIZE), 10)));
  const search    = sp.get("search")?.trim() ?? "";
  const fullSearch = sp.get("fullSearch") === "1";
  const profileId = sp.get("profileId") ?? "";
  const bidderId  = sp.get("bidderId") ?? "";
  const status    = sp.get("status") ?? "";
  const stage     = sp.get("stage") ?? "";
  const stages    = sp.get("stages")?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  const date      = sp.get("date") ?? "";

  const from = (page - 1) * pageSize;
  const to   = from + pageSize - 1;

  let query = supabase
    .from("applications")
    .select(
      "id, seq, job_url, role, company_name, job_board, status, pipeline_status, google_drive_link, google_drive_file_id, error_message, notes, recruiter_name, recruiter_email, recruiter_phone, scheduled_meeting_at, meeting_done, created_at, updated_at, created_by, profile_id, template_id, profiles(name), creator:team_users!created_by(name)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (session?.role === "assistant") {
    query = query.eq("created_by", session.userId);
  } else if (bidderId) {
    query = query.eq("created_by", bidderId);
  }

  if (search) {
    const escaped = search.replace(/[%_]/g, "\\$&");
    const quoted = `"%${escaped.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}%"`;
    const fields = ["company_name", "role"];
    if (fullSearch) fields.push("job_description");
    const orParts = fields.map((f) => `${f}.ilike.${quoted}`);
    if (/^\d+$/.test(search)) orParts.push(`seq.eq.${parseInt(search, 10)}`);
    query = query.or(orParts.join(","));
  }
  if (profileId) query = query.eq("profile_id", profileId);
  if (status)    query = query.eq("status", status);
  if (stage)     query = query.eq("pipeline_status", stage);
  if (stages.length) query = query.in("pipeline_status", stages);
  if (date) {
    query = query
      .gte("created_at", `${date}T00:00:00.000Z`)
      .lte("created_at", `${date}T23:59:59.999Z`);
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  const flattened = (data ?? []).map(({ profiles, creator, ...rest }) => ({
    ...rest,
    profile_name: (profiles as unknown as { name: string } | null)?.name ?? null,
    bidder_name:  (creator  as unknown as { name: string } | null)?.name ?? null,
  }));

  return NextResponse.json({ data: flattened, total: count ?? 0 });
}
