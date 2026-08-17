import { supabase } from "@/lib/supabase";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/defaultSystemPrompt";

/**
 * Resolves the system prompt for a resume-generation call: explicit override
 * (if given) -> the template's assigned prompt -> the DB default prompt ->
 * the hardcoded constant as an absolute last resort. Never throws - any DB
 * hiccup at a tier just falls through to the next one.
 */
export async function resolveSystemPrompt(
  templateId?: string | null,
  explicitPromptContent?: string | null
): Promise<string> {
  const explicit = explicitPromptContent?.trim();
  if (explicit) return explicit;

  if (templateId) {
    const { data: tpl } = await supabase
      .from("docx_templates")
      .select("prompt_id")
      .eq("id", templateId)
      .maybeSingle();
    if (tpl?.prompt_id) {
      const { data: prompt } = await supabase
        .from("prompts")
        .select("content")
        .eq("id", tpl.prompt_id)
        .maybeSingle();
      const content = prompt?.content?.trim();
      if (content) return content;
    }
  }

  const { data: defaultPrompt } = await supabase
    .from("prompts")
    .select("content")
    .eq("is_default", true)
    .maybeSingle();
  const dbDefault = defaultPrompt?.content?.trim();
  if (dbDefault) return dbDefault;

  return DEFAULT_SYSTEM_PROMPT;
}
