"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, Calendar, CheckCircle2, Clock, XCircle, Shield, TrendingUp } from "lucide-react";
import { DashboardLayout, PageHeader } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

interface StatsData {
  totalUsers: number;
  pendingUsers: number;
  approvedUsers: number;
  totalTimetables: number;
  pendingTimetables: number;
  approvedTimetables: number;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

const statCards = (s: StatsData) => [
  { label: "Total Users", value: s.totalUsers, icon: Users, color: "from-indigo-500 to-blue-600", sub: `${s.approvedUsers} approved` },
  { label: "Pending Approvals", value: s.pendingUsers, icon: Clock, color: "from-amber-500 to-orange-600", sub: "Awaiting review" },
  { label: "Timetables", value: s.totalTimetables, icon: Calendar, color: "from-emerald-500 to-teal-600", sub: `${s.approvedTimetables} approved` },
  { label: "Pending Timetables", value: s.pendingTimetables, icon: TrendingUp, color: "from-violet-500 to-purple-600", sub: "Need review" },
];

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<StatsData>({
    totalUsers: 0, pendingUsers: 0, approvedUsers: 0,
    totalTimetables: 0, pendingTimetables: 0, approvedTimetables: 0,
  });
  const [recentUsers, setRecentUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/users").then((r) => r.json()),
      fetch("/api/timetables").then((r) => r.json()),
    ]).then(([usersData, ttData]) => {
      const users: User[] = usersData.users ?? [];
      const timetables = ttData.timetables ?? [];
      setStats({
        totalUsers: users.length,
        pendingUsers: users.filter((u) => u.status === "PENDING").length,
        approvedUsers: users.filter((u) => u.status === "APPROVED").length,
        totalTimetables: timetables.length,
        pendingTimetables: timetables.filter((t: { status: string }) => t.status === "PENDING_APPROVAL").length,
        approvedTimetables: timetables.filter((t: { status: string }) => t.status === "APPROVED").length,
      });
      setRecentUsers(users.slice(0, 5));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <DashboardLayout requiredRole="SUPER_ADMIN">
      <PageHeader
        title="Super Admin Dashboard"
        description="System overview and pending approvals"
        action={
          <div className="flex items-center gap-2 text-sm text-zinc-400 bg-zinc-800/40 rounded-xl px-3 py-2 border border-zinc-700/40">
            <Shield className="h-4 w-4 text-violet-400" />
            Super Admin
          </div>
        }
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards(stats).map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="overflow-hidden">
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
        <Card className="border-amber-800/30 bg-amber-950/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-300">
              <Clock className="h-5 w-5" />
              Pending User Approvals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-zinc-100 mb-1">{stats.pendingUsers}</p>
            <p className="text-sm text-zinc-500 mb-4">Users waiting for account approval</p>
            <Button variant="warning" size="sm" asChild>
              <Link href="/super-admin/users?status=PENDING">Review Users</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-indigo-800/30 bg-indigo-950/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-indigo-300">
              <Calendar className="h-5 w-5" />
              Timetable Approvals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-zinc-100 mb-1">{stats.pendingTimetables}</p>
            <p className="text-sm text-zinc-500 mb-4">Timetables awaiting approval</p>
            <Button size="sm" asChild>
              <Link href="/super-admin/timetables?status=PENDING_APPROVAL">Review Timetables</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Users */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Registrations</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/super-admin/users">View All</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-14 rounded-xl bg-zinc-800/40 animate-pulse" />
              ))}
            </div>
          ) : recentUsers.length === 0 ? (
            <p className="text-zinc-500 text-sm text-center py-8">No users registered yet</p>
          ) : (
            <div className="space-y-2">
              {recentUsers.map((u) => (
                <div key={u.id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/30 hover:bg-zinc-800/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold">
                      {u.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-200">{u.name}</p>
                      <p className="text-xs text-zinc-500">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-zinc-600">{formatDate(u.createdAt)}</span>
                    <StatusBadge status={u.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
