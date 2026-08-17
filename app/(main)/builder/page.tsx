"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Loader2, Download, CheckCircle2, Tag, AlertCircle, Hammer, ShieldCheck,
} from "lucide-react";
import { DocxTemplate } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { getJsonCoveredVars } from "@/lib/docxTemplater";

// ─── Shared types ────────────────────────────────────────────────────────────

interface ValidationResult {
  jsonError: string | null;
  missingFields: string[];
  ok: boolean;
}

interface SectionState {
  templateId: string;
  jsonInput: string;
  building: boolean;
  error: string | null;
  downloadUrl: string | null;
  downloadName: string;
  validation: ValidationResult | null;
}

function initSection(): SectionState {
  return {
    templateId: "",
    jsonInput: "",
    building: false,
    error: null,
    downloadUrl: null,
    downloadName: "",
    validation: null,
  };
}

// ─── Cover letter state ───────────────────────────────────────────────────────

interface CoverLetterState {
  templateId: string;
  date: string;
  letter: string;
  building: boolean;
  error: string | null;
  downloadUrl: string | null;
  downloadName: string;
}

function initCoverLetter(): CoverLetterState {
  return {
    templateId: "",
    date: new Date().toISOString().slice(0, 10),
    letter: "",
    building: false,
    error: null,
    downloadUrl: null,
    downloadName: "",
  };
}

// ─── JSON helpers ─────────────────────────────────────────────────────────────

function parseJson(raw: string): { data: Record<string, unknown> | null; error: string | null } {
  const trimmed = raw.trim();
  if (!trimmed) return { data: null, error: null };
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed !== "object" || Array.isArray(parsed) || parsed === null)
      return { data: null, error: "Must be a JSON object { ... }" };
    return { data: parsed as Record<string, unknown>, error: null };
  } catch {
    return { data: null, error: "Invalid JSON" };
  }
}

// ─── Resume section ───────────────────────────────────────────────────────────

interface ResumeSectionProps {
  templates: DocxTemplate[];
  loadingData: boolean;
  state: SectionState;
  onChange: (patch: Partial<SectionState>) => void;
  onValidate: () => void;
  onBuild: () => void;
  onDownload: () => void;
}

function ResumeSection({ templates, loadingData, state, onChange, onValidate, onBuild, onDownload }: ResumeSectionProps) {
  const selectedTemplate = templates.find((t) => t.id === state.templateId);
  const { data: parsedValues, error: jsonError } = parseJson(state.jsonInput);
  const jsonSyntaxValid = state.jsonInput.trim() === "" || (jsonError === null && parsedValues !== null);
  const validatedKeys = parsedValues ? getJsonCoveredVars(parsedValues) : null;

  return (
    <div className="section-card space-y-4 flex flex-col">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Resume</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Fill resume template variables with your JSON values.</p>
      </div>

      <div>
        <label className="field-label">DOCX Template <span className="text-destructive">*</span></label>
        {loadingData ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <Loader2 size={12} className="animate-spin" /> Loading…
          </div>
        ) : templates.length === 0 ? (
          <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 px-3 py-2 text-xs text-yellow-400">
            No resume templates yet.{" "}
            <Link href="/templates" className="underline hover:text-yellow-300">Upload one →</Link>
          </div>
        ) : (
          <select
            className="field-input"
            value={state.templateId}
            onChange={(e) => onChange({ templateId: e.target.value, downloadUrl: null, validation: null })}
          >
            <option value="">Select template…</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
      </div>

      {selectedTemplate && selectedTemplate.variables?.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
            <Tag size={11} /> {selectedTemplate.variables.length} variables — add these keys to your JSON
          </p>
          <div className="flex flex-wrap gap-1.5">
            {selectedTemplate.variables.map((v) => {
              const validated = state.validation !== null && validatedKeys !== null;
              const present = validatedKeys?.has(v);
              return (
                <code
                  key={v}
                  title="Click to copy"
                  onClick={() => navigator.clipboard.writeText(`"${v}": ""`).catch(() => {})}
                  className={`text-[11px] px-1.5 py-0.5 rounded font-mono cursor-pointer transition-colors border ${
                    validated && present
                      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                      : validated && !present
                      ? "bg-destructive/15 border-destructive/40 text-destructive"
                      : "bg-muted/50 border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {v}
                </code>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex-1">
        <label className="field-label flex items-center justify-between">
          <span>Values (JSON) <span className="text-destructive">*</span></span>
          {state.jsonInput.trim() && (
            <span className={`text-[11px] font-mono ${jsonSyntaxValid ? "text-emerald-400" : "text-destructive"}`}>
              {jsonSyntaxValid ? "✓ valid JSON" : jsonError}
            </span>
          )}
        </label>
        <textarea
          className={`field-textarea font-mono text-xs transition-colors ${
            state.jsonInput.trim() && !jsonSyntaxValid ? "border-destructive/60 focus:border-destructive" : ""
          }`}
          rows={12}
          placeholder={'{\n  "profile_title": "Senior Engineer | Python • AWS",\n  "profile_summary": "…",\n  "skills": [{ "category": "Backend", "items": ["Python", "FastAPI"] }],\n  "experience": [{ "role_title": "Senior Engineer", "bullet_points": ["Built…"], "bold_words": ["Python"] }]\n}'}
          value={state.jsonInput}
          onChange={(e) => onChange({ jsonInput: e.target.value, error: null, downloadUrl: null, validation: null })}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            try {
              const parsed = JSON.parse(text);
              e.preventDefault();
              onChange({ jsonInput: JSON.stringify(parsed, null, 2), error: null, downloadUrl: null, validation: null });
            } catch {
              // not valid JSON — let default paste happen
            }
          }}
        />
      </div>

      <Button variant="outline" onClick={onValidate} disabled={!state.templateId || !state.jsonInput.trim()} className="w-full">
        <ShieldCheck size={14} /> Validate
      </Button>

      {state.validation && (
        state.validation.jsonError ? (
          <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2.5 text-sm text-destructive flex items-start gap-2">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>Invalid JSON: {state.validation.jsonError}</span>
          </div>
        ) : state.validation.missingFields.length > 0 ? (
          <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 px-3 py-2.5 space-y-1.5">
            <p className="text-xs text-yellow-400 font-medium flex items-center gap-1.5">
              <AlertCircle size={13} />
              {state.validation.missingFields.length} missing field{state.validation.missingFields.length > 1 ? "s" : ""}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {state.validation.missingFields.map((f) => (
                <code key={f} className="text-[11px] bg-yellow-500/10 border border-yellow-500/30 px-1.5 py-0.5 rounded text-yellow-400 font-mono">{f}</code>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2.5 text-sm text-emerald-400 flex items-center gap-2">
            <CheckCircle2 size={14} /> All fields present — ready to build
          </div>
        )
      )}

      <Button onClick={onBuild} disabled={state.building || loadingData || !state.templateId || !jsonSyntaxValid || !parsedValues} className="w-full">
        {state.building ? <><Loader2 size={14} className="animate-spin" /> Building…</> : <><Hammer size={14} /> Build Resume</>}
      </Button>

      {state.error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2.5 text-sm text-destructive flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 shrink-0" /><span>{state.error}</span>
        </div>
      )}

      {state.downloadUrl && (
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 space-y-2.5">
          <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
            <CheckCircle2 size={14} /> Built successfully!
          </div>
          <button onClick={onDownload} className="btn-primary w-full justify-center gap-2 py-2 text-sm">
            <Download size={14} /> Download {state.downloadName}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Cover letter section ─────────────────────────────────────────────────────

interface CoverLetterSectionProps {
  templates: DocxTemplate[];
  loadingData: boolean;
  state: CoverLetterState;
  onChange: (patch: Partial<CoverLetterState>) => void;
  onBuild: () => void;
  onDownload: () => void;
}

function CoverLetterSection({ templates, loadingData, state, onChange, onBuild, onDownload }: CoverLetterSectionProps) {
  const formattedDate = state.date
    ? new Date(state.date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "";

  return (
    <div className="section-card space-y-4 flex flex-col">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Cover Letter</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Fill cover letter template with a date and letter body.</p>
      </div>

      <div>
        <label className="field-label">DOCX Template <span className="text-destructive">*</span></label>
        {loadingData ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <Loader2 size={12} className="animate-spin" /> Loading…
          </div>
        ) : templates.length === 0 ? (
          <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 px-3 py-2 text-xs text-yellow-400">
            No cover letter templates yet.{" "}
            <Link href="/templates" className="underline hover:text-yellow-300">Upload one →</Link>
          </div>
        ) : (
          <select
            className="field-input"
            value={state.templateId}
            onChange={(e) => onChange({ templateId: e.target.value, downloadUrl: null })}
          >
            <option value="">Select template…</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
      </div>

      <div>
        <label className="field-label">Date <span className="text-destructive">*</span></label>
        <input
          type="date"
          className="field-input"
          value={state.date}
          onChange={(e) => onChange({ date: e.target.value, downloadUrl: null })}
        />
        {formattedDate && (
          <p className="text-[11px] text-muted-foreground mt-1">→ will render as <span className="text-foreground">{formattedDate}</span></p>
        )}
      </div>

      <div className="flex-1">
        <label className="field-label">Letter Body <span className="text-destructive">*</span></label>
        <textarea
          className="field-textarea text-sm"
          rows={14}
          placeholder={"Dear Hiring Manager,\n\nI am excited to apply for…\n\nSincerely,\nYour Name"}
          value={state.letter}
          onChange={(e) => onChange({ letter: e.target.value, error: null, downloadUrl: null })}
        />
        <p className="text-[11px] text-muted-foreground mt-1">
          {state.letter.trim()
            ? `${state.letter.trim().split(/\s+/).length} words`
            : "Write your full cover letter here."}
        </p>
      </div>

      <Button
        onClick={onBuild}
        disabled={state.building || loadingData || !state.templateId || !state.date || !state.letter.trim()}
        className="w-full"
      >
        {state.building ? <><Loader2 size={14} className="animate-spin" /> Building…</> : <><Hammer size={14} /> Build Cover Letter</>}
      </Button>

      {state.error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2.5 text-sm text-destructive flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 shrink-0" /><span>{state.error}</span>
        </div>
      )}

      {state.downloadUrl && (
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 space-y-2.5">
          <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
            <CheckCircle2 size={14} /> Built successfully!
          </div>
          <button onClick={onDownload} className="btn-primary w-full justify-center gap-2 py-2 text-sm">
            <Download size={14} /> Download {state.downloadName}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BuilderPage() {
  const [allTemplates, setAllTemplates] = useState<DocxTemplate[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [resume, setResume] = useState<SectionState>(initSection);
  const [coverLetter, setCoverLetter] = useState<CoverLetterState>(initCoverLetter);

  useEffect(() => {
    fetch("/api/docx-templates")
      .then((r) => r.json())
      .then((data) => setAllTemplates(Array.isArray(data) ? data : []))
      .catch(() => setAllTemplates([]))
      .finally(() => setLoadingData(false));
  }, []);

  useEffect(() => {
    return () => {
      if (resume.downloadUrl) URL.revokeObjectURL(resume.downloadUrl);
      if (coverLetter.downloadUrl) URL.revokeObjectURL(coverLetter.downloadUrl);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resumeTemplates = allTemplates.filter((t) => t.template_type === "resume");
  const coverLetterTemplates = allTemplates.filter((t) => t.template_type === "cover_letter");

  const validate = useCallback(
    (state: SectionState, setState: (patch: Partial<SectionState>) => void) => {
      const { data: values, error: jsonError } = parseJson(state.jsonInput);
      if (jsonError || !values) {
        setState({ validation: { jsonError: jsonError ?? "Invalid JSON", missingFields: [], ok: false } });
        return;
      }
      const template = resumeTemplates.find((t) => t.id === state.templateId);
      const vars = template?.variables ?? [];
      const covered = getJsonCoveredVars(values);
      const missingFields = vars.filter((v) => !covered.has(v));
      setState({ validation: { jsonError: null, missingFields, ok: missingFields.length === 0 } });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allTemplates]
  );

  const buildResume = useCallback(async () => {
    const { data: values } = parseJson(resume.jsonInput);
    if (!values) return;
    if (resume.downloadUrl) URL.revokeObjectURL(resume.downloadUrl);
    setResume((s) => ({ ...s, building: true, error: null, downloadUrl: null }));
    try {
      const res = await fetch("/api/builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: resume.templateId, values: values }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Build failed");
      const blob = await res.blob();
      const filename = res.headers.get("X-Filename") || "resume.docx";
      setResume((s) => ({ ...s, downloadUrl: URL.createObjectURL(blob), downloadName: filename }));
    } catch (err) {
      setResume((s) => ({ ...s, error: err instanceof Error ? err.message : "Unknown error" }));
    } finally {
      setResume((s) => ({ ...s, building: false }));
    }
  }, [resume]);

  const buildCoverLetter = useCallback(async () => {
    if (coverLetter.downloadUrl) URL.revokeObjectURL(coverLetter.downloadUrl);
    setCoverLetter((s) => ({ ...s, building: true, error: null, downloadUrl: null }));

    const formattedDate = coverLetter.date
      ? new Date(coverLetter.date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : coverLetter.date;

    try {
      const res = await fetch("/api/builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: coverLetter.templateId,
          values: { date: formattedDate, letter: coverLetter.letter },
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Build failed");
      const blob = await res.blob();
      const filename = res.headers.get("X-Filename") || "cover_letter.docx";
      setCoverLetter((s) => ({ ...s, downloadUrl: URL.createObjectURL(blob), downloadName: filename }));
    } catch (err) {
      setCoverLetter((s) => ({ ...s, error: err instanceof Error ? err.message : "Unknown error" }));
    } finally {
      setCoverLetter((s) => ({ ...s, building: false }));
    }
  }, [coverLetter]);

  const triggerDownload = (url: string, name: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
  };

  const patchResume = (patch: Partial<SectionState>) => setResume((s) => ({ ...s, ...patch }));

  return (
    <div className="h-full flex flex-col">
      <div className="px-8 py-6 border-b border-border">
        <h1 className="text-lg font-semibold text-foreground">Resume Builder</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl">
          <ResumeSection
            templates={resumeTemplates}
            loadingData={loadingData}
            state={resume}
            onChange={patchResume}
            onValidate={() => validate(resume, patchResume)}
            onBuild={buildResume}
            onDownload={() => resume.downloadUrl && triggerDownload(resume.downloadUrl, resume.downloadName)}
          />
          <CoverLetterSection
            templates={coverLetterTemplates}
            loadingData={loadingData}
            state={coverLetter}
            onChange={(patch) => setCoverLetter((s) => ({ ...s, ...patch }))}
            onBuild={buildCoverLetter}
            onDownload={() => coverLetter.downloadUrl && triggerDownload(coverLetter.downloadUrl, coverLetter.downloadName)}
          />
        </div>
      </div>
    </div>
  );
}
