"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Calendar, ClipboardCheck, TrendingUp,
  CheckCircle2, XCircle, Clock,
  ScanFace, Lock, AlertCircle, Camera, Upload, MessageSquare,
} from "lucide-react";
import Link from "next/link";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, CartesianGrid,
} from "recharts";
import { DashboardLayout, PageHeader } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/auth";
import { formatDate, formatTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface AttendanceRecord {
  id: string;
  status: string;
  timestamp: string;
  class: { subject: string; dayOfWeek: string; startTime: string };
}

interface Timetable {
  id: string;
  title: string;
  status: string;
  classes: { id: string; subject: string; dayOfWeek: string; startTime: string; endTime: string; room?: string }[];
}

interface Profile {
  faceRegistered: boolean;
  faceRetakeRequested: boolean;
  faceRetakeApproved: boolean;
  faceRetakeReason?: string;
}

type RetakePhase = "idle" | "camera" | "preview" | "uploading" | "done" | "error";

export default function StudentDashboard() {
  const { user } = useAuthStore();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  // One-time approved retake state
  const [retakePhase, setRetakePhase] = useState<RetakePhase>("idle");
  const [retakeMsg, setRetakeMsg] = useState("");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef   = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/attendance").then((r) => r.json()),
      fetch("/api/timetables").then((r) => r.json()),
      fetch("/api/profile").then((r) => r.json()),
    ]).then(([attData, ttData, profileData]) => {
      setAttendance(attData.attendance ?? []);
      setTimetables(ttData.timetables ?? []);
      setProfile(profileData.profile ?? null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Attach MediaStream → <video>
  useEffect(() => {
    if (retakePhase !== "camera") return;
    const v = videoRef.current; const s = streamRef.current;
    if (!v || !s) return;
    v.srcObject = s; v.muted = true; v.playsInline = true;
    const go = () => void v.play().catch(() => setRetakeMsg("Preview failed — upload a photo instead."));
    v.addEventListener("loadedmetadata", go);
    if (v.readyState >= HTMLMediaElement.HAVE_METADATA) go();
    return () => { v.removeEventListener("loadedmetadata", go); v.srcObject = null; };
  }, [retakePhase]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const startCamera = async () => {
    setRetakeMsg("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 } }, audio: false });
      streamRef.current = stream;
      setCapturedImage(null);
      setRetakePhase("camera");
    } catch {
      setRetakeMsg("Cannot access camera. Upload a photo instead.");
    }
  };

  const capturePhoto = () => {
    const v = videoRef.current; const c = canvasRef.current;
    if (!v || !c) return;
    if (!v.videoWidth) { setRetakeMsg("Camera still loading…"); return; }
    const ctx = c.getContext("2d"); if (!ctx) return;
    c.width = v.videoWidth; c.height = v.videoHeight;
    ctx.drawImage(v, 0, 0);
    setCapturedImage(c.toDataURL("image/jpeg", 0.85));
    stopCamera();
    setRetakePhase("preview");
  };

  const onFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setCapturedImage(ev.target?.result as string); stopCamera(); setRetakePhase("preview"); };
    reader.readAsDataURL(file);
  };

  const submitRetake = async () => {
    if (!capturedImage || !user) return;
    setRetakePhase("uploading");
    setRetakeMsg("");
    try {
      const res = await fetch("/api/ai-service?path=/register-face", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: capturedImage }),
      });
      const data = await res.json() as { success?: boolean; ok?: boolean; message?: string; locked?: boolean; detail?: unknown };
      if (res.ok && (data.success || data.ok)) {
        setRetakePhase("done");
        setProfile((p) => p ? { ...p, faceRegistered: true, faceRetakeApproved: false } : p);
      } else if (data.locked) {
        setRetakeMsg(data.message ?? "Face already registered.");
        setRetakePhase("error");
      } else {
        const msg = typeof data.detail === "string" ? data.detail : data.message ?? "Registration failed.";
        setRetakeMsg(msg); setRetakePhase("error");
      }
    } catch {
      setRetakeMsg("Network error."); setRetakePhase("error");
    }
  };

  const presentCount  = attendance.filter((a) => a.status === "PRESENT").length;
  const absentCount   = attendance.filter((a) => a.status === "ABSENT").length;
  const attendanceRate = attendance.length ? Math.round((presentCount / attendance.length) * 100) : 0;

  const chartData = ["Mon", "Tue", "Wed", "Thu", "Fri"].map((day) => ({
    day, rate: Math.floor(Math.random() * 30 + 70),
  }));

  const todayDay = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"][new Date().getDay()];
  const todayClasses = timetables.flatMap((t) => t.classes.filter((c) => c.dayOfWeek === todayDay));

  return (
    <DashboardLayout requiredRole="STUDENT">
      <PageHeader title={`Hello, ${user?.name?.split(" ")[0] ?? "Student"} 👋`} description="Here's your academic overview for today" />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Attendance Rate",  value: `${attendanceRate}%`, icon: TrendingUp,    color: "from-emerald-500 to-teal-600",   sub: `${presentCount} of ${attendance.length} classes` },
          { label: "Total Present",    value: presentCount,         icon: CheckCircle2,  color: "from-indigo-500 to-blue-600",    sub: "All time" },
          { label: "Total Absent",     value: absentCount,          icon: XCircle,       color: "from-red-500 to-rose-600",       sub: "All time" },
          { label: "Today Classes",    value: todayClasses.length,  icon: Clock,         color: "from-violet-500 to-purple-600",  sub: todayDay.slice(0, 3) },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-zinc-500 mb-1">{s.label}</p>
                      <p className="text-3xl font-bold text-zinc-100">{loading ? "—" : s.value}</p>
                      <p className="text-xs text-zinc-600 mt-1">{s.sub}</p>
                    </div>
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center flex-shrink-0`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Face ID Status Card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="mb-6">
        {!profile ? (
          <div className="h-24 rounded-2xl bg-zinc-800/40 animate-pulse" />
        ) : profile.faceRetakeApproved && retakePhase !== "done" ? (
          /* ── One-time approved retake form ─────────────────────────────── */
          <Card className="border-amber-500/30 bg-gradient-to-br from-amber-950/20 to-zinc-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-300">
                <ScanFace className="h-5 w-5" />
                Face Photo Update — One-Time
              </CardTitle>
              <p className="text-sm text-zinc-400">
                Your teacher approved a face photo update. Submit your new photo now — this option disappears after use.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {retakePhase === "camera" && (
                <div className="flex flex-col items-center gap-3">
                  <div className="relative w-full max-w-[260px] mx-auto aspect-[3/4] rounded-2xl overflow-hidden border border-zinc-700 bg-zinc-950">
                    <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover [transform:scaleX(-1)]" />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-32 h-40 rounded-full border-2 border-dashed border-white/30" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={capturePhoto}><Camera className="h-3.5 w-3.5" />Capture</Button>
                    <Button size="sm" variant="outline" onClick={() => { stopCamera(); setRetakePhase("idle"); }}>Cancel</Button>
                  </div>
                </div>
              )}

              {retakePhase === "preview" && capturedImage && (
                <div className="flex flex-col items-center gap-3">
                  <div className="relative w-full max-w-[260px] mx-auto aspect-[3/4] rounded-2xl overflow-hidden border border-amber-500/30">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={capturedImage} alt="New face" className="absolute inset-0 h-full w-full object-cover [transform:scaleX(-1)]" />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" loading={retakePhase as string === "uploading"} onClick={submitRetake}><ScanFace className="h-3.5 w-3.5" />Submit</Button>
                    <Button size="sm" variant="outline" onClick={() => { setCapturedImage(null); setRetakePhase("idle"); }}>Retake</Button>
                  </div>
                </div>
              )}

              {(retakePhase === "idle" || retakePhase === "error") && (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={startCamera}><Camera className="h-4 w-4" />Use Camera</Button>
                    <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" />Upload Photo</Button>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileUpload} />
                  </div>
                  {retakeMsg && <p className="text-xs text-red-400 bg-red-950/30 border border-red-800/40 rounded-xl px-3 py-2">{retakeMsg}</p>}
                </>
              )}
            </CardContent>
          </Card>
        ) : retakePhase === "done" ? (
          <Card className="border-emerald-500/20">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-600/20 border border-emerald-600/40 flex items-center justify-center flex-shrink-0">
                <ScanFace className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-300">Face Updated Successfully</p>
                <p className="text-xs text-zinc-500 mt-0.5">Your new face photo has been registered for attendance.</p>
              </div>
            </CardContent>
          </Card>
        ) : profile.faceRegistered ? (
          /* ── Face registered & locked ───────────────────────────────────── */
          <Card className={cn("border-zinc-700/30", profile.faceRetakeRequested ? "border-amber-500/20" : "border-emerald-500/20")}>
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
                  profile.faceRetakeRequested
                    ? "bg-amber-600/20 border border-amber-600/40"
                    : "bg-emerald-600/20 border border-emerald-600/40"
                )}>
                  {profile.faceRetakeRequested
                    ? <AlertCircle className="h-6 w-6 text-amber-400" />
                    : <ScanFace className="h-6 w-6 text-emerald-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  {profile.faceRetakeRequested ? (
                    <>
                      <p className="text-sm font-semibold text-amber-300">Retake Request Pending</p>
                      <p className="text-xs text-zinc-500 mt-0.5">Waiting for teacher approval. You'll see an update option here once approved.</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-emerald-300">Face ID Registered</p>
                      <p className="text-xs text-zinc-500 mt-0.5">Your face is locked. Need an update? Ask the AI Assistant.</p>
                    </>
                  )}
                </div>
                {!profile.faceRetakeRequested && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Lock className="h-3.5 w-3.5 text-zinc-600" />
                    <Button size="sm" variant="ghost" asChild className="text-xs text-zinc-500">
                      <Link href="/assistant">Request Update</Link>
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          /* ── No face registered yet ─────────────────────────────────────── */
          <Card className="border-red-500/20 bg-gradient-to-br from-red-950/10 to-zinc-900">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-red-600/20 border border-red-600/40 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="h-6 w-6 text-red-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-300">Face Not Registered</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Your face hasn't been registered yet. You can't use face-scan attendance until it's set up.</p>
                </div>
                <Button size="sm" variant="destructive" asChild>
                  <Link href="/assistant"><MessageSquare className="h-3.5 w-3.5" />Get Help</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Attendance Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-emerald-400" />Weekly Attendance Trend</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="day" tick={{ fill: "#71717a", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#71717a", fontSize: 12 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: "12px", fontSize: 12 }} labelStyle={{ color: "#d4d4d8" }} formatter={(v) => [`${v ?? 0}%`, "Attendance"]} />
                <Line type="monotone" dataKey="rate" stroke="#6366f1" strokeWidth={2} dot={{ fill: "#6366f1", r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Today's Schedule */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5 text-indigo-400" />Today</CardTitle>
              <Button variant="ghost" size="sm" asChild><Link href="/student/timetable">Full Schedule</Link></Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-zinc-800/40 animate-pulse" />)}</div>
            ) : todayClasses.length === 0 ? (
              <p className="text-zinc-500 text-sm text-center py-6">No classes today</p>
            ) : (
              <div className="space-y-2">
                {todayClasses.map((c) => (
                  <Link key={c.id} href="/student/timetable"
                    className="block p-3 rounded-xl bg-zinc-800/30 border border-zinc-700/30 hover:border-indigo-600/40 hover:bg-indigo-950/10 transition-all group">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-zinc-200">{c.subject}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{formatTime(c.startTime)} – {formatTime(c.endTime)}{c.room ? ` · ${c.room}` : ""}</p>
                      </div>
                      <ScanFace className="h-4 w-4 text-zinc-600 group-hover:text-indigo-400 transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Attendance */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-violet-400" />Recent Attendance</CardTitle>
            <Button variant="ghost" size="sm" asChild><Link href="/student/attendance">View All</Link></Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-zinc-800/40 animate-pulse" />)}</div>
          ) : attendance.length === 0 ? (
            <p className="text-zinc-500 text-sm text-center py-6">No attendance records yet. Tap a class in your timetable to mark attendance.</p>
          ) : (
            <div className="space-y-2">
              {attendance.slice(0, 8).map((a) => (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/20 hover:bg-zinc-800/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${a.status === "PRESENT" ? "bg-emerald-400" : a.status === "ABSENT" ? "bg-red-400" : "bg-amber-400"}`} />
                    <div>
                      <p className="text-sm font-medium text-zinc-200">{a.class?.subject ?? "Unknown"}</p>
                      <p className="text-xs text-zinc-500">{formatDate(a.timestamp)}</p>
                    </div>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
