import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireSession } from "@/lib/auth";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session || session.role !== "admin")
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { error } = await supabase.from("profile_assignments").delete().eq("id", id);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
