"use client";

import { useEffect, useState, useCallback } from "react";
import React from "react";
import {
  Users, Trash2, Pencil, X, Check, Plus, AlertTriangle, RefreshCw,
  Eye, EyeOff, ChevronDown, ChevronUp, Power,
} from "lucide-react";
import { Dialog } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TeamUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "assistant";
  is_active: boolean;
  created_at: string;
}

interface Profile { id: string; name: string; }
interface Assignment { id: string; profile_id: string; user_id: string; }

type FormState = { name: string; email: string; password: string; role: "admin" | "assistant" };
const EMPTY_FORM: FormState = { name: "", email: "", password: "", role: "assistant" };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function PasswordInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} className="pr-8 h-8 text-sm" />
      <button type="button" onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
        {show ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
    </div>
  );
}

function AssignmentPanel({ member, profiles }: { member: TeamUser; profiles: Profile[] }) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState("");
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/profile-assignments?user_id=${member.id}`)
      .then((r) => r.json())
      .then((data) => setAssignments(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [member.id]);

  const assignedProfileIds = new Set(assignments.map((a) => a.profile_id));
  const available = profiles.filter((p) => !assignedProfileIds.has(p.id));

  const add = async () => {
    if (!addingId) return;
    setSaving(true);
    const res = await fetch("/api/profile-assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile_id: addingId, user_id: member.id }),
    });
    if (res.ok) {
      const created: Assignment = await res.json();
      setAssignments((prev) => [...prev, created]);
      setAddingId("");
    }
    setSaving(false);
  };

  const remove = async (id: string) => {
    setRemovingId(id);
    await fetch(`/api/profile-assignments/${id}`, { method: "DELETE" });
    setAssignments((prev) => prev.filter((a) => a.id !== id));
    setRemovingId(null);
  };

  return (
    <div className="px-4 pb-3 pt-1 bg-muted/20 border-t border-border">
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
        Profile Access
      </p>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-1.5">
          {assignments.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No profiles assigned.</p>
          )}
          {assignments.map((a) => {
            const profile = profiles.find((p) => p.id === a.profile_id);
            return (
              <div key={a.id} className="flex items-center justify-between bg-background rounded-lg px-3 py-1.5 text-xs border border-border">
                <span className="text-foreground">{profile?.name ?? a.profile_id}</span>
                <button
                  onClick={() => remove(a.id)}
                  disabled={removingId === a.id}
                  className="text-muted-foreground hover:text-destructive transition-colors ml-2"
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}

          {available.length > 0 && (
            <div className="flex gap-2 pt-1">
              <select
                className="field-input text-xs flex-1"
                value={addingId}
                onChange={(e) => setAddingId(e.target.value)}
              >
                <option value="">Add profile…</option>
                {available.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <Button size="sm" className="h-7 text-xs px-3" onClick={add} disabled={!addingId || saving}>
                {saving ? "…" : <><Plus size={11} /> Add</>}
              </Button>
            </div>
          )}
          {available.length === 0 && assignments.length > 0 && (
            <p className="text-[11px] text-muted-foreground italic">All profiles assigned.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamUser[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<{ name: string; email: string; role: "admin" | "assistant"; password: string }>({
    name: "", email: "", role: "assistant", password: "",
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<FormState>(EMPTY_FORM);
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);
  const [apiError, setApiError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [teamRes, profileRes] = await Promise.all([
      fetch("/api/team"),
      fetch("/api/profiles"),
    ]);
    if (teamRes.ok) setMembers(await teamRes.json());
    if (profileRes.ok) setProfiles(await profileRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const startEdit = (m: TeamUser) => {
    setEditingId(m.id);
    setEditFields({ name: m.name, email: m.email, role: m.role, password: "" });
    setApiError("");
  };
  const cancelEdit = () => { setEditingId(null); setApiError(""); };

  const saveEdit = async (id: string) => {
    if (!editFields.name.trim() || !editFields.email.trim()) return;
    setSavingId(id);
    setApiError("");
    const body: Record<string, string> = { name: editFields.name, email: editFields.email, role: editFields.role };
    if (editFields.password.trim()) body.password = editFields.password.trim();
    const res = await fetch(`/api/team/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const updated: TeamUser = await res.json();
      setMembers((prev) => prev.map((m) => (m.id === id ? updated : m)));
      setEditingId(null);
    } else {
      const data = await res.json();
      setApiError(data.message ?? "Failed to update.");
    }
    setSavingId(null);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const res = await fetch(`/api/team/${id}`, { method: "DELETE" });
    if (res.ok) {
      setMembers((prev) => prev.filter((m) => m.id !== id));
    } else {
      const data = await res.json();
      setApiError(data.message ?? "Failed to delete.");
    }
    setDeletingId(null);
    setConfirmDeleteId(null);
  };

  const handleToggle = async (m: TeamUser) => {
    setTogglingId(m.id);
    setApiError("");
    const res = await fetch(`/api/team/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !m.is_active }),
    });
    if (res.ok) {
      const updated: TeamUser = await res.json();
      setMembers((prev) => prev.map((u) => (u.id === m.id ? updated : u)));
    } else {
      const data = await res.json();
      setApiError(data.message ?? "Failed to update status.");
    }
    setTogglingId(null);
  };

  const handleCreate = async () => {
    if (!createForm.name.trim() || !createForm.email.trim() || !createForm.password.trim()) {
      setCreateError("All fields are required.");
      return;
    }
    setCreating(true);
    setCreateError("");
    const res = await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createForm),
    });
    if (res.ok) {
      const created: TeamUser = await res.json();
      setMembers((prev) => [...prev, created]);
      setCreateOpen(false);
      setCreateForm(EMPTY_FORM);
    } else {
      const data = await res.json();
      setCreateError(data.message ?? "Failed to create member.");
    }
    setCreating(false);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-border flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-semibold text-foreground">Team</h1>
          <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">
            Manage assistant accounts and profile access
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => { load(); }} disabled={loading}>
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button size="sm" onClick={() => { setCreateForm(EMPTY_FORM); setCreateError(""); setCreateOpen(true); }}>
            <Plus size={13} /> Add Member
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-4 sm:py-6">
        {apiError && (
          <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg mb-4">{apiError}</p>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">Loading…</div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-3">
            <Users size={40} className="text-muted-foreground/30" />
            <p className="text-sm">No team members yet</p>
          </div>
        ) : (
          <div className="bg-card rounded-xl ring-1 ring-foreground/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Joined</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {members.map((m) => (
                  <React.Fragment key={m.id}>
                    <tr className={`hover:bg-accent/30 transition-colors${!m.is_active ? " opacity-60" : ""}`}>
                      <td className="px-4 py-3.5">
                        {editingId === m.id ? (
                          <Input value={editFields.name} onChange={(e) => setEditFields((f) => ({ ...f, name: e.target.value }))}
                            className="h-7 text-sm w-32" autoFocus />
                        ) : (
                          <span className="font-medium text-foreground">{m.name}</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground">
                        {editingId === m.id ? (
                          <Input type="email" value={editFields.email} onChange={(e) => setEditFields((f) => ({ ...f, email: e.target.value }))}
                            className="h-7 text-sm w-44" />
                        ) : (
                          <span className="text-xs">{m.email}</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {editingId === m.id ? (
                          <Select value={editFields.role} onValueChange={(v) => v && setEditFields((f) => ({ ...f, role: v as "admin" | "assistant" }))}>
                            <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin" className="text-xs">Admin</SelectItem>
                              <SelectItem value="assistant" className="text-xs">Assistant</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant={m.role === "admin" ? "default" : "secondary"} className="capitalize text-xs">
                            {m.role}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3.5 hidden sm:table-cell">
                        {m.is_active ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-muted text-muted-foreground ring-1 ring-foreground/10">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground text-xs hidden lg:table-cell">{formatDate(m.created_at)}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          {editingId === m.id ? (
                            <>
                              <div className="w-32">
                                <PasswordInput value={editFields.password} onChange={(v) => setEditFields((f) => ({ ...f, password: v }))} placeholder="New password…" />
                              </div>
                              {apiError && <span className="text-xs text-destructive max-w-32 truncate">{apiError}</span>}
                              <button onClick={() => saveEdit(m.id)} disabled={savingId === m.id}
                                className="inline-flex items-center justify-center size-7 rounded-lg bg-primary text-primary-foreground hover:bg-primary/80 transition-all disabled:opacity-50" title="Save">
                                <Check size={12} />
                              </button>
                              <button onClick={cancelEdit}
                                className="inline-flex items-center justify-center size-7 rounded-lg border border-input bg-transparent text-muted-foreground hover:text-foreground hover:bg-accent transition-all" title="Cancel">
                                <X size={12} />
                              </button>
                            </>
                          ) : (
                            <>
                              {m.role === "assistant" && (
                                <button
                                  onClick={() => setExpandedId(expandedId === m.id ? null : m.id)}
                                  className="inline-flex items-center justify-center size-7 rounded-lg border border-input bg-transparent text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
                                  title="Manage profile access"
                                >
                                  {expandedId === m.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                </button>
                              )}
                              <button onClick={() => startEdit(m)}
                                className="inline-flex items-center justify-center size-7 rounded-lg border border-input bg-transparent text-muted-foreground hover:text-foreground hover:bg-accent transition-all" title="Edit">
                                <Pencil size={12} />
                              </button>
                              <button
                                onClick={() => handleToggle(m)}
                                disabled={togglingId === m.id}
                                className={`inline-flex items-center justify-center size-7 rounded-lg border border-input bg-transparent transition-all disabled:opacity-50 ${
                                  m.is_active
                                    ? "text-muted-foreground hover:text-destructive hover:border-destructive/30 hover:bg-destructive/5"
                                    : "text-muted-foreground hover:text-emerald-500 hover:border-emerald-500/30 hover:bg-emerald-500/5"
                                }`}
                                title={m.is_active ? "Disable member" : "Enable member"}
                              >
                                <Power size={12} />
                              </button>
                              <Button size="icon-sm" variant="ghost" onClick={() => setConfirmDeleteId(m.id)} disabled={deletingId === m.id}
                                className="text-muted-foreground hover:text-destructive">
                                <Trash2 size={13} />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedId === m.id && (
                      <tr key={`${m.id}-assignments`}>
                        <td colSpan={6} className="p-0">
                          <AssignmentPanel member={m} profiles={profiles} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create member dialog */}
      <Dialog.Root open={createOpen} onOpenChange={(open) => { if (!open) setCreateOpen(false); }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 duration-150" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-2rem)] max-w-sm bg-card rounded-xl ring-1 ring-foreground/10 shadow-xl p-5 sm:p-6 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-sm font-semibold text-foreground">Add Team Member</Dialog.Title>
              <Dialog.Close render={<button className="size-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"><X size={14} /></button>} />
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Name</label>
                <Input value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} placeholder="Full name" className="h-8 text-sm" autoFocus />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Email</label>
                <Input type="email" value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} placeholder="email@example.com" className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Password</label>
                <PasswordInput value={createForm.password} onChange={(v) => setCreateForm((f) => ({ ...f, password: v }))} placeholder="Set a password" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Role</label>
                <Select value={createForm.role} onValueChange={(v) => v && setCreateForm((f) => ({ ...f, role: v as "admin" | "assistant" }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="assistant" className="text-xs">Assistant</SelectItem>
                    <SelectItem value="admin" className="text-xs">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {createError && <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{createError}</p>}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Dialog.Close render={<Button variant="outline" size="sm" disabled={creating}>Cancel</Button>} />
              <Button size="sm" onClick={handleCreate} disabled={creating}>{creating ? "Creating…" : "Create Member"}</Button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Delete confirmation dialog */}
      <Dialog.Root open={confirmDeleteId !== null} onOpenChange={(open) => { if (!open) setConfirmDeleteId(null); }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 duration-150" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-2rem)] max-w-sm bg-card rounded-xl ring-1 ring-foreground/10 shadow-xl p-5 sm:p-6 space-y-4 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="shrink-0 flex items-center justify-center size-9 rounded-full bg-destructive/10">
                <AlertTriangle size={16} className="text-destructive" />
              </div>
              <div>
                <Dialog.Title className="text-sm font-semibold text-foreground">Remove member?</Dialog.Title>
                <Dialog.Description className="text-xs text-muted-foreground mt-1">
                  This will permanently remove their account. They will no longer be able to sign in.
                </Dialog.Description>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Dialog.Close render={<Button variant="outline" size="sm" disabled={deletingId === confirmDeleteId}>Cancel</Button>} />
              <Button variant="destructive" size="sm" disabled={deletingId === confirmDeleteId} onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}>
                {deletingId === confirmDeleteId ? "Removing…" : "Remove"}
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
