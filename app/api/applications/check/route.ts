import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAnyAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await requireAnyAuth(request);
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const company = searchParams.get("company");
  const board = searchParams.get("board");
  const profile_id = searchParams.get("profile_id");

  let query = supabase
    .from("applications")
    .select("seq, role, company_name, pipeline_status, profiles(name)");

  if (url) {
    query = query.ilike("job_url", `%${url}%`).limit(1);
  } else if (company) {
    query = query.ilike("company_name", `%${company}%`).order("created_at", { ascending: false }).limit(3);
  } else if (board) {
    query = query.ilike("job_board", `%${board}%`).order("created_at", { ascending: false }).limit(3);
  } else {
    return NextResponse.json([]);
  }

  if (profile_id) {
    query = query.eq("profile_id", profile_id);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
