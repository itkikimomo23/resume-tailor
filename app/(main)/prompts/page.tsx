"use client";

import { useState, useEffect, useCallback } from "react";
import { Prompt } from "@/lib/types";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function PlusIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      className="h-4 w-4"
      fill={filled ? "currentColor" : "none"}
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={filled ? 0 : 2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.539-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  );
}

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | "new" | null>(null);
  const [editName, setEditName] = useState("");
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadPrompts = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/prompts");
    if (res.ok) setPrompts(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { loadPrompts(); }, [loadPrompts]);

  const select = (p: Prompt) => {
    setSelectedId(p.id);
    setEditName(p.name);
    setEditContent(p.content);
    setError("");
  };

  const newPrompt = () => {
    setSelectedId("new");
    setEditName("");
    setEditContent("");
    setError("");
  };

  const save = async () => {
    if (!editName.trim()) { setError("Prompt name is required"); return; }
    setSaving(true);
    setError("");

    const isNew = selectedId === "new";
    const url = isNew ? "/api/prompts" : `/api/prompts/${selectedId}`;
    const method = isNew ? "POST" : "PUT";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, content: editContent }),
    });

    if (!res.ok) {
      const { message } = await res.json().catch(() => ({ message: "Save failed" }));
      setError(message);
    } else {
      const saved: Prompt = await res.json();
      await loadPrompts();
      setSelectedId(saved.id);
    }
    setSaving(false);
  };

  const deletePrompt = async (id: string) => {
    if (!confirm("Delete this prompt? This cannot be undone.")) return;
    const res = await fetch(`/api/prompts/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const { message } = await res.json().catch(() => ({ message: "Delete failed" }));
      setError(message);
      return;
    }
    if (selectedId === id) setSelectedId(null);
    await loadPrompts();
  };

  const setDefault = async (id: string) => {
    const res = await fetch(`/api/prompts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_default: true }),
    });
    if (res.ok) await loadPrompts();
  };

  return (
    <div className="flex h-full">
      {/* Left panel */}
      <div className="w-64 flex-shrink-0 border-r border-zinc-800 flex flex-col">
        <div className="px-4 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h1 className="text-sm font-semibold text-zinc-100">Prompts</h1>
          <button onClick={newPrompt} className="btn-primary px-3 py-1.5 text-xs">
            <PlusIcon /> New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading && <p className="text-xs text-zinc-500 px-2 py-4 text-center">Loading…</p>}
          {!loading && prompts.length === 0 && (
            <p className="text-xs text-zinc-500 px-2 py-4 text-center">No prompts yet.</p>
          )}
          {prompts.map((p) => (
            <div
              key={p.id}
              className={`group flex items-center justify-between rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
                selectedId === p.id ? "bg-blue-600/20 border border-blue-600/30" : "hover:bg-zinc-800"
              }`}
              onClick={() => select(p)}
            >
              <div className="min-w-0">
                <p className={`text-sm font-medium truncate flex items-center gap-1.5 ${selectedId === p.id ? "text-blue-300" : "text-zinc-200"}`}>
                  {p.name}
                  {p.is_default && (
                    <span className="text-[10px] font-normal text-amber-400 border border-amber-400/40 rounded px-1 py-px flex-shrink-0">
                      Default
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-zinc-500 mt-0.5">{formatDate(p.created_at)}</p>
              </div>
              <div className="flex items-center flex-shrink-0 ml-1">
                <button
                  onClick={(e) => { e.stopPropagation(); setDefault(p.id); }}
                  className={`btn-ghost ${p.is_default ? "text-amber-400" : "text-zinc-500 opacity-0 group-hover:opacity-100 hover:text-amber-300"}`}
                  title={p.is_default ? "Default prompt" : "Set as default"}
                >
                  <StarIcon filled={p.is_default} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deletePrompt(p.id); }}
                  className="opacity-0 group-hover:opacity-100 btn-ghost text-red-400 hover:text-red-300 hover:bg-red-900/20"
                  title="Delete"
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedId === null ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
            <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center">
              <svg className="w-6 h-6 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-zinc-300 font-medium mb-1">Custom AI Prompts</p>
              <p className="text-xs text-zinc-500 max-w-xs">
                Write custom system instructions for the AI. For example, a &ldquo;Senior Software Engineer&rdquo; prompt can emphasize distributed systems, architecture decisions, and technical leadership.
              </p>
            </div>
            <button onClick={newPrompt} className="btn-secondary">
              <PlusIcon /> New Prompt
            </button>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center gap-3">
              <input
                className="field-input text-base font-semibold flex-1"
                placeholder="Prompt name (e.g. Senior Software Engineer)"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
              <button onClick={save} disabled={saving} className="btn-primary">
                {saving ? "Saving…" : selectedId === "new" ? "Create" : "Save"}
              </button>
              {selectedId !== "new" && (
                <>
                  <button
                    onClick={() => setDefault(selectedId)}
                    className={`btn-ghost px-3 py-2 ${
                      prompts.find((p) => p.id === selectedId)?.is_default
                        ? "text-amber-400"
                        : "text-zinc-500 hover:text-amber-300"
                    }`}
                    title={prompts.find((p) => p.id === selectedId)?.is_default ? "Default prompt" : "Set as default"}
                  >
                    <StarIcon filled={!!prompts.find((p) => p.id === selectedId)?.is_default} />
                  </button>
                  <button
                    onClick={() => deletePrompt(selectedId)}
                    className="btn-ghost text-red-400 hover:text-red-300 hover:bg-red-900/20 px-3 py-2"
                  >
                    <TrashIcon />
                  </button>
                </>
              )}
            </div>

            {error && (
              <div className="mx-6 mt-3 rounded-lg bg-red-900/30 border border-red-700/50 px-4 py-2 text-sm text-red-300">
                {error}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-3">
              <div>
                <label className="field-label">System instructions</label>
                <p className="text-[11px] text-zinc-500 mb-2">
                  These instructions replace the default AI prompt when selected. Include the full resume-writing guidelines and any role-specific emphasis. The AI must still return the same JSON structure.
                </p>
                <textarea
                  className="field-textarea font-mono text-xs"
                  rows={24}
                  placeholder={`You are an expert resume writer specializing in senior software engineering roles...\n\nGuidelines:\n- Emphasize system design and architectural decisions\n- Highlight distributed systems experience\n- ...\n\nReturn ONLY a valid JSON object matching the standard resume structure.`}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
