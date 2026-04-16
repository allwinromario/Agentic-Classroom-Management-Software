/**
 * Custom Next.js server with Socket.io integration.
 * Enables real-time attendance updates and emergency alert broadcasts.
 *
 * Run with: node --experimental-strip-types server.ts
 * Or compile to JS first: npx tsc server.ts --module commonjs --target es2020 --outDir .
 * Then: node server.js
 *
 * For dev use the npm script: npm run dev:socket
 */

import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server, Socket } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT ?? "3000", 10);

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    path: "/api/socket",
  });

  // Room management: users join their role-based room
  io.on("connection", (socket: Socket) => {
    const role = (socket.handshake.auth as { role?: string }).role ?? "guest";
    const userId = (socket.handshake.auth as { userId?: string }).userId ?? "";
    console.log(`[socket] connect  user=${userId} role=${role}`);

    socket.join(`role:${role}`);
    socket.join(`user:${userId}`);
    socket.join("all");

    // Attendance update from AI service or admin
    socket.on("attendance:update", (data: unknown) => {
      console.log("[socket] attendance:update", data);
      io.to("all").emit("attendance:update", data);
    });

    // Emergency alert broadcast
    socket.on("alert:broadcast", (data: unknown) => {
      console.log("[socket] alert:broadcast", data);
      io.to("all").emit("alert:new", data);
    });

    // Timetable approval notification
    socket.on("timetable:approved", (data: unknown) => {
      io.to("role:ADMIN").emit("timetable:approved", data);
      io.to("role:STUDENT").emit("timetable:approved", data);
    });

    // User approval notification
    socket.on("user:approved", (data: { userId: string }) => {
      io.to(`user:${data.userId}`).emit("user:approved", data);
    });

    socket.on("disconnect", () => {
      console.log(`[socket] disconnect user=${userId}`);
    });
  });

  // Expose io for API routes to emit events
  (global as unknown as { io: Server }).io = io;

  httpServer.listen(port, () => {
    console.log(`✅ SCMS running on http://localhost:${port}`);
    console.log(`   Socket.io enabled at /api/socket`);
  });
});
