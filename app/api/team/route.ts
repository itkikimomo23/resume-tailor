import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireSession } from "@/lib/auth";
import bcrypt from "bcryptjs";

async function requireAdmin() {
  const session = await requireSession();
  if (!session || session.role !== "admin") return null;
  return session;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("team_users")
    .select("id, name, email, role, is_active, created_at")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { name, email, password, role } = await request.json();

  if (!name?.trim() || !email?.trim() || !password?.trim()) {
    return NextResponse.json({ message: "name, email, and password are required" }, { status: 400 });
  }
  if (!["admin", "assistant"].includes(role)) {
    return NextResponse.json({ message: "role must be admin or assistant" }, { status: 400 });
  }

  const password_hash = await bcrypt.hash(password, 12);

  const { data, error } = await supabase
    .from("team_users")
    .insert({ name: name.trim(), email: email.toLowerCase().trim(), password_hash, role })
    .select("id, name, email, role, is_active, created_at")
    .single();

  if (error) {
    const msg = error.code === "23505" ? "Email already in use." : error.message;
    return NextResponse.json({ message: msg }, { status: 400 });
  }

  return NextResponse.json(data, { status: 201 });
}
