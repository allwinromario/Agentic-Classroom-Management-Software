"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Calendar, Trash2, SendHorizonal, BookOpen, X, Pencil, Users, CheckCircle, AlertTriangle, Timer } from "lucide-react";
import { DashboardLayout, PageHeader } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate, formatTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface ClassItem {
  id?: string;
  subject: string;
  room: string;
  startTime: string;
  endTime: string;
  dayOfWeek: string;
  lateThresholdMins: number;
}

interface Timetable {
  id: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  classes: ClassItem[];
}

interface Student {
  id: string;
  name: string;
  email: string;
  faceRegistered: boolean;
}

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const emptyClass = (): ClassItem => ({ subject: "", room: "", startTime: "09:00", endTime: "10:00", dayOfWeek: "MONDAY", lateThresholdMins: 10 });

export default function AdminTimetablePage() {
  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "" });
  const [classes, setClasses] = useState<ClassItem[]>([emptyClass()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  /** Status before opening the edit dialog (drives re-approval UX for APPROVED) */
  const [editingPreEditStatus, setEditingPreEditStatus] = useState<string | null>(null);

  // Enrollment dialog
  const [enrollDialog, setEnrollDialog] = useState(false);
  const [enrollingClass, setEnrollingClass] = useState<ClassItem | null>(null);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());
  const [enrollSaving, setEnrollSaving] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");

  const fetchTimetables = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/timetables");
    const data = await r.json();
    setTimetables(data.timetables ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTimetables(); }, [fetchTimetables]);

  // Open enrollment dialog for a class
  const openEnroll = async (cls: ClassItem) => {
    if (!cls.id) return;
    setEnrollingClass(cls);
    setStudentSearch("");

    const [studentsRes, enrollRes] = await Promise.all([
      fetch("/api/users?role=STUDENT&status=APPROVED").then((r) => r.json()),
      fetch(`/api/classes/${cls.id}/enrollments`).then((r) => r.json()),
    ]);
    setAllStudents(studentsRes.users ?? []);
    const ids = new Set<string>((enrollRes.enrollments ?? []).map((e: { student: { id: string } }) => e.student.id));
    setEnrolledIds(ids);
    setEnrollDialog(true);
  };

  const toggleEnroll = (sid: string) => {
    setEnrolledIds((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid); else next.add(sid);
      return next;
    });
  };

  const saveEnrollment = async () => {
    if (!enrollingClass?.id) return;
    setEnrollSaving(true);
    await fetch(`/api/classes/${enrollingClass.id}/enrollments`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentIds: Array.from(enrolledIds) }),
    });
    setEnrollSaving(false);
    setEnrollDialog(false);
  };

  const openCreate = () => {
    setEditingId(null);
    setEditingPreEditStatus(null);
    setForm({ title: "", description: "" });
    setClasses([emptyClass()]);
    setError("");
    setDialogOpen(true);
  };

  const openEdit = (t: Timetable) => {
    setEditingId(t.id);
    setEditingPreEditStatus(t.status);
    setForm({ title: t.title, description: t.description ?? "" });
    setClasses(t.classes.length > 0 ? t.classes.map((c) => ({ subject: c.subject, room: c.room ?? "", startTime: c.startTime, endTime: c.endTime, dayOfWeek: c.dayOfWeek, lateThresholdMins: (c as ClassItem).lateThresholdMins ?? 10 })) : [emptyClass()]);
    setError("");
    setDialogOpen(true);
  };

  const handleSave = async (
    e: React.FormEvent | null,
    resubmitMode?: "draft" | "pending"
  ) => {
    if (e) e.preventDefault();
    setError("");
    setSaving(true);

    let payload: Record<string, unknown> = { ...form, classes };
    if (editingPreEditStatus === "APPROVED") {
      if (resubmitMode === "draft") payload.status = "DRAFT";
      else if (resubmitMode === "pending") payload.status = "PENDING_APPROVAL";
      else {
        setError("Choose how to save: draft or submit for approval.");
        setSaving(false);
        return;
      }
    }

    const r = editingId
      ? await fetch(`/api/timetables/${editingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      : await fetch("/api/timetables", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, classes }) });
    const data = await r.json();
    if (!r.ok) {
      setError(data.error ?? "Failed to save");
    } else {
      setTimetables((prev) => (editingId ? prev.map((t) => (t.id === editingId ? data.timetable : t)) : [data.timetable, ...prev]));
      setDialogOpen(false);
      setEditingPreEditStatus(null);
    }
    setSaving(false);
  };

  const submitForApproval = async (id: string) => {
    setActionLoading(id);
    const r = await fetch(`/api/timetables/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "PENDING_APPROVAL" }) });
    if (r.ok) setTimetables((prev) => prev.map((t) => t.id === id ? { ...t, status: "PENDING_APPROVAL" } : t));
    setActionLoading(null);
  };

  const deleteTimetable = async (id: string) => {
    if (!confirm("Delete this timetable?")) return;
    setActionLoading(id + "del");
    await fetch(`/api/timetables/${id}`, { method: "DELETE" });
    setTimetables((prev) => prev.filter((t) => t.id !== id));
    setActionLoading(null);
  };

  const updateClass = (i: number, field: keyof ClassItem, value: string | number) => {
    setClasses((prev) => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c));
  };

  const canEditContent = (status: string) =>
    ["DRAFT", "REJECTED", "APPROVED", "PENDING_APPROVAL"].includes(status);
  const canDelete = (status: string) => status === "DRAFT" || status === "REJECTED";
  const filteredStudents = allStudents.filter((s) => s.name.toLowerCase().includes(studentSearch.toLowerCase()) || s.email.toLowerCase().includes(studentSearch.toLowerCase()));

  return (
    <DashboardLayout requiredRole="ADMIN">
      <PageHeader title="Timetable Management" description="Create schedules, edit approved timetables and resubmit for approval, enroll students"
        action={<Button onClick={openCreate}><Plus className="h-4 w-4" />Create Timetable</Button>}
      />

      {loading ? (
        <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-zinc-800/40 animate-pulse" />)}</div>
      ) : timetables.length === 0 ? (
        <Card className="p-16 text-center">
          <Calendar className="h-16 w-16 mx-auto text-zinc-700 mb-4" />
          <h3 className="text-lg font-semibold text-zinc-300 mb-2">No timetables yet</h3>
          <Button onClick={openCreate}><Plus className="h-4 w-4" />Create Timetable</Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {timetables.map((t, i) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-zinc-100">{t.title}</h3>
                        <StatusBadge status={t.status} />
                      </div>
                      {t.description && <p className="text-sm text-zinc-500 mb-1">{t.description}</p>}
                      <p className="text-xs text-zinc-600">{t.classes.length} classes · Created {formatDate(t.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {canEditContent(t.status) && (
                        <Button size="sm" variant="outline" onClick={() => openEdit(t)}>
                          <Pencil className="h-3.5 w-3.5" />
                          {t.status === "APPROVED" ? "Edit & resubmit" : "Edit"}
                        </Button>
                      )}
                      {t.status === "DRAFT" && (
                        <Button size="sm" variant="secondary" loading={actionLoading === t.id} onClick={() => submitForApproval(t.id)}>
                          <SendHorizonal className="h-3.5 w-3.5" />Submit
                        </Button>
                      )}
                      {canDelete(t.status) && (
                        <Button size="icon" variant="ghost" className="text-zinc-600 hover:text-red-400" loading={actionLoading === t.id + "del"} onClick={() => deleteTimetable(t.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {t.classes.length > 0 && (
                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                      {t.classes.map((c, ci) => (
                        <div key={c.id ?? ci} className="p-2.5 rounded-xl bg-zinc-800/40 border border-zinc-700/30 group relative">
                          <p className="text-xs font-medium text-zinc-300">{c.subject}</p>
                          <p className="text-xs text-zinc-600 mt-0.5">{c.dayOfWeek?.slice(0, 3)} · {formatTime(c.startTime)}</p>
                          {c.room && <p className="text-xs text-zinc-700">{c.room}</p>}
                          <p className="text-[10px] text-amber-600/80 mt-0.5 flex items-center gap-0.5">
                            <Timer className="h-2.5 w-2.5" />
                            Late after {(c as ClassItem).lateThresholdMins ?? 10}min
                          </p>
                          {/* Enroll students button — only for approved timetable classes with an ID */}
                          {c.id && t.status === "APPROVED" && (
                            <button onClick={() => openEnroll(c)}
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/40"
                              title="Enroll students"
                            >
                              <Users className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {t.status === "APPROVED" && t.classes.length > 0 && (
                    <p className="mt-2 text-xs text-zinc-600 flex items-center gap-1">
                      <Users className="h-3 w-3" /> Hover over a class to enroll students
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingPreEditStatus(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId
                ? editingPreEditStatus === "APPROVED"
                  ? "Edit timetable — re-approval required"
                  : "Edit Timetable"
                : "Create New Timetable"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Set the timetable title, description, and class slots with subject, room, day, and times.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              if (editingPreEditStatus === "APPROVED") {
                e.preventDefault();
                return;
              }
              handleSave(e);
            }}
            className="space-y-5"
          >
            {editingPreEditStatus === "APPROVED" && (
              <div className="flex gap-3 p-3 rounded-xl bg-amber-950/35 border border-amber-800/40 text-sm text-amber-200/90">
                <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-400" />
                <p>
                  Saving changes removes <strong className="text-amber-100">approved</strong> status until a Super Admin approves again.
                  Replacing class slots clears per-class enrollments — you may need to enroll students again after approval.
                </p>
              </div>
            )}
            <Input label="Timetable Title" placeholder="e.g. Class 10 — Term 2" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            <Input label="Description (optional)" placeholder="Brief description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-zinc-300 flex items-center gap-2"><BookOpen className="h-4 w-4 text-indigo-400" />Classes</label>
                <Button type="button" size="sm" variant="outline" onClick={() => setClasses([...classes, emptyClass()])}><Plus className="h-3.5 w-3.5" />Add Class</Button>
              </div>
              <div className="space-y-3">
                <AnimatePresence>
                  {classes.map((c, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                      className="p-4 rounded-xl bg-zinc-800/40 border border-zinc-700/40 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-zinc-400">Class {i + 1}</p>
                        {classes.length > 1 && (
                          <button type="button" onClick={() => setClasses(classes.filter((_, idx) => idx !== i))} className="text-zinc-600 hover:text-red-400"><X className="h-4 w-4" /></button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Input placeholder="Subject (e.g. Math)" value={c.subject} onChange={(e) => updateClass(i, "subject", e.target.value)} required />
                        <Input placeholder="Room (optional)" value={c.room} onChange={(e) => updateClass(i, "room", e.target.value)} />
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs text-zinc-400">Day</label>
                          <select value={c.dayOfWeek} onChange={(e) => updateClass(i, "dayOfWeek", e.target.value)}
                            className="h-9 rounded-xl border border-zinc-700 bg-zinc-800/50 px-2.5 text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
                            {DAYS.map((d) => <option key={d} value={d}>{d.slice(0, 3)}</option>)}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs text-zinc-400">Start</label>
                          <input type="time" value={c.startTime} onChange={(e) => updateClass(i, "startTime", e.target.value)}
                            className="h-9 rounded-xl border border-zinc-700 bg-zinc-800/50 px-2.5 text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs text-zinc-400">End</label>
                          <input type="time" value={c.endTime} onChange={(e) => updateClass(i, "endTime", e.target.value)}
                            className="h-9 rounded-xl border border-zinc-700 bg-zinc-800/50 px-2.5 text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs text-zinc-400 flex items-center gap-1">
                            <Timer className="h-3 w-3 text-amber-400" />
                            Late after (min)
                          </label>
                          <input
                            type="number" min={1} max={60}
                            value={c.lateThresholdMins}
                            onChange={(e) => updateClass(i, "lateThresholdMins", Math.min(60, Math.max(1, Number(e.target.value))))}
                            className="h-9 rounded-xl border border-zinc-700 bg-zinc-800/50 px-2.5 text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                          />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
            {error && <p className="text-sm text-red-400 bg-red-950/30 border border-red-800/40 rounded-xl px-3 py-2">{error}</p>}
            <div className="flex flex-wrap justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              {editingId && editingPreEditStatus === "APPROVED" ? (
                <>
                  <Button type="button" variant="outline" loading={saving} onClick={() => handleSave(null, "draft")}>
                    Save as draft
                  </Button>
                  <Button type="button" loading={saving} onClick={() => handleSave(null, "pending")}>
                    <SendHorizonal className="h-3.5 w-3.5" />
                    Save &amp; submit for approval
                  </Button>
                </>
              ) : (
                <Button type="submit" loading={saving}>{editingId ? "Save Changes" : "Create Timetable"}</Button>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Enrollment Dialog */}
      <Dialog open={enrollDialog} onOpenChange={setEnrollDialog}>
        <DialogContent className="max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-400" />
              Enroll Students — {enrollingClass?.subject}
              {enrollingClass?.dayOfWeek && (
                <span className="text-sm font-normal text-zinc-500">
                  · {enrollingClass.dayOfWeek.slice(0, 3)} {formatTime(enrollingClass.startTime)}–{formatTime(enrollingClass.endTime)}
                  {enrollingClass.room ? ` · ${enrollingClass.room}` : ""}
                </span>
              )}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Search and select students to enroll in this class slot.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 min-h-0 flex-1 overflow-hidden">
            {/* Search + select-all row */}
            <div className="flex gap-2 flex-shrink-0">
              <input
                placeholder="Search students…"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="flex-1 h-9 rounded-xl border border-zinc-700 bg-zinc-800/50 px-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
              {allStudents.length > 0 && (
                <button
                  onClick={() => {
                    const allFilteredIds = filteredStudents.map((s) => s.id);
                    const allSelected = allFilteredIds.every((id) => enrolledIds.has(id));
                    setEnrolledIds((prev) => {
                      const next = new Set(prev);
                      if (allSelected) {
                        allFilteredIds.forEach((id) => next.delete(id));
                      } else {
                        allFilteredIds.forEach((id) => next.add(id));
                      }
                      return next;
                    });
                  }}
                  className={cn(
                    "flex-shrink-0 flex items-center gap-1.5 px-3 h-9 rounded-xl border text-xs font-medium transition-all",
                    filteredStudents.length > 0 && filteredStudents.every((s) => enrolledIds.has(s.id))
                      ? "border-indigo-500/50 bg-indigo-950/30 text-indigo-300"
                      : "border-zinc-700 bg-zinc-800/40 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                  )}
                >
                  <div className={cn(
                    "w-4 h-4 rounded border flex items-center justify-center",
                    filteredStudents.length > 0 && filteredStudents.every((s) => enrolledIds.has(s.id))
                      ? "bg-indigo-600 border-indigo-600"
                      : filteredStudents.some((s) => enrolledIds.has(s.id))
                        ? "bg-indigo-600/40 border-indigo-500/60"
                        : "border-zinc-600"
                  )}>
                    {filteredStudents.length > 0 && filteredStudents.every((s) => enrolledIds.has(s.id)) && (
                      <CheckCircle className="h-3 w-3 text-white" />
                    )}
                    {filteredStudents.some((s) => enrolledIds.has(s.id)) && !filteredStudents.every((s) => enrolledIds.has(s.id)) && (
                      <span className="w-2 h-0.5 bg-indigo-300 rounded-full" />
                    )}
                  </div>
                  {filteredStudents.length > 0 && filteredStudents.every((s) => enrolledIds.has(s.id))
                    ? "Deselect all"
                    : "Select all"}
                  {studentSearch && ` (${filteredStudents.length})`}
                </button>
              )}
            </div>

            {/* Student count summary */}
            <div className="flex items-center justify-between flex-shrink-0">
              <p className="text-xs text-zinc-500">
                {filteredStudents.length} student{filteredStudents.length !== 1 ? "s" : ""}
                {studentSearch ? " matched" : " total"}
              </p>
              <p className="text-xs font-medium text-indigo-400">
                {enrolledIds.size} selected
                {enrolledIds.size === 0 && <span className="text-zinc-600 font-normal"> · all approved students can mark attendance</span>}
              </p>
            </div>

            {/* Student list */}
            {allStudents.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center py-10">No approved students found</p>
            ) : filteredStudents.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center py-10">No students match "{studentSearch}"</p>
            ) : (
              <div className="overflow-y-auto flex-1 pr-1 space-y-1.5">
                {filteredStudents.map((s) => {
                  const enrolled = enrolledIds.has(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => toggleEnroll(s.id)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all",
                        enrolled
                          ? "border-indigo-500/50 bg-indigo-950/30"
                          : "border-zinc-700/40 bg-zinc-800/20 hover:border-zinc-600"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-all",
                        enrolled ? "bg-indigo-600 border-indigo-600" : "border-zinc-600"
                      )}>
                        {enrolled && <CheckCircle className="h-3.5 w-3.5 text-white" />}
                      </div>
                      <div className="w-8 h-8 rounded-lg bg-zinc-700/50 flex items-center justify-center text-xs font-bold text-zinc-400 flex-shrink-0">
                        {s.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-200 truncate">{s.name}</p>
                        <p className="text-xs text-zinc-500 truncate">{s.email}</p>
                      </div>
                      {s.faceRegistered
                        ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 flex-shrink-0">Face ✓</span>
                        : <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-700/40 text-zinc-500 border border-zinc-700/30 flex-shrink-0">No face</span>
                      }
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end gap-2 flex-shrink-0 pt-1 border-t border-zinc-800/50">
              <Button variant="outline" onClick={() => setEnrollDialog(false)}>Cancel</Button>
              <Button loading={enrollSaving} onClick={saveEnrollment}>
                <Users className="h-4 w-4" />
                Save Enrollment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
