import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireBearerAuth } from "@/lib/auth";
import { extractJsonAnswer } from "@/lib/promptBuilder";
import { uploadResumeToDrive } from "@/lib/googleDrive";
import {
  renderDocxTemplate,
  renderDocxTemplateStructured,
  isStructuredOutput,
  mapStructuredToFlat,
  type StructuredAIOutput,
} from "@/lib/docxTemplater";
import { applicationDocxFilename } from "@/lib/resumeFilename";

/**
 * Accepts ChatGPT's raw reply text, extracts the JSON object (tolerating markdown
 * fences), renders the docx against the application's OWN `template_id`, uploads it
 * to Google Drive, and flips the application to `completed`. Mirrors the app's own
 * generate-from-json + upload path (app/api/batch-builder/[id]/generate-from-json +
 * app/api/applications/[id]/upload).
 *
 * Always responds 200 with `{ status:'Success' }` or `{ status:'Error', detail }` -
 * on error the row is left claimed (still `generating`) so the extension's retry
 * picks up cleanly.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireBearerAuth(request);
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const answer = String(body?.answer ?? "");
    const fallbackTemplateId = String(body?.templateId ?? "").trim();
    if (!answer.trim()) return NextResponse.json({ status: "Error", detail: "Empty answer." });

    const { data: app } = await supabase
      .from("applications")
      .select("id, seq, profile_id, template_id, company_name")
      .eq("id", id)
      .maybeSingle();
    if (!app) return NextResponse.json({ status: "Error", detail: "Application not found." });

    // Same resolution as the claim path (own template wins, default fills in) so
    // the rendered resume matches the template the prompt was built from.
    const effectiveTemplateId = app.template_id || fallbackTemplateId;
    if (!effectiveTemplateId)
      return NextResponse.json({ status: "Error", detail: "Application has no template assigned." });

    let jsonData: Record<string, unknown>;
    try {
      jsonData = extractJsonAnswer(answer);
    } catch (err) {
      return NextResponse.json({
        status: "Error",
        detail: err instanceof Error ? err.message : "Could not parse JSON from ChatGPT reply.",
      });
    }

    const { data: tpl } = await supabase
      .from("docx_templates")
      .select("name, storage_path")
      .eq("id", effectiveTemplateId)
      .maybeSingle();
    if (!tpl) return NextResponse.json({ status: "Error", detail: "Template not found." });

    const { data: fileBlob, error: dlError } = await supabase.storage
      .from("docx-templates")
      .download(tpl.storage_path);
    if (dlError || !fileBlob)
      return NextResponse.json({ status: "Error", detail: "Failed to download template." });

    const templateBuffer = Buffer.from(await fileBlob.arrayBuffer());

    let buffer: Buffer;
    if (isStructuredOutput(jsonData)) {
      const structured = jsonData as unknown as StructuredAIOutput;
      buffer = renderDocxTemplateStructured(templateBuffer, structured, mapStructuredToFlat(structured));
    } else {
      buffer = renderDocxTemplate(templateBuffer, jsonData as Record<string, string>);
    }

    let profileName = "";
    if (app.profile_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", app.profile_id)
        .maybeSingle();
      if (profile) profileName = profile.name ?? "";
    }

    const filename = applicationDocxFilename(profileName, app.seq, app.company_name);

    const { fileId, driveLink } = await uploadResumeToDrive(buffer, filename);

    const { error: updateError } = await supabase
      .from("applications")
      .update({
        status: "completed",
        google_drive_file_id: fileId,
        google_drive_link: driveLink,
        error_message: null,
        autogen_claimed_at: null,
      })
      .eq("id", id);
    if (updateError) return NextResponse.json({ status: "Error", detail: updateError.message });

    return NextResponse.json({ status: "Success", driveLink, fileId });
  } catch (err) {
    return NextResponse.json({
      status: "Error",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
