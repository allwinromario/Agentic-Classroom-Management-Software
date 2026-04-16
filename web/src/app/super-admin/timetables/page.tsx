"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Calendar, CheckCircle, XCircle, Clock, BookOpen } from "lucide-react";
import { DashboardLayout, PageHeader } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatTime } from "@/lib/utils";

interface ClassItem {
  id: string;
  subject: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  room?: string;
}

interface Timetable {
  id: string;
  title: string;
  description?: string;
  status: string;
  createdAt: string;
  createdBy: { name: string; email: string };
  classes: ClassItem[];
}

export default function TimetableApprovalPage() {
  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchTimetables = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/timetables");
    const data = await r.json();
    setTimetables(data.timetables ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTimetables();
  }, [fetchTimetables]);

  const updateStatus = async (id: string, status: string) => {
    setActionLoading(id + status);
    const r = await fetch(`/api/timetables/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (r.ok) {
      setTimetables((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status } : t))
      );
    }
    setActionLoading(null);
  };

  const filtered = statusFilter === "ALL" ? timetables : timetables.filter((t) => t.status === statusFilter);

  const dayOrder = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

  return (
    <DashboardLayout requiredRole="SUPER_ADMIN">
      <PageHeader
        title="Timetable Approval"
        description="Review and approve timetables submitted by teachers"
      />

      <div className="flex items-center gap-3 mb-6">
        {["ALL", "PENDING_APPROVAL", "APPROVED", "REJECTED", "DRAFT"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              statusFilter === s
                ? "bg-indigo-600/20 text-indigo-300 border border-indigo-600/30"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40"
            }`}
          >
            {s === "ALL" ? "All" : s.replace("_", " ")}
            <span className="ml-1.5 text-zinc-600">
              ({s === "ALL" ? timetables.length : timetables.filter((t) => t.status === s).length})
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-zinc-800/40 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Calendar className="h-12 w-12 mx-auto text-zinc-700 mb-3" />
          <p className="text-zinc-500">No timetables found</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-zinc-100">{t.title}</h3>
                        <StatusBadge status={t.status} />
                      </div>
                      {t.description && (
                        <p className="text-sm text-zinc-500 mb-2">{t.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-zinc-500">
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-3.5 w-3.5" />
                          {t.classes.length} classes
                        </span>
                        <span>By {t.createdBy.name}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDate(t.createdAt)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                      >
                        {expanded === t.id ? "Hide" : "Preview"}
                      </Button>
                      {t.status === "PENDING_APPROVAL" && (
                        <>
                          <Button
                            variant="success"
                            size="sm"
                            loading={actionLoading === t.id + "APPROVED"}
                            onClick={() => updateStatus(t.id, "APPROVED")}
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            Approve
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            loading={actionLoading === t.id + "REJECTED"}
                            onClick={() => updateStatus(t.id, "REJECTED")}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {expanded === t.id && t.classes.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4 pt-4 border-t border-zinc-800/60"
                    >
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {[...t.classes]
                          .sort((a, b) => dayOrder.indexOf(a.dayOfWeek) - dayOrder.indexOf(b.dayOfWeek))
                          .map((c) => (
                            <div key={c.id} className="p-3 rounded-xl bg-zinc-800/40 border border-zinc-700/40">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-sm font-medium text-zinc-200">{c.subject}</p>
                                  <p className="text-xs text-zinc-500 mt-0.5">
                                    {c.dayOfWeek.slice(0, 3)} · {formatTime(c.startTime)} – {formatTime(c.endTime)}
                                  </p>
                                </div>
                                {c.room && (
                                  <span className="text-xs text-zinc-600 bg-zinc-700/40 px-2 py-0.5 rounded-lg">
                                    {c.room}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
