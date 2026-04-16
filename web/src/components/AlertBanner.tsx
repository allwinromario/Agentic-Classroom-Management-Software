"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Info, X, Zap } from "lucide-react";
import { useAlertStore } from "@/store/alerts";

const severityConfig = {
  info: {
    icon: Info,
    bg: "bg-indigo-950/80 border-indigo-800/60",
    text: "text-indigo-200",
    icon_color: "text-indigo-400",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-amber-950/80 border-amber-800/60",
    text: "text-amber-200",
    icon_color: "text-amber-400",
  },
  critical: {
    icon: Zap,
    bg: "bg-red-950/80 border-red-800/60",
    text: "text-red-200",
    icon_color: "text-red-400",
  },
};

export function AlertBanner() {
  const { alerts, setAlerts, dismissAlert } = useAlertStore();

  useEffect(() => {
    fetch("/api/alerts")
      .then((r) => r.json())
      .then((data) => {
        if (data.alerts) setAlerts(data.alerts);
      })
      .catch(() => {});
  }, [setAlerts]);

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {alerts.map((alert) => {
          const config = severityConfig[alert.severity as keyof typeof severityConfig] ?? severityConfig.info;
          const Icon = config.icon;
          return (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.9 }}
              className={`pointer-events-auto glass rounded-2xl border p-4 shadow-2xl ${config.bg}`}
            >
              <div className="flex items-start gap-3">
                <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${config.icon_color}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${config.text}`}>{alert.title}</p>
                  <p className={`text-xs mt-0.5 opacity-80 ${config.text}`}>{alert.message}</p>
                </div>
                <button
                  onClick={() => dismissAlert(alert.id)}
                  className={`flex-shrink-0 ${config.text} opacity-60 hover:opacity-100 transition-opacity`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
