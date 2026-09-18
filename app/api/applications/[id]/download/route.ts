import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireSession } from "@/lib/auth";
import { downloadResumeFromDrive } from "@/lib/googleDrive";
import { applicationDocxFilename, attachmentDisposition } from "@/lib/resumeFilename";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { data, error } = await supabase
    .from("applications")
    .select("google_drive_file_id, company_name, status, seq, created_by, profiles(name)")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  if (session.role === "assistant" && data.created_by !== session.userId) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  if (data.status !== "completed" || !data.google_drive_file_id) {
    return NextResponse.json({ message: "Resume not yet available" }, { status: 404 });
  }

  const profileName = (data.profiles as unknown as { name: string } | null)?.name ?? null;
  const docxName = applicationDocxFilename(profileName, data.seq, data.company_name);

  try {
    const { buffer } = await downloadResumeFromDrive(data.google_drive_file_id);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": attachmentDisposition(docxName),
        "Content-Length": String(buffer.length),
        "X-Filename": docxName,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ message: `Failed to download: ${msg}` }, { status: 500 });
  }
}
