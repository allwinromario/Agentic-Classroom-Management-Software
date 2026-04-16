"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Clock, CheckCircle2, XCircle, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth";

export default function PendingPage() {
  const { user, logout, setUser } = useAuthStore();
  const router = useRouter();

  // Validate the session server-side. If no cookie / account deleted → kick to login.
  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (r) => {
        if (r.status === 401 || r.status === 404) {
          setUser(null);
          router.replace("/login");
          return;
        }
        if (r.ok) {
          const data = await r.json() as { user: { id: string; name: string; email: string; role: string; status: string; avatarUrl?: string | null } };
          setUser(data.user);
          // If they've since been approved, redirect to their dashboard
          if (data.user.status === "APPROVED") {
            const map: Record<string, string> = { SUPER_ADMIN: "/super-admin", ADMIN: "/admin", STUDENT: "/student" };
            router.replace(map[data.user.role] ?? "/student");
          }
        }
      })
      .catch(() => { /* keep existing state on network error */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusConfig = {
    PENDING: {
      icon: Clock,
      color: "text-amber-400",
      bg: "bg-amber-950/20 border-amber-800/40",
      title: "Account Pending Approval",
      message: "Your account has been created and is awaiting approval from a Super Admin. You'll be notified once your account is reviewed.",
    },
    REJECTED: {
      icon: XCircle,
      color: "text-red-400",
      bg: "bg-red-950/20 border-red-800/40",
      title: "Account Rejected",
      message: "Your account registration was rejected. Please contact your school administrator for more information.",
    },
    APPROVED: {
      icon: CheckCircle2,
      color: "text-emerald-400",
      bg: "bg-emerald-950/20 border-emerald-800/40",
      title: "Account Approved!",
      message: "Your account has been approved. You can now access your dashboard.",
    },
  };

  const status = user?.status ?? "PENDING";
  const config = statusConfig[status as keyof typeof statusConfig] ?? statusConfig.PENDING;
  const Icon = config.icon;

  return (
    <div className="min-h-screen grid-bg flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <div className="glass rounded-3xl p-8 border border-zinc-700/50 text-center">
          <div className={`w-16 h-16 rounded-2xl ${config.bg} border flex items-center justify-center mx-auto mb-6`}>
            <Icon className={`h-8 w-8 ${config.color}`} />
          </div>

          <h1 className="text-2xl font-bold text-zinc-100 mb-3">{config.title}</h1>
          <p className="text-zinc-400 text-sm leading-relaxed mb-8">{config.message}</p>

          {user && (
            <div className="bg-zinc-800/40 rounded-2xl p-4 mb-6 text-left space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Name</span>
                <span className="text-zinc-300">{user.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Role</span>
                <span className="text-zinc-300">{user.role}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Status</span>
                <span className={config.color}>{status}</span>
              </div>
            </div>
          )}

          {status === "APPROVED" && (
            <Button className="w-full mb-3" onClick={() => {
              const roleMap: Record<string, string> = {
                SUPER_ADMIN: "/super-admin",
                ADMIN: "/admin",
                STUDENT: "/student",
              };
              window.location.href = roleMap[user?.role ?? "STUDENT"] ?? "/student";
            }}>
              Go to Dashboard
            </Button>
          )}

          <Button variant="ghost" className="w-full text-zinc-500" onClick={logout}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
