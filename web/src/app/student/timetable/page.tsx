"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Clock, BookOpen, MapPin, ScanFace, Camera, Upload, CheckCircle2, XCircle, AlertTriangle, Lock, Timer } from "lucide-react";
import { DashboardLayout, PageHeader } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface ClassItem {
  id: string;
  subject: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  room?: string;
  lateThresholdMins?: number;
}

interface Timetable {
  id: string;
  title: string;
  description?: string;
  status: string;
  createdBy: { name: string };
  classes: ClassItem[];
}

type ScanState = "idle" | "liveness" | "preview" | "verifying" | "success" | "fail" | "offline" | "duplicate";

interface GeoLocation {
  latitude: number;
  longitude: number;
  locationName?: string;
}

async function getLocation(): Promise<GeoLocation | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        // Reverse-geocode using the free Nominatim API
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { "Accept-Language": "en" } }
          );
          const d = await r.json() as { address?: { city?: string; town?: string; village?: string; suburb?: string; state?: string; country?: string } };
          const a = d.address ?? {};
          const place = a.city ?? a.town ?? a.village ?? a.suburb ?? a.state ?? "";
          const country = a.country ?? "";
          const locationName = [place, country].filter(Boolean).join(", ");
          resolve({ latitude, longitude, locationName: locationName || undefined });
        } catch {
          resolve({ latitude, longitude });
        }
      },
      () => resolve(null),
      { timeout: 8000, maximumAge: 60000 }
    );
  });
}

/** Order for display columns (Mon–Sun). Not aligned with Date.getDay() indices. */
const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
/** Date.getDay(): 0 = Sunday … 6 = Saturday */
const WEEKDAY_FROM_JS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const;
const DAY_ABBREV: Record<string, string> = { MONDAY: "Mon", TUESDAY: "Tue", WEDNESDAY: "Wed", THURSDAY: "Thu", FRIDAY: "Fri", SATURDAY: "Sat", SUNDAY: "Sun" };
const SUBJECT_COLORS = ["from-indigo-500 to-blue-600", "from-violet-500 to-purple-600", "from-emerald-500 to-teal-600", "from-pink-500 to-rose-600", "from-amber-500 to-orange-600", "from-cyan-500 to-sky-600"];

type ClassWindow = "not-started" | "open" | "late" | "ended" | "other-day";

function getClassWindow(cls: ClassItem, now: Date): ClassWindow {
  const todayDay = WEEKDAY_FROM_JS[now.getDay()];
  if (cls.dayOfWeek !== todayDay) return "other-day";

  const lateGrace = cls.lateThresholdMins ?? 10;
  const [sh, sm] = cls.startTime.split(":").map(Number);
  const [eh, em] = cls.endTime.split(":").map(Number);
  const start = new Date(now); start.setHours(sh, sm, 0, 0);
  const end   = new Date(now); end.setHours(eh, em, 0, 0);
  const late  = new Date(start.getTime() + lateGrace * 60_000);

  if (now < start) return "not-started";
  if (now >= end)  return "ended";
  if (now <= late) return "open";
  return "late";
}

const WINDOW_BADGE: Record<ClassWindow, { label: string; className: string } | null> = {
  "other-day":   null,
  "not-started": { label: "Not started", className: "bg-zinc-700/50 text-zinc-400 border-zinc-600/40" },
  "open":        { label: "Open now",    className: "bg-emerald-600/20 text-emerald-300 border-emerald-600/30" },
  "late":        { label: "Late",        className: "bg-amber-600/20 text-amber-300 border-amber-600/30" },
  "ended":       { label: "Ended",       className: "bg-red-600/15 text-red-400 border-red-600/25" },
};

export default function StudentTimetablePage() {
  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  // Keep `now` fresh so window badges update without a full page reload
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Face scan modal
  const [scanOpen, setScanOpen] = useState(false);
  const [scanClass, setScanClass] = useState<ClassItem | null>(null);
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [scanMsg, setScanMsg] = useState("");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const fileRef     = useRef<HTMLInputElement>(null);
  const locationRef = useRef<GeoLocation | null>(null);
  const livenessRef = useRef<boolean>(false);   // set true once challenge passes
  const [livenessChallenge, setLivenessChallenge] = useState("");
  const [livenessProgress, setLivenessProgress] = useState(0); // 0-100

  useEffect(() => {
    fetch("/api/timetables")
      .then((r) => r.json())
      .then((data) => {
        const tt = data.timetables ?? [];
        setTimetables(tt);
        if (tt.length > 0) setSelected(tt[0].id);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => { stopCamera(); }, [stopCamera]);

  // ── Liveness challenge ────────────────────────────────────────────────────
  // Must be defined BEFORE the useEffects that reference it.
  const CHALLENGES = ["Blink your eyes", "Turn your head slightly left", "Turn your head slightly right", "Nod slowly"];

  const runLivenessCheck = useCallback(async () => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;

    const challenge = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
    setLivenessChallenge(challenge);
    setLivenessProgress(0);
    livenessRef.current = false;

    // Use a small canvas just for motion detection (not the capture canvas)
    const motionCanvas = document.createElement("canvas");
    const W = 160, H = 120;
    motionCanvas.width = W; motionCanvas.height = H;
    const ctx = motionCanvas.getContext("2d")!;

    // Wait a moment for video to stabilise before taking baseline
    await new Promise<void>((r) => setTimeout(r, 400));
    ctx.drawImage(v, 0, 0, W, H);
    const baseline = ctx.getImageData(0, 0, W, H).data;

    let maxDiff = 0;
    const NEEDED_DIFF = 18;
    const TIMEOUT_MS  = 8000;
    const start = Date.now();

    const passed = await new Promise<boolean>((resolve) => {
      const tick = () => {
        if (Date.now() - start > TIMEOUT_MS) { resolve(false); return; }
        ctx.drawImage(v, 0, 0, W, H);
        const cur = ctx.getImageData(0, 0, W, H).data;
        let diff = 0;
        for (let i = 0; i < cur.length; i += 4) {
          diff += Math.abs(cur[i] - baseline[i])
                + Math.abs(cur[i+1] - baseline[i+1])
                + Math.abs(cur[i+2] - baseline[i+2]);
        }
        const avgDiff = diff / (W * H * 3);
        maxDiff = Math.max(maxDiff, avgDiff);
        const progress = Math.min(100, Math.round((maxDiff / NEEDED_DIFF) * 100));
        setLivenessProgress(progress);
        if (maxDiff >= NEEDED_DIFF) {
          resolve(true);
        } else {
          requestAnimationFrame(tick);
        }
      };
      requestAnimationFrame(tick);
    });

    if (!passed) {
      setScanState("fail");
      setScanMsg("Liveness check timed out. Please follow the on-screen instruction and try again.");
      return;
    }

    // Liveness passed — capture the photo immediately using the full-res video
    livenessRef.current = true;
    setLivenessProgress(100);

    // Brief pause so the face returns to neutral after the motion
    await new Promise<void>((r) => setTimeout(r, 350));

    const fullCanvas = c;
    fullCanvas.width  = v.videoWidth  || 640;
    fullCanvas.height = v.videoHeight || 480;
    const fullCtx = fullCanvas.getContext("2d")!;
    fullCtx.drawImage(v, 0, 0);
    const dataUrl = fullCanvas.toDataURL("image/jpeg", 0.85);

    stopCamera();
    setCapturedImage(dataUrl);
    setScanState("preview");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopCamera]);

  // Attach stream to video — only needed for the "liveness" state now
  useEffect(() => {
    if (scanState !== "liveness") return;
    const v = videoRef.current; const s = streamRef.current;
    if (!v || !s) return;
    v.srcObject = s; v.muted = true; v.playsInline = true;
    const go = () => {
      void v.play().catch(() => setScanMsg("Preview failed — try uploading a photo."));
      void runLivenessCheck();
    };
    v.addEventListener("loadedmetadata", go);
    if (v.readyState >= HTMLMediaElement.HAVE_METADATA) go();
    return () => { v.removeEventListener("loadedmetadata", go); v.srcObject = null; };
  }, [scanState, runLivenessCheck]);

  const openScanModal = (cls: ClassItem) => {
    const window = getClassWindow(cls, new Date());
    setScanClass(cls);
    setCapturedImage(null);
    locationRef.current = null;

    if (window === "ended") {
      setScanState("fail");
      setScanMsg(`Attendance window is closed — this class ended at ${cls.endTime}.`);
    } else if (window === "not-started") {
      setScanState("fail");
      setScanMsg(`Class hasn't started yet — attendance opens at ${cls.startTime}.`);
    } else {
      setScanState("idle");
      setScanMsg(window === "late" ? `You are ${cls.lateThresholdMins ?? 10}+ minutes late — your attendance will be recorded as LATE.` : "");
    }
    setScanOpen(true);
    // Start fetching location immediately in the background
    getLocation().then((loc) => { locationRef.current = loc; });
  };

  const closeScanModal = () => {
    stopCamera();
    livenessRef.current = false;
    setScanOpen(false);
    setScanState("idle");
    setCapturedImage(null);
  };

  const startCamera = async () => {
    setScanMsg("");
    livenessRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 } }, audio: false });
      streamRef.current = stream;
      setCapturedImage(null);
      setScanState("liveness"); // go through challenge before capture
    } catch {
      setScanMsg("Cannot access camera. Upload a photo instead.");
    }
  };

  const onFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCapturedImage(ev.target?.result as string);
      stopCamera();
      setScanState("preview");
    };
    reader.readAsDataURL(file);
  };

  const submitFaceScan = async () => {
    if (!capturedImage || !scanClass) return;
    setScanState("verifying");
    setScanMsg("Verifying your identity…");

    try {
      // Step 1: verify face identity
      const verifyRes = await fetch("/api/ai-service?path=/verify-face", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: capturedImage, antiSpoofing: true }),
      });
      const verifyData = await verifyRes.json() as { verified?: boolean; message?: string; ok?: boolean; error?: string };

      if (verifyRes.status === 503) {
        setScanState("offline");
        setScanMsg("AI service offline — cannot verify face right now.");
        return;
      }

      if (!verifyRes.ok || !verifyData.verified) {
        setScanState("fail");
        setScanMsg(verifyData.message ?? verifyData.error ?? "Face verification failed. Try again in better lighting.");
        return;
      }

      // Step 2: mark attendance (include location if available)
      const loc = locationRef.current;
      const markRes = await fetch("/api/attendance/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: scanClass.id,
          status: "PRESENT",
          verifiedByFace: true,
          ...(loc ? { latitude: loc.latitude, longitude: loc.longitude, locationName: loc.locationName } : {}),
        }),
      });
      const markData = await markRes.json();

      if (markRes.ok) {
        const status = markData.attendance?.status as string | undefined;
        const isLate = status === "LATE";
        setScanState("success");
        setScanMsg(
          isLate
            ? `Attendance marked as LATE for ${scanClass.subject}.`
            : `Attendance marked for ${scanClass.subject}! ${verifyData.message ?? ""}`
        );
        setTimeout(() => closeScanModal(), 2500);
      } else if (markRes.status === 409 && markData.alreadyMarked) {
        setScanState("duplicate");
        setScanMsg(markData.message ?? "Attendance already marked for this class.");
      } else if (markData.tooLate) {
        setScanState("fail");
        setScanMsg(markData.error ?? "Attendance window is closed — this class has already ended.");
      } else if (markData.tooEarly) {
        setScanState("fail");
        setScanMsg(markData.error ?? "Class hasn't started yet.");
      } else {
        setScanState("fail");
        setScanMsg(markData.error ?? "Failed to mark attendance.");
      }
    } catch {
      setScanState("fail");
      setScanMsg("Network error. Please try again.");
    }
  };

  const activeTimetable = timetables.find((t) => t.id === selected);
  const today = WEEKDAY_FROM_JS[now.getDay()];
  const getSubjectColor = (subject: string) => SUBJECT_COLORS[subject.charCodeAt(0) % SUBJECT_COLORS.length];

  return (
    <DashboardLayout requiredRole="STUDENT">
      <PageHeader title="My Timetable" description="Tap a class to scan your face and mark attendance" />

      {loading ? (
        <div className="h-64 rounded-2xl bg-zinc-800/40 animate-pulse" />
      ) : timetables.length === 0 ? (
        <Card className="p-16 text-center">
          <Calendar className="h-16 w-16 mx-auto text-zinc-700 mb-4" />
          <h3 className="text-lg font-semibold text-zinc-400 mb-2">No Approved Timetables</h3>
          <p className="text-zinc-500 text-sm">Your timetable will appear once a teacher creates and it gets approved.</p>
        </Card>
      ) : (
        <>
          {timetables.length > 1 && (
            <div className="flex items-center gap-2 mb-6 flex-wrap">
              {timetables.map((t) => (
                <button key={t.id} onClick={() => setSelected(t.id)}
                  className={cn("px-4 py-2 rounded-xl text-sm font-medium border transition-all",
                    selected === t.id ? "border-indigo-600/60 bg-indigo-950/30 text-indigo-300" : "border-zinc-700 bg-zinc-800/30 text-zinc-400 hover:border-zinc-600"
                  )}>
                  {t.title}
                </button>
              ))}
            </div>
          )}

          {activeTimetable && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-100">{activeTimetable.title}</h2>
                  {activeTimetable.description && <p className="text-sm text-zinc-500 mt-0.5">{activeTimetable.description}</p>}
                  <p className="text-xs text-zinc-600 mt-1">By {activeTimetable.createdBy.name}</p>
                </div>
                <StatusBadge status={activeTimetable.status} />
              </div>

              {/* Weekly grid — classes are tappable */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {DAYS.slice(0, 5).map((day) => {
                  const dayClasses = activeTimetable.classes.filter((c) => c.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
                  const isToday = day === today;
                  return (
                    <motion.div key={day} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                      <Card className={isToday ? "border-indigo-700/50 bg-indigo-950/10" : ""}>
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-sm flex items-center justify-between">
                            <span className={isToday ? "text-indigo-300" : "text-zinc-300"}>{DAY_ABBREV[day]}</span>
                            {isToday && <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-600/20 text-indigo-400 border border-indigo-600/30">Today</span>}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                          {dayClasses.length === 0 ? (
                            <p className="text-xs text-zinc-700 text-center py-4">—</p>
                          ) : (
                            <div className="space-y-2">
                              {dayClasses.map((c) => {
                                const win = getClassWindow(c, now);
                                const badge = WINDOW_BADGE[win];
                                const blocked = isToday && (win === "ended" || win === "not-started");
                                return (
                                  <button key={c.id} onClick={() => openScanModal(c)}
                                    disabled={blocked}
                                    className={cn(
                                      "w-full p-3 rounded-xl bg-gradient-to-br text-left relative overflow-hidden group transition-all",
                                      blocked ? "opacity-50 cursor-not-allowed" : "hover:scale-[1.02] active:scale-[0.99]",
                                      getSubjectColor(c.subject)
                                    )}
                                    title={blocked ? (win === "ended" ? `Ended at ${c.endTime}` : `Opens at ${c.startTime}`) : "Tap to mark attendance"}
                                  >
                                    <div className="absolute inset-0 opacity-10 bg-black" />
                                    <div className="relative">
                                      <p className="text-sm font-semibold text-white">{c.subject}</p>
                                      <div className="flex items-center gap-1 mt-1">
                                        <Clock className="h-3 w-3 text-white/70" />
                                        <p className="text-xs text-white/80">{formatTime(c.startTime)} – {formatTime(c.endTime)}</p>
                                      </div>
                                      {c.room && <div className="flex items-center gap-1 mt-0.5"><MapPin className="h-3 w-3 text-white/60" /><p className="text-xs text-white/70">{c.room}</p></div>}
                                      {isToday && badge && (
                                        <span className={cn("inline-flex items-center gap-1 mt-1.5 text-[10px] px-1.5 py-0.5 rounded-full border font-medium", badge.className)}>
                                          {win === "ended" && <Lock className="h-2.5 w-2.5" />}
                                          {win === "late"  && <Timer className="h-2.5 w-2.5" />}
                                          {badge.label}
                                        </span>
                                      )}
                                      {!blocked && (
                                        <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <ScanFace className="h-4 w-4 text-white/80" />
                                        </div>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>

              {/* List view */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-indigo-400" />All Classes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[...activeTimetable.classes]
                      .sort((a, b) => DAYS.indexOf(a.dayOfWeek) - DAYS.indexOf(b.dayOfWeek) || a.startTime.localeCompare(b.startTime))
                      .map((c) => {
                        const win = getClassWindow(c, now);
                        const badge = WINDOW_BADGE[win];
                        const blocked = win === "ended" || win === "not-started";
                        return (
                          <button key={c.id} onClick={() => openScanModal(c)}
                            disabled={blocked}
                            className={cn(
                              "flex items-start gap-3 p-3 rounded-xl bg-zinc-800/30 transition-colors text-left group",
                              blocked ? "opacity-50 cursor-not-allowed" : "hover:bg-zinc-800/60"
                            )}>
                            <div className={`w-2 h-8 rounded-full bg-gradient-to-b flex-shrink-0 mt-0.5 ${getSubjectColor(c.subject)}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-zinc-200">{c.subject}</p>
                              <p className="text-xs text-zinc-500">{DAY_ABBREV[c.dayOfWeek]} · {formatTime(c.startTime)} – {formatTime(c.endTime)}</p>
                              {c.room && <p className="text-xs text-zinc-600 mt-0.5">{c.room}</p>}
                              {badge && (
                                <span className={cn("inline-flex items-center gap-1 mt-1 text-[10px] px-1.5 py-0.5 rounded-full border font-medium", badge.className)}>
                                  {win === "ended" && <Lock className="h-2.5 w-2.5" />}
                                  {win === "late"  && <Timer className="h-2.5 w-2.5" />}
                                  {badge.label}
                                </span>
                              )}
                            </div>
                            {!blocked && <ScanFace className="h-4 w-4 text-zinc-600 group-hover:text-indigo-400 transition-colors flex-shrink-0 mt-0.5" />}
                            {blocked && win === "ended" && <Lock className="h-4 w-4 text-zinc-700 flex-shrink-0 mt-0.5" />}
                          </button>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* ── Face Scan Modal ─────────────────────────────────────────────── */}
      <Dialog open={scanOpen} onOpenChange={(o) => { if (!o) closeScanModal(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanFace className="h-5 w-5 text-indigo-400" />
              Mark Attendance
            </DialogTitle>
            <DialogDescription className="sr-only">
              Use your camera or upload a photo to verify your face and mark attendance for this class.
            </DialogDescription>
          </DialogHeader>

          {scanClass && (
            <div className="mb-4 p-3 rounded-xl bg-zinc-800/50 border border-zinc-700/40">
              <p className="text-sm font-semibold text-zinc-100">{scanClass.subject}</p>
              <p className="text-xs text-zinc-500">{DAY_ABBREV[scanClass.dayOfWeek]} · {formatTime(scanClass.startTime)} – {formatTime(scanClass.endTime)}{scanClass.room ? ` · ${scanClass.room}` : ""}</p>
            </div>
          )}

          {/* Success */}
          {scanState === "success" && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className={cn("w-16 h-16 rounded-full flex items-center justify-center",
                scanMsg.includes("LATE") ? "bg-amber-600/20 border border-amber-600/40" : "bg-emerald-600/20 border border-emerald-600/40"
              )}>
                <CheckCircle2 className={cn("h-9 w-9", scanMsg.includes("LATE") ? "text-amber-400" : "text-emerald-400")} />
              </div>
              <p className={cn("text-sm font-semibold", scanMsg.includes("LATE") ? "text-amber-300" : "text-emerald-300")}>
                {scanMsg.includes("LATE") ? "Marked as Late" : "Attendance Marked!"}
              </p>
              <p className="text-xs text-zinc-400">{scanMsg}</p>
              {locationRef.current && (
                <div className="flex items-center gap-1.5 text-xs text-zinc-500 bg-zinc-800/50 border border-zinc-700/40 rounded-xl px-3 py-1.5">
                  <MapPin className="h-3 w-3 text-indigo-400 flex-shrink-0" />
                  <span>{locationRef.current.locationName ?? `${locationRef.current.latitude.toFixed(4)}, ${locationRef.current.longitude.toFixed(4)}`}</span>
                </div>
              )}
            </div>
          )}

          {/* Already marked */}
          {scanState === "duplicate" && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="w-16 h-16 rounded-full bg-indigo-600/20 border border-indigo-600/40 flex items-center justify-center">
                <CheckCircle2 className="h-9 w-9 text-indigo-400" />
              </div>
              <p className="text-sm font-semibold text-indigo-300">Already Marked</p>
              <p className="text-xs text-zinc-400 max-w-[220px]">{scanMsg}</p>
              <p className="text-[11px] text-zinc-600">You can only mark attendance once per class.</p>
              <Button size="sm" variant="outline" onClick={closeScanModal}>Close</Button>
            </div>
          )}

          {/* Fail */}
          {(scanState === "fail" || scanState === "offline") && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className={cn("w-16 h-16 rounded-full flex items-center justify-center",
                scanState === "offline" ? "bg-amber-600/20 border border-amber-600/40" : "bg-red-600/20 border border-red-600/40"
              )}>
                {scanState === "offline" ? <AlertTriangle className="h-9 w-9 text-amber-400" /> : <XCircle className="h-9 w-9 text-red-400" />}
              </div>
              <p className={cn("text-sm font-semibold", scanState === "offline" ? "text-amber-300" : "text-red-300")}>
                {scanState === "offline" ? "Service Offline" : "Verification Failed"}
              </p>
              <p className="text-xs text-zinc-400">{scanMsg}</p>
              <Button size="sm" variant="outline" onClick={() => { setScanState("idle"); setCapturedImage(null); }}>Try Again</Button>
            </div>
          )}

          {/* Verifying */}
          {scanState === "verifying" && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="w-16 h-16 rounded-full bg-indigo-600/20 border border-indigo-600/40 flex items-center justify-center animate-pulse">
                <ScanFace className="h-9 w-9 text-indigo-400" />
              </div>
              <p className="text-sm text-zinc-300">{scanMsg}</p>
            </div>
          )}

          {/* Liveness challenge */}
          {scanState === "liveness" && (
            <div className="flex flex-col items-center gap-4">
              <div className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden border-2 border-amber-500/40 bg-zinc-950">
                <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover [transform:scaleX(-1)]" />
                <canvas ref={canvasRef} className="hidden" />
                {/* Oval guide */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-36 h-44 rounded-full border-2 border-dashed border-amber-400/50" />
                </div>
                {/* Challenge overlay */}
                <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-sm px-4 py-3 text-center">
                  <p className="text-xs text-amber-300 font-semibold uppercase tracking-wide mb-1">Liveness Check</p>
                  <p className="text-sm text-white font-medium">{livenessChallenge}</p>
                </div>
              </div>
              {/* Progress bar */}
              <div className="w-full">
                <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
                  <span>Motion detected</span>
                  <span>{livenessProgress}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-150"
                    style={{ width: `${livenessProgress}%` }}
                  />
                </div>
              </div>
              <p className="text-[11px] text-zinc-500 text-center">Perform the action above. Photo will be taken automatically once verified.</p>
              <Button size="sm" variant="outline" onClick={() => { stopCamera(); setScanState("idle"); }}>Cancel</Button>
            </div>
          )}

          {/* Preview */}
          {scanState === "preview" && capturedImage && (
            <div className="flex flex-col items-center gap-3">
              <div className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden border border-indigo-500/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={capturedImage} alt="Face" className="absolute inset-0 h-full w-full object-cover [transform:scaleX(-1)]" />
              </div>
              <p className="text-xs text-zinc-500 text-center">Liveness verified ✓ — confirm your photo below</p>
              <div className="flex gap-2">
                <Button size="sm" onClick={submitFaceScan}><ScanFace className="h-3.5 w-3.5" />Verify & Mark</Button>
                <Button size="sm" variant="outline" onClick={() => {
                  livenessRef.current = false;
                  setCapturedImage(null);
                  setScanState("idle");
                }}>Retake</Button>
              </div>
            </div>
          )}

          {/* Idle */}
          {scanState === "idle" && (
            <div className="space-y-4">
              {scanClass && (() => {
                const win = getClassWindow(scanClass, new Date());
                if (win === "late") return (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-950/30 border border-amber-700/40">
                    <Timer className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-amber-300">You are late</p>
                      <p className="text-[11px] text-amber-400/80 mt-0.5">More than {scanClass.lateThresholdMins ?? 10} minutes have passed since the class started. Your attendance will be recorded as <span className="font-semibold">LATE</span>.</p>
                    </div>
                  </div>
                );
                return null;
              })()}
              <p className="text-sm text-zinc-400 text-center">Scan your face to mark attendance for this class.</p>
              {scanMsg && <p className="text-xs text-red-400 bg-red-950/30 border border-red-800/40 rounded-xl px-3 py-2">{scanMsg}</p>}
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="secondary" onClick={startCamera}><Camera className="h-4 w-4" />Use Camera</Button>
                <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" />Upload Photo</Button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileUpload} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
