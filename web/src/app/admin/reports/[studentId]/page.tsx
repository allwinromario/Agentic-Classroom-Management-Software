"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, Cell,
} from "recharts";
import {
  TrendingUp, BookOpen, AlertTriangle, CheckCircle2, Star,
  Download, RefreshCw, Brain, Target, Calendar, Zap,
  ChevronRight, ArrowLeft, User,
} from "lucide-react";
import Link from "next/link";
import { DashboardLayout, PageHeader } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SubjectAnalysis {
  subject: string;
  score: number;
  maxScore: number;
  percentage: number;
  level: "STRONG" | "AVERAGE" | "WEAK";
}

interface Recommendation {
  type: string;
  priority: "high" | "medium" | "low";
  message: string;
  subject?: string;
}

interface StudyPlanDay {
  day: string;
  subjects: string[];
  hoursAllocated: number;
  focus: string;
}

interface Report {
  id: string;
  studentId: string;
  attendancePercentage: number;
  averageMarks: number;
  performanceLevel: "GOOD" | "AVERAGE" | "WEAK";
  subjectBreakdown: SubjectAnalysis[];
  recommendations: Recommendation[];
  studyPlan: StudyPlanDay[];
  summary: string;
  generatedAt: string;
  student?: { id: string; name: string; email: string };
}

const LEVEL_CONFIG = {
  STRONG:  { label: "Strong",  color: "text-emerald-400", bg: "bg-emerald-500/20", border: "border-emerald-500/30", bar: "#10b981" },
  GOOD:    { label: "Good",    color: "text-emerald-400", bg: "bg-emerald-500/20", border: "border-emerald-500/30", bar: "#10b981" },
  AVERAGE: { label: "Average", color: "text-amber-400",   bg: "bg-amber-500/20",   border: "border-amber-500/30",   bar: "#f59e0b" },
  WEAK:    { label: "Weak",    color: "text-red-400",     bg: "bg-red-500/20",     border: "border-red-500/30",     bar: "#ef4444" },
} as const;

const PRIORITY_ICON = {
  high:   { icon: AlertTriangle, color: "text-red-400 bg-red-500/10 border-red-500/20" },
  medium: { icon: Target,        color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  low:    { icon: CheckCircle2,  color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
};

export default function AdminStudentReportPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.studentId as string;

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const res = await fetch(`/api/reports?studentId=${studentId}`);
      const data = (await res.json()) as { reports: Report[] };
      if (data.reports?.length > 0) {
        setReport(data.reports[0]);
      } else {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    }
    setLoading(false);
  }, [studentId]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const generateReport = async () => {
    setGenerating(true);
    setNotFound(false);
    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      });
      const data = (await res.json()) as { report: Report };
      if (data.report) setReport(data.report);
    } catch { /* ignore */ }
    setGenerating(false);
  };

  const downloadPDF = async () => {
    if (!report) return;
    setDownloading(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF();
      const levelConf = LEVEL_CONFIG[report.performanceLevel];

      doc.setFillColor(17, 24, 39);
      doc.rect(0, 0, 210, 40, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("SCMS — Student Performance Report", 15, 20);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Generated: ${new Date(report.generatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}`, 15, 32);

      doc.setTextColor(30, 30, 30);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(report.student?.name ?? "Student", 15, 55);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(90, 90, 90);
      doc.text(report.student?.email ?? "", 15, 63);

      doc.setFillColor(245, 247, 250);
      doc.roundedRect(10, 70, 190, 28, 3, 3, "F");
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      const summaryLines = doc.splitTextToSize(report.summary ?? "", 180);
      doc.text(summaryLines, 15, 80);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(30, 30, 30);
      doc.text("Performance Overview", 15, 110);
      [
        { label: "Attendance",   value: `${report.attendancePercentage.toFixed(1)}%` },
        { label: "Avg Marks",    value: `${report.averageMarks}%` },
        { label: "Level",        value: levelConf.label },
      ].forEach((k, i) => {
        const x = 15 + i * 65;
        doc.setFillColor(235, 240, 255);
        doc.roundedRect(x, 115, 58, 22, 2, 2, "F");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(90, 90, 90);
        doc.text(k.label, x + 5, 122);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(30, 30, 100);
        doc.text(k.value, x + 5, 132);
      });

      let y = 150;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(30, 30, 30);
      doc.text("Subject-wise Performance", 15, y);
      y += 8;
      for (const s of report.subjectBreakdown) {
        if (y > 260) { doc.addPage(); y = 20; }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(50, 50, 50);
        doc.text(s.subject, 15, y);
        doc.text(`${s.percentage}% (${s.score}/${s.maxScore})`, 100, y);
        doc.text(s.level, 165, y);
        const c = s.level === "STRONG" ? [16, 185, 129] : s.level === "AVERAGE" ? [245, 158, 11] : [239, 68, 68];
        doc.setFillColor(c[0], c[1], c[2]);
        doc.rect(15, y + 2, (s.percentage / 100) * 80, 3, "F");
        y += 12;
      }

      y += 8;
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(30, 30, 30);
      doc.text("AI Recommendations", 15, y);
      y += 8;
      for (const r of report.recommendations) {
        if (y > 260) { doc.addPage(); y = 20; }
        const lines = doc.splitTextToSize(`• ${r.message}`, 175);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);
        doc.text(lines, 15, y);
        y += lines.length * 5 + 4;
      }

      doc.save(`SCMS_Report_${report.student?.name?.replace(/\s+/g, "_") ?? studentId}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
      console.error("PDF error", e);
    }
    setDownloading(false);
  };

  const level = report ? LEVEL_CONFIG[report.performanceLevel] : null;

  return (
    <DashboardLayout requiredRole="ADMIN">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <span className="text-zinc-700">/</span>
        <span className="text-sm text-zinc-500">Student Report</span>
      </div>

      {loading ? (
        <>
          <div className="h-8 w-64 bg-zinc-800/40 rounded-xl animate-pulse mb-2" />
          <div className="h-4 w-40 bg-zinc-800/30 rounded-lg animate-pulse mb-8" />
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 rounded-2xl bg-zinc-800/40 animate-pulse" />
            ))}
          </div>
        </>
      ) : notFound || !report ? (
        <div className="space-y-6">
          <PageHeader
            title="Student Report"
            description="No AI report has been generated yet for this student"
          />
          <Card className="border-indigo-800/30">
            <CardContent className="p-12 text-center">
              <Brain className="h-14 w-14 mx-auto text-indigo-400/40 mb-4" />
              <h3 className="text-lg font-semibold text-zinc-200 mb-2">No report yet</h3>
              <p className="text-zinc-500 text-sm mb-6 max-w-sm mx-auto">
                Generate an AI report to see this student&apos;s subject breakdown, recommendations and study plan.
              </p>
              <Button onClick={generateReport} disabled={generating}>
                <Brain className="h-4 w-4" />
                {generating ? "Generating…" : "Generate Report"}
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-600/30 flex items-center justify-center flex-shrink-0">
                <User className="h-6 w-6 text-indigo-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-zinc-100">{report.student?.name ?? "Student"}</h1>
                <p className="text-zinc-500 text-sm mt-0.5">{report.student?.email}</p>
                <p className="text-xs text-zinc-600 mt-1">
                  Report generated {new Date(report.generatedAt).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button variant="outline" size="sm" onClick={generateReport} disabled={generating}>
                <RefreshCw className={cn("h-4 w-4", generating && "animate-spin")} />
                {generating ? "Regenerating…" : "Regenerate"}
              </Button>
              <Button size="sm" onClick={downloadPDF} disabled={downloading}>
                <Download className="h-4 w-4" />
                {downloading ? "…" : "PDF"}
              </Button>
            </div>
          </div>

          <div className="space-y-6">
            {/* ── KPI cards ──────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  label: "Attendance",
                  value: `${report.attendancePercentage.toFixed(1)}%`,
                  icon: Calendar,
                  gradient: report.attendancePercentage >= 75 ? "from-emerald-500 to-teal-600" : "from-red-500 to-rose-600",
                  sub: report.attendancePercentage >= 75 ? "Above minimum threshold" : "Below 75% — at risk",
                  bar: report.attendancePercentage,
                  barColor: report.attendancePercentage >= 75 ? "#10b981" : "#ef4444",
                },
                {
                  label: "Average Marks",
                  value: `${report.averageMarks}%`,
                  icon: BookOpen,
                  gradient: report.averageMarks >= 70 ? "from-emerald-500 to-teal-600" : report.averageMarks >= 40 ? "from-amber-500 to-orange-600" : "from-red-500 to-rose-600",
                  sub: `Across ${report.subjectBreakdown.length} subject${report.subjectBreakdown.length !== 1 ? "s" : ""}`,
                  bar: report.averageMarks,
                  barColor: report.averageMarks >= 70 ? "#10b981" : report.averageMarks >= 40 ? "#f59e0b" : "#ef4444",
                },
                {
                  label: "Performance Level",
                  value: level!.label,
                  icon: Star,
                  gradient: report.performanceLevel === "GOOD" ? "from-emerald-500 to-teal-600" : report.performanceLevel === "AVERAGE" ? "from-amber-500 to-orange-600" : "from-red-500 to-rose-600",
                  sub: report.summary?.slice(0, 65) + "…",
                  bar: report.performanceLevel === "GOOD" ? 100 : report.performanceLevel === "AVERAGE" ? 60 : 30,
                  barColor: report.performanceLevel === "GOOD" ? "#10b981" : report.performanceLevel === "AVERAGE" ? "#f59e0b" : "#ef4444",
                },
              ].map((stat, i) => {
                const Icon = stat.icon;
                return (
                  <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                    <Card>
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <p className="text-xs text-zinc-500 mb-1">{stat.label}</p>
                            <p className="text-3xl font-bold text-zinc-100">{stat.value}</p>
                            <p className="text-xs text-zinc-600 mt-1 max-w-[145px] leading-relaxed">{stat.sub}</p>
                          </div>
                          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center flex-shrink-0`}>
                            <Icon className="h-5 w-5 text-white" />
                          </div>
                        </div>
                        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(stat.bar, 100)}%` }}
                            transition={{ duration: 0.8, delay: i * 0.1 + 0.3 }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: stat.barColor }}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>

            {/* ── Subject bar chart + breakdown ─────────────────────── */}
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5" /> Subject-wise Performance
              </h2>
              <div className="grid lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <BookOpen className="h-4 w-4 text-indigo-400" /> Marks Chart
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {report.subjectBreakdown.length === 0 ? (
                      <p className="text-zinc-500 text-sm text-center py-8">No marks data</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={report.subjectBreakdown} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                          <XAxis dataKey="subject" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis domain={[0, 100]} tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                          <Tooltip
                            contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: "12px", fontSize: 12 }}
                            labelStyle={{ color: "#d4d4d8" }}
                            formatter={(v: number, _: string, p: { payload: SubjectAnalysis }) => [
                              `${v}% (${p.payload.score}/${p.payload.maxScore})`, "Score",
                            ]}
                          />
                          <Bar dataKey="percentage" radius={[6, 6, 0, 0]}>
                            {report.subjectBreakdown.map((s) => (
                              <Cell key={s.subject} fill={LEVEL_CONFIG[s.level].bar} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                <div className="grid grid-cols-2 gap-3 content-start">
                  {report.subjectBreakdown.map((s, i) => {
                    const conf = LEVEL_CONFIG[s.level];
                    return (
                      <motion.div key={s.subject} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
                        <div className={cn("rounded-xl p-4 border h-full", conf.bg, conf.border)}>
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-semibold text-zinc-300 truncate">{s.subject}</p>
                            <span className={cn("text-xs font-bold", conf.color)}>{s.percentage}%</span>
                          </div>
                          <p className="text-xs text-zinc-500">{s.score}/{s.maxScore}</p>
                          <div className="h-1 bg-zinc-800 rounded-full mt-2 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${s.percentage}%` }}
                              transition={{ duration: 0.6, delay: i * 0.07 + 0.3 }}
                              className="h-full rounded-full"
                              style={{ backgroundColor: conf.bar }}
                            />
                          </div>
                          <span className={cn("text-xs font-semibold mt-1.5 inline-block", conf.color)}>{conf.label}</span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* ── Recommendations ───────────────────────────────────── */}
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
                <Zap className="h-3.5 w-3.5" /> AI Recommendations
              </h2>
              <div className="space-y-3">
                {report.recommendations.map((rec, i) => {
                  const { icon: PIcon, color } = PRIORITY_ICON[rec.priority];
                  return (
                    <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}>
                      <div className={cn("flex items-start gap-4 p-4 rounded-xl border", color)}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-zinc-900/60">
                          <PIcon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {rec.subject && (
                              <span className="text-xs font-semibold text-zinc-400 bg-zinc-800/60 px-2 py-0.5 rounded-full">
                                {rec.subject}
                              </span>
                            )}
                            <span className="text-xs text-zinc-600 capitalize">{rec.priority} priority</span>
                          </div>
                          <p className="text-sm text-zinc-300 leading-relaxed">{rec.message}</p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </section>

            {/* ── Study Plan ────────────────────────────────────────── */}
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
                <Target className="h-3.5 w-3.5" /> Suggested Study Plan
              </h2>
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y divide-zinc-800/50">
                    {report.studyPlan.map((day, i) => (
                      <motion.div
                        key={day.day}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.06 }}
                        className="flex items-start gap-4 p-4 hover:bg-zinc-800/20 transition-colors"
                      >
                        <div className="w-20 flex-shrink-0">
                          <p className="text-sm font-semibold text-zinc-300">{day.day}</p>
                          <p className="text-xs text-zinc-600 mt-0.5">{day.hoursAllocated}h</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap gap-1.5 mb-1.5">
                            {day.subjects.map((s) => (
                              <span key={s} className="text-xs bg-indigo-600/20 text-indigo-300 border border-indigo-600/30 px-2 py-0.5 rounded-full">
                                {s}
                              </span>
                            ))}
                          </div>
                          <p className="text-xs text-zinc-500 leading-relaxed">{day.focus}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-zinc-700 flex-shrink-0 mt-0.5" />
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* ── AI Summary ────────────────────────────────────────── */}
            {report.summary && (
              <Card className="border-indigo-800/30 bg-indigo-950/10">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-600/30 flex items-center justify-center flex-shrink-0">
                      <Brain className="h-5 w-5 text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-xs text-indigo-400 font-semibold mb-1 uppercase tracking-wide">AI Summary</p>
                      <p className="text-sm text-zinc-300 leading-relaxed">{report.summary}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Footer links ──────────────────────────────────────── */}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/admin/marks?student=${studentId}`}>
                  <BookOpen className="h-4 w-4" /> Manage Marks
                </Link>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4" /> Back to AI Tools
              </Button>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
