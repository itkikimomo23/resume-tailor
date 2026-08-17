import { NextRequest, NextResponse } from "next/server";
import { generateFromTemplate } from "@/lib/generateResume";

export async function POST(request: NextRequest) {
  let templateId: string;
  let backgroundInfo: string;
  let jobDescription: string;
  let promptContent: string | undefined;
  let contextContent: string | undefined;
  let modelId: string | undefined;

  try {
    ({ templateId, backgroundInfo, jobDescription, promptContent, contextContent, modelId } =
      await request.json());
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  if (!templateId?.trim())
    return NextResponse.json({ message: "A DOCX template must be selected" }, { status: 400 });
  if (!jobDescription?.trim())
    return NextResponse.json({ message: "Job description is required" }, { status: 400 });

  let buffer: Buffer;
  let filename: string;

  try {
    ({ buffer, filename } = await generateFromTemplate(
      templateId,
      backgroundInfo ?? "",
      jobDescription,
      { promptContent, contextContent, modelId }
    ));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.includes("OPENAI_API_KEY") ? 500 : 500;
    return NextResponse.json({ message: msg }, { status });
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Filename": filename,
    },
  });
}
