import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  renderDocxTemplate,
  renderDocxTemplateStructured,
  isStructuredOutput,
  mapStructuredToFlat,
  type StructuredAIOutput,
} from "@/lib/docxTemplater";

export async function POST(request: NextRequest) {
  let templateId: string;
  let values: Record<string, unknown>;

  try {
    ({ templateId, values } = await request.json());
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  if (!templateId?.trim())
    return NextResponse.json({ message: "A DOCX template must be selected" }, { status: 400 });
  if (!values || typeof values !== "object" || Array.isArray(values))
    return NextResponse.json({ message: "values must be a JSON object" }, { status: 400 });

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
    return NextResponse.json({ message: "Failed to download template from storage" }, { status: 500 });

  let buffer: Buffer;
  try {
    const templateBuffer = Buffer.from(await fileBlob.arrayBuffer());
    if (isStructuredOutput(values)) {
      const structured = values as unknown as StructuredAIOutput;
      buffer = renderDocxTemplateStructured(templateBuffer, structured, mapStructuredToFlat(structured));
    } else {
      buffer = renderDocxTemplate(templateBuffer, values as Record<string, string>);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ message: msg }, { status: 500 });
  }

  const safeName = tpl.name.replace(/[^a-zA-Z0-9_\- ]/g, "").replace(/\s+/g, "_").slice(0, 60);
  const filename = `${safeName}.docx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Filename": filename,
    },
  });
}
