"use client";

import { useEffect, useState, useRef } from "react";
import { ExternalLink, Contact, NotebookPen, X } from "lucide-react";
import { Dialog } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PipelineStatus = "screening" | "hr_interview" | "tech_1" | "tech_2" | "offer" | "failed";

interface Application {
  id: string;
  seq: number;
  role: string;
  company_name: string;
  job_url: string | null;
  pipeline_status: string;
  profile_name: string | null;
  recruiter_name: string | null;
  recruiter_email: string | null;
  recruiter_phone: string | null;
  scheduled_meeting_at: string | null;
  meeting_done: boolean;
  notes: string | null;
  created_at: string;
}

const COLUMNS: { id: PipelineStatus; label: string; color: string; dot: string }[] = [
  { id: "screening",    label: "Screening",    color: "border-t-pink-500",     dot: "bg-pink-500" },
  { id: "hr_interview", label: "HR Interview", color: "border-t-yellow-500",   dot: "bg-yellow-500" },
  { id: "tech_1",       label: "Tech 1",       color: "border-t-purple-500",   dot: "bg-purple-500" },
  { id: "tech_2",       label: "Tech 2",       color: "border-t-orange-500",   dot: "bg-orange-500" },
  { id: "offer",        label: "Offer",        color: "border-t-emerald-400",  dot: "bg-emerald-400" },
  { id: "failed",       label: "Failed",       color: "border-t-red-500",      dot: "bg-red-500" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function formatMeetingDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

// <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm" in local time, no timezone.
function toInputValue(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromInputValue(local: string) {
  if (!local) return null;
  return new Date(local).toISOString();
}

type ContactDraft = {
  recruiter_name: string;
  recruiter_email: string;
  recruiter_phone: string;
  scheduled_meeting_at: string;
  meeting_done: boolean;
};

const EMPTY_DRAFT: ContactDraft = {
  recruiter_name: "", recruiter_email: "", recruiter_phone: "", scheduled_meeting_at: "", meeting_done: false,
};

export default function JobBoardPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const draggingId = useRef<string | null>(null);

  const [contactModal, setContactModal] = useState<{
    open: boolean; app: Application | null; draft: ContactDraft; saving: boolean;
  }>({ open: false, app: null, draft: EMPTY_DRAFT, saving: false });

  const [notesModal, setNotesModal] = useState<{
    open: boolean; app: Application | null; draft: string; saving: boolean;
  }>({ open: false, app: null, draft: "", saving: false });

  useEffect(() => {
    let active = true;
    const stages = COLUMNS.map((c) => c.id).join(",");

    async function fetchAll() {
      const pageSize = 500;
      let page = 1;
      let all: Application[] = [];

      while (true) {
        const res = await fetch(`/api/applications?page=${page}&pageSize=${pageSize}&stages=${stages}`);
        const result = await res.json();
        const batch: Application[] = Array.isArray(result.data) ? result.data : [];
        all = all.concat(batch);

        // Stop once we've fetched every row the server reported, or the server ran out of rows.
        const total = typeof result.total === "number" ? result.total : all.length;
        if (batch.length < pageSize || all.length >= total) break;
        page += 1;
      }

      if (active) setApps(all);
    }

    fetchAll().finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function handleDragStart(id: string) {
    draggingId.current = id;
  }

  function handleDrop(targetStatus: PipelineStatus) {
    const id = draggingId.current;
    if (!id) return;
    draggingId.current = null;

    const app = apps.find((a) => a.id === id);
    if (!app || app.pipeline_status === targetStatus) return;

    setApps((prev) => prev.map((a) => a.id === id ? { ...a, pipeline_status: targetStatus } : a));

    fetch(`/api/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pipeline_status: targetStatus }),
    });
  }

  function openContactModal(app: Application) {
    setContactModal({
      open: true,
      app,
      draft: {
        recruiter_name: app.recruiter_name ?? "",
        recruiter_email: app.recruiter_email ?? "",
        recruiter_phone: app.recruiter_phone ?? "",
        scheduled_meeting_at: toInputValue(app.scheduled_meeting_at),
        meeting_done: app.meeting_done ?? false,
      },
      saving: false,
    });
  }

  async function saveContact() {
    const app = contactModal.app;
    if (!app) return;
    setContactModal((prev) => ({ ...prev, saving: true }));

    const { draft } = contactModal;
    const payload = {
      recruiter_name: draft.recruiter_name.trim() || null,
      recruiter_email: draft.recruiter_email.trim() || null,
      recruiter_phone: draft.recruiter_phone.trim() || null,
      scheduled_meeting_at: fromInputValue(draft.scheduled_meeting_at),
      meeting_done: draft.meeting_done,
    };

    const res = await fetch(`/api/applications/${app.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const updated = await res.json();
      setApps((prev) => prev.map((a) => a.id === app.id ? { ...a, ...updated } : a));
    }
    setContactModal((prev) => ({ ...prev, open: false, saving: false }));
  }

  function openNotesModal(app: Application) {
    setNotesModal({ open: true, app, draft: app.notes ?? "", saving: false });
  }

  async function saveNotes() {
    const app = notesModal.app;
    if (!app) return;
    setNotesModal((prev) => ({ ...prev, saving: true }));

    const res = await fetch(`/api/applications/${app.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notesModal.draft.trim() || null }),
    });

    if (res.ok) {
      const updated = await res.json();
      setApps((prev) => prev.map((a) => a.id === app.id ? { ...a, notes: updated.notes } : a));
    }
    setNotesModal((prev) => ({ ...prev, open: false, saving: false }));
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  const boardApps = apps.filter((a) => COLUMNS.some((c) => c.id === a.pipeline_status));

  return (
    <div className="h-full flex flex-col">
      <div className="px-8 py-6 border-b border-border flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Job Board</h1>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden px-8 py-6">
        <div className="flex gap-4 h-full min-w-max">
          {COLUMNS.map((col) => {
            const cards = boardApps.filter((a) => a.pipeline_status === col.id);
            return (
              <div
                key={col.id}
                className="flex flex-col w-64 bg-card rounded-xl ring-1 ring-foreground/10 overflow-hidden"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(col.id)}
              >
                {/* Column header */}
                <div className={`border-t-4 ${col.color} px-4 pt-3 pb-2`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                      <span className="text-sm font-semibold text-foreground">{col.label}</span>
                    </div>
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                      {cards.length}
                    </span>
                  </div>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {cards.length === 0 ? (
                    <div className="flex items-center justify-center h-20 text-xs text-muted-foreground/40">
                      Empty
                    </div>
                  ) : (
                    cards.map((app) => (
                      <div
                        key={app.id}
                        draggable
                        onDragStart={() => handleDragStart(app.id)}
                        className={`rounded-lg p-3 ring-1 cursor-grab active:cursor-grabbing space-y-2 transition-all ${
                          app.meeting_done
                            ? "bg-emerald-500/10 ring-emerald-500/40 hover:ring-emerald-500/60"
                            : "bg-background ring-foreground/10 hover:ring-primary/40"
                        }`}
                      >
                        {/* Line 1: seq · title */}
                        <p className="text-sm font-medium text-foreground leading-tight">
                          <span className="text-[11px] font-normal text-muted-foreground/60 mr-1">#{app.seq}</span>
                          {app.role}
                        </p>

                        {/* Line 2: company · profile · date */}
                        <p className="text-xs text-muted-foreground truncate">
                          {[app.company_name, app.profile_name, formatDate(app.created_at)]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>

                        {(app.recruiter_name || app.scheduled_meeting_at) && (
                          <div className="text-[11px] text-muted-foreground/80 space-y-0.5 border-t border-border/60 pt-1.5">
                            {app.recruiter_name && <p className="truncate">{app.recruiter_name}</p>}
                            {app.scheduled_meeting_at && (
                              <p className="truncate flex items-center gap-1">
                                Meeting: {formatMeetingDate(app.scheduled_meeting_at)}
                                {app.meeting_done && (
                                  <span className="text-emerald-500 font-medium">✓ Done</span>
                                )}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Line 3: actions */}
                        <div className="flex items-center gap-2 pt-0.5">
                          <button
                            onClick={() => openContactModal(app)}
                            className="flex-1 h-6 flex items-center justify-center gap-1.5 rounded-lg text-xs font-medium text-muted-foreground ring-1 ring-foreground/10 hover:text-primary hover:bg-accent active:scale-[0.97] transition-all"
                            title="Edit contact info"
                          >
                            <Contact size={15} />
                            Edit
                          </button>
                          <button
                            onClick={() => openNotesModal(app)}
                            className={`flex-1 h-6 flex items-center justify-center gap-1.5 rounded-lg text-xs font-medium ring-1 ring-foreground/10 hover:bg-accent active:scale-[0.97] transition-all ${
                              app.notes ? "text-primary" : "text-muted-foreground hover:text-primary"
                            }`}
                            title={app.notes ?? "Add note"}
                          >
                            <NotebookPen size={15} />
                            Note
                          </button>
                          {app.job_url && (
                            <a
                              href={app.job_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 h-6 flex items-center justify-center gap-1.5 rounded-lg text-xs font-medium text-muted-foreground ring-1 ring-foreground/10 hover:text-primary hover:bg-accent active:scale-[0.97] transition-all"
                            >
                              <ExternalLink size={15} />
                              Link
                            </a>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog.Root
        open={contactModal.open}
        onOpenChange={(open) => { if (!open && !contactModal.saving) setContactModal((prev) => ({ ...prev, open: false })); }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 duration-150" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-2rem)] max-w-md bg-card rounded-xl ring-1 ring-foreground/10 shadow-xl flex flex-col data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <div className="min-w-0">
                <Dialog.Title className="text-sm font-semibold text-foreground">Contact Info</Dialog.Title>
                <Dialog.Description className="text-xs text-muted-foreground mt-0.5 truncate">
                  {contactModal.app ? `${contactModal.app.company_name} — ${contactModal.app.role}` : ""}
                </Dialog.Description>
              </div>
              <Dialog.Close render={<button className="size-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"><X size={14} /></button>} />
            </div>

            <div className="px-5 py-4 space-y-3">
              <div className="space-y-1">
                <Label htmlFor="recruiter_name">Recruiter Name</Label>
                <Input
                  id="recruiter_name"
                  value={contactModal.draft.recruiter_name}
                  onChange={(e) => setContactModal((prev) => ({ ...prev, draft: { ...prev.draft, recruiter_name: e.target.value } }))}
                  disabled={contactModal.saving}
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="recruiter_email">Email</Label>
                <Input
                  id="recruiter_email"
                  type="email"
                  value={contactModal.draft.recruiter_email}
                  onChange={(e) => setContactModal((prev) => ({ ...prev, draft: { ...prev.draft, recruiter_email: e.target.value } }))}
                  disabled={contactModal.saving}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="recruiter_phone">Phone Number</Label>
                <Input
                  id="recruiter_phone"
                  type="tel"
                  value={contactModal.draft.recruiter_phone}
                  onChange={(e) => setContactModal((prev) => ({ ...prev, draft: { ...prev.draft, recruiter_phone: e.target.value } }))}
                  disabled={contactModal.saving}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="scheduled_meeting_at">Scheduled Meeting Date (optional)</Label>
                <Input
                  id="scheduled_meeting_at"
                  type="datetime-local"
                  value={contactModal.draft.scheduled_meeting_at}
                  onChange={(e) => setContactModal((prev) => ({ ...prev, draft: { ...prev.draft, scheduled_meeting_at: e.target.value } }))}
                  disabled={contactModal.saving}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground pt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="size-4 rounded border-input accent-emerald-500"
                  checked={contactModal.draft.meeting_done}
                  onChange={(e) => setContactModal((prev) => ({ ...prev, draft: { ...prev.draft, meeting_done: e.target.checked } }))}
                  disabled={contactModal.saving}
                />
                Meeting done
              </label>
            </div>

            <div className="flex justify-end gap-2 px-5 pb-5">
              <Dialog.Close render={<Button variant="outline" size="sm" disabled={contactModal.saving}>Cancel</Button>} />
              <Button size="sm" onClick={saveContact} disabled={contactModal.saving}>
                {contactModal.saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root
        open={notesModal.open}
        onOpenChange={(open) => { if (!open && !notesModal.saving) setNotesModal((prev) => ({ ...prev, open: false })); }}
      >
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
                onChange={(e) => setNotesModal((prev) => ({ ...prev, draft: e.target.value }))}
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
    </div>
  );
}
