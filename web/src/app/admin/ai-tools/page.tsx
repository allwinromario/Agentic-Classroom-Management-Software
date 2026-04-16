"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Send, TrendingUp, Users, AlertTriangle,
  RefreshCw, Download, CheckCircle2, BarChart2,
  Sparkles, ChevronDown, ChevronUp,
} from "lucide-react";
import { DashboardLayout, PageHeader } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Student {
  id: string;
  name: string;
  email: string;
}

interface CommandResult {
  id: string;
  command: string;
  intent: string;
  message: string;
  result: unknown;
  timestamp: Date;
}

interface StudentReport {
  id: string;
  name: string;
  email: string;
  attendancePercentage?: number;
  averageMarks?: number;
  performanceLevel?: "GOOD" | "AVERAGE" | "WEAK";
  summary?: string;
  weakSubjects?: string[];
}

interface ClassSummary {
  totalStudents: number;
  withMarks: number;
  averageAttendance: number;
  averageMarks: number;
  distribution: { GOOD: number; AVERAGE: number; WEAK: number };
}

const EXAMPLE_COMMANDS = [
  "Show top 5 students",
  "Who has low attendance?",
  "Show failing students",
  "Generate report for all students",
  "Show class performance",
];

const LEVEL_COLORS = {
  GOOD:    "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  AVERAGE: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  WEAK:    "text-red-400 bg-red-500/10 border-red-500/20",
};

export default function AdminAIToolsPage() {
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<CommandResult[]>([]);
  const [running, setRunning] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [reportStudentId, setReportStudentId] = useState("");
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportResult, setReportResult] = useState<StudentReport | null>(null);
  const [expandedResult, setExpandedResult] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/users?role=STUDENT")
      .then((r) => r.json())
      .then((d: { users?: Array<Student & { status?: string }> }) =>
        setStudents(d.users?.filter((u) => u.status === "APPROVED") ?? [])
      )
      .catch(() => {});
  }, []);

  const runCommand = async (cmd?: string) => {
    const text = (cmd ?? command).trim();
    if (!text) return;
    setRunning(true);
    setCommand("");

    try {
      const res = await fetch("/api/ai-commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: text }),
      });
      const data = (await res.json()) as { intent: string; message: string; result: unknown };
      const entry: CommandResult = {
        id: Math.random().toString(36).slice(2),
        command: text,
        intent: data.intent,
        message: data.message,
        result: data.result,
        timestamp: new Date(),
      };
      setHistory((prev) => [entry, ...prev]);
      setExpandedResult(entry.id);
    } catch { /* ignore */ }

    setRunning(false);
  };

  const generateReport = async () => {
    if (!reportStudentId) return;
    setGeneratingReport(true);
    setReportResult(null);
    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: reportStudentId }),
      });
      const data = (await res.json()) as {
        report: {
          studentName?: string;
          studentEmail?: string;
          attendancePercentage?: number;
          averageMarks?: number;
          performanceLevel?: "GOOD" | "AVERAGE" | "WEAK";
          summary?: string;
          subjectBreakdown?: Array<{ subject: string; level: string }>;
        };
      };
      if (data.report) {
        setReportResult({
          id: reportStudentId,
          name: data.report.studentName ?? "Student",
          email: data.report.studentEmail ?? "",
          attendancePercentage: data.report.attendancePercentage,
          averageMarks: data.report.averageMarks,
          performanceLevel: data.report.performanceLevel,
          summary: data.report.summary,
          weakSubjects: data.report.subjectBreakdown?.filter((s) => s.level === "WEAK").map((s) => s.subject),
        });
      }
    } catch { /* ignore */ }
    setGeneratingReport(false);
  };

  const renderResult = (entry: CommandResult) => {
    const isExpanded = expandedResult === entry.id;
    const arr = Array.isArray(entry.result) ? (entry.result as StudentReport[]) : null;
    const obj = !arr && typeof entry.result === "object" ? (entry.result as ClassSummary) : null;

    return (
      <motion.div
        key={entry.id}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="border border-zinc-800/60 rounded-2xl overflow-hidden"
      >
        <button
          onClick={() => setExpandedResult(isExpanded ? null : entry.id)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-zinc-800/20 transition-colors"
        >
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-600/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Sparkles className="h-4 w-4 text-indigo-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-200 truncate">"{entry.command}"</p>
              <p className="text-xs text-zinc-500 mt-0.5">{entry.message}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            <span className="text-xs text-zinc-600">{entry.timestamp.toLocaleTimeString()}</span>
            {isExpanded ? <ChevronUp className="h-4 w-4 text-zinc-600" /> : <ChevronDown className="h-4 w-4 text-zinc-600" />}
          </div>
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: "auto" }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="border-t border-zinc-800/60 p-4">
                {entry.intent === "unknown" && (
                  <p className="text-sm text-zinc-400">{entry.message}</p>
                )}

                {arr && arr.length === 0 && (
                  <p className="text-sm text-zinc-500 text-center py-4">No results found</p>
                )}

                {arr && arr.length > 0 && (entry.intent === "top_students" || entry.intent === "generate_report") && (
                  <div className="space-y-2">
                    {arr.map((s, i) => (
                      <div key={s.id} className="flex items-center justify-between p-3 bg-zinc-800/30 rounded-xl">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-zinc-600 w-5">#{i + 1}</span>
                          <div>
                            <p className="text-sm font-medium text-zinc-200">{s.name}</p>
                            <p className="text-xs text-zinc-500">{s.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {s.averageMarks !== undefined && (
                            <span className="text-xs text-zinc-300">{s.averageMarks}% avg</span>
                          )}
                          {s.performanceLevel && (
                            <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border", LEVEL_COLORS[s.performanceLevel])}>
                              {s.performanceLevel}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {arr && arr.length > 0 && (entry.intent === "low_attendance") && (
                  <div className="space-y-2">
                    {(arr as Array<{ id: string; name: string; email: string; attendancePercentage: number; totalClasses: number }>).map((s) => (
                      <div key={s.id} className="flex items-center justify-between p-3 bg-zinc-800/30 rounded-xl">
                        <div>
                          <p className="text-sm font-medium text-zinc-200">{s.name}</p>
                          <p className="text-xs text-zinc-500">{s.totalClasses} classes recorded</p>
                        </div>
                        <span className="text-sm font-bold text-red-400">{s.attendancePercentage}%</span>
                      </div>
                    ))}
                  </div>
                )}

                {arr && arr.length > 0 && entry.intent === "failing_students" && (
                  <div className="space-y-2">
                    {(arr as Array<{ id: string; name: string; email: string; averageMarks: number; weakSubjects: string[] }>).map((s) => (
                      <div key={s.id} className="flex items-center justify-between p-3 bg-zinc-800/30 rounded-xl">
                        <div>
                          <p className="text-sm font-medium text-zinc-200">{s.name}</p>
                          <p className="text-xs text-zinc-500">Weak: {s.weakSubjects.join(", ") || "—"}</p>
                        </div>
                        <span className="text-sm font-bold text-red-400">{s.averageMarks}%</span>
                      </div>
                    ))}
                  </div>
                )}

                {obj && entry.intent === "class_performance" && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Total Students", value: obj.totalStudents },
                      { label: "Avg Attendance", value: `${obj.averageAttendance}%` },
                      { label: "Avg Marks", value: `${obj.averageMarks}%` },
                      { label: "With Marks", value: obj.withMarks },
                    ].map((k) => (
                      <div key={k.label} className="bg-zinc-800/40 rounded-xl p-3 text-center">
                        <p className="text-xs text-zinc-500">{k.label}</p>
                        <p className="text-xl font-bold text-zinc-100 mt-1">{k.value}</p>
                      </div>
                    ))}
                    <div className="col-span-2 sm:col-span-4 flex gap-3">
                      {Object.entries(obj.distribution).map(([level, count]) => (
                        <div key={level} className={cn("flex-1 rounded-xl p-3 text-center border", LEVEL_COLORS[level as keyof typeof LEVEL_COLORS])}>
                          <p className="text-xs font-semibold">{level}</p>
                          <p className="text-2xl font-bold mt-1">{count}</p>
                          <p className="text-xs opacity-70 mt-0.5">students</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  return (
    <DashboardLayout requiredRole="ADMIN">
      <PageHeader
        title="AI Tools"
        description="Natural language commands and intelligent report generation"
      />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* ── Left: NL Command Interface ─────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-indigo-400" />
                AI Command Interface
              </CardTitle>
              <p className="text-sm text-zinc-500">Ask questions in natural language — the AI maps them to actions</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void runCommand(); }}
                  placeholder='Try "Show top 5 students" or "Who has low attendance?"'
                  className="flex-1 bg-zinc-800/60 border border-zinc-700/60 text-zinc-200 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 placeholder:text-zinc-600"
                />
                <Button onClick={() => void runCommand()} disabled={running || !command.trim()}>
                  {running ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {running ? "Running..." : "Run"}
                </Button>
              </div>

              {/* Example commands */}
              <div>
                <p className="text-xs text-zinc-600 mb-2">Quick examples:</p>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLE_COMMANDS.map((cmd) => (
                    <button
                      key={cmd}
                      onClick={() => void runCommand(cmd)}
                      className="text-xs bg-zinc-800/60 hover:bg-indigo-600/20 hover:text-indigo-300 border border-zinc-700/40 hover:border-indigo-600/30 text-zinc-400 px-3 py-1.5 rounded-lg transition-all"
                    >
                      {cmd}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Command history */}
          <div className="space-y-3">
            {history.length === 0 && (
              <div className="text-center py-12 text-zinc-600">
                <Brain className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Run a command above to see results here</p>
              </div>
            )}
            {history.map((entry) => renderResult(entry))}
          </div>
        </div>

        {/* ── Right: Report Generator ─────────────────────────────────── */}
        <div className="space-y-6">
          <Card className="border-violet-800/30 bg-violet-950/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart2 className="h-5 w-5 text-violet-400" />
                Generate Student Report
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2 block">Student</label>
                <select
                  value={reportStudentId}
                  onChange={(e) => { setReportStudentId(e.target.value); setReportResult(null); }}
                  className="w-full bg-zinc-800/60 border border-zinc-700/60 text-zinc-200 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                >
                  <option value="">— Select student —</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <Button
                className="w-full"
                variant="secondary"
                onClick={generateReport}
                disabled={generatingReport || !reportStudentId}
              >
                {generatingReport
                  ? <><RefreshCw className="h-4 w-4 animate-spin" /> Generating…</>
                  : <><Sparkles className="h-4 w-4" /> Generate Report</>}
              </Button>

              {reportResult && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2.5">
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                    Report generated for {reportResult.name}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Attendance", value: `${reportResult.attendancePercentage?.toFixed(1) ?? "—"}%`, icon: Users },
                      { label: "Avg Marks", value: `${reportResult.averageMarks ?? "—"}%`, icon: TrendingUp },
                    ].map((k) => {
                      const Icon = k.icon;
                      return (
                        <div key={k.label} className="bg-zinc-800/40 rounded-xl p-3">
                          <div className="flex items-center gap-1.5 text-zinc-500 text-xs mb-1">
                            <Icon className="h-3.5 w-3.5" /> {k.label}
                          </div>
                          <p className="text-lg font-bold text-zinc-100">{k.value}</p>
                        </div>
                      );
                    })}
                  </div>

                  {reportResult.performanceLevel && (
                    <div className={cn("text-center py-2 rounded-xl border text-sm font-semibold", LEVEL_COLORS[reportResult.performanceLevel])}>
                      {reportResult.performanceLevel} Performance
                    </div>
                  )}

                  {reportResult.weakSubjects && reportResult.weakSubjects.length > 0 && (
                    <div className="bg-red-950/20 border border-red-800/30 rounded-xl p-3">
                      <p className="text-xs font-semibold text-red-400 flex items-center gap-1.5 mb-1.5">
                        <AlertTriangle className="h-3.5 w-3.5" /> Weak Subjects
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {reportResult.weakSubjects.map((s) => (
                          <span key={s} className="text-xs bg-red-950/40 text-red-300 border border-red-800/30 px-2 py-0.5 rounded-full">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {reportResult.summary && (
                    <p className="text-xs text-zinc-400 leading-relaxed bg-zinc-800/30 rounded-xl p-3">
                      {reportResult.summary}
                    </p>
                  )}

                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <a href={`/admin/reports/${reportStudentId}`}>
                      <Download className="h-4 w-4" /> View Full Report
                    </a>
                  </Button>
                </motion.div>
              )}
            </CardContent>
          </Card>

          {/* Quick stats cards */}
          <Card className="border-zinc-800/40">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-400" />
                Supported Commands
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { icon: TrendingUp, color: "text-emerald-400", label: "Top students", example: "Show top 10 students" },
                { icon: Users, color: "text-red-400", label: "Low attendance", example: "Who has below 75% attendance?" },
                { icon: AlertTriangle, color: "text-amber-400", label: "Failing students", example: "Show students who are failing" },
                { icon: BarChart2, color: "text-violet-400", label: "Class overview", example: "Show class performance" },
                { icon: Brain, color: "text-indigo-400", label: "Generate reports", example: "Generate report for class" },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    onClick={() => void runCommand(item.example)}
                    className="w-full text-left flex items-center gap-3 p-2.5 rounded-xl hover:bg-zinc-800/40 transition-colors group"
                  >
                    <Icon className={cn("h-4 w-4 flex-shrink-0", item.color)} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-zinc-300">{item.label}</p>
                      <p className="text-xs text-zinc-600 truncate">{item.example}</p>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
