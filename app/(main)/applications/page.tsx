"use client";

import { useEffect, useRef, useState } from "react";
import {
  RefreshCw, Download, ExternalLink, Trash2, Inbox,
  Search, ChevronLeft, ChevronRight, Copy, Check,
  AlertTriangle, FileText, X, Pencil, Upload, UploadCloud, NotebookPen,
} from "lucide-react";
import { Dialog } from "@base-ui/react/dialog";
import { Tooltip } from "@base-ui/react/tooltip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { applicationDocxFilename, applicationResumeBaseName } from "@/lib/resumeFilename";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Application {
  id: string;
  seq: number;
  job_url: string | null;
  role: string;
  company_name: string;
  job_board: string | null;
  profile_id: string | null;
  profile_name: string | null;
  bidder_name: string | null;
  created_by: string | null;
  status: "generating" | "completed" | "failed" | "pending";
  pipeline_status: string;
  google_drive_link: string | null;
  google_drive_file_id: string | null;
  error_message: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Profile  { id: string; name: string; }
interface TeamUser { id: string; name: string; role: string; }

const PAGE_SIZE = 20;

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending:    "secondary",
  generating: "outline",
  completed:  "default",
  failed:     "destructive",
};

const PIPELINE_OPTIONS = [
  { value: "saved",        label: "Saved" },
  { value: "applied",      label: "Applied" },
  { value: "external",     label: "External" },
  { value: "screening",    label: "Screening" },
  { value: "hr_interview", label: "HR Interview" },
  { value: "tech_1",       label: "Tech 1" },
  { value: "tech_2",       label: "Tech 2" },
  { value: "offer",        label: "Offer" },
  { value: "failed",       label: "Failed" },
];

const PIPELINE_COLORS: Record<string, string> = {
  saved:        "text-muted-foreground",
  applied:      "text-blue-500",
  external:     "text-cyan-500",
  screening:    "text-pink-500",
  hr_interview: "text-yellow-500",
  tech_1:       "text-purple-500",
  tech_2:       "text-orange-500",
  offer:        "text-green-500",
  failed:       "text-destructive",
};

const STATUS_OPTIONS = ["pending", "generating", "completed", "failed"];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isDiceJobUrl(url: string | null): boolean {
  return !!url && /dice\.com\/job-detail\//i.test(url);
}

function DiceBadge() {
  return (
    <span title="Dice" className="inline-flex items-center justify-center size-3.5 rounded bg-red-500 text-white text-[9px] leading-none font-bold shrink-0">
      D
    </span>
  );
}

function buildPageRange(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "…")[] = [1];
  if (current > 3) pages.push("…");
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
  if (current < total - 2) pages.push("…");
  pages.push(total);
  return pages;
}

function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.cssText = "position:fixed;opacity:0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* silently fail */ }
  };
  return (
    <button onClick={handle} title="Copy"
      className="inline-flex items-center justify-center size-7 rounded-lg border border-input bg-transparent text-muted-foreground hover:text-foreground hover:bg-accent transition-all">
      {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
    </button>
  );
}

function ActionButtons({ app, deletingId, downloading, onOpenJd, onDelete, onUpload, onDownload }: {
  app: Application; deletingId: string | null; downloading: boolean;
  onOpenJd: (app: Application) => void;
  onDelete: (id: string) => void;
  onUpload: (app: Application) => void;
  onDownload: (app: Application) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-nowrap">
      {app.job_url && (
        <a href={app.job_url} target="_blank" rel="noopener noreferrer" title="Open job link"
          className="inline-flex items-center gap-1.5 h-7 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/80 transition-all">
          <ExternalLink size={12} /><span>Job Link</span>
        </a>
      )}
      {app.status === "pending" && (
        <button onClick={() => onUpload(app)} title="Upload resume to Drive"
          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-input bg-transparent text-muted-foreground hover:text-foreground hover:bg-accent text-xs font-medium transition-all">
          <Upload size={12} /><span>Upload</span>
        </button>
      )}
      {app.status === "completed" && app.google_drive_file_id && (
        <button
          onClick={() => onDownload(app)}
          disabled={downloading}
          title={applicationDocxFilename(app.profile_name, app.seq, app.company_name)}
          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/80 transition-all disabled:opacity-60">
          <Download size={12} /><span>{downloading ? "Downloading…" : "Download"}</span>
        </button>
      )}
      <button onClick={() => onOpenJd(app)} title="View job description"
        className="inline-flex items-center justify-center size-7 rounded-lg border border-input bg-transparent text-muted-foreground hover:text-foreground hover:bg-accent transition-all">
        <FileText size={12} />
      </button>
      <Button size="icon-sm" variant="ghost" onClick={() => onDelete(app.id)} disabled={deletingId === app.id}
        className="text-muted-foreground hover:text-destructive">
        <Trash2 size={13} />
      </Button>
    </div>
  );
}

export default function ApplicationsPage() {
  // Data
  const [applications, setApplications] = useState<Application[]>([]);
  const [total, setTotal]               = useState(0);
  const [loading, setLoading]           = useState(true);
  const [isAdmin, setIsAdmin]           = useState(false);
  const [profiles, setProfiles]         = useState<Profile[]>([]);
  const [bidders, setBidders]           = useState<TeamUser[]>([]);

  // Filters
  const [search, setSearch]                   = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchFullText, setSearchFullText]   = useState(false);
  const [profileId, setProfileId]             = useState("");
  const [bidderId, setBidderId]               = useState("");
  const [statusFilter, setStatusFilter]       = useState("");
  const [stageFilter, setStageFilter]         = useState("");
  const [date, setDate]                       = useState("");
  const [page, setPage]                       = useState(1);
  const [pageJump, setPageJump]               = useState("");
  const [refreshKey, setRefreshKey]           = useState(0);

  // UI state
  const [deletingId, setDeletingId]           = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [updatingId, setUpdatingId]           = useState<string | null>(null);
  const [editingId, setEditingId]             = useState<string | null>(null);
  const [editFields, setEditFields]           = useState({ company_name: "", role: "" });
  const [selectedIds, setSelectedIds]         = useState<Set<string>>(new Set());
  const [downloadingIds, setDownloadingIds]   = useState<Set<string>>(new Set());
  const [downloadError, setDownloadError]     = useState<string | null>(null);
  const [bulkUpdating, setBulkUpdating]       = useState(false);
  const [bulkStatusUpdating, setBulkStatusUpdating] = useState(false);
  const [jdModal, setJdModal] = useState<{ open: boolean; loading: boolean; content: string | null; title: string; role: string }>({
    open: false, loading: false, content: null, title: "", role: "",
  });
  const [uploadModal, setUploadModal] = useState<{
    open: boolean; app: Application | null;
    profileId: string; file: File | null;
    uploading: boolean; error: string | null; isDragging: boolean;
  }>({ open: false, app: null, profileId: "", file: null, uploading: false, error: null, isDragging: false });

  const [notesModal, setNotesModal] = useState<{ open: boolean; app: Application | null; draft: string; saving: boolean }>({
    open: false, app: null, draft: "", saving: false,
  });

  const uploadFileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef(false);

  // Debounce search — resets page atomically when it fires
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  // Clear selection on page navigation only — not on the silent background poll
  // (refreshKey also bumps every few seconds whenever a row is pending/generating,
  // which would otherwise wipe the user's checkboxes mid-selection).
  useEffect(() => { setSelectedIds(new Set()); }, [page]);

  // Load current user + filter option lists once on mount
  useEffect(() => {
    Promise.all([fetch("/api/me"), fetch("/api/profiles")]).then(async ([meRes, profRes]) => {
      if (meRes.ok) {
        const me = await meRes.json();
        const admin = me.role === "admin";
        setIsAdmin(admin);
        if (admin) {
          fetch("/api/team")
            .then(r => r.ok ? r.json() : [])
            .then((users: TeamUser[]) => setBidders(users.filter(u => u.role === "assistant")));
        }
      }
      if (profRes.ok) setProfiles(await profRes.json());
    });
  }, []);

  // Main fetch — fires on any filter / page / manual refresh change
  useEffect(() => {
    const silent = pollingRef.current;
    pollingRef.current = false;

    let active = true;
    if (!silent) setLoading(true);

    const p = new URLSearchParams({ page: String(page) });
    if (debouncedSearch) p.set("search", debouncedSearch);
    if (debouncedSearch && searchFullText) p.set("fullSearch", "1");
    if (profileId)       p.set("profileId", profileId);
    if (bidderId)        p.set("bidderId", bidderId);
    if (statusFilter)    p.set("status", statusFilter);
    if (stageFilter)     p.set("stage", stageFilter);
    if (date)            p.set("date", date);

    fetch(`/api/applications?${p}`)
      .then(r => r.ok ? r.json() : null)
      .then(result => {
        if (!active || !result) return;
        setApplications(result.data);
        setTotal(result.total);
        setLoading(false);
      })
      .catch(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [refreshKey, page, debouncedSearch, searchFullText, profileId, bidderId, statusFilter, stageFilter, date]);

  // Background poll while any app is in-progress (no loading spinner)
  useEffect(() => {
    if (!applications.some(a => a.status === "generating" || a.status === "pending")) return;
    const id = setInterval(() => { pollingRef.current = true; setRefreshKey(k => k + 1); }, 5000);
    return () => clearInterval(id);
  }, [applications]);

  const resetFilters = () => {
    setSearch(""); setDebouncedSearch(""); setSearchFullText(false); setProfileId(""); setBidderId("");
    setStatusFilter(""); setStageFilter(""); setDate(""); setPage(1);
  };

  const hasActiveFilters = !!(search || profileId || bidderId || statusFilter || stageFilter || date);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Handlers
  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await fetch(`/api/applications/${id}`, { method: "DELETE" });
    setDeletingId(null);
    setConfirmDeleteId(null);
    if (applications.length === 1 && page > 1) setPage(p => p - 1);
    else setRefreshKey(k => k + 1);
  };

  const handleDownload = async (app: Application) => {
    setDownloadError(null);
    setDownloadingIds(prev => new Set(prev).add(app.id));
    try {
      const res = await fetch(`/api/applications/${app.id}/download`);
      if (!res.ok) {
        let message = "Download failed";
        try {
          const data = await res.json();
          if (data?.message) message = data.message;
        } catch { /* ignore */ }
        setDownloadError(message);
        return;
      }
      const blob = await res.blob();
      const docxName = res.headers.get("X-Filename") || applicationDocxFilename(app.profile_name, app.seq, app.company_name);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = docxName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloadingIds(prev => {
        const next = new Set(prev);
        next.delete(app.id);
        return next;
      });
    }
  };

  const openJd = async (app: Application) => {
    setJdModal({ open: true, loading: true, content: null, title: `${app.company_name} — ${app.role}`, role: app.role });
    const res = await fetch(`/api/applications/${app.id}`);
    if (res.ok) {
      const data = await res.json();
      setJdModal(prev => ({ ...prev, loading: false, content: data.job_description ?? null }));
    } else {
      setJdModal(prev => ({ ...prev, loading: false, content: null }));
    }
  };

  const handlePipelineChange = async (id: string, pipeline_status: string) => {
    setUpdatingId(id);
    const res = await fetch(`/api/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pipeline_status }),
    });
    if (res.ok) {
      const updated: Application = await res.json();
      setApplications(prev => prev.map(a => a.id === id ? { ...a, pipeline_status: updated.pipeline_status } : a));
    }
    setUpdatingId(null);
  };

  const toggleSelect = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const allOnPageSelected = applications.length > 0 && applications.every(a => selectedIds.has(a.id));
  const someOnPageSelected = applications.some(a => selectedIds.has(a.id));

  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      setSelectedIds(prev => { const next = new Set(prev); applications.forEach(a => next.delete(a.id)); return next; });
    } else {
      setSelectedIds(prev => { const next = new Set(prev); applications.forEach(a => next.add(a.id)); return next; });
    }
  };

  const handleBulkPipelineChange = async (pipeline_status: string) => {
    if (selectedIds.size === 0 || !pipeline_status) return;
    setBulkUpdating(true);
    const ids = Array.from(selectedIds);
    const res = await fetch("/api/applications/batch", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, pipeline_status }),
    });
    if (res.ok) {
      setApplications(prev => prev.map(a => selectedIds.has(a.id) ? { ...a, pipeline_status } : a));
      setSelectedIds(new Set());
    }
    setBulkUpdating(false);
  };

  const handleBulkStatusChange = async (status: string) => {
    if (selectedIds.size === 0 || !status) return;
    setBulkStatusUpdating(true);
    const ids = Array.from(selectedIds);
    const res = await fetch("/api/applications/batch", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, status }),
    });
    if (res.ok) {
      const clearsResume = status === "pending" || status === "failed";
      setApplications(prev => prev.map(a => selectedIds.has(a.id)
        ? {
            ...a,
            status: status as Application["status"],
            ...(clearsResume ? { google_drive_link: null, google_drive_file_id: null } : {}),
          }
        : a));
      setSelectedIds(new Set());
    }
    setBulkStatusUpdating(false);
  };

  const startEdit = (app: Application) => {
    setEditingId(app.id);
    setEditFields({ company_name: app.company_name, role: app.role });
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (id: string) => {
    if (!editFields.company_name.trim() || !editFields.role.trim()) return;
    setUpdatingId(id);
    const res = await fetch(`/api/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company_name: editFields.company_name.trim(), role: editFields.role.trim() }),
    });
    if (res.ok) {
      const updated: Application = await res.json();
      setApplications(prev => prev.map(a =>
        a.id === id ? { ...a, company_name: updated.company_name, role: updated.role } : a
      ));
    }
    setEditingId(null);
    setUpdatingId(null);
  };

  const openNotes = (app: Application) =>
    setNotesModal({ open: true, app, draft: app.notes ?? "", saving: false });

  const saveNotes = async () => {
    if (!notesModal.app) return;
    setNotesModal(prev => ({ ...prev, saving: true }));
    const res = await fetch(`/api/applications/${notesModal.app.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notesModal.draft.trim() || null }),
    });
    if (res.ok) {
      const updated: Application = await res.json();
      setApplications(prev => prev.map(a => a.id === updated.id ? { ...a, notes: updated.notes } : a));
    }
    setNotesModal(prev => ({ ...prev, open: false, saving: false }));
  };

  const openUpload = (app: Application) =>
    setUploadModal({ open: true, app, profileId: "", file: null, uploading: false, error: null, isDragging: false });

  const handleUploadSubmit = async () => {
    if (!uploadModal.app || !uploadModal.file || !uploadModal.profileId) return;
    setUploadModal(prev => ({ ...prev, uploading: true, error: null }));
    const fd = new FormData();
    fd.append("file", uploadModal.file);
    fd.append("profileId", uploadModal.profileId);
    const res = await fetch(`/api/applications/${uploadModal.app.id}/upload`, { method: "POST", body: fd });
    if (!res.ok) {
      const data = await res.json();
      setUploadModal(prev => ({ ...prev, uploading: false, error: data.message ?? "Upload failed" }));
      return;
    }
    const updated: Application = await res.json();
    setApplications(prev => prev.map(a =>
      a.id === uploadModal.app!.id
        ? { ...a, status: updated.status, google_drive_file_id: updated.google_drive_file_id, google_drive_link: updated.google_drive_link }
        : a
    ));
    setUploadModal({ open: false, app: null, profileId: "", file: null, uploading: false, error: null, isDragging: false });
  };

  const uploadPreviewName = (() => {
    if (!uploadModal.app || !uploadModal.profileId) return null;
    const p = profiles.find(pr => pr.id === uploadModal.profileId);
    return p ? applicationResumeBaseName(p.name, uploadModal.app.seq, uploadModal.app.company_name) : null;
  })();

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-border flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-semibold text-foreground">Applications</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => setRefreshKey(k => k + 1)} className="shrink-0">
          <RefreshCw size={13} /><span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-4 sm:py-6">
        <div className="space-y-4">

          {/* ── Filters ── */}
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-0.5">
              <div className="relative flex items-center gap-1.5">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input placeholder="Search…" value={search}
                    onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm w-48" />
                </div>
                <label className="flex items-center gap-1 text-[11px] text-muted-foreground cursor-pointer select-none whitespace-nowrap" title="Also search job description">
                  <input type="checkbox" checked={searchFullText}
                    onChange={e => setSearchFullText(e.target.checked)}
                    className="size-3.5 rounded border-input cursor-pointer accent-primary" />
                  Entire search
                </label>
              </div>
            </div>

            {profiles.length > 0 && (
              <div className="flex flex-col gap-0.5">
                <Select value={profileId || "_all"} onValueChange={v => { setProfileId(v === "_all" ? "" : (v ?? "")); setPage(1); }}>
                  <SelectTrigger className="h-8 text-sm w-auto min-w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all" className="text-xs">All profiles</SelectItem>
                    {profiles.map(p => <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {isAdmin && bidders.length > 0 && (
              <div className="flex flex-col gap-0.5">
                <Select value={bidderId || "_all"} onValueChange={v => { setBidderId(v === "_all" ? "" : (v ?? "")); setPage(1); }}>
                  <SelectTrigger className="h-8 text-sm w-auto min-w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all" className="text-xs">All bidders</SelectItem>
                    {bidders.map(b => <SelectItem key={b.id} value={b.id} className="text-xs">{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex flex-col gap-0.5">
              <Select value={statusFilter || "_all"} onValueChange={v => { setStatusFilter(v === "_all" ? "" : (v ?? "")); setPage(1); }}>
                <SelectTrigger className="h-8 text-sm w-auto min-w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all" className="text-xs">All statuses</SelectItem>
                  {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s} className="text-xs capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-0.5">
              <Select value={stageFilter || "_all"} onValueChange={v => { setStageFilter(v === "_all" ? "" : (v ?? "")); setPage(1); }}>
                <SelectTrigger className="h-8 text-sm w-auto min-w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all" className="text-xs">All stages</SelectItem>
                  {PIPELINE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-0.5">
              <input type="date" className="field-input h-8 text-xs px-2 w-36" value={date}
                onChange={e => { setDate(e.target.value); setPage(1); }} title="Date" />
            </div>

            {hasActiveFilters && (
              <div className="flex flex-col gap-0.5">
                <button onClick={resetFilters}
                  className="h-8 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <X size={11} /> Clear
                </button>
              </div>
            )}

            {selectedIds.size > 0 && (
              <div className="ml-auto flex flex-col gap-0.5">
                <div className="h-8 flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground whitespace-nowrap">{selectedIds.size} selected</span>
                  <Select onValueChange={(val: string | null) => { if (val) void handleBulkPipelineChange(val); }} disabled={bulkUpdating}>
                    <SelectTrigger size="sm" className="h-8 text-sm w-auto min-w-36">
                      <SelectValue placeholder={bulkUpdating ? "Updating…" : "Set stage…"} />
                    </SelectTrigger>
                    <SelectContent>
                      {PIPELINE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-sm">{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select onValueChange={(val: string | null) => { if (val) void handleBulkStatusChange(val); }} disabled={bulkStatusUpdating}>
                    <SelectTrigger size="sm" className="h-8 text-sm w-auto min-w-36">
                      <SelectValue placeholder={bulkStatusUpdating ? "Updating…" : "Set status…"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending" className="text-sm">Pending</SelectItem>
                      <SelectItem value="completed" className="text-sm">Completed</SelectItem>
                      <SelectItem value="failed" className="text-sm">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                  <button
                    onClick={() => {
                      applications
                        .filter(a => selectedIds.has(a.id) && a.job_url)
                        .forEach(a => window.open(a.job_url!, "_blank", "noopener,noreferrer"));
                    }}
                    disabled={!applications.some(a => selectedIds.has(a.id) && a.job_url)}
                    className="size-7 flex items-center justify-center rounded-lg border border-input bg-transparent text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30 disabled:pointer-events-none"
                    title="Open selected job URLs in new tabs">
                    <ExternalLink size={13} />
                  </button>
                  <button onClick={() => setSelectedIds(new Set())}
                    className="size-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" title="Clear selection">
                    <X size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {downloadError && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              <AlertTriangle size={14} className="shrink-0" />
              <span className="flex-1">{downloadError}</span>
              <button onClick={() => setDownloadError(null)} className="text-destructive/70 hover:text-destructive" title="Dismiss">
                <X size={13} />
              </button>
            </div>
          )}

          {/* ── Content ── */}
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">Loading…</div>
          ) : total === 0 && !hasActiveFilters ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-3">
              <Inbox size={40} className="text-muted-foreground/30" />
              <p className="text-sm">No applications yet</p>
              <p className="text-xs text-muted-foreground/60 text-center px-4">Submit a job via your Chrome extension to get started</p>
            </div>
          ) : applications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-3">
              <Search size={40} className="text-muted-foreground/30" />
              <p className="text-sm">No results for current filters</p>
              <button onClick={resetFilters} className="text-xs text-primary hover:underline">Clear filters</button>
            </div>
          ) : (
            <>
              {/* ── Desktop table ── */}
              <div className="hidden md:block bg-card rounded-xl ring-1 ring-foreground/10 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-3 w-8">
                        <input type="checkbox" checked={allOnPageSelected} ref={el => { if (el) el.indeterminate = someOnPageSelected && !allOnPageSelected; }} onChange={toggleSelectAll}
                          className="size-4 rounded border-input cursor-pointer accent-primary" />
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider w-10">#</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Company</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Role</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Profile</th>
                      {isAdmin && <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Bidder</th>}
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Notes</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Stage</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {applications.map(app => (
                      <tr key={app.id} className={`hover:bg-accent/30 transition-colors ${selectedIds.has(app.id) ? "bg-accent/20" : ""}`}>
                        <td className="px-4 py-3.5">
                          <input type="checkbox" checked={selectedIds.has(app.id)} onChange={() => toggleSelect(app.id)}
                            className="size-4 rounded border-input cursor-pointer accent-primary" />
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground text-xs tabular-nums">{app.seq}</td>

                        {/* Company */}
                        <td className="px-4 py-3.5">
                          {editingId === app.id ? (
                            <input className="field-input text-sm h-7 px-2 w-36" value={editFields.company_name}
                              onChange={e => setEditFields(f => ({ ...f, company_name: e.target.value }))}
                              onKeyDown={e => { if (e.key === "Enter") saveEdit(app.id); if (e.key === "Escape") cancelEdit(); }}
                              autoFocus />
                          ) : (
                            <div className="flex items-center gap-1.5">
                              {app.job_board ? (
                                <Tooltip.Provider>
                                  <Tooltip.Root>
                                    <Tooltip.Trigger className="font-medium text-foreground whitespace-nowrap cursor-default">{app.company_name}</Tooltip.Trigger>
                                    <Tooltip.Portal>
                                      <Tooltip.Positioner sideOffset={6}>
                                        <Tooltip.Popup className="z-50 rounded-md bg-popover px-2.5 py-1 text-xs text-popover-foreground shadow-md ring-1 ring-foreground/10">{app.job_board}</Tooltip.Popup>
                                      </Tooltip.Positioner>
                                    </Tooltip.Portal>
                                  </Tooltip.Root>
                                </Tooltip.Provider>
                              ) : (
                                <span className="font-medium text-foreground whitespace-nowrap">{app.company_name}</span>
                              )}
                              {isDiceJobUrl(app.job_url) && <DiceBadge />}
                              <button onClick={() => startEdit(app)} title="Edit"
                                className="text-muted-foreground hover:text-primary transition-colors shrink-0">
                                <Pencil size={11} />
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Role */}
                        <td className="px-4 py-3.5 text-muted-foreground max-w-0 w-full">
                          {editingId === app.id ? (
                            <input className="field-input text-sm h-7 px-2 w-full" value={editFields.role}
                              onChange={e => setEditFields(f => ({ ...f, role: e.target.value }))}
                              onKeyDown={e => { if (e.key === "Enter") saveEdit(app.id); if (e.key === "Escape") cancelEdit(); }} />
                          ) : (
                            <div className="truncate" title={app.role}>{app.role}</div>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-muted-foreground text-xs whitespace-nowrap">
                          {app.profile_name ?? <span className="text-muted-foreground/30">—</span>}
                        </td>

                        {isAdmin && (
                          <td className="px-4 py-3.5 text-muted-foreground text-xs whitespace-nowrap">
                            {app.bidder_name ?? <span className="text-muted-foreground/30">—</span>}
                          </td>
                        )}

                        <td className="px-4 py-3.5 text-muted-foreground text-xs whitespace-nowrap">{formatDate(app.created_at)}</td>

                        {/* Notes */}
                        <td className="px-4 py-3.5">
                          <button onClick={() => openNotes(app)} title={app.notes ?? "Add note"}
                            className={`inline-flex items-center justify-center size-7 rounded-lg border border-input bg-transparent transition-all ${app.notes ? "text-primary hover:bg-accent" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}>
                            <NotebookPen size={12} />
                          </button>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <Badge variant={STATUS_VARIANT[app.status] ?? "secondary"} className="capitalize gap-1">
                              {(app.status === "generating" || app.status === "pending") && (
                                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                              )}
                              {app.status}
                            </Badge>
                            {app.status === "failed" && app.error_message && (
                              <span className="text-xs text-destructive max-w-40 truncate" title={app.error_message}>{app.error_message}</span>
                            )}
                          </div>
                        </td>

                        {/* Stage */}
                        <td className="px-4 py-3.5">
                          <Select value={app.pipeline_status} onValueChange={val => val && handlePipelineChange(app.id, val)} disabled={updatingId === app.id}>
                            <SelectTrigger size="sm" className={`border-0 bg-transparent px-1.5 shadow-none focus-visible:ring-0 focus-visible:border-input h-8 text-sm font-medium ${PIPELINE_COLORS[app.pipeline_status] ?? "text-foreground"}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent align="start">
                              {PIPELINE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-sm">{o.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            {editingId === app.id ? (
                              <>
                                <button onClick={() => saveEdit(app.id)} disabled={updatingId === app.id}
                                  className="inline-flex items-center justify-center size-7 rounded-lg bg-primary text-primary-foreground hover:bg-primary/80 transition-all" title="Save">
                                  <Check size={12} />
                                </button>
                                <button onClick={cancelEdit}
                                  className="inline-flex items-center justify-center size-7 rounded-lg border border-input bg-transparent text-muted-foreground hover:text-foreground hover:bg-accent transition-all" title="Cancel">
                                  <X size={12} />
                                </button>
                              </>
                            ) : (
                              <ActionButtons app={app} deletingId={deletingId} downloading={downloadingIds.has(app.id)} onOpenJd={openJd} onDelete={id => setConfirmDeleteId(id)} onUpload={openUpload} onDownload={handleDownload} />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Mobile cards ── */}
              <div className="md:hidden space-y-3">
                {applications.map(app => (
                  <div key={app.id} className={`bg-card rounded-xl ring-1 ring-foreground/10 p-4 space-y-3 ${selectedIds.has(app.id) ? "ring-primary/40 bg-accent/10" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <input type="checkbox" checked={selectedIds.has(app.id)} onChange={() => toggleSelect(app.id)}
                        className="mt-0.5 size-4 rounded border-input cursor-pointer accent-primary shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground tabular-nums">#{app.seq}</span>
                          <span className="font-semibold text-foreground text-sm truncate">{app.company_name}</span>
                          {isDiceJobUrl(app.job_url) && <DiceBadge />}
                          {app.job_url && (
                            <a href={app.job_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary shrink-0">
                              <ExternalLink size={11} />
                            </a>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{app.role}</p>
                        {app.profile_name && <p className="text-[11px] text-muted-foreground/60 truncate">{app.profile_name}</p>}
                        {isAdmin && app.bidder_name && <p className="text-[11px] text-muted-foreground/50 truncate">by {app.bidder_name}</p>}
                      </div>
                      <Badge variant={STATUS_VARIANT[app.status] ?? "secondary"} className="capitalize gap-1 shrink-0">
                        {(app.status === "generating" || app.status === "pending") && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
                        {app.status}
                      </Badge>
                    </div>
                    {app.status === "failed" && app.error_message && <p className="text-xs text-destructive truncate">{app.error_message}</p>}
                    <div className="flex items-center justify-between gap-2">
                      <Select value={app.pipeline_status} onValueChange={val => val && handlePipelineChange(app.id, val)} disabled={updatingId === app.id}>
                        <SelectTrigger size="sm" className={`border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 h-8 text-sm font-medium w-auto ${PIPELINE_COLORS[app.pipeline_status] ?? "text-foreground"}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent align="start">
                          {PIPELINE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-sm">{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <span className="text-xs text-muted-foreground shrink-0">{formatDate(app.created_at)}</span>
                    </div>
                    <div className="pt-1 border-t border-border flex items-center justify-between gap-2">
                      <ActionButtons app={app} deletingId={deletingId} downloading={downloadingIds.has(app.id)} onOpenJd={openJd} onDelete={id => setConfirmDeleteId(id)} onUpload={openUpload} onDownload={handleDownload} />
                      <button onClick={() => openNotes(app)} title={app.notes ?? "Add note"}
                        className={`inline-flex items-center justify-center size-7 rounded-lg border border-input bg-transparent transition-all shrink-0 ${app.notes ? "text-primary hover:bg-accent" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}>
                        <NotebookPen size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{total} application{total !== 1 ? "s" : ""}{hasActiveFilters ? " (filtered)" : ""}</span>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                      className="size-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30 disabled:pointer-events-none">
                      <ChevronLeft size={14} />
                    </button>
                    {buildPageRange(page, totalPages).map((p, i) =>
                      p === "…"
                        ? <span key={`e${i}`} className="px-1 text-muted-foreground/50">…</span>
                        : (
                          <button key={p} onClick={() => setPage(p)}
                            className={`min-w-7 h-7 px-2 rounded text-xs font-medium transition-colors ${p === page ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}>
                            {p}
                          </button>
                        )
                    )}
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                      className="size-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30 disabled:pointer-events-none">
                      <ChevronRight size={14} />
                    </button>
                    <form
                      className="flex items-center gap-1.5 ml-1 pl-2 border-l border-border"
                      onSubmit={e => {
                        e.preventDefault();
                        const n = parseInt(pageJump, 10);
                        if (Number.isFinite(n)) setPage(Math.min(totalPages, Math.max(1, n)));
                        setPageJump("");
                      }}
                    >
                      <span className="text-muted-foreground/70">Go to</span>
                      <Input
                        type="number"
                        min={1}
                        max={totalPages}
                        value={pageJump}
                        onChange={e => setPageJump(e.target.value)}
                        placeholder={String(page)}
                        className="h-7 w-14 px-1.5 text-xs text-center"
                      />
                    </form>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Notes modal */}
      <Dialog.Root open={notesModal.open} onOpenChange={open => { if (!open && !notesModal.saving) setNotesModal(prev => ({ ...prev, open: false })); }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 duration-150" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-2rem)] max-w-md bg-card rounded-xl ring-1 ring-foreground/10 shadow-xl flex flex-col data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <div className="min-w-0">
                <Dialog.Title className="text-sm font-semibold text-foreground">Personal Note</Dialog.Title>
                <Dialog.Description className="text-xs text-muted-foreground mt-0.5 truncate">
                  {notesModal.app ? `${notesModal.app.company_name} — ${notesModal.app.role}` : ""}
                </Dialog.Description>
              </div>
              <Dialog.Close render={<button className="size-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"><X size={14} /></button>} />
            </div>
            <div className="px-5 py-4">
              <textarea
                className="field-input w-full text-sm px-3 py-2 resize-none rounded-lg min-h-36"
                placeholder="Contact info, recruiter details, interview notes…"
                value={notesModal.draft}
                onChange={e => setNotesModal(prev => ({ ...prev, draft: e.target.value }))}
                disabled={notesModal.saving}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 px-5 pb-5">
              <Dialog.Close render={<Button variant="outline" size="sm" disabled={notesModal.saving}>Cancel</Button>} />
              <Button size="sm" onClick={saveNotes} disabled={notesModal.saving}>
                {notesModal.saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      {/* JD modal */}
      <Dialog.Root open={jdModal.open} onOpenChange={open => { if (!open) setJdModal(prev => ({ ...prev, open: false })); }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 duration-150" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-2rem)] max-w-2xl max-h-[85vh] bg-card rounded-xl ring-1 ring-foreground/10 shadow-xl flex flex-col data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <div className="min-w-0">
                <Dialog.Title className="text-sm font-semibold text-foreground">Job Description</Dialog.Title>
                <Dialog.Description className="text-xs text-muted-foreground mt-0.5 truncate">{jdModal.title}</Dialog.Description>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                {jdModal.content && <CopyButton url={`JOB Title:${jdModal.role}\n\nDescription:\n${jdModal.content}`} />}
                <Dialog.Close render={<button className="size-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"><X size={14} /></button>} />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {jdModal.loading
                ? <p className="text-sm text-muted-foreground">Loading…</p>
                : jdModal.content
                  ? <pre className="text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed">{jdModal.content}</pre>
                  : <p className="text-sm text-muted-foreground">No job description available.</p>}
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Upload modal */}
      <Dialog.Root open={uploadModal.open} onOpenChange={open => { if (!open && !uploadModal.uploading) setUploadModal(prev => ({ ...prev, open: false })); }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 duration-150" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-2rem)] max-w-md bg-card rounded-xl ring-1 ring-foreground/10 shadow-xl flex flex-col data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <div>
                <Dialog.Title className="text-sm font-semibold text-foreground">Upload Resume</Dialog.Title>
                <Dialog.Description className="text-xs text-muted-foreground mt-0.5">
                  Upload a .docx file to Google Drive for this application
                </Dialog.Description>
              </div>
              <Dialog.Close render={
                <button disabled={uploadModal.uploading}
                  className="size-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40">
                  <X size={14} />
                </button>
              } />
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Profile selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Profile</label>
                <Select
                  value={uploadModal.profileId || "_none"}
                  onValueChange={v => setUploadModal(prev => ({ ...prev, profileId: v === "_none" ? "" : (v ?? "") }))}
                  disabled={uploadModal.uploading}
                >
                  <SelectTrigger className="h-9 text-sm w-full"><SelectValue placeholder="Select a profile…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none" className="text-xs text-muted-foreground">Select a profile…</SelectItem>
                    {profiles.map(p => <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Filename preview */}
              {uploadPreviewName && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/50 text-xs text-muted-foreground">
                  <FileText size={12} className="shrink-0" />
                  <span className="font-mono font-medium text-foreground">{uploadPreviewName}.docx</span>
                </div>
              )}

              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setUploadModal(prev => ({ ...prev, isDragging: true })); }}
                onDragLeave={() => setUploadModal(prev => ({ ...prev, isDragging: false }))}
                onDrop={e => {
                  e.preventDefault();
                  const f = e.dataTransfer.files[0];
                  if (f?.name.toLowerCase().endsWith(".docx")) {
                    setUploadModal(prev => ({ ...prev, file: f, isDragging: false, error: null }));
                  } else {
                    setUploadModal(prev => ({ ...prev, isDragging: false, error: "Only .docx files are accepted" }));
                  }
                }}
                onClick={() => !uploadModal.uploading && uploadFileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center gap-2 h-32 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
                  uploadModal.isDragging
                    ? "border-primary bg-primary/5"
                    : uploadModal.file
                      ? "border-green-500/50 bg-green-500/5"
                      : "border-border hover:border-foreground/30 hover:bg-accent/30"
                } ${uploadModal.uploading ? "pointer-events-none opacity-60" : ""}`}
              >
                <input
                  ref={uploadFileInputRef}
                  type="file"
                  accept=".docx"
                  className="sr-only"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) setUploadModal(prev => ({ ...prev, file: f, error: null }));
                    e.target.value = "";
                  }}
                />
                {uploadModal.file ? (
                  <>
                    <Check size={20} className="text-green-500" />
                    <p className="text-xs font-medium text-foreground text-center px-4 truncate max-w-full">{uploadModal.file.name}</p>
                    <p className="text-[11px] text-muted-foreground">Click to replace</p>
                  </>
                ) : (
                  <>
                    <UploadCloud size={20} className="text-muted-foreground" />
                    <p className="text-xs text-muted-foreground text-center">
                      <span className="font-medium text-foreground">Click to browse</span> or drag & drop
                    </p>
                    <p className="text-[11px] text-muted-foreground">.docx files only</p>
                  </>
                )}
              </div>

              {/* Error */}
              {uploadModal.error && (
                <p className="text-xs text-destructive flex items-center gap-1.5">
                  <AlertTriangle size={12} />{uploadModal.error}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
              <Dialog.Close render={
                <Button variant="outline" size="sm" disabled={uploadModal.uploading}>Cancel</Button>
              } />
              <Button size="sm" onClick={handleUploadSubmit}
                disabled={!uploadModal.file || !uploadModal.profileId || uploadModal.uploading}>
                {uploadModal.uploading ? "Uploading…" : "Upload to Drive"}
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Delete confirmation */}
      <Dialog.Root open={confirmDeleteId !== null} onOpenChange={open => { if (!open) setConfirmDeleteId(null); }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 duration-150" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-2rem)] max-w-sm bg-card rounded-xl ring-1 ring-foreground/10 shadow-xl p-6 space-y-4 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="shrink-0 flex items-center justify-center size-9 rounded-full bg-destructive/10">
                <AlertTriangle size={16} className="text-destructive" />
              </div>
              <div>
                <Dialog.Title className="text-sm font-semibold text-foreground">Delete application?</Dialog.Title>
                <Dialog.Description className="text-xs text-muted-foreground mt-1">This will permanently remove the application record. This action cannot be undone.</Dialog.Description>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Dialog.Close render={<Button variant="outline" size="sm" disabled={deletingId === confirmDeleteId}>Cancel</Button>} />
              <Button variant="destructive" size="sm" disabled={deletingId === confirmDeleteId}
                onClick={async () => { if (!confirmDeleteId) return; await handleDelete(confirmDeleteId); }}>
                {deletingId === confirmDeleteId ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
