"use client";

import { useCallback, useRef, useState } from "react";

type Props = {
  classId: string;
};

export function AttendanceCapture({ classId }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startCamera = useCallback(async () => {
    setStatus(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setStatus("Camera permission denied or unavailable.");
    }
  }, []);

  const captureFrame = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setStatus("Start the camera first.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    setPreviewUrl(canvas.toDataURL("image/jpeg", 0.92));
  }, []);

  const onFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
  }, []);

  const submitImage = useCallback(async () => {
    if (!previewUrl) {
      setStatus("Choose a file or capture a frame first.");
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/attendance/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, imageBase64: previewUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setStatus(typeof data.message === "string" ? data.message : JSON.stringify(data));
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }, [classId, previewUrl]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={startCamera}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Start camera
        </button>
        <button
          type="button"
          onClick={stopCamera}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
        >
          Stop
        </button>
        <button
          type="button"
          onClick={captureFrame}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
        >
          Capture frame
        </button>
        <label className="inline-flex cursor-pointer items-center rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600">
          Upload image
          <input type="file" accept="image/*" className="hidden" onChange={onFile} />
        </label>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-black/5 dark:border-zinc-800">
          <video ref={videoRef} className="aspect-video w-full object-cover" playsInline muted />
        </div>
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Preview" className="aspect-video w-full object-contain bg-zinc-100 dark:bg-zinc-900" />
          ) : (
            <div className="flex aspect-video items-center justify-center text-sm text-zinc-500">Preview</div>
          )}
        </div>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={submitImage}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {busy ? "Processing…" : "Send for recognition (stub)"}
      </button>
      {status && (
        <pre className="whitespace-pre-wrap rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          {status}
        </pre>
      )}
    </div>
  );
}
