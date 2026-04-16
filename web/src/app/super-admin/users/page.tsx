"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, CheckCircle, XCircle, Search, Filter, Trash2, ScanFace, ImageOff, RefreshCw, Bell, Archive, X, ZoomIn } from "lucide-react";
import { DashboardLayout, PageHeader } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, getInitials } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface DeletedUser {
  id: string;
  originalId: string;
  name: string;
  email: string;
  role: string;
  status: string;
  deletedAt: string;
  deletedById: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  faceRegistered: boolean;
  faceImageB64?: string | null;
  faceRetakeRequested: boolean;
  faceRetakeApproved: boolean;
  faceRetakeReason?: string;
  createdAt: string;
}

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "from-violet-500 to-purple-600",
  ADMIN: "from-indigo-500 to-blue-600",
  STUDENT: "from-emerald-500 to-teal-600",
};

type TabId = "all" | "retake" | "deleted";

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [filtered, setFiltered] = useState<User[]>([]);
  const [deletedUsers, setDeletedUsers] = useState<DeletedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("all");
  const [facePreview, setFacePreview] = useState<{ name: string; b64: string } | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const [usersData, deletedData] = await Promise.all([
      fetch("/api/users").then((r) => r.json()),
      fetch("/api/deleted-users").then((r) => r.json()),
    ]);
    setUsers(usersData.users ?? []);
    setDeletedUsers(deletedData.deletedUsers ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  useEffect(() => {
    let list = users;
    if (tab === "retake") {
      list = list.filter((u) => u.faceRetakeRequested);
    } else {
      if (search) list = list.filter((u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));
      if (statusFilter !== "ALL") list = list.filter((u) => u.status === statusFilter);
      if (roleFilter !== "ALL") list = list.filter((u) => u.role === roleFilter);
    }
    setFiltered(list);
  }, [users, search, statusFilter, roleFilter, tab]);

  const updateUser = async (id: string, status: string) => {
    setActionLoading(id + status);
    const r = await fetch(`/api/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (r.ok) setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status } : u)));
    setActionLoading(null);
  };

  const deleteUser = async (id: string) => {
    if (!confirm("Delete this user permanently? All their data (attendance, chat, enrollments) will also be deleted.")) return;
    setActionLoading(id + "delete");
    const r = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (r.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== id));
      // Refresh deleted users list
      fetch("/api/deleted-users").then((res) => res.json()).then((d) => setDeletedUsers(d.deletedUsers ?? []));
    } else {
      const data = await r.json().catch(() => ({})) as { error?: string };
      alert(data.error ?? "Failed to delete user. Please try again.");
    }
    setActionLoading(null);
  };

  const handleRetake = async (studentId: string, approve: boolean) => {
    setActionLoading(studentId + (approve ? "approve" : "reject"));
    const r = await fetch("/api/face-retake", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, approve }),
    });
    if (r.ok) {
      setUsers((prev) => prev.map((u) =>
        u.id === studentId
          ? { ...u, faceRetakeRequested: false, faceRetakeApproved: approve }
          : u
      ));
    }
    setActionLoading(null);
  };

  const retakeCount = users.filter((u) => u.faceRetakeRequested).length;

  return (
    <DashboardLayout requiredRole="SUPER_ADMIN">
      <PageHeader title="User Management" description="Approve, reject, manage users and face registrations" />

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {([
          ["all",     "All Users",        Users],
          ["retake",  "Retake Requests",  Bell],
          ["deleted", "Deleted Users",    Archive],
        ] as [TabId, string, React.ComponentType<{className?: string}>][]).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all",
              tab === id ? "border-indigo-600/60 bg-indigo-950/30 text-indigo-300" : "border-zinc-700 bg-zinc-800/30 text-zinc-400 hover:border-zinc-600"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
            {id === "retake" && retakeCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">{retakeCount}</span>
            )}
            {id === "deleted" && deletedUsers.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-zinc-700/60 text-zinc-400 text-[10px] font-bold border border-zinc-600/40">{deletedUsers.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Filters (All tab only) */}
      {tab === "all" && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <input placeholder="Search by name or email…" value={search} onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-9 rounded-xl border border-zinc-700 bg-zinc-800/50 pl-9 pr-4 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-zinc-500" />
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-9 rounded-xl border border-zinc-700 bg-zinc-800/50 px-3 text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
                  <option value="ALL">All Status</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </select>
                <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
                  className="h-9 rounded-xl border border-zinc-700 bg-zinc-800/50 px-3 text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
                  <option value="ALL">All Roles</option>
                  <option value="ADMIN">Teacher</option>
                  <option value="STUDENT">Student</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "all" && (
        <div className="flex items-center gap-4 mb-4 text-sm text-zinc-500">
          <span>{filtered.length} user{filtered.length !== 1 ? "s" : ""}</span>·
          <span className="text-amber-400">{users.filter((u) => u.status === "PENDING").length} pending</span>·
          <span className="text-emerald-400">{users.filter((u) => u.status === "APPROVED").length} approved</span>·
          <span className="text-indigo-400">{users.filter((u) => u.faceRegistered && u.role === "STUDENT").length} faces registered</span>
        </div>
      )}

      {/* ── All Users table ──────────────────────────────────────────── */}
      {tab === "all" && (
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-zinc-800/40 animate-pulse" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center"><Users className="h-12 w-12 mx-auto text-zinc-700 mb-3" /><p className="text-zinc-500">No users found</p></div>
            ) : (
              <div className="divide-y divide-zinc-800/60">
                <AnimatePresence>
                  {filtered.map((u) => (
                    <motion.div key={u.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="flex items-center gap-4 px-6 py-4 hover:bg-zinc-800/20 transition-colors"
                    >
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${ROLE_COLORS[u.role] ?? "from-zinc-500 to-zinc-600"} flex items-center justify-center text-white text-xs font-semibold flex-shrink-0`}>
                        {getInitials(u.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-200 truncate">{u.name}</p>
                        <p className="text-xs text-zinc-500 truncate">{u.email}</p>
                      </div>
                      <span className="hidden sm:block text-xs px-2 py-1 rounded-lg bg-zinc-800 text-zinc-400">
                        {u.role === "ADMIN" ? "Teacher" : u.role === "SUPER_ADMIN" ? "Super Admin" : "Student"}
                      </span>
                      {/* Face status badge — students only */}
                      {u.role === "STUDENT" && (
                        u.faceRegistered && u.faceImageB64 ? (
                          <button
                            onClick={() => setFacePreview({ name: u.name, b64: u.faceImageB64! })}
                            className="hidden sm:flex items-center gap-1 text-xs px-2 py-1 rounded-lg border bg-emerald-950/40 border-emerald-800/40 text-emerald-400 hover:bg-emerald-900/50 transition-colors cursor-pointer"
                          >
                            <ScanFace className="h-3 w-3" />
                            Face ✓
                            <ZoomIn className="h-3 w-3 ml-0.5 opacity-60" />
                          </button>
                        ) : (
                          <div className={cn("hidden sm:flex items-center gap-1 text-xs px-2 py-1 rounded-lg border",
                            u.faceRegistered
                              ? "bg-emerald-950/40 border-emerald-800/40 text-emerald-400"
                              : "bg-zinc-800/40 border-zinc-700/40 text-zinc-500"
                          )}>
                            {u.faceRegistered
                              ? <><ScanFace className="h-3 w-3" />Face ✓</>
                              : <><ImageOff className="h-3 w-3" />No Face</>}
                          </div>
                        )
                      )}
                      <div className="hidden sm:block text-xs text-zinc-600">{formatDate(u.createdAt)}</div>
                      <StatusBadge status={u.status} />
                      <div className="flex items-center gap-1.5">
                        {u.status !== "APPROVED" && (
                          <Button variant="success" size="sm" loading={actionLoading === u.id + "APPROVED"} onClick={() => updateUser(u.id, "APPROVED")}>
                            <CheckCircle className="h-3.5 w-3.5" />Approve
                          </Button>
                        )}
                        {u.status !== "REJECTED" && (
                          <Button variant="destructive" size="sm" loading={actionLoading === u.id + "REJECTED"} onClick={() => updateUser(u.id, "REJECTED")}>
                            <XCircle className="h-3.5 w-3.5" />Reject
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" loading={actionLoading === u.id + "delete"} onClick={() => deleteUser(u.id)} className="text-zinc-600 hover:text-red-400">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Retake Requests tab ──────────────────────────────────────── */}
      {tab === "retake" && (
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-zinc-800/40 animate-pulse" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center">
                <ScanFace className="h-12 w-12 mx-auto text-zinc-700 mb-3" />
                <p className="text-zinc-500 text-sm">No pending face retake requests</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/60">
                {filtered.map((u) => (
                  <div key={u.id} className="flex items-start gap-4 px-6 py-5">
                    {/* Current registered face thumbnail */}
                    {u.faceImageB64 ? (
                      <button
                        onClick={() => setFacePreview({ name: u.name, b64: u.faceImageB64! })}
                        className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 mt-0.5 border-2 border-indigo-600/40 hover:border-indigo-400/70 transition-colors group relative"
                        title="View registered face photo"
                      >
                        <img
                          src={`data:image/jpeg;base64,${u.faceImageB64}`}
                          alt={u.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                          <ZoomIn className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </button>
                    ) : (
                      <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${ROLE_COLORS["STUDENT"]} flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 mt-0.5`}>
                        {getInitials(u.name)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-200">{u.name}</p>
                      <p className="text-xs text-zinc-500">{u.email}</p>
                      {u.faceImageB64 && (
                        <button
                          onClick={() => setFacePreview({ name: u.name, b64: u.faceImageB64! })}
                          className="mt-1 text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                        >
                          <ZoomIn className="h-3 w-3" />View current photo
                        </button>
                      )}
                      {u.faceRetakeReason && (
                        <div className="mt-2 p-2.5 rounded-xl bg-zinc-800/50 border border-zinc-700/40">
                          <p className="text-xs text-zinc-400 font-medium mb-0.5">Reason for retake:</p>
                          <p className="text-xs text-zinc-300">{u.faceRetakeReason}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button size="sm" variant="success" loading={actionLoading === u.id + "approve"} onClick={() => handleRetake(u.id, true)}>
                        <CheckCircle className="h-3.5 w-3.5" />Approve
                      </Button>
                      <Button size="sm" variant="destructive" loading={actionLoading === u.id + "reject"} onClick={() => handleRetake(u.id, false)}>
                        <XCircle className="h-3.5 w-3.5" />Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Deleted Users archive tab ────────────────────────────────── */}
      {tab === "deleted" && (
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-zinc-800/40 animate-pulse" />)}</div>
            ) : deletedUsers.length === 0 ? (
              <div className="p-12 text-center">
                <Archive className="h-12 w-12 mx-auto text-zinc-700 mb-3" />
                <p className="text-zinc-500 text-sm">No deleted users yet</p>
                <p className="text-zinc-700 text-xs mt-1">Deleted accounts are archived here. Their emails become available for re-registration immediately.</p>
              </div>
            ) : (
              <>
                <div className="px-6 py-3 border-b border-zinc-800/60">
                  <p className="text-xs text-zinc-500">
                    These accounts have been permanently deleted. Their email addresses are <span className="text-emerald-400">free to re-register</span>.
                  </p>
                </div>
                <div className="divide-y divide-zinc-800/60">
                  {deletedUsers.map((u) => (
                    <div key={u.id} className="flex items-center gap-4 px-6 py-4 opacity-70 hover:opacity-100 transition-opacity">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${ROLE_COLORS[u.role] ?? "from-zinc-500 to-zinc-700"} flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 grayscale`}>
                        {getInitials(u.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-zinc-300 truncate">{u.name}</p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-900/30 text-red-400 border border-red-800/30 flex-shrink-0">Deleted</span>
                        </div>
                        <p className="text-xs text-zinc-500 truncate">{u.email}</p>
                      </div>
                      <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-600">
                        <span className="px-2 py-1 rounded-lg bg-zinc-800 text-zinc-400">
                          {u.role === "ADMIN" ? "Teacher" : u.role === "SUPER_ADMIN" ? "Super Admin" : "Student"}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-600 hidden sm:block whitespace-nowrap">
                        {formatDate(u.deletedAt)}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
      {/* ── Face Photo Preview Modal ────────────────────────────────── */}
      <AnimatePresence>
        {facePreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setFacePreview(null)}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="relative bg-zinc-900 border border-zinc-700/60 rounded-3xl p-5 shadow-2xl max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-semibold text-zinc-100">Registered Face ID</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">{facePreview.name}</p>
                </div>
                <button
                  onClick={() => setFacePreview(null)}
                  className="w-8 h-8 rounded-xl bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="rounded-2xl overflow-hidden border border-zinc-700/40 bg-zinc-800/40 aspect-[3/4] relative">
                <img
                  src={`data:image/jpeg;base64,${facePreview.b64}`}
                  alt={`${facePreview.name} face ID`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback: try as PNG if JPEG fails
                    (e.currentTarget as HTMLImageElement).src = `data:image/png;base64,${facePreview.b64}`;
                  }}
                />
                {/* Face guide overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-32 h-40 rounded-full border-2 border-indigo-400/30" />
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 h-px bg-zinc-800" />
                <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                  <ScanFace className="h-3 w-3" />Face registered
                </span>
                <div className="flex-1 h-px bg-zinc-800" />
              </div>

              <button
                onClick={() => setFacePreview(null)}
                className="w-full mt-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
