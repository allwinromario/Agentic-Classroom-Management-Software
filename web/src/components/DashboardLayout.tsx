"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Sidebar } from "@/components/Sidebar";
import { useAuthStore } from "@/store/auth";

interface DashboardLayoutProps {
  children: React.ReactNode;
  requiredRole?: string;
}

export function DashboardLayout({ children, requiredRole }: DashboardLayoutProps) {
  const { user, isLoading, setUser, logout } = useAuthStore();
  const router = useRouter();

  // Re-validate the session against the DB on every page load.
  // If the account was deleted, the JWT cookie is still valid but /me returns 404 → force logout.
  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (r) => {
        if (r.status === 401 || r.status === 404) {
          // Account deleted or session expired — clear everything and redirect
          await fetch("/api/auth/logout", { method: "POST" });
          setUser(null);
          router.replace("/login");
          return;
        }
        if (r.ok) {
          const data = await r.json() as { user: { id: string; name: string; email: string; role: string; status: string; avatarUrl?: string | null } };
          setUser(data.user);
        }
      })
      .catch(() => { /* network error — keep existing state */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.replace("/login");
        return;
      }
      if (user.status !== "APPROVED") {
        router.replace("/pending");
        return;
      }
      if (requiredRole && user.role !== requiredRole) {
        const map: Record<string, string> = {
          SUPER_ADMIN: "/super-admin",
          ADMIN: "/admin",
          STUDENT: "/student",
        };
        router.replace(map[user.role] ?? "/");
      }
    }
  }, [user, isLoading, requiredRole, router]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
          <p className="text-zinc-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid-bg">
      <Sidebar />
      <motion.main
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="ml-64 min-h-screen p-8"
      >
        {children}
      </motion.main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">{title}</h1>
        {description && <p className="text-zinc-400 text-sm mt-1">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
