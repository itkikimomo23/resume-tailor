import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let name: string;
  try {
    ({ name } = await request.json());
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  if (!name?.trim()) {
    return NextResponse.json({ message: "name is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ name: name.trim() })
    .eq("id", id)
    .select("id, name, created_at")
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { error } = await supabase.from("profiles").delete().eq("id", id);

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
