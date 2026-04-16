"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Camera, Users, CheckCircle2, Clock, TrendingUp } from "lucide-react";
import Link from "next/link";
import { DashboardLayout, PageHeader } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate, formatTime } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";

interface Timetable {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  classes: { id: string; subject: string; dayOfWeek: string; startTime: string }[];
}

interface AttendanceRecord {
  id: string;
  status: string;
  timestamp: string;
  student: { name: string };
  class: { subject: string };
}

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/timetables").then((r) => r.json()),
      fetch("/api/attendance").then((r) => r.json()),
    ]).then(([ttData, attData]) => {
      setTimetables(ttData.timetables ?? []);
      setAttendance(attData.attendance ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const approved = timetables.filter((t) => t.status === "APPROVED").length;
  const pending = timetables.filter((t) => t.status === "PENDING_APPROVAL").length;
  const todayAttendance = attendance.filter((a) => {
    const d = new Date(a.timestamp);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });
  const presentToday = todayAttendance.filter((a) => a.status === "PRESENT").length;

  return (
    <DashboardLayout requiredRole="ADMIN">
      <PageHeader
        title={`Welcome, ${user?.name ?? "Teacher"}`}
        description="Manage your classes, timetables, and attendance"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "My Timetables", value: timetables.length, icon: Calendar, color: "from-indigo-500 to-blue-600", sub: `${approved} approved` },
          { label: "Pending Review", value: pending, icon: Clock, color: "from-amber-500 to-orange-600", sub: "Submitted to admin" },
          { label: "Today Present", value: presentToday, icon: CheckCircle2, color: "from-emerald-500 to-teal-600", sub: `${todayAttendance.length} total marked` },
          { label: "Total Classes", value: timetables.reduce((acc, t) => acc + t.classes.length, 0), icon: TrendingUp, color: "from-violet-500 to-purple-600", sub: "Across all timetables" },
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
                      <p className="text-xs text-zinc-600 mt-1">{s.sub}</p>
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

      {/* Quick Actions */}
      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        <Card className="border-indigo-800/30 bg-indigo-950/10 hover:border-indigo-700/40 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-indigo-300">
              <Calendar className="h-5 w-5" />
              Timetable Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-400 mb-4">Create and manage your class schedules, then submit for approval.</p>
            <div className="flex gap-2">
              <Button size="sm" asChild>
                <Link href="/admin/timetable">Manage Timetables</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-violet-800/30 bg-violet-950/10 hover:border-violet-700/40 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-violet-300">
              <Camera className="h-5 w-5" />
              AI Face Attendance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-400 mb-4">Start attendance mode to automatically detect and mark student presence.</p>
            <Button size="sm" variant="secondary" asChild>
              <Link href="/admin/attendance">Open Attendance</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Timetables list */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>My Timetables</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/timetable">Manage</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-zinc-800/40 animate-pulse" />)}</div>
          ) : timetables.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-10 w-10 mx-auto text-zinc-700 mb-3" />
              <p className="text-zinc-500 text-sm mb-4">No timetables yet</p>
              <Button size="sm" asChild><Link href="/admin/timetable">Create First Timetable</Link></Button>
            </div>
          ) : (
            <div className="space-y-2">
              {timetables.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/30 hover:bg-zinc-800/50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{t.title}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{t.classes.length} classes · {formatDate(t.createdAt)}</p>
                  </div>
                  <StatusBadge status={t.status} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
