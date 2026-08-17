import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireSession } from "@/lib/auth";
import {
  renderDocxTemplate,
  renderDocxTemplateStructured,
  isStructuredOutput,
  mapStructuredToFlat,
  type StructuredAIOutput,
} from "@/lib/docxTemplater";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  let templateId: string;
  let jsonData: Record<string, unknown>;
  try {
    ({ templateId, jsonData } = await request.json());
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  if (!templateId?.trim())
    return NextResponse.json({ message: "templateId is required" }, { status: 400 });
  if (!jsonData || typeof jsonData !== "object" || Array.isArray(jsonData))
    return NextResponse.json({ message: "jsonData must be an object" }, { status: 400 });

  const { data: app } = await supabase
    .from("applications")
    .select("id, seq, profile_id")
    .eq("id", id)
    .single();

  if (!app) return NextResponse.json({ message: "Application not found" }, { status: 404 });

  const { data: tpl, error: tplError } = await supabase
    .from("docx_templates")
    .select("name, storage_path")
    .eq("id", templateId)
    .single();

  if (tplError || !tpl)
    return NextResponse.json({ message: "Template not found" }, { status: 404 });

  const { data: fileBlob, error: dlError } = await supabase.storage
    .from("docx-templates")
    .download(tpl.storage_path);

  if (dlError || !fileBlob)
    return NextResponse.json({ message: "Failed to download template" }, { status: 500 });

  const templateBuffer = Buffer.from(await fileBlob.arrayBuffer());

  let buffer: Buffer;
  if (isStructuredOutput(jsonData)) {
    const flatData = mapStructuredToFlat(jsonData as unknown as StructuredAIOutput);
    buffer = renderDocxTemplateStructured(templateBuffer, jsonData as unknown as StructuredAIOutput, flatData);
  } else {
    buffer = renderDocxTemplate(templateBuffer, jsonData as Record<string, string>);
  }

  let profileName = "";
  if (app.profile_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", app.profile_id)
      .single();
    if (profile) profileName = profile.name ?? "";
  }

  const baseName = profileName
    ? profileName.replace(/[^a-zA-Z0-9]/g, "") + "Resume"
    : tpl.name.replace(/\s+/g, "_");
  const filename = app.seq ? `${baseName}_${app.seq}.docx` : `${baseName}.docx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Filename": filename,
    },
  });
}
