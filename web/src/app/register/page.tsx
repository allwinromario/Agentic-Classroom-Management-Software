"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Mail, Lock, User, ArrowRight, Eye, EyeOff,
  GraduationCap, BookOpen, Camera, Upload, ScanFace,
  CheckCircle, ChevronLeft, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";

type Step = "credentials" | "face";

export default function RegisterPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();

  const [step, setStep] = useState<Step>("credentials");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "STUDENT" as "ADMIN" | "STUDENT" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  // Always start fresh — clear any existing session so the form is never skipped.
  useEffect(() => {
    setUser(null);
    fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Face capture state
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [faceError, setFaceError] = useState("");
  const [registering, setRegistering] = useState(false);
  const [aiOnline, setAiOnline] = useState<boolean | null>(null);
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef   = useRef<HTMLInputElement>(null);

  // Registered user from step 1 (needed to call register-face)
  const [pendingUser, setPendingUser] = useState<{ id: string; name: string } | null>(null);

  // Check AI service when student arrives at face step
  useEffect(() => {
    if (step !== "face") return;
    fetch("/api/ai-service?path=/health")
      .then((r) => r.json())
      .then((d) => setAiOnline(d.ok === true))
      .catch(() => setAiOnline(false));
  }, [step]);

  // Attach MediaStream to <video> after it mounts
  useEffect(() => {
    if (!showCamera) return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    const go = () => void video.play().catch(() => {
      setFaceError("Camera preview failed. Try uploading a photo instead.");
    });
    video.addEventListener("loadedmetadata", go);
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) go();
    return () => { video.removeEventListener("loadedmetadata", go); video.srcObject = null; };
  }, [showCamera]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setShowCamera(false);
  }, []);

  useEffect(() => () => { stopCamera(); }, [stopCamera]);

  const startCamera = useCallback(async () => {
    try {
      setFaceError("");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 } }, audio: false });
      streamRef.current = stream;
      setCapturedImage(null);
      setShowCamera(true);
    } catch {
      setFaceError("Cannot access camera. Allow camera permission or upload a photo.");
    }
  }, []);

  const capture = () => {
    const v = videoRef.current; const c = canvasRef.current;
    if (!v || !c) return;
    if (!v.videoWidth) { setFaceError("Camera is still loading — wait a moment or upload a photo."); return; }
    const ctx = c.getContext("2d"); if (!ctx) return;
    c.width = v.videoWidth; c.height = v.videoHeight;
    ctx.drawImage(v, 0, 0);
    setCapturedImage(c.toDataURL("image/jpeg", 0.85));
    stopCamera();
  };

  const onFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setCapturedImage(ev.target?.result as string); stopCamera(); };
    reader.readAsDataURL(file);
  };

  // ── Step 1: Register account ──────────────────────────────────────────
  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Registration failed"); return; }
      setUser(data.user);
      setPendingUser({ id: data.user.id, name: data.user.name });
      if (form.role === "STUDENT") {
        setStep("face");
      } else {
        router.push("/pending");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Register face (student only) ─────────────────────────────
  const handleFaceSubmit = async () => {
    if (!capturedImage || !pendingUser) return;
    setRegistering(true); setFaceError("");
    try {
      const res = await fetch("/api/ai-service?path=/register-face", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: pendingUser.id, imageBase64: capturedImage }),
      });
      const data = await res.json() as { success?: boolean; ok?: boolean; message?: string; detail?: unknown };
      const ok = res.ok && (data.success === true || data.ok === true);
      if (!ok) {
        const msg = (() => {
          if (typeof data.detail === "string") return data.detail;
          if (Array.isArray(data.detail) && data.detail[0]?.msg) return String(data.detail[0].msg);
          return data.message ?? "Registration failed. Please try again.";
        })();
        setFaceError(msg);
        return;
      }
      // Face registered — proceed to pending page
      router.push("/pending");
    } catch {
      setFaceError("Network error. Please try again.");
    } finally {
      setRegistering(false);
    }
  };

  const skipFace = () => router.push("/pending");

  return (
    <div className="min-h-screen grid-bg flex items-center justify-center p-4">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-purple-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-indigo-600/5 rounded-full blur-3xl" />
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md relative z-10">
        <div className="glass rounded-3xl p-8 border border-zinc-700/50">

          {/* Step indicator */}
          {form.role === "STUDENT" && (
            <div className="flex items-center gap-2 mb-6">
              {(["credentials", "face"] as Step[]).map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                    step === s ? "bg-indigo-600 text-white"
                    : i < ["credentials","face"].indexOf(step) ? "bg-emerald-600 text-white"
                    : "bg-zinc-800 text-zinc-500"
                  )}>
                    {i < ["credentials","face"].indexOf(step) ? <CheckCircle className="h-4 w-4" /> : i + 1}
                  </div>
                  <span className={cn("text-xs", step === s ? "text-zinc-200" : "text-zinc-500")}>
                    {s === "credentials" ? "Account" : "Face ID"}
                  </span>
                  {i === 0 && <div className="w-8 h-px bg-zinc-700" />}
                </div>
              ))}
            </div>
          )}

          <AnimatePresence mode="wait">

            {/* ── Step 1: Credentials ───────────────────────────────────── */}
            {step === "credentials" && (
              <motion.div key="credentials" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <div className="text-center mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl mx-auto mb-4">SC</div>
                  <h1 className="text-2xl font-bold text-zinc-100">Create account</h1>
                  <p className="text-zinc-400 text-sm mt-1">Join SCMS — pending admin approval</p>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  {[
                    { value: "STUDENT", label: "Student", icon: BookOpen, desc: "View timetable & attendance" },
                    { value: "ADMIN",   label: "Teacher", icon: GraduationCap, desc: "Manage classes & attendance" },
                  ].map((r) => {
                    const Icon = r.icon;
                    return (
                      <button key={r.value} type="button"
                        onClick={() => setForm({ ...form, role: r.value as "ADMIN" | "STUDENT" })}
                        className={cn("p-4 rounded-2xl border text-left transition-all duration-200",
                          form.role === r.value
                            ? "border-indigo-500/60 bg-indigo-950/30 text-indigo-300"
                            : "border-zinc-700 bg-zinc-800/30 text-zinc-400 hover:border-zinc-600"
                        )}
                      >
                        <Icon className="h-5 w-5 mb-2" />
                        <p className="font-medium text-sm">{r.label}</p>
                        <p className="text-xs mt-0.5 opacity-70">{r.desc}</p>
                      </button>
                    );
                  })}
                </div>

                <form onSubmit={handleCredentials} className="space-y-4">
                  <Input label="Full Name" placeholder="Jane Smith" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} icon={<User className="h-4 w-4" />} required />
                  <Input label="Email" type="email" placeholder="you@school.edu" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} icon={<Mail className="h-4 w-4" />} required />
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-zinc-300">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                      <input type={showPass ? "text" : "password"} placeholder="Min. 8 characters" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={8} required
                        className="flex h-10 w-full rounded-xl border border-zinc-700 bg-zinc-800/50 pl-10 pr-10 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
                      />
                      <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                        {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {error && <p className="text-sm text-red-400 bg-red-950/30 border border-red-800/40 rounded-xl px-3 py-2">{error}</p>}

                  <Button type="submit" className="w-full" loading={loading}>
                    {form.role === "STUDENT" ? "Next: Register Face" : "Create Account"}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </form>

                {form.role === "STUDENT" && (
                  <p className="text-xs text-zinc-600 text-center mt-3">
                    Students must register their face for AI attendance recognition.
                  </p>
                )}

                <div className="mt-4 text-center">
                  <p className="text-sm text-zinc-500">Already have an account?{" "}
                    <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">Sign in</Link>
                  </p>
                </div>
              </motion.div>
            )}

            {/* ── Step 2: Face Capture ──────────────────────────────────── */}
            {step === "face" && (
              <motion.div key="face" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="text-center mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white mx-auto mb-4">
                    <ScanFace className="h-7 w-7" />
                  </div>
                  <h2 className="text-xl font-bold text-zinc-100">Register Your Face</h2>
                  <p className="text-zinc-400 text-sm mt-1">Used for AI-powered attendance — one photo, permanent.</p>
                </div>

                {/* AI status */}
                {aiOnline === false && (
                  <div className="mb-4 p-3 rounded-xl bg-amber-950/40 border border-amber-800/40 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-300">
                      The AI service is currently offline. Your photo will still be stored and processed once the service restarts.
                    </p>
                  </div>
                )}

                {/* Camera / preview */}
                <div className="space-y-4">
                  {showCamera && (
                    <div className="flex flex-col items-center gap-3">
                      <div className="relative w-full max-w-[280px] mx-auto aspect-[3/4] rounded-2xl overflow-hidden border border-zinc-700/60 bg-zinc-950 shadow-xl">
                        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover [transform:scaleX(-1)]" />
                        <canvas ref={canvasRef} className="hidden" />
                        {/* Face guide overlay */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-36 h-44 rounded-full border-2 border-dashed border-white/30" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={capture}><Camera className="h-3.5 w-3.5" />Capture</Button>
                        <Button size="sm" variant="outline" onClick={stopCamera}>Cancel</Button>
                      </div>
                    </div>
                  )}

                  {capturedImage && !showCamera && (
                    <div className="flex flex-col items-center gap-3">
                      <div className="relative w-full max-w-[280px] mx-auto aspect-[3/4] rounded-2xl overflow-hidden border border-indigo-500/30">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={capturedImage} alt="Face preview" className="absolute inset-0 h-full w-full object-cover [transform:scaleX(-1)]" />
                        <div className="absolute top-2 right-2">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-600/80 text-white">✓ Captured</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" loading={registering} onClick={handleFaceSubmit}>
                          <ScanFace className="h-3.5 w-3.5" />
                          {registering ? "Registering…" : "Submit & Continue"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setCapturedImage(null); setFaceError(""); }} disabled={registering}>
                          Retake
                        </Button>
                      </div>
                    </div>
                  )}

                  {!showCamera && !capturedImage && (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-full max-w-[280px] mx-auto aspect-[3/4] rounded-2xl border-2 border-dashed border-zinc-700 bg-zinc-900/50 flex flex-col items-center justify-center gap-3 text-zinc-600">
                        <ScanFace className="h-12 w-12" />
                        <p className="text-sm text-center px-4">Position your face clearly<br />in good lighting</p>
                      </div>
                      <div className="flex flex-wrap justify-center gap-2">
                        <Button variant="secondary" onClick={startCamera}><Camera className="h-4 w-4" />Use Camera</Button>
                        <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" />Upload Photo</Button>
                        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileUpload} />
                      </div>
                    </div>
                  )}

                  {faceError && (
                    <p className="text-xs text-red-400 bg-red-950/30 border border-red-800/40 rounded-xl px-3 py-2">{faceError}</p>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                    <button onClick={() => setStep("credentials")} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300">
                      <ChevronLeft className="h-3.5 w-3.5" /> Back
                    </button>
                    <button onClick={skipFace} className="text-xs text-zinc-600 hover:text-zinc-400 underline underline-offset-2">
                      Skip for now
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
