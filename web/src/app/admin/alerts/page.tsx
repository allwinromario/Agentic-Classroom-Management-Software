"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Plus, Trash2, Zap, AlertTriangle, Info } from "lucide-react";
import { DashboardLayout, PageHeader } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";

interface Alert {
  id: string;
  title: string;
  message: string;
  severity: string;
  active: boolean;
  createdAt: string;
  createdBy: { name: string };
}

const severityConfig = {
  info: { icon: Info, color: "text-indigo-400", bg: "bg-indigo-950/20 border-indigo-800/30" },
  warning: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-950/20 border-amber-800/30" },
  critical: { icon: Zap, color: "text-red-400", bg: "bg-red-950/20 border-red-800/30" },
};

export default function AdminAlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: "", message: "", severity: "info" as "info" | "warning" | "critical" });
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const fetchAlerts = useCallback(async () => {
    const r = await fetch("/api/alerts");
    const data = await r.json();
    setAlerts(data.alerts ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const createAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const r = await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (r.ok) {
      const data = await r.json();
      setAlerts([data.alert, ...alerts]);
      setForm({ title: "", message: "", severity: "info" });
      setShowForm(false);
    }
    setSaving(false);
  };

  const dismissAlert = async (id: string) => {
    await fetch(`/api/alerts?id=${id}`, { method: "DELETE" });
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <DashboardLayout requiredRole="ADMIN">
      <PageHeader
        title="Emergency Alerts"
        description="Broadcast real-time alerts to all users"
        action={
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4" />
            New Alert
          </Button>
        }
      />

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <Card className="border-indigo-800/30">
            <CardHeader><CardTitle>Create Alert</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={createAlert} className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  {(["info", "warning", "critical"] as const).map((s) => {
                    const c = severityConfig[s];
                    const Icon = c.icon;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setForm({ ...form, severity: s })}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                          form.severity === s ? `${c.bg} ${c.color}` : "border-zinc-700 text-zinc-500 hover:border-zinc-600"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    );
                  })}
                </div>
                <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="Alert title..." />
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-zinc-300">Message</label>
                  <textarea
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    required
                    rows={3}
                    placeholder="Describe the alert..."
                    className="rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 resize-none"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
                  <Button type="submit" loading={saving} variant={form.severity === "critical" ? "destructive" : form.severity === "warning" ? "warning" : "default"}>
                    <Bell className="h-4 w-4" />
                    Broadcast Alert
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-zinc-800/40 animate-pulse" />)}</div>
      ) : alerts.length === 0 ? (
        <Card className="p-12 text-center">
          <Bell className="h-12 w-12 mx-auto text-zinc-700 mb-3" />
          <p className="text-zinc-500">No active alerts</p>
        </Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {alerts.map((a) => {
              const config = severityConfig[a.severity as keyof typeof severityConfig] ?? severityConfig.info;
              const Icon = config.icon;
              return (
                <motion.div key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Card className={config.bg}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Icon className={`h-5 w-5 ${config.color} flex-shrink-0 mt-0.5`} />
                        <div className="flex-1">
                          <p className={`font-semibold text-sm ${config.color}`}>{a.title}</p>
                          <p className="text-sm text-zinc-400 mt-1">{a.message}</p>
                          <p className="text-xs text-zinc-600 mt-2">
                            By {a.createdBy.name} · {formatDate(a.createdAt)}
                          </p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => dismissAlert(a.id)} className="text-zinc-600 hover:text-red-400">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </DashboardLayout>
  );
}
