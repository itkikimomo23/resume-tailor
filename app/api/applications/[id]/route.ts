import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { deleteFileFromDrive } from "@/lib/googleDrive";
import { STATUSES_THAT_CLEAR_RESUME, resumeClearingFields } from "@/lib/applicationResumeCleanup";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { data, error } = await supabase
    .from("applications")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const allowed = [
    "pipeline_status", "status", "role", "company_name", "notes",
    "recruiter_name", "recruiter_email", "recruiter_phone", "scheduled_meeting_at", "meeting_done",
  ] as const;
  const update: Record<string, string | boolean | null> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }

  if (Object.keys(update).length === 0)
    return NextResponse.json({ message: "No valid fields to update" }, { status: 400 });

  if (typeof update.status === "string" && STATUSES_THAT_CLEAR_RESUME.includes(update.status)) {
    Object.assign(update, await resumeClearingFields([id]));
  }

  const { data, error } = await supabase
    .from("applications")
    .update(update)
    .eq("id", id)
    .select("id, seq, job_url, role, company_name, status, pipeline_status, google_drive_link, google_drive_file_id, error_message, notes, recruiter_name, recruiter_email, recruiter_phone, scheduled_meeting_at, meeting_done, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: app } = await supabase
    .from("applications")
    .select("google_drive_file_id")
    .eq("id", id)
    .single();

  if (app?.google_drive_file_id) {
    try {
      await deleteFileFromDrive(app.google_drive_file_id);
    } catch {
      // Drive file may already be gone — continue with DB deletion
    }
  }

  const { error } = await supabase.from("applications").delete().eq("id", id);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
