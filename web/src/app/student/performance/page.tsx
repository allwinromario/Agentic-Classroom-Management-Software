"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  LineChart, Line, Cell,
} from "recharts";
import {
  TrendingUp, BookOpen, AlertTriangle, CheckCircle2, Star,
  Download, RefreshCw, Brain, Target, Calendar, Zap, ChevronRight,
} from "lucide-react";
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
  attendancePercentage: number;
  averageMarks: number;
  performanceLevel: "GOOD" | "AVERAGE" | "WEAK";
  subjectBreakdown: SubjectAnalysis[];
  recommendations: Recommendation[];
  studyPlan: StudyPlanDay[];
  summary: string;
  generatedAt: string;
  student?: { name: string; email: string };
}

const LEVEL_CONFIG = {
  GOOD:    { label: "Good",    color: "text-emerald-400", bg: "bg-emerald-500/20", border: "border-emerald-500/30", bar: "#10b981" },
  AVERAGE: { label: "Average", color: "text-amber-400",   bg: "bg-amber-500/20",   border: "border-amber-500/30",   bar: "#f59e0b" },
  WEAK:    { label: "Weak",    color: "text-red-400",     bg: "bg-red-500/20",     border: "border-red-500/30",     bar: "#ef4444" },
} as const;

const PRIORITY_ICON = {
  high:   { icon: AlertTriangle, color: "text-red-400 bg-red-500/10 border-red-500/20" },
  medium: { icon: Target,        color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  low:    { icon: CheckCircle2,  color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
};

export default function StudentPerformancePage() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [attendanceTrend, setAttendanceTrend] = useState<{ day: string; rate: number }[]>([]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reports");
      const data = (await res.json()) as { reports: Report[] };
      if (data.reports?.length > 0) setReport(data.reports[0]);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadReport();
    // Build attendance trend from actual data
    fetch("/api/attendance")
      .then((r) => r.json())
      .then((data: { attendance?: Array<{ status: string; class?: { dayOfWeek?: string } }> }) => {
        const days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];
        const trend = days.map((day) => {
          const dayRecords = (data.attendance ?? []).filter((a) => a.class?.dayOfWeek === day);
          const present = dayRecords.filter((a) => a.status === "PRESENT").length;
          const total = dayRecords.length;
          return { day: day.slice(0, 3), rate: total > 0 ? Math.round((present / total) * 100) : 0 };
        });
        setAttendanceTrend(trend);
      })
      .catch(() => {});
  }, [loadReport]);

  const generateReport = async () => {
    setGenerating(true);
    try {
      const meRes = await fetch("/api/auth/me");
      const meData = (await meRes.json()) as { user?: { id: string } };
      if (!meData.user?.id) return;

      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: meData.user.id }),
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

      // Header
      doc.setFillColor(17, 24, 39);
      doc.rect(0, 0, 210, 40, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("SCMS — Student Performance Report", 15, 20);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Generated: ${new Date(report.generatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}`, 15, 32);

      // Student info
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text(`${report.student?.name ?? "Student"}`, 15, 55);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(report.student?.email ?? "", 15, 62);

      // Summary box
      doc.setFillColor(245, 247, 250);
      doc.roundedRect(10, 70, 190, 28, 3, 3, "F");
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      const summaryLines = doc.splitTextToSize(report.summary, 180);
      doc.text(summaryLines, 15, 80);

      // KPIs
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(30, 30, 30);
      doc.text("Performance Overview", 15, 110);

      const kpis = [
        { label: "Attendance", value: `${report.attendancePercentage.toFixed(1)}%` },
        { label: "Average Marks", value: `${report.averageMarks}%` },
        { label: "Level", value: levelConf.label },
      ];
      kpis.forEach((k, i) => {
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

      // Subject breakdown
      let y = 150;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(30, 30, 30);
      doc.text("Subject-wise Performance", 15, y);
      y += 8;

      for (const s of report.subjectBreakdown) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(50, 50, 50);
        doc.text(`${s.subject}`, 15, y);
        doc.text(`${s.percentage}% (${s.score}/${s.maxScore})`, 100, y);
        doc.text(s.level, 160, y);

        const barColor = s.level === "STRONG" ? [16, 185, 129] : s.level === "AVERAGE" ? [245, 158, 11] : [239, 68, 68];
        doc.setFillColor(barColor[0], barColor[1], barColor[2]);
        doc.rect(15, y + 2, (s.percentage / 100) * 80, 3, "F");
        y += 12;
        if (y > 260) { doc.addPage(); y = 20; }
      }

      // Recommendations
      y += 8;
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(30, 30, 30);
      doc.text("AI Recommendations", 15, y);
      y += 8;

      for (const r of report.recommendations) {
        if (y > 260) { doc.addPage(); y = 20; }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);
        const lines = doc.splitTextToSize(`• ${r.message}`, 175);
        doc.text(lines, 15, y);
        y += lines.length * 5 + 4;
      }

      doc.save(`SCMS_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
      console.error("PDF generation failed", e);
    }
    setDownloading(false);
  };

  if (loading) {
    return (
      <DashboardLayout requiredRole="STUDENT">
        <PageHeader title="AI Performance Dashboard" description="Analyzing your academic journey..." />
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-zinc-800/40 animate-pulse" />
          ))}
        </div>
      </DashboardLayout>
    );
  }

  const level = report ? LEVEL_CONFIG[report.performanceLevel] : null;

  return (
    <DashboardLayout requiredRole="STUDENT">
      <PageHeader
        title="AI Performance Dashboard"
        description="Your personalized academic insights, recommendations and study plan"
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={generateReport} disabled={generating}>
              <RefreshCw className={cn("h-4 w-4", generating && "animate-spin")} />
              {generating ? "Generating..." : "Refresh Report"}
            </Button>
            {report && (
              <Button size="sm" onClick={downloadPDF} disabled={downloading}>
                <Download className="h-4 w-4" />
                {downloading ? "..." : "Download PDF"}
              </Button>
            )}
          </div>
        }
      />

      {!report ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-indigo-800/30">
            <CardContent className="p-12 text-center">
              <Brain className="h-14 w-14 mx-auto text-indigo-400/50 mb-4" />
              <h3 className="text-lg font-semibold text-zinc-200 mb-2">No report yet</h3>
              <p className="text-zinc-500 text-sm mb-6 max-w-sm mx-auto">
                Generate your first AI performance report to see subject analysis, recommendations and a personalized study plan.
              </p>
              <Button onClick={generateReport} disabled={generating}>
                <Brain className="h-4 w-4" />
                {generating ? "Generating..." : "Generate My Report"}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <div className="space-y-6">
          {/* ── Your Performance ──────────────────────────────────────────── */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5" /> Your Performance
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  label: "Attendance",
                  value: `${report.attendancePercentage.toFixed(1)}%`,
                  icon: Calendar,
                  gradient: report.attendancePercentage >= 75 ? "from-emerald-500 to-teal-600" : "from-red-500 to-rose-600",
                  sub: report.attendancePercentage >= 75 ? "Above threshold" : "Below 75% — at risk",
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
                  sub: report.summary.slice(0, 60) + "…",
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
                            <p className="text-xs text-zinc-600 mt-1 max-w-[140px] leading-relaxed">{stat.sub}</p>
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
          </section>

          {/* ── AI Insights ───────────────────────────────────────────────── */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
              <Brain className="h-3.5 w-3.5" /> AI Insights
            </h2>
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Subject marks bar chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BookOpen className="h-4 w-4 text-indigo-400" /> Subject-wise Marks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {report.subjectBreakdown.length === 0 ? (
                    <p className="text-zinc-500 text-sm text-center py-8">No marks data yet</p>
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
                            `${v}% (${p.payload.score}/${p.payload.maxScore})`, "Score"
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

              {/* Attendance trend line chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="h-4 w-4 text-emerald-400" /> Attendance Trend
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={attendanceTrend} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="day" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: "12px", fontSize: 12 }}
                        labelStyle={{ color: "#d4d4d8" }}
                        formatter={(v: number) => [`${v}%`, "Attendance"]}
                      />
                      <Line type="monotone" dataKey="rate" stroke="#6366f1" strokeWidth={2} dot={{ fill: "#6366f1", r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Subject breakdown cards */}
            {report.subjectBreakdown.length > 0 && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                {report.subjectBreakdown.map((s, i) => {
                  const conf = LEVEL_CONFIG[s.level];
                  return (
                    <motion.div key={s.subject} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
                      <div className={cn("rounded-xl p-4 border", conf.bg, conf.border)}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-semibold text-zinc-200">{s.subject}</p>
                          <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", conf.bg, conf.color, conf.border, "border")}>
                            {conf.label}
                          </span>
                        </div>
                        <p className={cn("text-2xl font-bold", conf.color)}>{s.percentage}%</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{s.score} / {s.maxScore} marks</p>
                        <div className="h-1.5 bg-zinc-800 rounded-full mt-2 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${s.percentage}%` }}
                            transition={{ duration: 0.7, delay: i * 0.07 + 0.3 }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: conf.bar }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── Recommendations ───────────────────────────────────────────── */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
              <Zap className="h-3.5 w-3.5" /> Recommendations
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

          {/* ── Study Plan ────────────────────────────────────────────────── */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
              <Target className="h-3.5 w-3.5" /> Weekly Study Plan
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

          {/* ── AI Summary ────────────────────────────────────────────────── */}
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
                    <p className="text-xs text-zinc-600 mt-2">
                      Report generated {new Date(report.generatedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
