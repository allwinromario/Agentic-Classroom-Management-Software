"use client";

import { io, Socket } from "socket.io-client";

// Store socket on window so it survives Turbopack HMR module reloads.
// Module-level vars reset to null/false on every HMR update, but the old
// Socket object keeps polling unless we can reach it through window.
declare global {
  interface Window {
    __scms_socket__: Socket | null;
    __scms_socket_gave_up__: boolean;
  }
}

function getWin(): (typeof window & { __scms_socket__: Socket | null; __scms_socket_gave_up__: boolean }) | null {
  return typeof window !== "undefined" ? (window as never) : null;
}

/**
 * Returns a connected Socket.io instance, or null when:
 * – NEXT_PUBLIC_SOCKET_ENABLED is not "true"  (default: standard `npm run dev`)
 * – We already gave up after repeated 404s
 *
 * Setting NEXT_PUBLIC_SOCKET_ENABLED="true" in .env.local activates real-time
 * only when the custom Socket.io server is running (`npm run dev:socket`).
 */
export function getSocket(auth?: { userId: string; role: string }): Socket | null {
  const win = getWin();
  if (!win) return null;

  // If Socket.io server is not configured, kill any stale socket and bail out.
  if (process.env.NEXT_PUBLIC_SOCKET_ENABLED !== "true") {
    if (win.__scms_socket__) {
      win.__scms_socket__.removeAllListeners();
      win.__scms_socket__.disconnect();
      win.__scms_socket__ = null;
    }
    return null;
  }

  if (win.__scms_socket_gave_up__) return null;

  // Reuse if already connected.
  if (win.__scms_socket__?.connected) return win.__scms_socket__;

  // Disconnect stale / disconnected instance before creating a new one.
  if (win.__scms_socket__) {
    win.__scms_socket__.removeAllListeners();
    win.__scms_socket__.disconnect();
    win.__scms_socket__ = null;
  }

  let fails = 0;
  const MAX_FAILS = 3;

  const sock = io({
    path: "/api/socket",
    auth,
    reconnection: true,
    reconnectionAttempts: MAX_FAILS,
    reconnectionDelay: 3000,
    reconnectionDelayMax: 15000,
    timeout: 4000,
  });

  win.__scms_socket__ = sock;

  sock.on("connect", () => {
    fails = 0;
    console.log("[socket] connected:", sock.id);
  });

  sock.on("connect_error", () => {
    fails++;
    if (fails >= MAX_FAILS) {
      win.__scms_socket_gave_up__ = true;
      sock.removeAllListeners();
      sock.disconnect();
      win.__scms_socket__ = null;
    }
  });

  sock.on("disconnect", (reason) => {
    if (reason === "io server disconnect" || reason === "io client disconnect") {
      win.__scms_socket__ = null;
    }
  });

  return sock;
}

export function disconnectSocket() {
  const win = getWin();
  if (!win) return;
  win.__scms_socket__?.removeAllListeners();
  win.__scms_socket__?.disconnect();
  win.__scms_socket__ = null;
  win.__scms_socket_gave_up__ = false;
}
