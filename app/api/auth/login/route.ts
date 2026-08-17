import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createSession, readEnv } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ message: "Invalid request" }, { status: 400 });

  const email = String(body.email ?? "").toLowerCase().trim();
  const password = String(body.password ?? "");

  if (!email || !password) {
    return NextResponse.json({ message: "Email and password are required." }, { status: 400 });
  }

  const { data: user } = await supabase
    .from("team_users")
    .select("id, name, email, role, password_hash, is_active")
    .eq("email", email)
    .maybeSingle();

  if (!user) {
    return NextResponse.json({ message: "Invalid email or password." }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return NextResponse.json({ message: "Invalid email or password." }, { status: 401 });
  }

  if (!user.is_active) {
    return NextResponse.json({ message: "Account is disabled. Contact an administrator." }, { status: 403 });
  }

  const token = await createSession(user.id, user.role, readEnv(process.env.SESSION_SECRET));
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { error: sessionError } = await supabase.from("sessions").insert({
    user_id: user.id,
    token,
    expires_at: expiresAt,
  });

  if (sessionError) {
    console.error("Failed to create session:", sessionError.message);
    return NextResponse.json({ message: "Failed to create session." }, { status: 500 });
  }

  return NextResponse.json({
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    token,
    expiresAt,
  });
}
