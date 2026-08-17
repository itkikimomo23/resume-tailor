"use client";

import { useState, useEffect, useRef } from "react";
import { Trash2, Loader2, UploadCloud, FileText, Check, AlertCircle, Tag, Mail, Download } from "lucide-react";
import { DocxTemplate, Prompt } from "@/lib/types";
import { Button } from "@/components/ui/button";

interface Profile { id: string; name: string; }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function TypeBadge({ type }: { type: "resume" | "cover_letter" }) {
  return type === "cover_letter" ? (
    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-400 font-medium">
      <Mail size={9} /> Cover Letter
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400 font-medium">
      <FileText size={9} /> Resume
    </span>
  );
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<DocxTemplate[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProfileId, setFilterProfileId] = useState<string>("");

  const [uploadName, setUploadName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState<"resume" | "cover_letter">("resume");
  const [uploadProfileId, setUploadProfileId] = useState("");
  const [uploadPromptId, setUploadPromptId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "success" | "error">("idle");
  const [uploadError, setUploadError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadTemplates = async () => {
    setLoading(true);
    const [tplRes, profileRes, promptRes] = await Promise.all([
      fetch("/api/docx-templates").catch(() => null),
      fetch("/api/profiles").catch(() => null),
      fetch("/api/prompts").catch(() => null),
    ]);
    if (tplRes?.ok) setTemplates(await tplRes.json());
    if (profileRes?.ok) setProfiles(await profileRes.json());
    if (promptRes?.ok) setPrompts(await promptRes.json());
    setLoading(false);
  };

  useEffect(() => { loadTemplates(); }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setUploadFile(file);
    if (file && !uploadName) {
      setUploadName(file.name.replace(/\.docx$/i, "").replace(/[_-]/g, " "));
    }
    setUploadStatus("idle");
  };

  const handleUpload = async () => {
    if (!uploadProfileId) { setUploadError("Profile is required"); setUploadStatus("error"); return; }
    if (!uploadName.trim()) { setUploadError("Template name is required"); setUploadStatus("error"); return; }
    if (!uploadFile) { setUploadError("Please select a .docx file"); setUploadStatus("error"); return; }

    setUploading(true);
    setUploadStatus("idle");

    const formData = new FormData();
    formData.append("name", uploadName.trim());
    formData.append("file", uploadFile);
    formData.append("template_type", uploadType);
    if (uploadProfileId) formData.append("profile_id", uploadProfileId);
    if (uploadPromptId) formData.append("prompt_id", uploadPromptId);

    try {
      const res = await fetch("/api/docx-templates", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Upload failed" }));
        throw new Error(err.message || "Upload failed");
      }
      const newTpl: DocxTemplate = await res.json();
      setTemplates((prev) => [...prev, newTpl]);
      setUploadName("");
      setUploadFile(null);
      setUploadType("resume");
      setUploadProfileId("");
      setUploadPromptId("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setUploadStatus("success");
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
      setUploadStatus("error");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete template "${name}"? This cannot be undone.`)) return;
    await fetch(`/api/docx-templates/${id}`, { method: "DELETE" });
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  const handleReassignPrompt = async (templateId: string, promptId: string) => {
    const res = await fetch(`/api/docx-templates/${templateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt_id: promptId || null }),
    });
    if (res.ok) {
      const updated: DocxTemplate = await res.json();
      setTemplates((prev) => prev.map((t) => (t.id === templateId ? updated : t)));
    }
  };

  const profileName = (id: string | null) => profiles.find((p) => p.id === id)?.name ?? null;

  return (
    <div className="h-full flex flex-col">
      <div className="px-8 py-6 border-b border-border shrink-0">
        <h1 className="text-lg font-semibold text-foreground">DOCX Templates</h1>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="h-full flex gap-0 divide-x divide-border">

          {/* ── Left: Upload ── */}
          <div className="w-105 shrink-0 overflow-y-auto px-8 py-8 space-y-6">

            {/* Upload form */}
            <div className="section-card space-y-4">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <UploadCloud size={14} /> Upload New Template
              </h2>

              {/* Type toggle */}
              <div>
                <label className="field-label">Template Type *</label>
                <div className="flex gap-2">
                  {(["resume", "cover_letter"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setUploadType(t)}
                      className={`flex-1 py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${
                        uploadType === t
                          ? t === "cover_letter"
                            ? "bg-violet-500/20 border-violet-500/50 text-violet-300"
                            : "bg-orange-500/20 border-orange-500/50 text-orange-300"
                          : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {t === "resume" ? "Resume" : "Cover Letter"}
                    </button>
                  ))}
                </div>
                {uploadType === "cover_letter" && (
                  <p className="text-[11px] text-violet-400/80 mt-1.5">
                    Only <code className="bg-muted px-1 rounded">{"<<date>>"}</code> and <code className="bg-muted px-1 rounded">{"<<letter>>"}</code> placeholders are allowed.
                  </p>
                )}
              </div>

              {/* Profile */}
              <div>
                <label className="field-label">Profile *</label>
                <select
                  className="field-input"
                  value={uploadProfileId}
                  onChange={(e) => { setUploadProfileId(e.target.value); setUploadStatus("idle"); }}
                >
                  <option value="" disabled>Select a profile…</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Name */}
              <div>
                <label className="field-label">Template Name *</label>
                <input
                  className="field-input"
                  placeholder="My Resume Template"
                  value={uploadName}
                  onChange={(e) => { setUploadName(e.target.value); setUploadStatus("idle"); }}
                />
              </div>

              {/* AI Prompt */}
              <div>
                <label className="field-label">AI Prompt</label>
                <select
                  className="field-input"
                  value={uploadPromptId}
                  onChange={(e) => setUploadPromptId(e.target.value)}
                >
                  <option value="">Use default prompt</option>
                  {prompts.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}{p.is_default ? " (default)" : ""}</option>
                  ))}
                </select>
              </div>

              {/* File drop */}
              <div>
                <label className="field-label">DOCX File *</label>
                <div
                  className="relative border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input ref={fileInputRef} type="file" accept=".docx" className="hidden" onChange={handleFileChange} />
                  {uploadFile ? (
                    <div className="flex items-center justify-center gap-2 text-sm text-foreground">
                      <FileText size={16} className="text-primary" />
                      <span className="font-medium">{uploadFile.name}</span>
                      <span className="text-muted-foreground text-xs">({(uploadFile.size / 1024).toFixed(1)} KB)</span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <UploadCloud size={20} className="mx-auto text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">Click to select a .docx file</p>
                      <p className="text-[11px] text-muted-foreground/50">Only .docx format is supported</p>
                    </div>
                  )}
                </div>
              </div>

              {uploadStatus === "error" && (
                <div className="flex items-start gap-2 text-xs text-destructive">
                  <AlertCircle size={13} className="mt-0.5 shrink-0" /> {uploadError}
                </div>
              )}
              {uploadStatus === "success" && (
                <div className="flex items-center gap-2 text-xs text-emerald-400">
                  <Check size={13} /> Template uploaded and variables extracted successfully.
                </div>
              )}

              <Button onClick={handleUpload} disabled={uploading} className="gap-2">
                {uploading ? <><Loader2 size={13} className="animate-spin" /> Uploading…</> : <><UploadCloud size={13} /> Upload Template</>}
              </Button>
            </div>

          </div>

          {/* ── Right: Saved templates ── */}
          <div className="flex-1 min-w-0 overflow-y-auto px-8 py-8">
            <div className="section-card space-y-3">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-sm font-semibold text-foreground">Saved Templates</h2>
                <select
                  className="field-input w-44 text-xs"
                  value={filterProfileId}
                  onChange={(e) => setFilterProfileId(e.target.value)}
                >
                  <option value="">All Profiles</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {loading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 size={14} className="animate-spin" /> Loading templates…
                </div>
              )}
              {!loading && templates.filter((t) => !filterProfileId || t.profile_id === filterProfileId).length === 0 && (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  {filterProfileId ? "No templates for this profile." : "No templates yet. Upload your first .docx template above."}
                </p>
              )}

              <div className="divide-y divide-border">
                {templates.filter((t) => !filterProfileId || t.profile_id === filterProfileId).map((t) => (
                  <div key={t.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <FileText size={15} className="text-primary shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-foreground">{t.name}</p>
                            <TypeBadge type={t.template_type ?? "resume"} />
                            {profileName(t.profile_id) && (
                              <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                                {profileName(t.profile_id)}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Uploaded {formatDate(t.created_at)} · ID: {t.id.slice(0, 8)}…
                          </p>
                          <div className="mt-1.5">
                            <select
                              className="field-input text-[11px] py-0.5 w-44"
                              value={t.prompt_id ?? ""}
                              onChange={(e) => handleReassignPrompt(t.id, e.target.value)}
                              title="AI prompt used to generate this template"
                            >
                              <option value="">Default prompt</option>
                              {prompts.map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          </div>
                          {t.variables?.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60 mr-1">
                                <Tag size={9} /> {t.variables.length} vars:
                              </span>
                              {t.variables.map((v) => (
                                <code key={v} className="text-[10px] bg-muted/40 px-1 py-0.5 rounded font-mono text-muted-foreground">
                                  {`<<${v}>>`}
                                </code>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <a
                          href={`/api/docx-templates/${t.id}/download`}
                          className="btn-ghost text-muted-foreground/50 hover:text-foreground hover:bg-muted p-2"
                          title="Download template"
                        >
                          <Download size={14} />
                        </a>
                        <button
                          onClick={() => handleDelete(t.id, t.name)}
                          className="btn-ghost text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 p-2"
                          title="Delete template"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
