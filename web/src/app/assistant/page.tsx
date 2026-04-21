"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, Sparkles, RotateCcw, Mic, MicOff, Volume2, VolumeX,
  Upload, X, CheckCircle2, ClipboardList, Camera, Paperclip,
  Send, Loader2, AlertCircle, Plus,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth";
import { useChatStore, type AgentAction, type ChatMessage } from "@/store/chat";
import { cn, getInitials } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

// ── Types ──────────────────────────────────────────────────────────────────────

interface CsvRow {
  [key: string]: string;
}

// ── Speech Recognition (not yet in standard TS DOM lib) ───────────────────────

interface ISpeechRecognitionErrorEvent {
  error?: string;
}
interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: ISpeechRecognitionEvent) => void) | null;
  onerror: ((event: ISpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}
interface ISpeechRecognitionEvent {
  results: Array<Array<{ transcript: string }>>;
}
interface ISpeechRecognitionCtor {
  new(): ISpeechRecognition;
}

function getSRCtor(): ISpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w["SpeechRecognition"] ?? w["webkitSpeechRecognition"] ?? null) as ISpeechRecognitionCtor | null;
}

// ── Voice hooks ────────────────────────────────────────────────────────────────

type VoiceError = "not_supported" | "no_permission" | "no_speech" | "network" | null;

function useVoiceInput(onTranscript: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<VoiceError>(null);
  const ref = useRef<ISpeechRecognition | null>(null);

  useEffect(() => {
    const SR = getSRCtor();
    if (!SR) { setIsSupported(false); return; }
    setIsSupported(true);

    const r = new SR();
    r.continuous = true;
    r.interimResults = false;
    r.lang = "en-US";

    r.onresult = (e: ISpeechRecognitionEvent) => {
      const transcript = Array.from({ length: e.results.length })
        .map((_, i) => e.results[i][0].transcript)
        .join(" ")
        .trim();
      if (transcript) { onTranscript(transcript); setError(null); }
      setIsListening(false);
    };

    r.onerror = (ev: ISpeechRecognitionErrorEvent) => {
      const code = ev.error ?? "";
      if (code === "not-allowed" || code === "permission-denied") setError("no_permission");
      else if (code === "no-speech")                               setError("no_speech");
      else if (code === "network")                                 setError("network");
      setIsListening(false);
    };

    r.onend = () => setIsListening(false);
    ref.current = r;
  }, [onTranscript]);

  const start = useCallback(() => {
    if (!ref.current || isListening) return;
    setError(null);
    try { ref.current.start(); setIsListening(true); }
    catch { setError("not_supported"); }
  }, [isListening]);

  const stop = useCallback(() => {
    if (!ref.current || !isListening) return;
    try { ref.current.stop(); } catch { /* ignore */ }
    setIsListening(false);
  }, [isListening]);

  const clearError = useCallback(() => setError(null), []);

  return { isListening, isSupported, error, start, stop, clearError };
}

const TTS_PREF_KEY = "scms-voice-enabled";

function useTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  const [enabled, setEnabledState] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(TTS_PREF_KEY);
    if (stored !== null) setEnabledState(stored === "true");
  }, []);

  const setEnabled = useCallback((val: boolean) => {
    setEnabledState(val);
    localStorage.setItem(TTS_PREF_KEY, String(val));
  }, []);

  const speak = useCallback((text: string) => {
    if (!supported || !enabled) return;
    window.speechSynthesis.cancel();
    const clean = text
      .replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1")
      .replace(/#{1,6}\s/g, "").replace(/`(.*?)`/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/>\s/g, "")
      .slice(0, 600);
    const u = new SpeechSynthesisUtterance(clean);
    u.rate = 1.05;
    u.onstart = () => setIsSpeaking(true);
    u.onend   = () => setIsSpeaking(false);
    u.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(u);
  }, [supported, enabled]);

  const stop = useCallback(() => { window.speechSynthesis.cancel(); setIsSpeaking(false); }, []);

  return { speak, stop, isSpeaking, enabled, setEnabled, supported };
}

// ── CSV parser ─────────────────────────────────────────────────────────────────

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split("\n").filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
  return lines.slice(1).map((line) => {
    const vals = line.split(",").map((v) => v.trim().replace(/"/g, ""));
    const row: CsvRow = {};
    headers.forEach((h, i) => { row[h] = vals[i] ?? ""; });
    return row;
  });
}

// ── Shared markdown components ─────────────────────────────────────────────────

const MD_COMPONENTS = {
  p:          ({ children }: { children?: React.ReactNode }) => <p className="mb-2 last:mb-0 text-zinc-200">{children}</p>,
  strong:     ({ children }: { children?: React.ReactNode }) => <strong className="text-zinc-100 font-semibold">{children}</strong>,
  em:         ({ children }: { children?: React.ReactNode }) => <em className="text-zinc-300 italic">{children}</em>,
  ul:         ({ children }: { children?: React.ReactNode }) => <ul className="list-disc list-inside space-y-1 text-zinc-300 mb-2">{children}</ul>,
  ol:         ({ children }: { children?: React.ReactNode }) => <ol className="list-decimal list-inside space-y-1 text-zinc-300 mb-2">{children}</ol>,
  li:         ({ children }: { children?: React.ReactNode }) => <li className="text-zinc-300">{children}</li>,
  code:       ({ children }: { children?: React.ReactNode }) => <code className="px-1.5 py-0.5 rounded-md bg-zinc-800 text-indigo-300 text-xs font-mono">{String(children ?? "")}</code>,
  blockquote: ({ children }: { children?: React.ReactNode }) => <blockquote className="border-l-2 border-indigo-500/40 pl-3 text-zinc-400 italic my-2">{children}</blockquote>,
};

// ── Action card (teacher only) ─────────────────────────────────────────────────

function ActionCard({ action }: { action: AgentAction }) {
  const isMarks   = action.type === "marks_entered" || action.type === "bulk_marks_entered";
  const isAtt     = action.type === "attendance_marked";
  const isTiming  = action.type === "class_timing_updated";

  const colorClass = isMarks  ? "bg-emerald-950/20 border-emerald-700/30 text-emerald-300"
                   : isTiming ? "bg-amber-950/20 border-amber-700/30 text-amber-300"
                   :            "bg-indigo-950/20 border-indigo-700/30 text-indigo-300";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className={cn("rounded-2xl border p-4 text-sm", colorClass)}
    >
      <div className="flex items-center gap-2 mb-2 font-semibold">
        {isMarks   && <><ClipboardList className="h-4 w-4 flex-shrink-0" /> Marks Entered</>}
        {isAtt     && <><Camera className="h-4 w-4 flex-shrink-0" /> Attendance Marked</>}
        {isTiming  && <><span className="text-base leading-none">🕐</span> Class Timing Updated</>}
        <CheckCircle2 className="h-4 w-4 ml-auto" />
      </div>

      {action.details.student && (
        <p className="opacity-80 text-xs mb-1">Student: <span className="font-medium">{action.details.student}</span></p>
      )}
      {isMarks && action.details.entriesAdded !== undefined && (
        <p className="opacity-80 text-xs mb-1">Entries saved: <span className="font-medium">{action.details.entriesAdded}</span></p>
      )}
      {action.type === "bulk_marks_entered" && action.details.totalAdded !== undefined && (
        <p className="opacity-80 text-xs mb-1">Total saved: <span className="font-medium">{action.details.totalAdded}</span></p>
      )}
      {isMarks && action.details.entries && (
        <div className="mt-2 space-y-1">
          {action.details.entries.map((e, i) => (
            <div key={i} className="flex justify-between text-xs opacity-70">
              <span>{e.subject} ({e.examType})</span>
              <span className="font-medium">{e.score}/{e.maxScore}</span>
            </div>
          ))}
        </div>
      )}

      {isAtt && action.details.subject && (
        <p className="opacity-80 text-xs mb-1">Subject: <span className="font-medium">{action.details.subject}</span></p>
      )}
      {isAtt && action.details.status && (
        <p className="opacity-80 text-xs">Status: <span className={cn("font-semibold",
          action.details.status === "PRESENT" ? "text-emerald-400" :
          action.details.status === "LATE"    ? "text-amber-400"   : "text-red-400"
        )}>{action.details.status}</span></p>
      )}

      {isTiming && action.details.subject && (
        <p className="opacity-80 text-xs mb-1">Class: <span className="font-medium">{action.details.subject}</span></p>
      )}
      {isTiming && action.details.timetableTitle && (
        <p className="opacity-80 text-xs mb-2">Timetable: <span className="font-medium">{action.details.timetableTitle}</span></p>
      )}
      {isTiming && action.details.previousTiming && action.details.newTiming && (
        <div className="grid grid-cols-2 gap-2 text-xs mt-1">
          <div className="opacity-60">
            <p className="font-semibold mb-0.5">Before</p>
            <p>{action.details.previousTiming.day}</p>
            <p>{action.details.previousTiming.start} – {action.details.previousTiming.end}</p>
            <p>Late after {action.details.previousTiming.lateThresholdMins} min</p>
          </div>
          <div>
            <p className="font-semibold mb-0.5">After</p>
            <p>{action.details.newTiming.day}</p>
            <p>{action.details.newTiming.start} – {action.details.newTiming.end}</p>
            <p>Late after {action.details.newTiming.lateThresholdMins} min</p>
          </div>
        </div>
      )}
      {isTiming && (
        <p className="mt-2 text-xs opacity-60 italic">{action.details.note ?? "Submitted for super admin approval."}</p>
      )}
    </motion.div>
  );
}

// ── Message bubble ─────────────────────────────────────────────────────────────

function MessageBubble({ msg, userName, actions }: { msg: ChatMessage; userName: string; actions?: AgentAction[] }) {
  const isUser = msg.role === "user";
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      <div className={cn(
        "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-semibold self-end",
        isUser ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white"
               : "bg-gradient-to-br from-violet-600 to-pink-600 text-white"
      )}>
        {isUser ? <span>{getInitials(userName)}</span> : <Bot className="h-4 w-4" />}
      </div>

      <div className="flex flex-col gap-2 max-w-[80%]">
        <div className={cn(
          "rounded-2xl px-4 py-3 text-sm",
          isUser ? "bg-indigo-600/20 border border-indigo-600/30 text-indigo-100"
                 : "glass border border-zinc-700/50 text-zinc-200"
        )}>
          {isUser
            ? <p>{msg.content}</p>
            : <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown components={MD_COMPONENTS}>
                  {typeof msg.content === "string" ? msg.content : ""}
                </ReactMarkdown>
              </div>
          }
        </div>
        {!isUser && actions && actions.length > 0 && (
          <div className="space-y-2">
            {actions.map((a, i) => <ActionCard key={i} action={a} />)}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Quick prompts per role ─────────────────────────────────────────────────────

const TEACHER_PROMPTS = [
  "Enter marks for a student",
  "Mark attendance for a student",
  "Change the timing of a class",
  "Show students with low attendance",
  "Enter marks from a CSV file",
];

const STUDENT_PROMPTS = [
  "What classes do I have today?",
  "Show my attendance status",
  "How does face recognition work?",
  "Request retake because my appearance changed",
  "What can you help me with?",
];

// ── Welcome messages ───────────────────────────────────────────────────────────

function teacherWelcome(name: string) {
  return `Hello ${name}! I'm your AI teaching assistant. I can help you:\n\n- **Enter marks** for students (type or upload a CSV)\n- **Mark attendance** for specific students and classes\n- **Look up** student performance and records\n\nJust tell me what you need, or use the microphone for voice input.`;
}

function studentWelcome(name: string) {
  return `Hello ${name}! I'm your SCMS assistant. I can help you with timetable queries, attendance information, face ID, and navigating the system. What can I help you with today?`;
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AssistantPage() {
  const { user } = useAuthStore();
  const isTeacher = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const {
    sessions,
    activeSessionId,
    createSession,
    addMessage,
    setMessages,
    setActionsForMessage,
    clearActiveSession,
  } = useChatStore();

  // Derive current session reactively
  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;
  const messages: ChatMessage[] = activeSession?.messages ?? [];
  const actionsMap: Record<string, AgentAction[]> = activeSession?.actionsMap ?? {};

  const [input, setInput]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [fetching, setFetching]       = useState(false);
  const [csvData, setCsvData]         = useState<CsvRow[] | null>(null);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [csvError, setCsvError]       = useState<string | null>(null);

  const bottomRef    = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef  = useRef<HTMLTextAreaElement>(null);

  const tts = useTTS();

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  const handleTranscript = useCallback((text: string) => {
    setInput((prev) => (prev ? prev + " " + text : text));
    textareaRef.current?.focus();
  }, []);

  const voice = useVoiceInput(handleTranscript);

  // ── Initialise / restore chat session ────────────────────────────────────────

  useEffect(() => {
    if (!user) return;
    const firstName = user.name?.split(" ")[0] ?? "there";

    // If there's already an active session with messages, restore it (no fetch needed)
    if (activeSession && activeSession.messages.length > 0) {
      setFetching(false);
      return;
    }

    if (isTeacher) {
      const welcomeMsg: ChatMessage = {
        id: "welcome",
        role: "assistant",
        content: teacherWelcome(firstName),
      };
      if (!activeSessionId) {
        createSession(welcomeMsg);
      } else {
        setMessages([welcomeMsg]);
      }
      setFetching(false);
    } else {
      // Students: load persisted history from API for a new/empty session
      setFetching(true);
      fetch("/api/chat")
        .then((r) => r.json())
        .then((data: { messages?: Array<{ id: string; content: string; role: string; createdAt?: string }> }) => {
          const msgs = data.messages ?? [];
          const chatMsgs: ChatMessage[] =
            msgs.length > 0
              ? msgs.map((m) => ({ id: m.id, content: m.content, role: m.role as "user" | "assistant", createdAt: m.createdAt }))
              : [{ id: "welcome", role: "assistant", content: studentWelcome(firstName) }];

          if (!activeSessionId) {
            createSession(chatMsgs[0]);
            // Add remaining messages after the first
            if (chatMsgs.length > 1) {
              chatMsgs.slice(1).forEach((m) => addMessage(m));
            }
          } else {
            setMessages(chatMsgs);
          }
        })
        .catch(() => {
          const welcomeMsg: ChatMessage = { id: "welcome", role: "assistant", content: studentWelcome(firstName) };
          if (!activeSessionId) {
            createSession(welcomeMsg);
          } else {
            setMessages([welcomeMsg]);
          }
        })
        .finally(() => setFetching(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── File upload ──────────────────────────────────────────────────────────────

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvError(null);
    if (!file.name.endsWith(".csv")) { setCsvError("Please upload a CSV file (.csv)"); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCsv(ev.target?.result as string);
      if (rows.length === 0) { setCsvError("CSV is empty or invalid — make sure it has a header row."); return; }
      setCsvData(rows);
      setCsvFileName(file.name);
      setInput((prev) => prev || "Enter marks from this CSV file");
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ── Send message ─────────────────────────────────────────────────────────────

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content };
    addMessage(userMsg);
    setInput("");
    setLoading(true);

    const attachedCsv  = csvData;
    const attachedName = csvFileName;
    setCsvData(null);
    setCsvFileName(null);

    // Build conversation history from current session messages (excluding welcome)
    const currentMsgs = useChatStore.getState().getActiveSession()?.messages ?? [];
    const history = currentMsgs
      .filter((m) => !m.id.startsWith("welcome"))
      .slice(-11, -1)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      let replyText = "";
      let actions: AgentAction[] = [];

      if (isTeacher) {
        const r = await fetch("/api/agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: attachedName ? `${content}\n\n[File: ${attachedName}]` : content,
            history,
            csvData: attachedCsv ?? undefined,
          }),
        });
        const data = await r.json() as { reply?: string; actions?: AgentAction[]; error?: string };
        replyText = data.reply ?? data.error ?? "Sorry, I encountered an error. Please try again.";
        actions   = data.actions ?? [];
      } else {
        const r = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: content }),
        });
        const data = await r.json() as { message?: { id?: string; content?: string } | string };
        const raw = data.message;
        replyText =
          typeof raw === "object" && raw?.content ? String(raw.content) :
          typeof raw === "string"                 ? raw :
          "Sorry, I encountered an error. Please try again.";
      }

      const assistantId = (Date.now() + 1).toString();
      addMessage({ id: assistantId, role: "assistant", content: replyText });

      if (actions.length > 0) setActionsForMessage(assistantId, actions);
      if (tts.enabled) tts.speak(replyText);

    } catch {
      addMessage({
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Network error. Please check your connection and try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  // ── New chat ─────────────────────────────────────────────────────────────────

  const startNewChat = () => {
    const firstName = user?.name?.split(" ")[0] ?? "there";
    const welcomeMsg: ChatMessage = {
      id: "welcome-" + Date.now(),
      role: "assistant",
      content: isTeacher
        ? teacherWelcome(firstName)
        : `Hi ${firstName}! Starting a new conversation. How can I help you?`,
    };
    createSession(welcomeMsg);
    setCsvData(null);
    setCsvFileName(null);
  };

  // ── Clear chat ───────────────────────────────────────────────────────────────

  const clearChat = () => {
    const firstName = user?.name?.split(" ")[0] ?? "there";
    clearActiveSession({
      id: "welcome-" + Date.now(),
      role: "assistant",
      content: `Chat cleared! Hi ${firstName}, how can I help you?`,
    });
    setCsvData(null);
    setCsvFileName(null);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  const quickPrompts = isTeacher ? TEACHER_PROMPTS : STUDENT_PROMPTS;

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto h-[calc(100vh-8rem)] flex flex-col">

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600 to-pink-600 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-zinc-100">AI Assistance</h1>
              <p className="text-xs text-zinc-500">
                {isTeacher ? "Marks · Attendance · Analytics — Gemini powered" : "Context-aware SCMS helper"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* New chat button */}
            <button
              onClick={startNewChat}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-zinc-700/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 hover:border-zinc-600/50 transition-all duration-200"
            >
              <Plus className="h-3.5 w-3.5" />
              New Chat
            </button>

            {/* TTS toggle — teachers only */}
            {isTeacher && tts.supported && (
              <button
                onClick={() => {
                  const next = !tts.enabled;
                  if (!next) tts.stop();
                  tts.setEnabled(next);
                }}
                className={cn(
                  "p-2 rounded-xl border text-xs flex items-center gap-1.5 transition-all",
                  tts.enabled
                    ? "bg-violet-600/20 border-violet-600/30 text-violet-300"
                    : "bg-zinc-800/50 border-zinc-700/50 text-zinc-500"
                )}
                title={tts.enabled ? "Voice ON — click to turn off" : "Voice OFF — click to turn on"}
              >
                {tts.enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                <span className="hidden sm:inline">{tts.enabled ? "Voice ON" : "Voice OFF"}</span>
              </button>
            )}
            <Button variant="ghost" size="sm" onClick={clearChat} className="text-zinc-500 hover:text-zinc-300">
              <RotateCcw className="h-4 w-4" />
              <span className="hidden sm:inline ml-1.5">Clear</span>
            </Button>
          </div>
        </div>

        {/* ── Messages ──────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2 min-h-0 pb-2">
          {fetching ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  userName={user?.name ?? "User"}
                  actions={actionsMap[msg.id]}
                />
              ))}
            </AnimatePresence>
          )}

          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-pink-600 flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="glass rounded-2xl px-4 py-3 border border-zinc-700/50">
                {isTeacher ? (
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
                    Processing your request…
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    {[0, 150, 300].map((d) => (
                      <span key={d} className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* ── Quick prompts ──────────────────────────────────────────────────── */}
        {messages.length <= 1 && !fetching && (
          <div className="flex flex-wrap gap-2 my-3">
            {quickPrompts.map((p) => (
              <button
                key={p}
                onClick={() => void sendMessage(p)}
                className="text-xs px-3 py-2 rounded-xl border border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-all"
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* ── CSV attachment preview (teacher only) ─────────────────────────── */}
        {isTeacher && csvData && csvFileName && (
          <motion.div
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            className="mb-2 flex items-center gap-3 bg-emerald-950/20 border border-emerald-700/30 rounded-xl px-3 py-2.5 text-sm"
          >
            <Paperclip className="h-4 w-4 text-emerald-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-emerald-300 font-medium truncate">{csvFileName}</p>
              <p className="text-xs text-emerald-400/60">{csvData.length} rows ready to process</p>
            </div>
            <button onClick={() => { setCsvData(null); setCsvFileName(null); }} className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg">
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}

        {/* ── CSV error ─────────────────────────────────────────────────────── */}
        {csvError && (
          <div className="mb-2 flex items-center gap-2 text-xs text-red-400 bg-red-950/20 border border-red-800/30 rounded-xl px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            {csvError}
            <button onClick={() => setCsvError(null)} className="ml-auto"><X className="h-3.5 w-3.5" /></button>
          </div>
        )}

        {/* ── Input bar ─────────────────────────────────────────────────────── */}
        <div className="mt-2">
          <div className="flex items-end gap-2 glass rounded-2xl border border-zinc-700/50 p-3">

            {/* CSV upload — teachers only */}
            {isTeacher && (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 transition-all flex-shrink-0"
                  title="Upload CSV for bulk marks entry"
                >
                  <Upload className="h-4 w-4" />
                </button>
                <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
              </>
            )}

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }}
              placeholder={
                voice.isListening
                  ? "Listening… speak now"
                  : isTeacher
                  ? "Enter marks, mark attendance, or ask anything…"
                  : "Ask about timetables, attendance, or type 'help'…"
              }
              rows={1}
              style={{ overflow: "hidden" }}
              className={cn(
                "flex-1 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 resize-none focus:outline-none max-h-48",
                voice.isListening && "placeholder:text-violet-400"
              )}
            />

            {/* Mic — teachers only */}
            {isTeacher && (
              <button
                onClick={voice.isSupported ? (voice.isListening ? voice.stop : voice.start) : undefined}
                disabled={!voice.isSupported}
                className={cn(
                  "p-2 rounded-xl transition-all flex-shrink-0",
                  voice.isListening
                    ? "bg-violet-600/30 text-violet-300 border border-violet-600/40 animate-pulse"
                    : voice.error === "no_permission"
                    ? "text-red-400 hover:text-red-300 hover:bg-red-950/30"
                    : voice.isSupported
                    ? "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
                    : "text-zinc-700 cursor-not-allowed"
                )}
                title={
                  !voice.isSupported       ? "Voice input not supported in this browser (use Chrome or Edge)" :
                  voice.error === "no_permission" ? "Microphone blocked — click the lock icon in the address bar to allow" :
                  voice.error === "no_speech"     ? "No speech detected — click and speak clearly" :
                  voice.error === "network"       ? "Network error during voice recognition" :
                  voice.isListening        ? "Listening… click to stop" :
                                             "Click to speak"
                }
              >
                {voice.isListening ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </button>
            )}

            {/* Send */}
            <Button
              size="icon"
              onClick={() => void sendMessage()}
              disabled={(!input.trim() && !csvData) || loading}
              className="flex-shrink-0 h-8 w-8"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>

          <div className="flex items-center justify-between mt-2 px-1">
            <p className="text-xs text-zinc-700">
              Enter to send · Shift+Enter for new line
              {isTeacher && voice.isSupported && " · Mic for voice"}
            </p>
            {tts.isSpeaking && (
              <button onClick={tts.stop} className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
                <Volume2 className="h-3 w-3 animate-pulse" /> Speaking…
              </button>
            )}
          </div>

          {/* Voice error hint */}
          {isTeacher && voice.error && (
            <motion.div
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className="mt-1 flex items-center gap-2 text-xs text-amber-400 bg-amber-950/20 border border-amber-800/30 rounded-xl px-3 py-2"
            >
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              {voice.error === "no_permission" &&
                "Microphone access was blocked. Click the lock/camera icon in your browser's address bar, allow the microphone, then reload the page."}
              {voice.error === "no_speech" &&
                "No speech was detected. Make sure your microphone is connected and speak clearly after clicking the mic button."}
              {voice.error === "network" &&
                "Voice recognition network error. Check your internet connection and try again."}
              {voice.error === "not_supported" &&
                "Voice input isn't supported in this browser. Use Google Chrome or Microsoft Edge for voice features."}
              <button onClick={voice.clearError} className="ml-auto shrink-0"><X className="h-3.5 w-3.5" /></button>
            </motion.div>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}
