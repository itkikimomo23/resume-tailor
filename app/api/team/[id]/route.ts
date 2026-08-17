import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireSession } from "@/lib/auth";
import bcrypt from "bcryptjs";

async function requireAdmin() {
  const session = await requireSession();
  if (!session || session.role !== "admin") return null;
  return session;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const updates: Record<string, string | boolean> = {};

  if (body.name?.trim()) updates.name = body.name.trim();
  if (body.email?.trim()) updates.email = body.email.toLowerCase().trim();
  if (body.role && ["admin", "assistant"].includes(body.role)) updates.role = body.role;
  if (body.password?.trim()) updates.password_hash = await bcrypt.hash(body.password.trim(), 12);
  if (typeof body.is_active === "boolean") {
    if (!body.is_active && id === session.userId) {
      return NextResponse.json({ message: "Cannot disable your own account." }, { status: 400 });
    }
    updates.is_active = body.is_active;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ message: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("team_users")
    .update(updates)
    .eq("id", id)
    .select("id, name, email, role, is_active, created_at")
    .single();

  if (error) {
    const msg = error.code === "23505" ? "Email already in use." : error.message;
    return NextResponse.json({ message: msg }, { status: 400 });
  }

  return NextResponse.json(data);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const { id } = await params;

  if (id === session.userId) {
    return NextResponse.json({ message: "Cannot delete your own account." }, { status: 400 });
  }

  const { error } = await supabase.from("team_users").delete().eq("id", id);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
