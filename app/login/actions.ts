"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, createSession, readEnv } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import bcrypt from "bcryptjs";

export async function login(formData: FormData): Promise<{ error: string } | void> {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const password = String(formData.get("password") ?? "");
  const secret = readEnv(process.env.SESSION_SECRET);

  if (!secret) return { error: "Server credentials not configured." };

  const { data: user } = await supabase
    .from("team_users")
    .select("id, role, password_hash, is_active")
    .eq("email", email)
    .maybeSingle();

  if (!user) return { error: "Invalid email or password." };

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return { error: "Invalid email or password." };

  if (!user.is_active) return { error: "Your account has been disabled. Contact an administrator." };

  const token = await createSession(user.id, user.role, secret);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  redirect(user.role === "admin" ? "/" : "/applications");
}
