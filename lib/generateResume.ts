import OpenAI from "openai";
import { supabase } from "@/lib/supabase";
import {
  renderDocxTemplate,
  renderDocxTemplateStructured,
  extractTemplateVariables,
  isStructuredOutput,
  mapStructuredToFlat,
  type StructuredAIOutput,
} from "@/lib/docxTemplater";
import { isValidModel, DEFAULT_MODEL } from "@/lib/models";
import { resolveSystemPrompt } from "@/lib/promptResolution";
import { buildUserPrompt, extractJsonAnswer } from "@/lib/promptBuilder";


export interface GenerateOptions {
  promptContent?: string;
  contextContent?: string;
  modelId?: string;
  /** The application's own job-title field - an explicit, reliable signal for
   * `profile_title` generation instead of leaving the model to infer it from
   * the job description text alone. */
  role?: string | null;
}

export interface GenerateResult {
  buffer: Buffer;
  filename: string;
}

export async function generateFromTemplate(
  templateId: string,
  backgroundInfo: string,
  jobDescription: string,
  options: GenerateOptions = {}
): Promise<GenerateResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === "your_key_here") {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  // Fetch template metadata + file from Supabase
  const { data: tpl, error: tplError } = await supabase
    .from("docx_templates")
    .select("name, storage_path, variables")
    .eq("id", templateId)
    .single();

  if (tplError || !tpl) throw new Error(`Template not found: ${templateId}`);

  const { data: fileBlob, error: dlError } = await supabase.storage
    .from("docx-templates")
    .download(tpl.storage_path);

  if (dlError || !fileBlob) throw new Error("Failed to download DOCX template from storage");

  const templateBuffer = Buffer.from(await fileBlob.arrayBuffer());

  // Use stored variables, or re-extract if column is empty
  const variables: string[] =
    Array.isArray(tpl.variables) && tpl.variables.length > 0
      ? tpl.variables
      : extractTemplateVariables(templateBuffer);

  if (variables.length === 0) throw new Error("No <<variable>> placeholders found in template");

  const { promptContent, contextContent, modelId, role } = options;
  const systemPrompt = await resolveSystemPrompt(templateId, promptContent);
  const baseUserPrompt = buildUserPrompt(variables, backgroundInfo, jobDescription, role);
  const userPrompt = contextContent?.trim()
    ? `Additional context:\n${contextContent.trim()}\n\n${baseUserPrompt}`
    : baseUserPrompt;

  const model =
    (modelId && isValidModel(modelId) ? modelId : null) ??
    process.env.OPENAI_MODEL ??
    DEFAULT_MODEL;
  const isReasoningModel = /^o\d|thinking/i.test(model);
  const reasoningEffort = process.env.REASONING_EFFORT || "medium";

  const openai = new OpenAI({ apiKey });
  const messages: Parameters<typeof openai.chat.completions.create>[0]["messages"] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const response = await (isReasoningModel
    ? openai.chat.completions.create({
        model,
        messages,
        // @ts-expect-error reasoning_effort is valid on reasoning models
        reasoning_effort: reasoningEffort,
      })
    : openai.chat.completions.create({
        model,
        messages,
        response_format: { type: "json_object" },
      }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawText = (response as any).choices?.[0]?.message?.content ?? "";
  const aiValues = extractJsonAnswer(rawText);

  let buffer: Buffer;
  let nameForFile: string;

  if (isStructuredOutput(aiValues)) {
    const structured = aiValues as unknown as StructuredAIOutput;
    const flatData = mapStructuredToFlat(structured);
    buffer = renderDocxTemplateStructured(templateBuffer, structured, flatData);
    nameForFile = tpl.name;
  } else {
    const flatValues = aiValues as Record<string, string>;
    buffer = renderDocxTemplate(templateBuffer, flatValues);
    nameForFile = String(aiValues["name"] ?? tpl.name);
  }

  const safeName = nameForFile
    .replace(/[^a-zA-Z0-9_\- ]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 60);

  return { buffer, filename: `${safeName}_resume.docx` };
}
