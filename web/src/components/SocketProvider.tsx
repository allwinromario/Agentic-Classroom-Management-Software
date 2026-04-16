"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/auth";
import { useAlertStore } from "@/store/alerts";
import { getSocket, disconnectSocket } from "@/lib/socket";

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const { addAlert } = useAlertStore();

  useEffect(() => {
    if (!user) return;

    // Returns null when NEXT_PUBLIC_SOCKET_ENABLED !== "true".
    // Also kills any stale socket left over from an HMR module reload.
    const sock = getSocket({ userId: user.id, role: user.role });
    if (!sock) return;

    sock.on("alert:new", (data: { id: string; title: string; message: string; severity: string; createdAt: string }) => {
      addAlert(data);
    });

    sock.on("attendance:update", (data: unknown) => {
      window.dispatchEvent(new CustomEvent("scms:attendance", { detail: data }));
    });

    sock.on("user:approved", () => {
      window.location.reload();
    });

    sock.on("timetable:approved", () => {
      window.dispatchEvent(new CustomEvent("scms:timetable_approved"));
    });

    return () => {
      sock.off("alert:new");
      sock.off("attendance:update");
      sock.off("user:approved");
      sock.off("timetable:approved");
      // Fully disconnect on unmount / HMR re-render so the old socket
      // doesn't keep polling in the background.
      disconnectSocket();
    };
  }, [user, addAlert]);

  return <>{children}</>;
}
