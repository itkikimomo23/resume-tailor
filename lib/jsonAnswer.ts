/**
 * Shared JSON extraction used by every path that turns pasted / LLM text into
 * a docx payload (batch-builder Build, builder page, OpenAI generate, AutoGen).
 *
 * ChatGPT (and some clipboard UIs) inject a "Pasted text" label — as a wrapper
 * around the whole paste, or mid-sentence inside field values. That label must
 * never reach the docx renderer.
 */

const PASTED_TEXT_PHRASE = /\bpasted\s+text\b/gi;
const PASTED_TEXT_LINE = /^\s*pasted\s+text\s*$/i;
const PASTED_TEXT_PREFIX = /^\s*pasted\s+text\s*[\r\n]+/i;
const FENCE_OPEN = /^\s*```(?:json|JSON)?\s*\r?\n?/;
const FENCE_CLOSE = /\r?\n?\s*```\s*$/;

/**
 * Repairs the most common way LLMs break JSON: writing a literal `"` inside a
 * string value instead of escaping it.
 */
function repairUnescapedQuotes(text: string): string {
  let out = "";
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\\" && inString) {
      out += ch + (text[i + 1] ?? "");
      i++;
      continue;
    }
    if (ch === '"') {
      if (!inString) {
        inString = true;
        out += ch;
        continue;
      }
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      const next = text[j];
      const closesString = next === undefined || ",}]:".includes(next);
      if (closesString) {
        inString = false;
        out += ch;
      } else {
        out += '\\"';
      }
      continue;
    }
    out += ch;
  }
  return out;
}

/** Strip ChatGPT "Pasted text" labels and markdown code fences from raw text. */
export function stripJsonNoise(text: string): string {
  let s = String(text ?? "").trim();

  // Leading "Pasted text" line(s) — ChatGPT paste attachment / clipboard label
  while (PASTED_TEXT_PREFIX.test(s) || PASTED_TEXT_LINE.test(s.split(/\r?\n/, 1)[0] ?? "")) {
    if (PASTED_TEXT_PREFIX.test(s)) {
      s = s.replace(PASTED_TEXT_PREFIX, "").trim();
      continue;
    }
    const nl = s.search(/\r?\n/);
    if (nl === -1) {
      s = "";
      break;
    }
    s = s.slice(nl).replace(/^\r?\n/, "").trim();
  }

  // ```json ... ``` fences (outermost)
  if (FENCE_OPEN.test(s)) {
    s = s.replace(FENCE_OPEN, "");
    s = s.replace(FENCE_CLOSE, "");
    s = s.trim();
  }

  return s;
}

/**
 * Remove every "Pasted text" occurrence from a string value and tidy whitespace /
 * punctuation left behind (e.g. "direction, Pasted text design" → "direction, design").
 */
export function scrubPastedTextInValue(value: string): string {
  if (!value) return value;
  if (!PASTED_TEXT_PHRASE.test(value)) return value;
  // Reset lastIndex after test() on a global regex
  PASTED_TEXT_PHRASE.lastIndex = 0;

  let s = value.replace(PASTED_TEXT_PHRASE, " ");
  // Collapse whitespace (spaces / tabs; keep intentional newlines as paragraph breaks)
  s = s
    .replace(/[^\S\r\n]{2,}/g, " ")
    .replace(/[^\S\r\n]*\n[^\S\r\n]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
  // Fix punctuation left dangling after removal: "foo , bar" / "foo  ,bar" / " , bar"
  s = s
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,.;:!?])\s*([,.;:!?])/g, "$1")
    .replace(/^\s+/, "")
    .replace(/\s+$/, "");
  return s;
}

export function scrubPastedTextInJson(value: unknown): unknown {
  if (typeof value === "string") return scrubPastedTextInValue(value);
  if (Array.isArray(value)) {
    return value
      .map(scrubPastedTextInJson)
      .filter((item) => {
        // Drop array entries that were only the paste label (e.g. bold_words)
        if (typeof item === "string" && PASTED_TEXT_LINE.test(item.trim())) return false;
        if (typeof item === "string" && item.trim() === "") return false;
        return true;
      });
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = scrubPastedTextInJson(v);
    }
    return out;
  }
  return value;
}

/**
 * Tolerantly extracts a JSON object from pasted text or an LLM reply.
 * Strips "Pasted text" wrappers, markdown fences, surrounding prose, and
 * repairs stray unescaped quotes. Also scrubs "Pasted text" from string values.
 */
export function extractJsonAnswer(text: string): Record<string, unknown> {
  const cleaned = stripJsonNoise(text);
  let parsed: unknown;

  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end <= start) {
      throw new Error("Could not parse JSON from model response");
    }
    const candidate = cleaned.slice(start, end + 1);
    try {
      parsed = JSON.parse(candidate);
    } catch {
      parsed = JSON.parse(repairUnescapedQuotes(candidate));
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("JSON must be an object { ... }");
  }

  return scrubPastedTextInJson(parsed) as Record<string, unknown>;
}
