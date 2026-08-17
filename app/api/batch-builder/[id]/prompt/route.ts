import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireSession } from "@/lib/auth";
import { extractTemplateVariables } from "@/lib/docxTemplater";
import { resolveSystemPrompt } from "@/lib/promptResolution";
import { buildUserPrompt } from "@/lib/promptBuilder";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const templateId = searchParams.get("templateId");

  if (!templateId)
    return NextResponse.json({ message: "templateId query param is required" }, { status: 400 });

  const { data: app } = await supabase
    .from("applications")
    .select("id, seq, role, company_name, job_description, profile_id")
    .eq("id", id)
    .single();

  if (!app) return NextResponse.json({ message: "Application not found" }, { status: 404 });

  if (!app.job_description?.trim())
    return NextResponse.json({ message: "No job description available for this application" }, { status: 400 });

  let profileName = "";
  if (app.profile_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", app.profile_id)
      .single();
    if (profile) profileName = profile.name ?? "";
  }

  const { data: tpl, error: tplError } = await supabase
    .from("docx_templates")
    .select("name, storage_path, variables")
    .eq("id", templateId)
    .single();

  if (tplError || !tpl)
    return NextResponse.json({ message: "Template not found" }, { status: 404 });

  let variables: string[] = Array.isArray(tpl.variables) && tpl.variables.length > 0
    ? tpl.variables
    : [];

  if (variables.length === 0) {
    const { data: fileBlob } = await supabase.storage
      .from("docx-templates")
      .download(tpl.storage_path);
    if (fileBlob) {
      const buf = Buffer.from(await fileBlob.arrayBuffer());
      variables = extractTemplateVariables(buf);
    }
  }

  const backgroundInfo = profileName ? `Name: ${profileName}` : "";
  const userPrompt = buildUserPrompt(variables, backgroundInfo, app.job_description, app.role);

  const templateContext = variables.length > 0
    ? `\n[Template Variables]\n${variables.join(", ")}\n`
    : "";

  const systemPrompt = await resolveSystemPrompt(templateId);
  const fullPrompt = [
    "========== SYSTEM PROMPT ==========",
    systemPrompt,
    "",
    "========== USER PROMPT ==========",
    templateContext,
    userPrompt,
  ].join("\n");

  return NextResponse.json({ systemPrompt, userPrompt, fullPrompt });
}
