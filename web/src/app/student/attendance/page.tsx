"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ClipboardCheck, CheckCircle2, XCircle, AlertCircle, TrendingUp
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, PieChart, Pie
} from "recharts";
import { DashboardLayout, PageHeader } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

interface AttendanceRecord {
  id: string;
  status: string;
  timestamp: string;
  class: { subject: string; dayOfWeek: string; startTime: string };
}

export default function StudentAttendancePage() {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/attendance")
      .then((r) => r.json())
      .then((data) => {
        setAttendance(data.attendance ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const present = attendance.filter((a) => a.status === "PRESENT").length;
  const absent = attendance.filter((a) => a.status === "ABSENT").length;
  const late = attendance.filter((a) => a.status === "LATE").length;
  const total = attendance.length;
  const rate = total ? Math.round((present / total) * 100) : 0;

  const bySubject = attendance.reduce((acc, a) => {
    const subj = a.class?.subject ?? "Unknown";
    if (!acc[subj]) acc[subj] = { present: 0, absent: 0, late: 0 };
    if (a.status === "PRESENT") acc[subj].present++;
    else if (a.status === "ABSENT") acc[subj].absent++;
    else acc[subj].late++;
    return acc;
  }, {} as Record<string, { present: number; absent: number; late: number }>);

  const subjectData = Object.entries(bySubject).map(([name, counts]) => ({
    name: name.slice(0, 10),
    present: counts.present,
    absent: counts.absent,
    total: counts.present + counts.absent + counts.late,
    rate: counts.present + counts.absent + counts.late
      ? Math.round((counts.present / (counts.present + counts.absent + counts.late)) * 100)
      : 0,
  }));

  const pieData = [
    { name: "Present", value: present, color: "#34d399" },
    { name: "Absent", value: absent, color: "#f87171" },
    { name: "Late", value: late, color: "#fbbf24" },
  ].filter((d) => d.value > 0);

  return (
    <DashboardLayout requiredRole="STUDENT">
      <PageHeader
        title="My Attendance"
        description="Detailed attendance records and analytics"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Attendance Rate", value: `${rate}%`, icon: TrendingUp, color: "from-emerald-500 to-teal-600" },
          { label: "Present", value: present, icon: CheckCircle2, color: "from-indigo-500 to-blue-600" },
          { label: "Absent", value: absent, icon: XCircle, color: "from-red-500 to-rose-600" },
          { label: "Late", value: late, icon: AlertCircle, color: "from-amber-500 to-orange-600" },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-zinc-500 mb-1">{s.label}</p>
                      <p className="text-3xl font-bold text-zinc-100">{loading ? "—" : s.value}</p>
                    </div>
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center flex-shrink-0`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        {/* Donut Chart */}
        <Card>
          <CardHeader><CardTitle>Overall Breakdown</CardTitle></CardHeader>
          <CardContent>
            {total === 0 ? (
              <p className="text-zinc-500 text-sm text-center py-8">No data yet</p>
            ) : (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: "12px", fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-2">
                  {pieData.map((d) => (
                    <div key={d.name} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                      <span className="text-xs text-zinc-400">{d.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* By Subject */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>By Subject</CardTitle></CardHeader>
          <CardContent>
            {subjectData.length === 0 ? (
              <p className="text-zinc-500 text-sm text-center py-8">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={subjectData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="name" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: "12px", fontSize: 12 }}
                    formatter={(v) => [`${v ?? 0}%`, "Rate"]}
                  />
                  <Bar dataKey="rate" fill="#6366f1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Records Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-violet-400" />
            All Records
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-zinc-800/40 animate-pulse" />)}</div>
          ) : attendance.length === 0 ? (
            <div className="p-12 text-center">
              <ClipboardCheck className="h-12 w-12 mx-auto text-zinc-700 mb-3" />
              <p className="text-zinc-500">No attendance records yet</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/60">
              {attendance.map((a, i) => (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="flex items-center justify-between px-6 py-3.5 hover:bg-zinc-800/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${a.status === "PRESENT" ? "bg-emerald-400" : a.status === "ABSENT" ? "bg-red-400" : "bg-amber-400"}`} />
                    <div>
                      <p className="text-sm font-medium text-zinc-200">{a.class?.subject ?? "Unknown"}</p>
                      <p className="text-xs text-zinc-500">{a.class?.dayOfWeek?.slice(0, 3)} · {a.class?.startTime}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-zinc-600">{formatDate(a.timestamp)}</span>
                    <StatusBadge status={a.status} />
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
