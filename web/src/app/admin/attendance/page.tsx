"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, Users, CheckCircle2, XCircle, Clock, BookOpen, ChevronDown,
  MapPin, RefreshCw, ExternalLink, ScanFace, Radio, Lock, Pencil,
  History, BarChart3, ChevronRight, TrendingUp,
} from "lucide-react";
import { DashboardLayout, PageHeader } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

function useCountdown(savedAt: string | undefined | null) {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!savedAt) { setRemaining(null); return; }
    const tick = () => {
      const left = EDIT_WINDOW_MS - (Date.now() - new Date(savedAt).getTime());
      setRemaining(left > 0 ? left : 0);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [savedAt]);
  return remaining;
}

function formatCountdown(ms: number) {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  return `${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
}

interface Student { id: string; name: string; email: string; faceRegistered: boolean; }
interface ClassItem { id: string; subject: string; dayOfWeek: string; startTime: string; endTime: string; }
interface Timetable { id: string; title: string; classes: ClassItem[]; }

interface AttendanceRecord {
  id: string;
  status: "PRESENT" | "ABSENT" | "LATE";
  timestamp: string;
  savedAt?: string | null;
  remarks?: string;
  latitude?: number | null;
  longitude?: number | null;
  locationName?: string | null;
  student: { id: string; name: string; email?: string };
  class?: { id: string; subject: string; dayOfWeek: string; startTime: string };
}

interface AttendanceEntry {
  studentId: string;
  studentName: string;
  status: "PRESENT" | "ABSENT" | "LATE";
  record?: AttendanceRecord;
}

const DAY_ABBREV: Record<string, string> = { MONDAY: "Mon", TUESDAY: "Tue", WEDNESDAY: "Wed", THURSDAY: "Thu", FRIDAY: "Fri", SATURDAY: "Sat", SUNDAY: "Sun" };

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

// ── Live roster row ───────────────────────────────────────────────────────────

interface RowProps {
  entry: AttendanceEntry;
  student: Student | undefined;
  saving: boolean;
  savedNow: boolean;
  inEditMode: boolean;
  isLocked: boolean;
  isSaved: boolean;
  onSetStatus: (s: "PRESENT" | "ABSENT" | "LATE") => void;
  onSave: () => void;
  onEdit: () => void;
}

function AttendanceRow({ entry, student, saving, savedNow, inEditMode, isLocked, isSaved, onSetStatus, onSave, onEdit }: RowProps) {
  const rec = entry.record;
  const hasLocation = rec?.latitude != null && rec?.longitude != null;
  const isFaceMarked = rec?.remarks?.includes("face recognition");
  const remaining = useCountdown(isSaved ? (rec?.savedAt ?? null) : null);
  const isEditable = !rec?.savedAt || inEditMode;

  if (!student) return null;

  return (
    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="px-5 py-3 hover:bg-zinc-800/20 transition-colors">
      <div className="flex items-center gap-4">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
          {student.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-zinc-200 truncate">{student.name}</p>
            {isFaceMarked && (
              <span className="flex-shrink-0 flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-600/15 text-indigo-400 border border-indigo-600/20">
                <ScanFace className="h-2.5 w-2.5" />Face
              </span>
            )}
            {isLocked && (
              <span className="flex-shrink-0 flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-700/40 text-zinc-500 border border-zinc-600/30">
                <Lock className="h-2.5 w-2.5" />Locked
              </span>
            )}
            {isSaved && !isLocked && remaining !== null && (
              <span className="flex-shrink-0 flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-600/10 text-amber-400 border border-amber-600/20">
                <Clock className="h-2.5 w-2.5" />Editable for {formatCountdown(remaining)}
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 truncate">{student.email}</p>

          {rec && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
              <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                <Clock className="h-3 w-3 text-zinc-600" />
                {formatTimestamp(rec.timestamp)}
              </span>
              {hasLocation ? (
                <a
                  href={`https://www.google.com/maps?q=${rec.latitude},${rec.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors"
                  title={`${rec.latitude?.toFixed(5)}, ${rec.longitude?.toFixed(5)}`}
                >
                  <MapPin className="h-3 w-3" />
                  {rec.locationName ?? `${rec.latitude?.toFixed(4)}, ${rec.longitude?.toFixed(4)}`}
                  <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                </a>
              ) : (
                <span className="flex items-center gap-1 text-[11px] text-zinc-600">
                  <MapPin className="h-3 w-3" />
                  {rec.remarks?.includes("face recognition") ? "Location not shared" : "No location"}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right-side controls */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isLocked ? (
            <span className={cn("px-2.5 py-1 rounded-lg text-xs font-medium border",
              entry.status === "PRESENT" ? "bg-emerald-600/15 border-emerald-600/30 text-emerald-400"
              : entry.status === "LATE"    ? "bg-amber-600/15 border-amber-600/30 text-amber-400"
              :                              "bg-red-600/15 border-red-600/30 text-red-400"
            )}>
              {entry.status === "PRESENT" ? <CheckCircle2 className="h-3.5 w-3.5 inline -mt-0.5 mr-1" /> : entry.status === "ABSENT" ? <XCircle className="h-3.5 w-3.5 inline -mt-0.5 mr-1" /> : <Clock className="h-3.5 w-3.5 inline -mt-0.5 mr-1" />}
              {entry.status.slice(0, 1) + entry.status.slice(1).toLowerCase()}
            </span>
          ) : isEditable ? (
            <>
              {(["PRESENT", "ABSENT", "LATE"] as const).map((s) => (
                <button key={s} onClick={() => onSetStatus(s)}
                  className={cn("px-2.5 py-1 rounded-lg text-xs font-medium border transition-all",
                    entry.status === s
                      ? s === "PRESENT" ? "bg-emerald-600/25 border-emerald-600/50 text-emerald-300"
                        : s === "ABSENT" ? "bg-red-600/25 border-red-600/50 text-red-300"
                        : "bg-amber-600/25 border-amber-600/50 text-amber-300"
                      : "bg-zinc-800/40 border-zinc-700/40 text-zinc-500 hover:border-zinc-600"
                  )}>
                  {s === "PRESENT" ? <CheckCircle2 className="h-3.5 w-3.5 inline -mt-0.5 mr-1" /> : s === "ABSENT" ? <XCircle className="h-3.5 w-3.5 inline -mt-0.5 mr-1" /> : <Clock className="h-3.5 w-3.5 inline -mt-0.5 mr-1" />}
                  {s.slice(0, 1) + s.slice(1).toLowerCase()}
                </button>
              ))}
              <Button size="icon" variant={savedNow ? "success" : "secondary"}
                loading={saving} onClick={onSave} className="w-8 h-8 flex-shrink-0" title="Save">
                {savedNow ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Camera className="h-3.5 w-3.5" />}
              </Button>
            </>
          ) : (
            <>
              <span className={cn("px-2.5 py-1 rounded-lg text-xs font-medium border",
                entry.status === "PRESENT" ? "bg-emerald-600/15 border-emerald-600/30 text-emerald-400"
                : entry.status === "LATE"    ? "bg-amber-600/15 border-amber-600/30 text-amber-400"
                :                              "bg-red-600/15 border-red-600/30 text-red-400"
              )}>
                {entry.status === "PRESENT" ? <CheckCircle2 className="h-3.5 w-3.5 inline -mt-0.5 mr-1" /> : entry.status === "ABSENT" ? <XCircle className="h-3.5 w-3.5 inline -mt-0.5 mr-1" /> : <Clock className="h-3.5 w-3.5 inline -mt-0.5 mr-1" />}
                {entry.status.slice(0, 1) + entry.status.slice(1).toLowerCase()}
              </span>
              <Button size="icon" variant="ghost" onClick={onEdit}
                className="w-8 h-8 flex-shrink-0 text-zinc-400 hover:text-zinc-200" title="Edit (within 24 hrs)">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── History panel ─────────────────────────────────────────────────────────────

interface HistoryGroup {
  classId: string;
  subject: string;
  dayOfWeek: string;
  startTime: string;
  records: AttendanceRecord[];
}

function HistoryPanel({ allClasses }: { allClasses: ClassItem[] }) {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<HistoryGroup[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filterClass, setFilterClass] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/attendance");
      const data = await r.json() as { attendance: AttendanceRecord[] };
      const all: AttendanceRecord[] = data.attendance ?? [];

      // Group by classId
      const map = new Map<string, AttendanceRecord[]>();
      for (const rec of all) {
        const key = rec.class?.id ?? "unknown";
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(rec);
      }

      const built: HistoryGroup[] = [];
      map.forEach((recs, classId) => {
        const cls = recs[0].class;
        if (!cls) return;
        built.push({
          classId,
          subject: cls.subject,
          dayOfWeek: cls.dayOfWeek,
          startTime: cls.startTime,
          records: recs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
        });
      });

      // Sort by most recent record first
      built.sort((a, b) => new Date(b.records[0]?.timestamp ?? 0).getTime() - new Date(a.records[0]?.timestamp ?? 0).getTime());
      setGroups(built);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const displayed = filterClass === "all" ? groups : groups.filter((g) => g.classId === filterClass);

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center gap-3">
        <BarChart3 className="h-4 w-4 text-indigo-400 flex-shrink-0" />
        <div className="relative flex-1">
          <select
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            className="w-full h-9 appearance-none rounded-xl border border-zinc-700 bg-zinc-800/50 px-3 pr-8 text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          >
            <option value="all">All Classes</option>
            {allClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.subject} · {DAY_ABBREV[c.dayOfWeek]} {formatTime(c.startTime)}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
        </div>
        <Button size="icon" variant="ghost" className="h-9 w-9 flex-shrink-0" onClick={load} title="Refresh">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-zinc-800/40 animate-pulse" />)}</div>
      ) : displayed.length === 0 ? (
        <Card className="p-12 text-center">
          <History className="h-12 w-12 mx-auto text-zinc-700 mb-3" />
          <p className="text-zinc-500 text-sm">No attendance records yet.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {displayed.map((group) => {
            const present = group.records.filter((r) => r.status === "PRESENT").length;
            const absent  = group.records.filter((r) => r.status === "ABSENT").length;
            const late    = group.records.filter((r) => r.status === "LATE").length;
            const total   = group.records.length;
            const pct     = total > 0 ? Math.round((present / total) * 100) : 0;
            const isOpen  = expanded === group.classId;

            return (
              <Card key={group.classId} className="overflow-hidden">
                {/* Mini-dashboard header */}
                <button
                  className="w-full text-left px-5 py-4 hover:bg-zinc-800/20 transition-colors"
                  onClick={() => setExpanded(isOpen ? null : group.classId)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <BookOpen className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                        <p className="font-semibold text-zinc-200 text-sm truncate">{group.subject}</p>
                        <span className="text-xs text-zinc-500 flex-shrink-0">
                          {DAY_ABBREV[group.dayOfWeek]} · {formatTime(group.startTime)}
                        </span>
                      </div>
                      {/* Stat pills */}
                      <div className="flex items-center gap-2 flex-wrap mt-2">
                        <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-600/10 text-emerald-400 border border-emerald-600/20">
                          <CheckCircle2 className="h-3 w-3" />{present} Present
                        </span>
                        <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-red-600/10 text-red-400 border border-red-600/20">
                          <XCircle className="h-3 w-3" />{absent} Absent
                        </span>
                        {late > 0 && (
                          <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-600/10 text-amber-400 border border-amber-600/20">
                            <Clock className="h-3 w-3" />{late} Late
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-indigo-600/10 text-indigo-400 border border-indigo-600/20">
                          <TrendingUp className="h-3 w-3" />{pct}% rate
                        </span>
                      </div>
                      {/* Attendance bar */}
                      <div className="mt-2.5 h-1.5 w-full rounded-full bg-zinc-700/50 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-zinc-500">{total} students</span>
                      <ChevronRight className={cn("h-4 w-4 text-zinc-500 transition-transform", isOpen && "rotate-90")} />
                    </div>
                  </div>
                </button>

                {/* Expandable student list */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-zinc-800/60 divide-y divide-zinc-800/40">
                        {group.records.map((rec) => {
                          const hasLoc = rec.latitude != null && rec.longitude != null;
                          const isFace = rec.remarks?.includes("face recognition");
                          return (
                            <div key={rec.id} className="px-5 py-2.5 flex items-center gap-3">
                              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0">
                                {rec.student.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="text-xs font-medium text-zinc-300 truncate">{rec.student.name}</p>
                                  {isFace && (
                                    <span className="flex-shrink-0 flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded-full bg-indigo-600/15 text-indigo-400 border border-indigo-600/20">
                                      <ScanFace className="h-2 w-2" />Face
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                  <span className="flex items-center gap-0.5 text-[10px] text-zinc-500">
                                    <Clock className="h-2.5 w-2.5" />{formatDate(rec.timestamp)} · {formatTimestamp(rec.timestamp)}
                                  </span>
                                  {hasLoc ? (
                                    <a
                                      href={`https://www.google.com/maps?q=${rec.latitude},${rec.longitude}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-0.5 text-[10px] text-indigo-400 hover:text-indigo-300"
                                    >
                                      <MapPin className="h-2.5 w-2.5" />
                                      {rec.locationName ?? `${rec.latitude?.toFixed(3)}, ${rec.longitude?.toFixed(3)}`}
                                      <ExternalLink className="h-2 w-2 opacity-60" />
                                    </a>
                                  ) : (
                                    <span className="flex items-center gap-0.5 text-[10px] text-zinc-600">
                                      <MapPin className="h-2.5 w-2.5" />{isFace ? "Location not shared" : "No location"}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span className={cn("text-[10px] px-2 py-0.5 rounded-full border flex-shrink-0",
                                rec.status === "PRESENT" ? "bg-emerald-600/10 border-emerald-600/20 text-emerald-400"
                                : rec.status === "LATE"    ? "bg-amber-600/10 border-amber-600/20 text-amber-400"
                                :                            "bg-red-600/10 border-red-600/20 text-red-400"
                              )}>
                                {rec.status.slice(0, 1) + rec.status.slice(1).toLowerCase()}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminAttendancePage() {
  const [tab, setTab] = useState<"live" | "history">("live");
  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [attendance, setAttendance] = useState<AttendanceEntry[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [editMode, setEditMode] = useState<Record<string, boolean>>({});
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [liveConnected, setLiveConnected] = useState(false);

  const init = useCallback(async () => {
    const [ttData, studentData] = await Promise.all([
      fetch("/api/timetables").then((r) => r.json()),
      fetch("/api/users?role=STUDENT").then((r) => r.json()),
    ]);
    const allStudents: Student[] = studentData.users ?? [];
    setTimetables(ttData.timetables ?? []);
    setStudents(allStudents);
    setAttendance(allStudents.map((s) => ({ studentId: s.id, studentName: s.name, status: "ABSENT" as const })));
  }, []);

  useEffect(() => { init(); }, [init]);

  const loadClassAttendance = useCallback(async (classId: string, allStudents: Student[]) => {
    setLoadingAttendance(true);
    try {
      const r = await fetch(`/api/attendance?classId=${classId}`);
      const data = await r.json() as { attendance: AttendanceRecord[] };
      const records: AttendanceRecord[] = data.attendance ?? [];
      setAttendance(allStudents.map((s) => {
        const rec = records.find((r) => r.student.id === s.id);
        return {
          studentId: s.id,
          studentName: s.name,
          status: rec ? (rec.status as "PRESENT" | "ABSENT" | "LATE") : "ABSENT",
          record: rec,
        };
      }));
    } finally {
      setLoadingAttendance(false);
    }
  }, []);

  const handleClassChange = useCallback(async (cls: ClassItem | null) => {
    setSelectedClass(cls);
    setSaved({});
    setEditMode({});
    if (cls) await loadClassAttendance(cls.id, students);
  }, [students, loadClassAttendance]);

  useEffect(() => {
    if (!selectedClass) { setLiveConnected(false); return; }
    const classId = selectedClass.id;
    const es = new EventSource(`/api/attendance/stream?classId=${classId}`);
    es.addEventListener("connected", () => setLiveConnected(true));
    es.addEventListener("attendance_updated", () => { loadClassAttendance(classId, students); });
    es.onerror = () => setLiveConnected(false);
    return () => { es.close(); setLiveConnected(false); };
  }, [selectedClass, students, loadClassAttendance]);

  const setStatus = (sid: string, status: "PRESENT" | "ABSENT" | "LATE") => {
    setAttendance((prev) => prev.map((a) => a.studentId === sid ? { ...a, status } : a));
    setSaved((prev) => ({ ...prev, [sid]: false }));
  };

  const markOne = async (entry: AttendanceEntry) => {
    if (!selectedClass) return;
    setSaving(entry.studentId);
    const r = await fetch("/api/attendance/mark", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId: selectedClass.id, studentId: entry.studentId, status: entry.status, teacherSave: true }),
    });
    const data = await r.json();
    if (r.ok) {
      setSaved((prev) => ({ ...prev, [entry.studentId]: true }));
      setEditMode((prev) => ({ ...prev, [entry.studentId]: false }));
      await loadClassAttendance(selectedClass.id, students);
    } else if (r.status === 423) {
      alert(data.message ?? "This record is locked and can no longer be edited.");
    }
    setSaving(null);
  };

  const markAll = async () => {
    if (!selectedClass) return;
    for (const entry of attendance) await markOne(entry);
  };

  const presentCount = attendance.filter((a) => a.status === "PRESENT").length;
  const absentCount  = attendance.filter((a) => a.status === "ABSENT").length;
  const lateCount    = attendance.filter((a) => a.status === "LATE").length;
  const faceMarked   = attendance.filter((a) => a.record?.remarks?.includes("face recognition")).length;
  const allClasses   = timetables.flatMap((t) => t.classes);

  const isSavedAndLocked = (rec: AttendanceRecord | undefined) => {
    if (!rec?.savedAt) return false;
    return Date.now() - new Date(rec.savedAt).getTime() > EDIT_WINDOW_MS;
  };
  const isSavedAndUnlocked = (rec: AttendanceRecord | undefined) => {
    if (!rec?.savedAt) return false;
    return Date.now() - new Date(rec.savedAt).getTime() <= EDIT_WINDOW_MS;
  };

  return (
    <DashboardLayout requiredRole="ADMIN">
      <PageHeader title="Attendance" description="Mark attendance · view history · see student location & time" />

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 p-1 rounded-xl bg-zinc-800/40 border border-zinc-700/50 w-fit">
        {([
          { id: "live",    label: "Live",    icon: <Radio className="h-3.5 w-3.5" /> },
          { id: "history", label: "History", icon: <History className="h-3.5 w-3.5" /> },
        ] as const).map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              tab === t.id
                ? "bg-zinc-700 text-zinc-100 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            )}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === "live" ? (
          <motion.div key="live" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
            {/* Class selector */}
            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <BookOpen className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                  <div className="relative flex-1">
                    <select
                      value={selectedClass?.id ?? ""}
                      onChange={(e) => { const cls = allClasses.find((c) => c.id === e.target.value) ?? null; void handleClassChange(cls); }}
                      className="w-full h-9 appearance-none rounded-xl border border-zinc-700 bg-zinc-800/50 px-3 pr-8 text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    >
                      <option value="">— Select a class —</option>
                      {allClasses.map((c) => (
                        <option key={c.id} value={c.id}>{c.subject} · {DAY_ABBREV[c.dayOfWeek]} {formatTime(c.startTime)}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
                  </div>
                  {selectedClass && (
                    <Button size="icon" variant="ghost" className="flex-shrink-0 h-9 w-9"
                      onClick={() => loadClassAttendance(selectedClass.id, students)} title="Refresh">
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {selectedClass ? (
              <>
                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  {[
                    { label: "Present",     count: presentCount, color: "text-emerald-400", bg: "bg-emerald-600/10 border-emerald-600/20" },
                    { label: "Absent",      count: absentCount,  color: "text-red-400",     bg: "bg-red-600/10 border-red-600/20" },
                    { label: "Late",        count: lateCount,    color: "text-amber-400",   bg: "bg-amber-600/10 border-amber-600/20" },
                    { label: "Face-Marked", count: faceMarked,   color: "text-indigo-400",  bg: "bg-indigo-600/10 border-indigo-600/20" },
                  ].map((s) => (
                    <Card key={s.label} className={`border ${s.bg}`}>
                      <CardContent className="p-4 text-center">
                        <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{s.label}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Roster */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 flex-wrap">
                        <Users className="h-5 w-5 text-indigo-400" />
                        {selectedClass.subject} — {DAY_ABBREV[selectedClass.dayOfWeek]} {formatTime(selectedClass.startTime)}
                        {liveConnected && (
                          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-600/15 text-emerald-400 border border-emerald-600/25 animate-pulse">
                            <Radio className="h-2.5 w-2.5" />Live
                          </span>
                        )}
                      </CardTitle>
                      <Button size="sm" onClick={markAll}>Save All</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {loadingAttendance ? (
                      <div className="p-6 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-zinc-800/40 animate-pulse" />)}</div>
                    ) : students.length === 0 ? (
                      <div className="p-10 text-center">
                        <Users className="h-10 w-10 mx-auto text-zinc-700 mb-2" />
                        <p className="text-zinc-500 text-sm">No approved students found</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-zinc-800/50">
                        <AnimatePresence>
                          {attendance.map((entry) => (
                            <AttendanceRow
                              key={entry.studentId}
                              entry={entry}
                              student={students.find((s) => s.id === entry.studentId)}
                              saving={saving === entry.studentId}
                              savedNow={saved[entry.studentId]}
                              inEditMode={!!editMode[entry.studentId]}
                              onSetStatus={(s) => setStatus(entry.studentId, s)}
                              onSave={() => markOne(entry)}
                              onEdit={() => setEditMode((prev) => ({ ...prev, [entry.studentId]: true }))}
                              isLocked={isSavedAndLocked(entry.record)}
                              isSaved={isSavedAndUnlocked(entry.record)}
                            />
                          ))}
                        </AnimatePresence>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="p-16 text-center">
                <BookOpen className="h-14 w-14 mx-auto text-zinc-700 mb-4" />
                <h3 className="text-base font-semibold text-zinc-400 mb-2">Select a Class</h3>
                <p className="text-sm text-zinc-600">Choose a class above to view the student roster and mark attendance.</p>
                <p className="text-xs text-zinc-700 mt-3">Students mark attendance via face scan. Location and time are recorded automatically.</p>
              </Card>
            )}
          </motion.div>
        ) : (
          <motion.div key="history" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
            <HistoryPanel allClasses={allClasses} />
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
