"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Plus, Trash2, Clock, ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useChatStore } from "@/store/chat";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";

function formatRelativeDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ChatHistorySidebar() {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { sessions, activeSessionId, createSession, setActiveSession, deleteSession } =
    useChatStore();
  const { user } = useAuthStore();
  const router = useRouter();

  if (!user) return null;

  const handleMouseEnterTrigger = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };

  const handleMouseLeavePanel = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 300);
  };

  const handleMouseEnterPanel = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  const handleNewChat = () => {
    createSession();
    router.push("/assistant");
    setOpen(false);
  };

  const handleSelectSession = (id: string) => {
    setActiveSession(id);
    router.push("/assistant");
    setOpen(false);
  };

  const handleDeleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteSession(id);
  };

  return (
    <>
      {/* Invisible hover trigger strip on the right edge */}
      <div
        className="fixed right-0 top-0 h-full w-5 z-50"
        onMouseEnter={handleMouseEnterTrigger}
        aria-hidden="true"
      />

      {/* Visual tab/handle that peeks out */}
      <AnimatePresence>
        {!open && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ delay: 0.5 }}
            className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex items-center gap-1 pr-1 pl-2 py-3 rounded-l-xl bg-indigo-600/20 border border-r-0 border-indigo-600/30 text-indigo-400 cursor-pointer shadow-lg"
            onMouseEnter={handleMouseEnterTrigger}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <Clock className="h-3.5 w-3.5" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar panel */}
      <AnimatePresence>
        {open && (
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed right-0 top-0 h-full w-72 glass border-l border-zinc-800/60 flex flex-col z-50 shadow-2xl"
            onMouseEnter={handleMouseEnterPanel}
            onMouseLeave={handleMouseLeavePanel}
          >
            {/* Header */}
            <div className="p-4 border-b border-zinc-800/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-600/30 flex items-center justify-center">
                  <MessageSquare className="h-3.5 w-3.5 text-indigo-400" />
                </div>
                <h2 className="font-semibold text-zinc-100 text-sm">Chat History</h2>
              </div>
              <button
                onClick={handleNewChat}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-all duration-200 shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" />
                New Chat
              </button>
            </div>

            {/* Session list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="w-10 h-10 rounded-xl bg-zinc-800/60 flex items-center justify-center">
                    <MessageSquare className="h-5 w-5 text-zinc-600" />
                  </div>
                  <p className="text-zinc-500 text-xs text-center">
                    No chat history yet.
                    <br />
                    Start a conversation!
                  </p>
                </div>
              ) : (
                sessions.map((session) => {
                  const isActive = activeSessionId === session.id;
                  return (
                    <div
                      key={session.id}
                      className={cn(
                        "group flex items-start gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150 relative",
                        isActive
                          ? "bg-indigo-600/20 border border-indigo-600/30 text-indigo-300"
                          : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                      )}
                      onClick={() => handleSelectSession(session.id)}
                    >
                      <MessageSquare
                        className={cn(
                          "h-3.5 w-3.5 flex-shrink-0 mt-0.5",
                          isActive ? "text-indigo-400" : "text-zinc-600"
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-xs font-medium leading-snug">{session.title}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Clock className="h-2.5 w-2.5 text-zinc-600" />
                          <p className="text-[10px] text-zinc-600">
                            {formatRelativeDate(session.updatedAt)}
                          </p>
                          <span className="text-[10px] text-zinc-700 ml-auto">
                            {session.messages.length} msg{session.messages.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDeleteSession(e, session.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:text-red-400 hover:bg-red-950/20 transition-all duration-150 flex-shrink-0"
                        title="Delete session"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-zinc-800/60">
              <p className="text-[10px] text-zinc-600 text-center">
                History stored locally · Max 50 sessions
              </p>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
