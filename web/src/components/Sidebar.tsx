"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Camera,
  MessageSquare,
  Bell,
  Database,
  BookOpen,
  ClipboardCheck,
  LogOut,
  ChevronRight,
  GraduationCap,
  Shield,
  Inbox,
  ClipboardList,
  Brain,
  TrendingUp,
  Sun,
  Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { getInitials } from "@/lib/utils";
import { useTheme } from "@/components/ThemeProvider";

const navByRole: Record<string, Array<{ href: string; label: string; icon: React.ComponentType<{ className?: string }> }>> = {
  SUPER_ADMIN: [
    { href: "/super-admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/super-admin/users", label: "User Management", icon: Users },
    { href: "/super-admin/timetables", label: "Timetable Approval", icon: Calendar },
    { href: "/super-admin/database", label: "Database", icon: Database },
  ],
  ADMIN: [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/timetable", label: "Timetable", icon: Calendar },
    { href: "/admin/attendance", label: "Attendance", icon: Camera },
    { href: "/admin/marks", label: "Marks Entry", icon: ClipboardList },
    { href: "/admin/ai-tools", label: "AI Tools", icon: Brain },
    { href: "/admin/requests", label: "Requests", icon: Inbox },
    { href: "/admin/alerts", label: "Alerts", icon: Bell },
  ],
  STUDENT: [
    { href: "/student", label: "Dashboard", icon: LayoutDashboard },
    { href: "/student/timetable", label: "Timetable", icon: BookOpen },
    { href: "/student/attendance", label: "My Attendance", icon: ClipboardCheck },
    { href: "/student/performance", label: "AI Performance", icon: TrendingUp },
  ],
};

const roleIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  SUPER_ADMIN: Shield,
  ADMIN: GraduationCap,
  STUDENT: BookOpen,
};

const roleColors: Record<string, string> = {
  SUPER_ADMIN: "from-violet-500 to-purple-600",
  ADMIN: "from-indigo-500 to-blue-600",
  STUDENT: "from-emerald-500 to-teal-600",
};

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useTheme();

  if (!user) return null;

  const navItems = navByRole[user.role] ?? [];
  const RoleIcon = roleIcons[user.role] ?? Shield;

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="fixed left-0 top-0 h-full w-64 glass border-r border-zinc-800/60 flex flex-col z-40"
    >
      {/* Logo */}
      <div className="p-6 border-b border-zinc-800/60">
        <Link href="/" className="flex items-center gap-3">
          <div className={cn("w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center text-white font-bold text-sm", roleColors[user.role])}>
            SC
          </div>
          <div>
            <p className="font-semibold text-zinc-100 text-sm leading-none">SCMS</p>
            <p className="text-xs text-zinc-500 mt-0.5">Smart Classroom</p>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 overflow-y-auto">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 px-3 mb-3">
          Navigation
        </p>
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href) && pathname !== item.href.replace(/\/[^/]+$/, ""));
            const exactActive = pathname === item.href;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative",
                    exactActive
                      ? "bg-indigo-600/20 text-indigo-300 border border-indigo-600/30"
                      : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                  )}
                >
                  {exactActive && (
                    <motion.div
                      layoutId="sidebar-indicator"
                      className="absolute inset-0 rounded-xl bg-indigo-600/10 border border-indigo-600/20"
                    />
                  )}
                  <Icon className={cn("h-4 w-4 relative z-10", exactActive && "text-indigo-400")} />
                  <span className="relative z-10">{item.label}</span>
                  {exactActive && <ChevronRight className="h-3.5 w-3.5 ml-auto relative z-10 text-indigo-400" />}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mt-6 pt-6 border-t border-zinc-800/60">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 px-3 mb-3">
            AI Features
          </p>
          <Link
            href="/assistant"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
              pathname === "/assistant"
                ? "bg-indigo-600/20 text-indigo-300 border border-indigo-600/30"
                : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
            )}
          >
            <MessageSquare className="h-4 w-4" />
            AI Assistance
          </Link>
        </div>
      </nav>

      {/* User */}
      <div className="p-4 border-t border-zinc-800/60">
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-zinc-800/40 mb-2">
          <div className={cn("w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center text-white text-xs font-semibold flex-shrink-0", roleColors[user.role])}>
            {getInitials(user.name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-200 truncate">{user.name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <RoleIcon className="h-3 w-3 text-zinc-500" />
              <p className="text-xs text-zinc-500 truncate">{user.role.replace("_", " ")}</p>
            </div>
          </div>
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 transition-all duration-200 mb-1 group"
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          <div className="flex items-center gap-3 flex-1">
            {theme === "dark" ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4 text-indigo-400" />
            )}
            <span className="text-zinc-400 group-hover:text-zinc-200">
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </span>
          </div>
          {/* Toggle pill */}
          <div
            className={cn(
              "relative w-9 h-5 rounded-full transition-colors duration-300 flex-shrink-0",
              theme === "dark" ? "bg-zinc-700" : "bg-indigo-500"
            )}
          >
            <motion.div
              animate={{ x: theme === "dark" ? 2 : 18 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm"
            />
          </div>
        </button>

        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-zinc-500 hover:text-red-400 hover:bg-red-950/20 transition-all duration-200"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </motion.aside>
  );
}
