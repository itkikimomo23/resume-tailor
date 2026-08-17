import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAnyAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await requireAnyAuth(request);
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  let query = supabase
    .from("docx_templates")
    .select("id, name")
    .order("name", { ascending: true });

  if (session.role === "assistant") {
    const { data: assignments } = await supabase
      .from("profile_assignments")
      .select("profile_id")
      .eq("user_id", session.userId);

    const profileIds = (assignments ?? []).map((a) => a.profile_id);
    if (profileIds.length === 0) return NextResponse.json([]);
    query = query.in("profile_id", profileIds);
  }

  const profileId = request.nextUrl.searchParams.get("profile_id");
  if (profileId) {
    query = query.eq("profile_id", profileId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
