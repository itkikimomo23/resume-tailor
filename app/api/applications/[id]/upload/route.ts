import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { uploadResumeToDrive } from "@/lib/googleDrive";
import { requireSession } from "@/lib/auth";
import { applicationDocxFilename } from "@/lib/resumeFilename";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: app } = await supabase
    .from("applications")
    .select("id, seq, status, company_name")
    .eq("id", id)
    .single();

  if (!app) return NextResponse.json({ message: "Application not found" }, { status: 404 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ message: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const profileId = formData.get("profileId") as string | null;

  if (!file) return NextResponse.json({ message: "file is required" }, { status: 400 });
  if (!profileId) return NextResponse.json({ message: "profileId is required" }, { status: 400 });
  if (!file.name.toLowerCase().endsWith(".docx"))
    return NextResponse.json({ message: "Only .docx files are accepted" }, { status: 400 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", profileId)
    .single();

  if (!profile) return NextResponse.json({ message: "Profile not found" }, { status: 404 });

  const filename = applicationDocxFilename(profile.name, app.seq, app.company_name);

  const buffer = Buffer.from(await file.arrayBuffer());
  const { fileId, driveLink } = await uploadResumeToDrive(buffer, filename);

  const { data: updated, error } = await supabase
    .from("applications")
    .update({ status: "completed", google_drive_file_id: fileId, google_drive_link: driveLink })
    .eq("id", id)
    .select("id, seq, job_url, role, company_name, status, pipeline_status, google_drive_link, google_drive_file_id, error_message, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json(updated);
}
