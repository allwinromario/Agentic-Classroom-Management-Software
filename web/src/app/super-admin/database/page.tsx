"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Database, Users, Calendar, ClipboardCheck, MessageSquare, Bell } from "lucide-react";
import { DashboardLayout, PageHeader } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DbStats {
  users: number;
  timetables: number;
  attendance: number;
  messages: number;
  alerts: number;
}

const collectionCards = (s: DbStats) => [
  { name: "users", label: "Users", count: s.users, icon: Users, color: "from-indigo-500 to-blue-600" },
  { name: "timetables", label: "Timetables", count: s.timetables, icon: Calendar, color: "from-violet-500 to-purple-600" },
  { name: "attendances", label: "Attendance Records", count: s.attendance, icon: ClipboardCheck, color: "from-emerald-500 to-teal-600" },
  { name: "chat_messages", label: "Chat Messages", count: s.messages, icon: MessageSquare, color: "from-pink-500 to-rose-600" },
  { name: "alerts", label: "Alerts", count: s.alerts, icon: Bell, color: "from-amber-500 to-orange-600" },
];

export default function DatabasePage() {
  const [stats, setStats] = useState<DbStats>({ users: 0, timetables: 0, attendance: 0, messages: 0, alerts: 0 });
  const [users, setUsers] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/users").then((r) => r.json()),
      fetch("/api/timetables").then((r) => r.json()),
      fetch("/api/attendance").then((r) => r.json()),
      fetch("/api/alerts").then((r) => r.json()),
    ]).then(([u, t, a, al]) => {
      setStats({
        users: u.users?.length ?? 0,
        timetables: t.timetables?.length ?? 0,
        attendance: a.attendance?.length ?? 0,
        messages: 0,
        alerts: al.alerts?.length ?? 0,
      });
      setUsers(u.users ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <DashboardLayout requiredRole="SUPER_ADMIN">
      <PageHeader
        title="Database Overview"
        description="System-wide data and collection statistics"
        action={
          <div className="flex items-center gap-2 text-sm text-zinc-400 bg-zinc-800/40 rounded-xl px-3 py-2 border border-zinc-700/40">
            <Database className="h-4 w-4 text-emerald-400" />
            SQLite / Prisma
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {collectionCards(stats).map((c, i) => {
          const Icon = c.icon;
          return (
            <motion.div
              key={c.name}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card>
                <CardContent className="p-4 text-center">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center mx-auto mb-3`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <p className="text-2xl font-bold text-zinc-100">{loading ? "—" : c.count}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{c.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Raw users table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-emerald-400" />
            users collection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left py-2 px-3 text-xs font-medium text-zinc-500">id</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-zinc-500">name</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-zinc-500">email</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-zinc-500">role</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-zinc-500">status</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-zinc-500">createdAt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {loading ? (
                  <tr><td colSpan={6} className="py-8 text-center text-zinc-600">Loading...</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-zinc-600">No records</td></tr>
                ) : (
                  (users as Array<Record<string, unknown>>).map((u) => (
                    <tr key={String(u.id)} className="hover:bg-zinc-800/20">
                      <td className="py-2 px-3 font-mono text-xs text-zinc-600">{String(u.id).slice(0, 8)}…</td>
                      <td className="py-2 px-3 text-zinc-300">{String(u.name)}</td>
                      <td className="py-2 px-3 text-zinc-400">{String(u.email)}</td>
                      <td className="py-2 px-3">
                        <span className="text-xs px-2 py-0.5 rounded-lg bg-zinc-800 text-zinc-400">{String(u.role)}</span>
                      </td>
                      <td className="py-2 px-3">
                        <span className={`text-xs ${u.status === "APPROVED" ? "text-emerald-400" : u.status === "PENDING" ? "text-amber-400" : "text-red-400"}`}>
                          {String(u.status)}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-xs text-zinc-600">
                        {new Date(String(u.createdAt)).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
