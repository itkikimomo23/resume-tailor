/** Sanitize a name fragment for use in a download/Drive filename. */
export function sanitizeFilenamePart(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .slice(0, 60);
}

/**
 * Application resume base name: profile name + number + company name.
 * Example: JohnDoe_42_AcmeCorp
 */
export function applicationResumeBaseName(
  profileName: string | null | undefined,
  seq: number | null | undefined,
  companyName: string | null | undefined
): string {
  const profile = sanitizeFilenamePart(profileName) || "Resume";
  const number = seq != null && Number.isFinite(Number(seq)) ? String(seq) : "";
  const company = sanitizeFilenamePart(companyName);
  return [profile, number, company].filter(Boolean).join("_");
}

export function applicationDocxFilename(
  profileName: string | null | undefined,
  seq: number | null | undefined,
  companyName: string | null | undefined
): string {
  return `${applicationResumeBaseName(profileName, seq, companyName)}.docx`;
}

export function attachmentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
