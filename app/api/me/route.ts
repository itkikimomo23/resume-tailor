import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("team_users")
    .select("name")
    .eq("id", session.userId)
    .maybeSingle();

  return NextResponse.json({
    userId: session.userId,
    role: session.role,
    name: data?.name ?? "",
  });
}
