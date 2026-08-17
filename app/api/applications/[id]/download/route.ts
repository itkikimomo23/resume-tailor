import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { downloadResumeFromDrive } from "@/lib/googleDrive";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { data, error } = await supabase
    .from("applications")
    .select("google_drive_file_id, role, company_name, status")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  if (data.status !== "completed" || !data.google_drive_file_id) {
    return NextResponse.json({ message: "Resume not yet available" }, { status: 404 });
  }

  const { buffer, filename } = await downloadResumeFromDrive(data.google_drive_file_id);

  // Strip trailing _<number> added during upload (e.g. John_Doe_3.docx → John_Doe.docx)
  const cleanFilename = filename.replace(/_\d+\.docx$/i, ".docx");

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${cleanFilename}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
