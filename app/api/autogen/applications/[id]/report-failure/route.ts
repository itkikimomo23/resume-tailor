import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireBearerAuth } from "@/lib/auth";

/**
 * Called once the extension has exhausted its own retry budget for an application.
 * Sets `status='failed'` and `error_message=detail`, clearing the claim. Unlike the
 * stale-claim recycle path (silent, automatic), this is a real, human-visible
 * failure state in the Job Board / applications table.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireBearerAuth(request);
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const detail = String(body?.detail ?? "").slice(0, 2000);

  const { error } = await supabase
    .from("applications")
    .update({ status: "failed", error_message: detail, autogen_claimed_at: null })
    .eq("id", id);

  if (error) return NextResponse.json({ status: "Error", detail: error.message });
  return NextResponse.json({ status: "Success" });
}
