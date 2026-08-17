import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabase
    .from("contexts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  let name: string;
  let content: string;

  try {
    ({ name, content } = await request.json());
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  if (!name?.trim()) {
    return NextResponse.json({ message: "Context name is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("contexts")
    .insert({ name: name.trim(), content: content ?? "" })
    .select()
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
