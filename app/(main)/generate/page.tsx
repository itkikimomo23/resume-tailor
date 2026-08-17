"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Loader2, Zap, MessageSquare, Layers, AlertCircle,
  FileText, Download, CheckCircle2, Tag,
} from "lucide-react";
import { Prompt, Context, DocxTemplate } from "@/lib/types";
import { MODELS, DEFAULT_MODEL } from "@/lib/models";
import { Button } from "@/components/ui/button";

export default function GeneratePage() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [contexts, setContexts] = useState<Context[]>([]);
  const [templates, setTemplates] = useState<DocxTemplate[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [templateId, setTemplateId] = useState("");
  const [promptId, setPromptId] = useState("");
  const [contextId, setContextId] = useState("");
  const [modelId, setModelId] = useState(DEFAULT_MODEL);
  const [backgroundInfo, setBackgroundInfo] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/prompts").then((r) => r.json()).catch(() => []),
      fetch("/api/contexts").then((r) => r.json()).catch(() => []),
      fetch("/api/docx-templates").then((r) => r.json()).catch(() => []),
    ]).then(([pr, ctx, tpls]) => {
      setPrompts(Array.isArray(pr) ? pr : []);
      setContexts(Array.isArray(ctx) ? ctx : []);
      setTemplates(Array.isArray(tpls) ? tpls : []);
    }).finally(() => setLoadingData(false));
  }, []);

  useEffect(() => {
    return () => { if (downloadUrl) URL.revokeObjectURL(downloadUrl); };
  }, [downloadUrl]);

  const selectedTemplate = templates.find((t) => t.id === templateId);

  const generate = async () => {
    if (!templateId) { setError("Please select a DOCX template."); return; }
    if (!jobDescription.trim()) { setError("Please paste a job description."); return; }

    setGenerating(true);
    setError(null);
    if (downloadUrl) { URL.revokeObjectURL(downloadUrl); setDownloadUrl(null); }

    const selectedPrompt = prompts.find((p) => p.id === promptId);
    const selectedContext = contexts.find((c) => c.id === contextId);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          backgroundInfo: backgroundInfo.trim(),
          jobDescription: jobDescription.trim(),
          promptContent: selectedPrompt?.content,
          contextContent: selectedContext?.content,
          modelId,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Generation failed" }));
        throw new Error(err.message || "Generation failed");
      }

      const blob = await res.blob();
      const filename = res.headers.get("X-Filename") || "resume.docx";
      setDownloadUrl(URL.createObjectURL(blob));
      setDownloadName(filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setGenerating(false);
    }
  };

  const triggerDownload = () => {
    if (!downloadUrl) return;
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = downloadName;
    a.click();
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-8 py-6 border-b border-border">
        <h1 className="text-lg font-semibold text-foreground">Generate Tailored Resume</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-3xl space-y-6">

          {/* Configuration */}
          <div className="section-card space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Configuration</h2>

            {loadingData ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 size={14} className="animate-spin" /> Loading…
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="field-label">Model</label>
                  <select className="field-input" value={modelId} onChange={(e) => setModelId(e.target.value)}>
                    {MODELS.map((m) => (
                      <option key={m.id} value={m.id}>{m.label} — {m.description}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="field-label">
                    DOCX Template <span className="text-destructive">*</span>
                  </label>
                  {templates.length === 0 ? (
                    <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 px-3 py-2 text-xs text-yellow-400">
                      No templates yet.{" "}
                      <Link href="/templates" className="underline hover:text-yellow-300">Upload one →</Link>
                    </div>
                  ) : (
                    <select className="field-input" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                      <option value="">Select template…</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="field-label">Prompt</label>
                  <select className="field-input" value={promptId} onChange={(e) => setPromptId(e.target.value)}>
                    <option value="">Default AI prompt</option>
                    {prompts.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="field-label">Context</label>
                  <select className="field-input" value={contextId} onChange={(e) => setContextId(e.target.value)}>
                    <option value="">None</option>
                    {contexts.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Active template variable list */}
            {selectedTemplate && selectedTemplate.variables?.length > 0 && (
              <div className="pt-1">
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Tag size={11} />
                  {selectedTemplate.variables.length} variables in this template — AI will fill all of them
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedTemplate.variables.map((v) => (
                    <code
                      key={v}
                      className="text-[11px] bg-muted/50 border border-border px-1.5 py-0.5 rounded text-muted-foreground font-mono"
                    >
                      {`<<${v}>>`}
                    </code>
                  ))}
                </div>
              </div>
            )}

            {/* Active selection badges */}
            {(templateId || promptId || contextId) && (
              <div className="flex flex-wrap gap-2 pt-1">
                {templateId && (
                  <span className="inline-flex items-center gap-1.5 bg-orange-500/15 border border-orange-500/30 rounded-full px-2.5 py-0.5 text-xs text-orange-400">
                    <FileText size={11} /> {templates.find((t) => t.id === templateId)?.name}
                  </span>
                )}
                {promptId && (
                  <span className="inline-flex items-center gap-1.5 bg-violet-500/15 border border-violet-500/30 rounded-full px-2.5 py-0.5 text-xs text-violet-400">
                    <MessageSquare size={11} /> {prompts.find((p) => p.id === promptId)?.name}
                  </span>
                )}
                {contextId && (
                  <span className="inline-flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 rounded-full px-2.5 py-0.5 text-xs text-emerald-400">
                    <Layers size={11} /> {contexts.find((c) => c.id === contextId)?.name}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Background info */}
          <div className="section-card space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Your Background</h2>
            <p className="text-xs text-muted-foreground">
              Paste your existing resume, LinkedIn bio, or a summary of your skills and experience.
              The AI uses this to fill template variables accurately.
            </p>
            <textarea
              className="field-textarea font-mono text-xs"
              rows={10}
              placeholder={"Paste your current resume or background info here…\n\nName, contact info, work history, skills, education — the more detail the better."}
              value={backgroundInfo}
              onChange={(e) => setBackgroundInfo(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {backgroundInfo.trim()
                ? `${backgroundInfo.trim().split(/\s+/).length} words`
                : "Optional but recommended for accurate output."}
            </p>
          </div>

          {/* Job Description */}
          <div className="section-card space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Job Description</h2>
            <textarea
              className="field-textarea font-mono text-xs"
              rows={12}
              placeholder={"Paste the full job description here…"}
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {jobDescription.trim()
                ? `${jobDescription.trim().split(/\s+/).length} words`
                : "Required — include the full posting for best results."}
            </p>
          </div>

          {/* Generate button */}
          <Button
            onClick={generate}
            disabled={generating || loadingData}
            className="w-full py-3 text-base h-auto"
          >
            {generating ? (
              <><Loader2 size={16} className="animate-spin" /> Generating resume…</>
            ) : (
              <><Zap size={16} /> Generate Tailored Resume</>
            )}
          </Button>

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive flex items-start gap-2">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Download result */}
          {downloadUrl && (
            <div className="section-card space-y-4">
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                <CheckCircle2 size={15} />
                Resume generated successfully!
              </div>
              <button onClick={triggerDownload} className="btn-primary w-full justify-center gap-2 py-3">
                <Download size={15} />
                Download {downloadName}
              </button>
              <button onClick={generate} disabled={generating} className="btn-ghost w-full justify-center text-sm">
                <Zap size={13} /> Regenerate
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
