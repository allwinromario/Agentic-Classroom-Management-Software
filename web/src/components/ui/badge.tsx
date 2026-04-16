import * as React from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "info" | "outline";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "bg-zinc-800 text-zinc-300 border-zinc-700",
    success: "status-approved",
    warning: "status-pending",
    danger: "status-rejected",
    info: "bg-indigo-950/50 text-indigo-300 border-indigo-800",
    outline: "bg-transparent text-zinc-300 border-zinc-600",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: BadgeProps["variant"]; label: string }> = {
    APPROVED: { variant: "success", label: "Approved" },
    PENDING: { variant: "warning", label: "Pending" },
    PENDING_APPROVAL: { variant: "warning", label: "Pending Approval" },
    REJECTED: { variant: "danger", label: "Rejected" },
    DRAFT: { variant: "default", label: "Draft" },
    PRESENT: { variant: "success", label: "Present" },
    ABSENT: { variant: "danger", label: "Absent" },
    LATE: { variant: "warning", label: "Late" },
  };

  const config = map[status] ?? { variant: "default", label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export { Badge };
