"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Loader2, Download, Check, Copy, Zap, Code2,
  ChevronLeft, ChevronRight, PackageCheck, AlertTriangle,
  RefreshCw, Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DocxTemplate } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Application {
  id: string;
  seq: number;
  role: string;
  company_name: string;
  job_board: string | null;
  profile_id: string | null;
  profile_name: string | null;
  template_id: string | null;
  status: string;
  pipeline_status: string;
  created_at: string;
}

interface Profile { id: string; name: string; }

type CardPhase =
  | "idle"
  | "generating"
  | "building"
  | "ready"
  | "copying"
  | "uploading"
  | "done"
  | "error";

interface CardState {
  phase: CardPhase;
  file: { data: ArrayBuffer; filename: string } | null;
  error: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PAGE_SIZE = 8;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}


// ── Application Card ──────────────────────────────────────────────────────────

function AppCard({
  app,
  templates,
  profiles,
  state,
  onGenerate,
  onBuildJson,
  onCopyPrompt,
  onDownload,
  onComplete,
}: {
  app: Application;
  templates: DocxTemplate[];
  profiles: Profile[];
  state: CardState;
  onGenerate: (templateId: string) => void;
  onBuildJson: (json: string, templateId: string) => void;
  onCopyPrompt: (templateId: string) => void;
  onDownload: () => void;
  onComplete: (profileId: string) => void;
}) {
  const [jsonInput, setJsonInput] = useState("");
  const [jsonInputError, setJsonInputError] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState(app.template_id ?? "");
  const [selectedProfileId, setSelectedProfileId] = useState(app.profile_id ?? "");
  const [copied, setCopied] = useState(false);

  const effectiveProfileId = app.profile_id ?? selectedProfileId;
  const profileTemplates = templates.filter(
    t => t.template_type === "resume" && t.profile_id === app.profile_id
  );

  const handleCopyPrompt = async () => {
    await onCopyPrompt(templateId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const { phase, error } = state;
  const busy = phase === "generating" || phase === "building" || phase === "uploading" || phase === "copying";

  if (phase === "done") {
    return (
      <div className="h-full bg-card rounded-xl ring-1 ring-green-500/30 p-4 flex flex-col items-center justify-center gap-2 text-center">
        <div className="size-10 rounded-full bg-green-500/10 flex items-center justify-center">
          <Check size={20} className="text-green-500" />
        </div>
        <p className="text-sm font-medium text-foreground">{app.company_name}</p>
        <p className="text-xs text-muted-foreground">Uploaded to Drive</p>
      </div>
    );
  }

  return (
    <div className={`h-full bg-card rounded-xl ring-1 p-4 flex flex-col gap-3 ${error ? "ring-destructive/30" : "ring-foreground/10"}`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-muted-foreground tabular-nums">#{app.seq}</span>
              <span className="font-semibold text-foreground text-sm truncate">{app.company_name}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate" title={app.role}>{app.role}</p>
            {app.profile_name && (
              <p className="text-[11px] text-muted-foreground/60 truncate">{app.profile_name}</p>
            )}
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1">
            <Badge variant="secondary" className="capitalize text-[10px] gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              pending
            </Badge>
            <span className="text-[10px] text-muted-foreground">{formatDate(app.created_at)}</span>
          </div>
        </div>

        {/* Template selector — filtered to this card's profile */}
        {profileTemplates.length === 0 ? (
          <p className="text-[11px] text-muted-foreground/60 px-0.5">
            No templates assigned to this profile
          </p>
        ) : (
          <Select value={templateId || "_none"} onValueChange={v => setTemplateId(v === "_none" ? "" : (v ?? ""))}>
            <SelectTrigger className="h-7 text-xs w-full">
              <span className="truncate">
                {templateId
                  ? (profileTemplates.find(t => t.id === templateId)?.name ?? "Select template…")
                  : "Select template…"}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none" className="text-xs text-muted-foreground">Select template…</SelectItem>
              {profileTemplates.map(t => <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {/* Profile override (if app has no profile) */}
        {!app.profile_id && profiles.length > 0 && (
          <Select value={selectedProfileId || "_none"} onValueChange={v => setSelectedProfileId(v === "_none" ? "" : (v ?? ""))}>
            <SelectTrigger className="h-7 text-xs w-full">
              <SelectValue placeholder="Select profile for filename…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none" className="text-xs text-muted-foreground">No profile</SelectItem>
              {profiles.map(p => <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {/* Always-visible JSON textarea */}
        {phase !== "ready" && (
          <div className="flex flex-col gap-1.5 flex-1 min-h-0">
            <textarea
              className="w-full flex-1 min-h-0 field-input font-mono text-xs px-2.5 py-2 resize-none rounded-lg"
              placeholder={'{\n  "profile_title": "...",\n  "profile_summary": "...",\n  "skills": [...],\n  "experience": [...]\n}'}
              value={jsonInput}
              onChange={e => { setJsonInput(e.target.value); setJsonInputError(null); }}
              disabled={busy}
              spellCheck={false}
            />
            {jsonInputError && (
              <p className="text-[11px] text-destructive flex items-center gap-1 shrink-0">
                <AlertTriangle size={11} />{jsonInputError}
              </p>
            )}
          </div>
        )}

        {/* Status feedback */}
        {phase === "generating" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 size={12} className="animate-spin" />Generating with AI…
          </div>
        )}
        {phase === "building" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 size={12} className="animate-spin" />Building from JSON…
          </div>
        )}
        {phase === "copying" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 size={12} className="animate-spin" />Copying prompt…
          </div>
        )}
        {phase === "uploading" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 size={12} className="animate-spin" />Uploading to Drive…
          </div>
        )}
        {phase === "ready" && state.file && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-green-500/10 text-xs text-green-600 dark:text-green-400">
            <Check size={11} />
            <span className="font-mono truncate">{state.file.filename}</span>
          </div>
        )}
        {error && (
          <p className="text-xs text-destructive flex items-start gap-1.5">
            <AlertTriangle size={12} className="shrink-0 mt-0.5" />{error}
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-1.5 mt-auto pt-1 border-t border-border">
          {(phase === "idle" || phase === "error" || phase === "building" || phase === "generating" || phase === "copying") && (
            <>
              <button
                onClick={() => onGenerate(templateId)}
                disabled={!templateId || busy}
                title={!templateId ? "Select a template first" : "Generate with AI"}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/80 transition-all disabled:opacity-40 disabled:pointer-events-none"
              >
                <Zap size={11} />AI
              </button>
              <button
                onClick={() => {
                  if (!templateId) return;
                  try {
                    JSON.parse(jsonInput.trim());
                    setJsonInputError(null);
                    onBuildJson(jsonInput.trim(), templateId);
                  } catch (e) {
                    setJsonInputError(e instanceof Error ? e.message : "Invalid JSON");
                  }
                }}
                disabled={!templateId || !jsonInput.trim() || busy}
                title={!templateId ? "Select a template first" : !jsonInput.trim() ? "Paste JSON above first" : "Build from JSON"}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-input bg-transparent text-muted-foreground hover:text-foreground hover:bg-accent text-xs font-medium transition-all disabled:opacity-40 disabled:pointer-events-none"
              >
                <Code2 size={11} />Build
              </button>
              <button
                onClick={handleCopyPrompt}
                disabled={!templateId || busy}
                title={!templateId ? "Select a template first" : "Copy full prompt"}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-input bg-transparent text-muted-foreground hover:text-foreground hover:bg-accent text-xs font-medium transition-all disabled:opacity-40 disabled:pointer-events-none"
              >
                {copied ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
                {copied ? "Copied!" : "Prompt"}
              </button>
            </>
          )}

          {phase === "ready" && (
            <>
              <button
                onClick={onDownload}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/80 transition-all"
              >
                <Download size={11} />Download
              </button>
              <button
                onClick={() => onComplete(effectiveProfileId)}
                disabled={!effectiveProfileId}
                title={!effectiveProfileId ? "Select a profile for filename" : "Upload to Google Drive and mark complete"}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-green-500/50 text-green-600 dark:text-green-400 bg-green-500/10 hover:bg-green-500/20 text-xs font-medium transition-all disabled:opacity-40 disabled:pointer-events-none"
              >
                <Upload size={11} />Complete
              </button>
              <button
                onClick={handleCopyPrompt}
                disabled={!templateId || busy}
                title="Copy full prompt"
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-input bg-transparent text-muted-foreground hover:text-foreground hover:bg-accent text-xs font-medium transition-all disabled:opacity-40 disabled:pointer-events-none"
              >
                {copied ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
                Prompt
              </button>
              <button
                onClick={() => onGenerate(templateId)}
                disabled={!templateId}
                title="Regenerate with AI"
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-input bg-transparent text-muted-foreground hover:text-foreground hover:bg-accent text-xs font-medium transition-all disabled:opacity-40 disabled:pointer-events-none"
              >
                <RefreshCw size={11} />Regen
              </button>
            </>
          )}
        </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BatchBuilderPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [total, setTotal]               = useState(0);
  const [loading, setLoading]           = useState(true);
  const [page, setPage]                 = useState(1);
  const [refreshKey, setRefreshKey]     = useState(0);

  const [templates, setTemplates] = useState<DocxTemplate[]>([]);
  const [profiles, setProfiles]   = useState<Profile[]>([]);

  const [cardStates, setCardStates] = useState<Record<string, CardState>>({});
  const fileBuffers = useRef<Record<string, { data: ArrayBuffer; filename: string }>>({});

  // Init/meta fetch
  useEffect(() => {
    Promise.all([
      fetch("/api/docx-templates").then(r => r.ok ? r.json() : []),
      fetch("/api/profiles").then(r => r.ok ? r.json() : []),
    ]).then(([tpls, profs]) => {
      setTemplates(Array.isArray(tpls) ? tpls : []);
      setProfiles(Array.isArray(profs) ? profs : []);
    });
  }, []);

  // Fetch pending apps
  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), status: "pending" });
    fetch(`/api/applications?${p}`)
      .then(r => r.ok ? r.json() : null)
      .then(result => {
        if (!result) return;
        setApplications(result.data);
        setTotal(result.total);
      })
      .finally(() => setLoading(false));
  }, [page, refreshKey]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const setCardPhase = useCallback((id: string, phase: CardPhase, extra?: Partial<Omit<CardState, "phase">>) => {
    setCardStates(prev => ({ ...prev, [id]: { phase, file: prev[id]?.file ?? null, error: null, ...extra } }));
  }, []);

  const getCard = (id: string): CardState =>
    cardStates[id] ?? { phase: "idle", file: null, error: null };

  const handleGenerate = async (app: Application, templateId: string) => {
    if (!templateId) return;
    setCardPhase(app.id, "generating");
    try {
      const res = await fetch(`/api/batch-builder/${app.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setCardPhase(app.id, "error", { error: data.message ?? "Generation failed" });
        return;
      }
      const filename = res.headers.get("X-Filename") ?? "resume.docx";
      const buffer = await res.arrayBuffer();
      fileBuffers.current[app.id] = { data: buffer, filename };
      setCardPhase(app.id, "ready", { file: { data: buffer, filename } });
    } catch (e) {
      setCardPhase(app.id, "error", { error: e instanceof Error ? e.message : "Network error" });
    }
  };

  const handleBuildJson = async (app: Application, jsonStr: string, templateId: string) => {
    if (!templateId) return;
    setCardPhase(app.id, "building");
    try {
      const jsonData = JSON.parse(jsonStr);
      const res = await fetch(`/api/batch-builder/${app.id}/generate-from-json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, jsonData }),
      });
      if (!res.ok) {
        const data = await res.json();
        setCardPhase(app.id, "error", { error: data.message ?? "Build failed" });
        return;
      }
      const filename = res.headers.get("X-Filename") ?? "resume.docx";
      const buffer = await res.arrayBuffer();
      fileBuffers.current[app.id] = { data: buffer, filename };
      setCardPhase(app.id, "ready", { file: { data: buffer, filename } });
    } catch (e) {
      setCardPhase(app.id, "error", { error: e instanceof Error ? e.message : "Build error" });
    }
  };

  const handleCopyPrompt = async (app: Application, templateId: string) => {
    if (!templateId) return;
    setCardPhase(app.id, "copying");
    try {
      const res = await fetch(`/api/batch-builder/${app.id}/prompt?templateId=${templateId}`);
      if (!res.ok) {
        const data = await res.json();
        const hasFile = !!fileBuffers.current[app.id];
        setCardPhase(app.id, hasFile ? "ready" : "error", { error: data.message ?? "Failed to get prompt" });
        return;
      }
      const { fullPrompt } = await res.json();
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(fullPrompt);
      } else {
        const ta = document.createElement("textarea");
        ta.value = fullPrompt;
        ta.style.cssText = "position:fixed;opacity:0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      const hasFile = !!fileBuffers.current[app.id];
      setCardPhase(app.id, hasFile ? "ready" : "idle");
    } catch (e) {
      const hasFile = !!fileBuffers.current[app.id];
      setCardPhase(app.id, hasFile ? "ready" : "error", {
        error: e instanceof Error ? e.message : "Copy failed",
      });
    }
  };

  const handleDownload = (app: Application) => {
    const f = fileBuffers.current[app.id];
    if (!f) return;
    const blob = new Blob([f.data], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = f.filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const handleComplete = async (app: Application, profileId: string) => {
    const f = fileBuffers.current[app.id];
    if (!f || !profileId) return;
    setCardPhase(app.id, "uploading");
    try {
      const formData = new FormData();
      const blob = new Blob([f.data], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
      formData.append("file", blob, f.filename);
      formData.append("profileId", profileId);
      const res = await fetch(`/api/applications/${app.id}/upload`, { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json();
        setCardPhase(app.id, "error", { error: data.message ?? "Upload failed" });
        return;
      }
      delete fileBuffers.current[app.id];
      setCardPhase(app.id, "done");
      // Remove from list after brief animation
      setTimeout(() => {
        setApplications(prev => prev.filter(a => a.id !== app.id));
        setTotal(t => t - 1);
      }, 1200);
    } catch (e) {
      setCardPhase(app.id, "error", { error: e instanceof Error ? e.message : "Upload failed" });
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-border flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <PackageCheck size={18} className="text-primary shrink-0" />
            <h1 className="text-base sm:text-lg font-semibold text-foreground">Batch Builder</h1>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setRefreshKey(k => k + 1)}>
          <RefreshCw size={13} /><span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col px-4 sm:px-8 py-4 sm:py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
            <Loader2 size={20} className="animate-spin mr-2" />Loading…
          </div>
        ) : total === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-3">
            <PackageCheck size={40} className="text-muted-foreground/30" />
            <p className="text-sm">No pending applications</p>
            <p className="text-xs text-muted-foreground/60 text-center px-4">
              Select applications on the Applications page and set their status to <strong>Pending</strong> to queue them here.
              Or submit a new application from the Chrome extension with batch mode enabled.
            </p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col gap-4">
            {/* 4-column grid */}
            <div className="flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 auto-rows-fr">
              {applications.map(app => (
                <AppCard
                  key={app.id}
                  app={app}
                  templates={templates}
                  profiles={profiles}
                  state={getCard(app.id)}
                  onGenerate={templateId => handleGenerate(app, templateId)}
                  onBuildJson={(json, templateId) => handleBuildJson(app, json, templateId)}
                  onCopyPrompt={templateId => handleCopyPrompt(app, templateId)}
                  onDownload={() => handleDownload(app)}
                  onComplete={profileId => handleComplete(app, profileId)}
                />
              ))}
            </div>

            {/* Pagination */}
            <div className="shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{total} pending application{total !== 1 ? "s" : ""}</span>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="size-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30 disabled:pointer-events-none">
                    <ChevronLeft size={14} />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button key={p} onClick={() => setPage(p)}
                      className={`min-w-7 h-7 px-2 rounded text-xs font-medium transition-colors ${p === page ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}>
                      {p}
                    </button>
                  ))}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="size-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30 disabled:pointer-events-none">
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
