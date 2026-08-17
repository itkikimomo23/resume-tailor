import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, error } = await supabase
    .from("docx_templates")
    .select("id, name, storage_path, created_at, updated_at")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || !("prompt_id" in body))
    return NextResponse.json({ message: "No valid fields to update" }, { status: 400 });

  const prompt_id: string | null = body.prompt_id || null;

  const { data, error } = await supabase
    .from("docx_templates")
    .update({ prompt_id })
    .eq("id", id)
    .select("id, name, storage_path, variables, template_type, profile_id, prompt_id, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, error } = await supabase
    .from("docx_templates")
    .select("storage_path")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ message: "Template not found" }, { status: 404 });

  await supabase.storage.from("docx-templates").remove([data.storage_path]);

  const { error: delError } = await supabase.from("docx_templates").delete().eq("id", id);
  if (delError) return NextResponse.json({ message: delError.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
