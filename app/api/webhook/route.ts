import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireBearerAuth } from "@/lib/auth";
import { generateFromTemplate } from "@/lib/generateResume";
import { uploadResumeToDrive } from "@/lib/googleDrive";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  const session = await requireBearerAuth(request);
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }

  let job_url: string | undefined;
  let role: string;
  let company_name: string;
  let job_description: string | undefined;
  let template_id: string | undefined;
  let profile_id: string | undefined;
  let tailor_flag: boolean;
  let batch_mode: boolean | undefined;
  let job_board: string | undefined;

  try {
    ({ job_url, role, company_name, job_description, template_id, profile_id, tailor_flag, batch_mode, job_board } = await request.json());
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400, headers: CORS_HEADERS });
  }

  const shouldTailor = tailor_flag === true && batch_mode !== true;

  if (!role?.trim() || !company_name?.trim()) {
    return NextResponse.json(
      { message: "role and company_name are required" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  if (shouldTailor && !job_description?.trim()) {
    return NextResponse.json(
      { message: "job_description is required when tailor_flag is true" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const storedTemplateId = template_id?.trim() || null;
  const templateId = shouldTailor ? (storedTemplateId || process.env.DEFAULT_TEMPLATE_ID) : undefined;

  let profileName = "";
  let resolvedProfileId: string | null = null;

  if (profile_id?.trim()) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, name")
      .eq("id", profile_id.trim())
      .maybeSingle();
    if (profile) {
      resolvedProfileId = profile.id;
      profileName = profile.name ?? "";
    }
  }

  const { data: application, error: insertError } = await supabase
    .from("applications")
    .insert({
      job_url: job_url?.trim() || null,
      role: role.trim(),
      company_name: company_name.trim(),
      job_description: job_description?.trim() || null,
      profile_id: resolvedProfileId,
      template_id: storedTemplateId,
      created_by: session.userId,
      status: shouldTailor && templateId ? "generating" : "pending",
      pipeline_status: "saved",
      job_board: job_board?.trim() || null,
    })
    .select()
    .single();

  if (insertError || !application) {
    return NextResponse.json({ message: insertError?.message ?? "Insert failed" }, { status: 500, headers: CORS_HEADERS });
  }

  if (shouldTailor && templateId) {
    after(async () => {
      try {
        const backgroundInfo = profileName ? `Name: ${profileName}` : "";
        const { buffer, filename } = await generateFromTemplate(
          templateId,
          backgroundInfo,
          job_description!.trim(),
          { role }
        );

        const baseName = profileName
          ? profileName.replace(/[^a-zA-Z0-9]/g, "") + "Resume"
          : filename.replace(/\.docx$/i, "");
        const driveFilename = application.seq ? `${baseName}_${application.seq}.docx` : `${baseName}.docx`;
        const { fileId, driveLink } = await uploadResumeToDrive(buffer, driveFilename);

        await supabase
          .from("applications")
          .update({ status: "completed", google_drive_link: driveLink, google_drive_file_id: fileId })
          .eq("id", application.id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await supabase
          .from("applications")
          .update({ status: "failed", error_message: msg })
          .eq("id", application.id);
      }
    });
  }

  return NextResponse.json(application, { status: 202, headers: CORS_HEADERS });
}
