import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

/** Returns live role from DB, or null if the user doesn't exist or is disabled. */
async function getLiveUser(userId: string): Promise<{ role: string } | null> {
  const { data } = await supabase
    .from("team_users")
    .select("role, is_active")
    .eq("id", userId)
    .maybeSingle();
  if (!data || !data.is_active) return null;
  return { role: data.role };
}

export const SESSION_COOKIE = "rt_session";

export function readEnv(value: string | undefined): string {
  if (!value) return "";
  return value.replace(/^(['"])(.*)\1$/, "$2").trim();
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

async function hmacHex(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type SessionPayload = { userId: string; role: string };

/** Token format: `userId:role:nonce:<hmac(userId:role:nonce)>` */
export async function createSession(userId: string, role: string, secret: string): Promise<string> {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const payload = `${userId}:${role}:${nonce}`;
  const sig = await hmacHex(payload, secret);
  return `${payload}:${sig}`;
}

export async function verifySession(token: string, secret: string): Promise<SessionPayload | null> {
  const last = token.lastIndexOf(":");
  if (last === -1) return null;
  const payload = token.slice(0, last);
  const sig = token.slice(last + 1);
  const expected = await hmacHex(payload, secret);
  if (!timingSafeEqual(sig, expected)) return null;
  const parts = payload.split(":");
  const userId = parts[0];
  const role = parts[1];
  if (!userId || !role) return null;
  return { userId, role };
}

/** Read and verify the session cookie. Role is always read live from DB, not from the token. */
export async function requireSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value ?? "";
  const payload = await verifySession(token, readEnv(process.env.SESSION_SECRET));
  if (!payload) return null;
  const user = await getLiveUser(payload.userId);
  if (!user) return null;
  return { userId: payload.userId, role: user.role };
}

/** Verify Authorization: Bearer <token>. Role is always read live from DB, not from the token. */
export async function requireBearerAuth(request: NextRequest): Promise<SessionPayload | null> {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const payload = await verifySession(token, readEnv(process.env.SESSION_SECRET));
  if (!payload) return null;

  const { data: sessionRow } = await supabase
    .from("sessions")
    .select("user_id")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (!sessionRow) return null;

  const user = await getLiveUser(payload.userId);
  if (!user) return null;
  return { userId: payload.userId, role: user.role };
}

/** Try Bearer token first, fall back to session cookie. Returns null if neither is valid. */
export async function requireAnyAuth(request: NextRequest): Promise<SessionPayload | null> {
  return (await requireBearerAuth(request)) ?? (await requireSession());
}
