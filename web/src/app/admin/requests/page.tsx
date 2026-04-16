"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Inbox, ScanFace, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { DashboardLayout, PageHeader } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate, getInitials } from "@/lib/utils";

interface RetakeRequest {
  id: string;
  name: string;
  email: string;
  faceRetakeReason?: string;
  createdAt: string;
}

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<RetakeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/face-retake");
    const data = await r.json();
    setRequests(data.requests ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleAction = async (studentId: string, approve: boolean) => {
    setActionLoading(studentId + (approve ? "a" : "r"));
    const r = await fetch("/api/face-retake", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, approve }),
    });
    if (r.ok) {
      setRequests((prev) => prev.filter((req) => req.id !== studentId));
    }
    setActionLoading(null);
  };

  return (
    <DashboardLayout requiredRole="ADMIN">
      <PageHeader
        title="Student Requests"
        description="Face photo retake requests from students"
        action={
          <Button variant="outline" size="sm" onClick={fetchRequests}>
            <RefreshCw className="h-3.5 w-3.5" />Refresh
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-zinc-800/40 animate-pulse" />)}
            </div>
          ) : requests.length === 0 ? (
            <div className="p-16 text-center">
              <Inbox className="h-14 w-14 mx-auto text-zinc-700 mb-4" />
              <h3 className="text-base font-semibold text-zinc-400 mb-1">No Pending Requests</h3>
              <p className="text-sm text-zinc-600">Student face retake requests will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/60">
              <AnimatePresence>
                {requests.map((req) => (
                  <motion.div
                    key={req.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-start gap-4 px-6 py-5"
                  >
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 mt-0.5">
                      {getInitials(req.name)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-zinc-200">{req.name}</p>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">Retake</span>
                      </div>
                      <p className="text-xs text-zinc-500">{req.email}</p>
                      {req.faceRetakeReason && (
                        <div className="mt-2.5 p-3 rounded-xl bg-zinc-800/50 border border-zinc-700/40">
                          <div className="flex items-center gap-1.5 mb-1">
                            <ScanFace className="h-3.5 w-3.5 text-zinc-500" />
                            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Reason</p>
                          </div>
                          <p className="text-sm text-zinc-300">{req.faceRetakeReason}</p>
                        </div>
                      )}
                      <p className="text-xs text-zinc-600 mt-1.5">Requested {formatDate(req.createdAt)}</p>
                    </div>

                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="success"
                        loading={actionLoading === req.id + "a"}
                        onClick={() => handleAction(req.id, true)}
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        loading={actionLoading === req.id + "r"}
                        onClick={() => handleAction(req.id, false)}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Reject
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
