import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAnyAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await requireAnyAuth(request);
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  let query = supabase
    .from("profiles")
    .select("id, name")
    .order("name", { ascending: true });

  if (session.role === "assistant") {
    const { data: assignments } = await supabase
      .from("profile_assignments")
      .select("profile_id")
      .eq("user_id", session.userId);

    const ids = (assignments ?? []).map((a) => a.profile_id);
    if (ids.length === 0) return NextResponse.json([]);
    query = query.in("id", ids);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const session = await requireAnyAuth(request);
  if (!session || session.role !== "admin")
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  let name: string;
  try {
    ({ name } = await request.json());
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  if (!name?.trim())
    return NextResponse.json({ message: "name is required" }, { status: 400 });

  const { data, error } = await supabase
    .from("profiles")
    .insert({ name: name.trim() })
    .select("id, name, created_at")
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
