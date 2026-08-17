"use client";

import { useState, useEffect, useCallback } from "react";
import { Context } from "@/lib/types";

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

export default function ContextsPage() {
  const [contexts, setContexts] = useState<Context[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | "new" | null>(null);
  const [editName, setEditName] = useState("");
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadContexts = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/contexts");
    if (res.ok) setContexts(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { loadContexts(); }, [loadContexts]);

  const select = (c: Context) => {
    setSelectedId(c.id);
    setEditName(c.name);
    setEditContent(c.content);
    setError("");
  };

  const newContext = () => {
    setSelectedId("new");
    setEditName("");
    setEditContent("");
    setError("");
  };

  const save = async () => {
    if (!editName.trim()) { setError("Context name is required"); return; }
    setSaving(true);
    setError("");

    const isNew = selectedId === "new";
    const url = isNew ? "/api/contexts" : `/api/contexts/${selectedId}`;
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
      const saved: Context = await res.json();
      await loadContexts();
      setSelectedId(saved.id);
    }
    setSaving(false);
  };

  const deleteContext = async (id: string) => {
    if (!confirm("Delete this context? This cannot be undone.")) return;
    await fetch(`/api/contexts/${id}`, { method: "DELETE" });
    if (selectedId === id) setSelectedId(null);
    await loadContexts();
  };

  return (
    <div className="flex h-full">
      {/* Left panel */}
      <div className="w-64 flex-shrink-0 border-r border-zinc-800 flex flex-col">
        <div className="px-4 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h1 className="text-sm font-semibold text-zinc-100">Contexts</h1>
          <button onClick={newContext} className="btn-primary px-3 py-1.5 text-xs">
            <PlusIcon /> New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading && <p className="text-xs text-zinc-500 px-2 py-4 text-center">Loading…</p>}
          {!loading && contexts.length === 0 && (
            <p className="text-xs text-zinc-500 px-2 py-4 text-center">No contexts yet.</p>
          )}
          {contexts.map((c) => (
            <div
              key={c.id}
              className={`group flex items-center justify-between rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
                selectedId === c.id ? "bg-blue-600/20 border border-blue-600/30" : "hover:bg-zinc-800"
              }`}
              onClick={() => select(c)}
            >
              <div className="min-w-0">
                <p className={`text-sm font-medium truncate ${selectedId === c.id ? "text-blue-300" : "text-zinc-200"}`}>
                  {c.name}
                </p>
                <p className="text-[11px] text-zinc-500 mt-0.5">{formatDate(c.created_at)}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); deleteContext(c.id); }}
                className="opacity-0 group-hover:opacity-100 btn-ghost text-red-400 hover:text-red-300 hover:bg-red-900/20 flex-shrink-0 ml-1"
                title="Delete"
              >
                <TrashIcon />
              </button>
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-zinc-300 font-medium mb-1">Role Contexts</p>
              <p className="text-xs text-zinc-500 max-w-xs">
                Add extra context about a role or industry that gets injected into every generation. For example, a &ldquo;Senior Software Context&rdquo; can describe the typical tech stack, team structure, or key competencies the AI should emphasize.
              </p>
            </div>
            <button onClick={newContext} className="btn-secondary">
              <PlusIcon /> New Context
            </button>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center gap-3">
              <input
                className="field-input text-base font-semibold flex-1"
                placeholder="Context name (e.g. Senior Software Context)"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
              <button onClick={save} disabled={saving} className="btn-primary">
                {saving ? "Saving…" : selectedId === "new" ? "Create" : "Save"}
              </button>
              {selectedId !== "new" && (
                <button
                  onClick={() => deleteContext(selectedId)}
                  className="btn-ghost text-red-400 hover:text-red-300 hover:bg-red-900/20 px-3 py-2"
                >
                  <TrashIcon />
                </button>
              )}
            </div>

            {error && (
              <div className="mx-6 mt-3 rounded-lg bg-red-900/30 border border-red-700/50 px-4 py-2 text-sm text-red-300">
                {error}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-3">
              <div>
                <label className="field-label">Context content</label>
                <p className="text-[11px] text-zinc-500 mb-2">
                  This text is prepended to every generation as additional context for the AI. Describe the role, typical responsibilities, important technologies, and what the AI should emphasize.
                </p>
                <textarea
                  className="field-textarea font-mono text-xs"
                  rows={24}
                  placeholder={`Senior Software Engineering Context:\n\n- Typical stack: Go, Kubernetes, PostgreSQL, gRPC\n- Role focuses on distributed systems and service architecture\n- Team of 8 engineers, working closely with platform and data teams\n- Key competencies: system design, code review, mentoring junior engineers\n- Emphasize scalability, reliability, and cross-team collaboration`}
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
