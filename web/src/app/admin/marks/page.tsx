"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Upload, CheckCircle2, AlertTriangle, Trash2,
  BookOpen, User, Save, X, FileText, Search, ChevronDown,
} from "lucide-react";
import { DashboardLayout, PageHeader } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Student {
  id: string;
  name: string;
  email: string;
}

interface MarkRow {
  id: string;
  subject: string;
  score: string;
  maxScore: string;
  examType: string;
}

interface ValidationIssue {
  row: number;
  field: string;
  issue: string;
  suggestion: string;
}

interface ExistingMark {
  id: string;
  subject: string;
  score: number;
  maxScore: number;
  examType: string;
  createdAt: string;
  student: { name: string };
}

const EXAM_TYPES = ["MIDTERM", "FINAL", "QUIZ", "ASSIGNMENT", "PRACTICAL"];

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function emptyRow(): MarkRow {
  return { id: uid(), subject: "", score: "", maxScore: "100", examType: "MIDTERM" };
}

export default function AdminMarksPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [rows, setRows] = useState<MarkRow[]>([emptyRow()]);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [existingMarks, setExistingMarks] = useState<ExistingMark[]>([]);
  const [activeTab, setActiveTab] = useState<"manual" | "csv" | "view">("manual");
  const [csvText, setCsvText] = useState("");
  const [csvIssues, setCsvIssues] = useState<ValidationIssue[]>([]);
  const [csvParsed, setCsvParsed] = useState<MarkRow[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Search-combobox state
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    fetch("/api/users?role=STUDENT")
      .then((r) => r.json())
      .then((d: { users?: Array<Student & { status?: string }> }) =>
        setStudents(d.users?.filter((u) => u.status === "APPROVED") ?? [])
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedStudentId) return;
    fetch(`/api/marks?studentId=${selectedStudentId}`)
      .then((r) => r.json())
      .then((d: { marks?: ExistingMark[] }) => setExistingMarks(d.marks ?? []))
      .catch(() => {});
  }, [selectedStudentId, savedMsg]);

  const updateRow = (id: string, field: keyof MarkRow, value: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
    setIssues([]);
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));

  const validate = async (targetRows = rows): Promise<ValidationIssue[]> => {
    setValidating(true);
    try {
      const res = await fetch("/api/marks/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: targetRows.map((r, i) => ({
            row: i + 1,
            subject: r.subject,
            score: r.score,
            maxScore: r.maxScore,
            examType: r.examType,
          })),
        }),
      });
      const data = (await res.json()) as { issues: ValidationIssue[] };
      return data.issues ?? [];
    } catch {
      return [];
    } finally {
      setValidating(false);
    }
  };

  const handleValidate = async () => {
    const found = await validate();
    setIssues(found);
  };

  const handleSave = async () => {
    if (!selectedStudentId) return;
    const found = await validate();
    setIssues(found);
    if (found.length > 0) return;

    setSaving(true);
    try {
      const res = await fetch("/api/marks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedStudentId,
          entries: rows.map((r) => ({
            subject: r.subject,
            score: Number(r.score),
            maxScore: Number(r.maxScore),
            examType: r.examType,
          })),
        }),
      });
      if (res.ok) {
        setSavedMsg(`Saved ${rows.length} mark${rows.length !== 1 ? "s" : ""} successfully`);
        setRows([emptyRow()]);
        setIssues([]);
        setTimeout(() => setSavedMsg(""), 3000);
      }
    } catch { /* ignore */ }
    setSaving(false);
  };

  const parseCSV = (text: string): MarkRow[] => {
    const lines = text.trim().split("\n").filter(Boolean);
    const start = lines[0]?.toLowerCase().includes("subject") ? 1 : 0;
    return lines.slice(start).map((line) => {
      const [subject, score, maxScore, examType] = line.split(",").map((s) => s.trim());
      return { id: uid(), subject: subject ?? "", score: score ?? "", maxScore: maxScore ?? "100", examType: examType ?? "MIDTERM" };
    });
  };

  const handleCSVText = async (text: string) => {
    setCsvText(text);
    if (!text.trim()) { setCsvParsed([]); setCsvIssues([]); return; }
    const parsed = parseCSV(text);
    setCsvParsed(parsed);
    const found = await validate(parsed);
    setCsvIssues(found);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { void handleCSVText(ev.target?.result as string); };
    reader.readAsText(file);
  };

  const importCSV = async () => {
    if (!selectedStudentId || csvParsed.length === 0) return;
    const found = await validate(csvParsed);
    setCsvIssues(found);
    if (found.length > 0) return;

    setSaving(true);
    try {
      const res = await fetch("/api/marks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedStudentId,
          entries: csvParsed.map((r) => ({ subject: r.subject, score: Number(r.score), maxScore: Number(r.maxScore), examType: r.examType })),
        }),
      });
      if (res.ok) {
        setSavedMsg(`Imported ${csvParsed.length} marks from CSV`);
        setCsvText(""); setCsvParsed([]); setCsvIssues([]);
        setTimeout(() => setSavedMsg(""), 3000);
      }
    } catch { /* ignore */ }
    setSaving(false);
  };

  const deleteMark = async (id: string) => {
    await fetch(`/api/marks?id=${id}`, { method: "DELETE" });
    setExistingMarks((prev) => prev.filter((m) => m.id !== id));
  };

  const issuesOnRow = (rowIdx: number) => issues.filter((i) => i.row === rowIdx + 1);

  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  const filteredStudents = students.filter((s) => {
    const q = searchQuery.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
  });

  const selectStudent = (s: Student) => {
    setSelectedStudentId(s.id);
    setSearchQuery(s.name);
    setDropdownOpen(false);
    setRows([emptyRow()]);
    setIssues([]);
  };

  return (
    <DashboardLayout requiredRole="ADMIN">
      <PageHeader
        title="Marks Entry"
        description="Add subject-wise marks for students — AI validates entries automatically"
      />

      {/* Student search */}
      <Card className="mb-6">
        <CardContent className="p-5">
          <label className="block text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">
            Search Student
          </label>

          <div ref={searchRef} className="relative">
            {/* Input */}
            <div className="relative flex items-center">
              <Search className="absolute left-3 h-4 w-4 text-zinc-500 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setDropdownOpen(true);
                  if (!e.target.value) setSelectedStudentId("");
                }}
                onFocus={() => setDropdownOpen(true)}
                placeholder="Type a student name or email…"
                className="w-full bg-zinc-800/60 border border-zinc-700/60 text-zinc-200 text-sm rounded-xl pl-9 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 placeholder:text-zinc-600"
              />
              <ChevronDown
                className={cn("absolute right-3 h-4 w-4 text-zinc-500 transition-transform cursor-pointer", dropdownOpen && "rotate-180")}
                onClick={() => setDropdownOpen((v) => !v)}
              />
            </div>

            {/* Dropdown */}
            <AnimatePresence>
              {dropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute z-50 mt-1.5 w-full bg-zinc-900 border border-zinc-700/60 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto"
                >
                  {filteredStudents.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-zinc-500 text-center">
                      No students match "{searchQuery}"
                    </div>
                  ) : (
                    filteredStudents.map((s) => {
                      const initials = s.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
                      const isSelected = s.id === selectedStudentId;
                      return (
                        <button
                          key={s.id}
                          onMouseDown={(e) => { e.preventDefault(); selectStudent(s); }}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-zinc-800/70 transition-colors",
                            isSelected && "bg-indigo-600/15"
                          )}
                        >
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0",
                            isSelected
                              ? "bg-indigo-600/30 text-indigo-300 border border-indigo-600/40"
                              : "bg-zinc-800 text-zinc-400 border border-zinc-700/50"
                          )}>
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className={cn("text-sm font-medium truncate", isSelected ? "text-indigo-300" : "text-zinc-200")}>
                              {s.name}
                            </p>
                            <p className="text-xs text-zinc-500 truncate">{s.email}</p>
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="h-4 w-4 text-indigo-400 flex-shrink-0 ml-auto" />
                          )}
                        </button>
                      );
                    })
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Selected student chip */}
          {selectedStudent && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 flex items-center gap-3 bg-indigo-600/10 border border-indigo-600/25 rounded-xl px-4 py-2.5"
            >
              <div className="w-7 h-7 rounded-lg bg-indigo-600/30 border border-indigo-600/40 flex items-center justify-center text-xs font-bold text-indigo-300 flex-shrink-0">
                {selectedStudent.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-indigo-300 truncate">{selectedStudent.name}</p>
                <p className="text-xs text-zinc-500 truncate">{selectedStudent.email}</p>
              </div>
              <button
                onClick={() => { setSelectedStudentId(""); setSearchQuery(""); setRows([emptyRow()]); setIssues([]); }}
                className="text-zinc-600 hover:text-red-400 transition-colors p-1 flex-shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {selectedStudentId && (
        <>
          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-zinc-800/40 p-1 rounded-xl w-fit">
            {(["manual", "csv", "view"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize",
                  activeTab === tab
                    ? "bg-indigo-600 text-white"
                    : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                {tab === "view" ? "View Marks" : tab === "csv" ? "CSV Import" : "Manual Entry"}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {/* ── Manual Entry ─────────────────────────────────────────── */}
            {activeTab === "manual" && (
              <motion.div key="manual" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-indigo-400" />
                        Enter Marks for {selectedStudent?.name}
                      </CardTitle>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleValidate} disabled={validating}>
                          <CheckCircle2 className="h-4 w-4" />
                          {validating ? "Checking..." : "AI Validate"}
                        </Button>
                        <Button size="sm" onClick={handleSave} disabled={saving || !selectedStudentId}>
                          <Save className="h-4 w-4" />
                          {saving ? "Saving..." : "Save Marks"}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {savedMsg && (
                      <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm px-4 py-2.5 rounded-xl mb-4">
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0" /> {savedMsg}
                      </motion.div>
                    )}

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left">
                            <th className="text-xs font-semibold uppercase tracking-wide text-zinc-500 pb-2 pr-3">Subject</th>
                            <th className="text-xs font-semibold uppercase tracking-wide text-zinc-500 pb-2 pr-3">Score</th>
                            <th className="text-xs font-semibold uppercase tracking-wide text-zinc-500 pb-2 pr-3">Max</th>
                            <th className="text-xs font-semibold uppercase tracking-wide text-zinc-500 pb-2 pr-3">Exam Type</th>
                            <th className="pb-2" />
                          </tr>
                        </thead>
                        <tbody className="space-y-2">
                          {rows.map((row, i) => {
                            const rowIssues = issuesOnRow(i);
                            const hasIssue = rowIssues.length > 0;
                            return (
                              <tr key={row.id} className={cn("border-b border-zinc-800/40", hasIssue && "bg-red-950/10")}>
                                <td className="pr-3 py-2 w-40">
                                  <Input
                                    value={row.subject}
                                    onChange={(e) => updateRow(row.id, "subject", e.target.value)}
                                    placeholder="e.g. Mathematics"
                                    className={cn("h-9", hasIssue && rowIssues.some((x) => x.field === "subject") && "border-red-500/50")}
                                  />
                                </td>
                                <td className="pr-3 py-2 w-24">
                                  <Input
                                    value={row.score}
                                    onChange={(e) => updateRow(row.id, "score", e.target.value)}
                                    placeholder="72"
                                    type="number"
                                    className={cn("h-9", hasIssue && rowIssues.some((x) => x.field === "score") && "border-red-500/50")}
                                  />
                                </td>
                                <td className="pr-3 py-2 w-24">
                                  <Input
                                    value={row.maxScore}
                                    onChange={(e) => updateRow(row.id, "maxScore", e.target.value)}
                                    placeholder="100"
                                    type="number"
                                    className={cn("h-9", hasIssue && rowIssues.some((x) => x.field === "maxScore") && "border-red-500/50")}
                                  />
                                </td>
                                <td className="pr-3 py-2 w-40">
                                  <select
                                    value={row.examType}
                                    onChange={(e) => updateRow(row.id, "examType", e.target.value)}
                                    className={cn("w-full bg-zinc-800/60 border border-zinc-700/60 text-zinc-200 text-sm rounded-lg px-2 py-1.5 h-9 focus:outline-none focus:ring-2 focus:ring-indigo-500/50", hasIssue && rowIssues.some((x) => x.field === "examType") && "border-red-500/50")}
                                  >
                                    {EXAM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                                  </select>
                                </td>
                                <td className="py-2">
                                  <button onClick={() => removeRow(row.id)} className="text-zinc-600 hover:text-red-400 transition-colors p-1.5">
                                    <X className="h-4 w-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <Button variant="outline" size="sm" onClick={addRow} className="mt-4">
                      <Plus className="h-4 w-4" /> Add Row
                    </Button>

                    {/* Validation issues */}
                    {issues.length > 0 && (
                      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-2">
                        <p className="text-xs font-semibold text-red-400 uppercase tracking-wide flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5" /> AI found {issues.length} issue{issues.length !== 1 ? "s" : ""}
                        </p>
                        {issues.map((issue, i) => (
                          <div key={i} className="bg-red-950/20 border border-red-800/30 rounded-xl p-3">
                            <p className="text-xs text-red-300 font-medium">Row {issue.row} — {issue.field}: {issue.issue}</p>
                            <p className="text-xs text-zinc-500 mt-0.5">Suggestion: {issue.suggestion}</p>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* ── CSV Import ───────────────────────────────────────────── */}
            {activeTab === "csv" && (
              <motion.div key="csv" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-violet-400" />
                      CSV Import for {selectedStudent?.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-zinc-800/30 border border-zinc-700/30 rounded-xl p-4 text-xs text-zinc-400 font-mono">
                      <p className="font-semibold text-zinc-300 mb-2">Expected CSV format:</p>
                      <p>subject,score,maxScore,examType</p>
                      <p>Mathematics,72,100,MIDTERM</p>
                      <p>Physics,85,100,FINAL</p>
                      <p>Chemistry,45,100,QUIZ</p>
                    </div>

                    <div className="flex gap-3">
                      <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                        <Upload className="h-4 w-4" /> Upload CSV File
                      </Button>
                      <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
                    </div>

                    <textarea
                      value={csvText}
                      onChange={(e) => void handleCSVText(e.target.value)}
                      placeholder="Or paste CSV content here..."
                      rows={8}
                      className="w-full bg-zinc-800/40 border border-zinc-700/40 text-zinc-300 text-sm font-mono rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
                    />

                    {csvParsed.length > 0 && (
                      <div className="bg-zinc-800/30 rounded-xl overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-zinc-800/60">
                              {["Subject", "Score", "Max", "Type"].map((h) => (
                                <th key={h} className="text-left text-xs font-semibold text-zinc-500 px-4 py-2">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {csvParsed.map((r, i) => (
                              <tr key={r.id} className="border-t border-zinc-800/40">
                                <td className="px-4 py-2 text-zinc-300">{r.subject}</td>
                                <td className="px-4 py-2 text-zinc-300">{r.score}</td>
                                <td className="px-4 py-2 text-zinc-300">{r.maxScore}</td>
                                <td className="px-4 py-2 text-zinc-300">{r.examType}</td>
                                <td className="px-2 py-2">
                                  {csvIssues.some((x) => x.row === i + 1) && (
                                    <AlertTriangle className="h-4 w-4 text-red-400" />
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {csvIssues.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-red-400 uppercase tracking-wide flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5" /> {csvIssues.length} validation issue{csvIssues.length !== 1 ? "s" : ""}
                        </p>
                        {csvIssues.map((issue, i) => (
                          <div key={i} className="bg-red-950/20 border border-red-800/30 rounded-xl p-3">
                            <p className="text-xs text-red-300 font-medium">Row {issue.row} — {issue.field}: {issue.issue}</p>
                            <p className="text-xs text-zinc-500 mt-0.5">Suggestion: {issue.suggestion}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {csvParsed.length > 0 && csvIssues.length === 0 && (
                      <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm px-4 py-2.5 rounded-xl">
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                        All {csvParsed.length} rows passed validation — ready to import
                      </div>
                    )}

                    <Button onClick={importCSV} disabled={saving || csvParsed.length === 0 || csvIssues.length > 0}>
                      <Upload className="h-4 w-4" />
                      {saving ? "Importing..." : `Import ${csvParsed.length} Marks`}
                    </Button>

                    {savedMsg && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm px-4 py-2.5 rounded-xl">
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0" /> {savedMsg}
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* ── View Existing Marks ──────────────────────────────────── */}
            {activeTab === "view" && (
              <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5 text-emerald-400" />
                      Marks for {selectedStudent?.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {existingMarks.length === 0 ? (
                      <p className="text-zinc-500 text-sm text-center py-8">No marks recorded yet</p>
                    ) : (
                      <div className="space-y-2">
                        {existingMarks.map((m) => {
                          const pct = Math.round((m.score / m.maxScore) * 100);
                          const level = pct >= 70 ? "STRONG" : pct >= 40 ? "AVERAGE" : "WEAK";
                          const colors = {
                            STRONG: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
                            AVERAGE: "text-amber-400 bg-amber-500/10 border-amber-500/20",
                            WEAK: "text-red-400 bg-red-500/10 border-red-500/20",
                          };
                          return (
                            <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/20 hover:bg-zinc-800/40 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full" style={{ background: level === "STRONG" ? "#10b981" : level === "AVERAGE" ? "#f59e0b" : "#ef4444" }} />
                                <div>
                                  <p className="text-sm font-medium text-zinc-200">{m.subject}</p>
                                  <p className="text-xs text-zinc-500">{m.examType} · {new Date(m.createdAt).toLocaleDateString()}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border", colors[level])}>{pct}%</span>
                                <p className="text-sm text-zinc-300">{m.score}/{m.maxScore}</p>
                                <button onClick={() => void deleteMark(m.id)} className="text-zinc-600 hover:text-red-400 transition-colors p-1">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </DashboardLayout>
  );
}
