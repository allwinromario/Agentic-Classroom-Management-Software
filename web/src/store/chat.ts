import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ChatMessage {
  id: string;
  content: string;
  role: "user" | "assistant";
  createdAt?: string;
}

export interface AgentAction {
  type: "marks_entered" | "attendance_marked" | "bulk_marks_entered" | "class_timing_updated";
  details: {
    message?: string;
    student?: string;
    subject?: string;
    status?: string;
    entriesAdded?: number;
    totalAdded?: number;
    entries?: Array<{ subject: string; score: number; maxScore: number; examType: string }>;
    timetableTitle?: string;
    previousTiming?: { day: string; start: string; end: string; lateThresholdMins: number };
    newTiming?: { day: string; start: string; end: string; lateThresholdMins: number };
    note?: string;
  };
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  actionsMap: Record<string, AgentAction[]>;
  createdAt: string;
  updatedAt: string;
}

interface ChatStore {
  sessions: ChatSession[];
  activeSessionId: string | null;

  createSession: (welcomeMsg?: ChatMessage) => string;
  setActiveSession: (id: string) => void;
  getActiveSession: () => ChatSession | null;

  addMessage: (msg: ChatMessage) => void;
  setMessages: (msgs: ChatMessage[]) => void;
  setActionsForMessage: (msgId: string, actions: AgentAction[]) => void;

  clearActiveSession: (welcomeMsg: ChatMessage) => void;
  deleteSession: (id: string) => void;
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,

      createSession: (welcomeMsg) => {
        const id = `session-${Date.now()}`;
        const now = new Date().toISOString();
        const session: ChatSession = {
          id,
          title: "New Chat",
          messages: welcomeMsg ? [welcomeMsg] : [],
          actionsMap: {},
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({
          sessions: [session, ...s.sessions].slice(0, 50),
          activeSessionId: id,
        }));
        return id;
      },

      setActiveSession: (id) => {
        set({ activeSessionId: id });
      },

      getActiveSession: () => {
        const { sessions, activeSessionId } = get();
        return sessions.find((s) => s.id === activeSessionId) ?? null;
      },

      addMessage: (msg) => {
        const { activeSessionId } = get();
        if (!activeSessionId) return;
        set((s) => {
          const now = new Date().toISOString();
          return {
            sessions: s.sessions.map((session) => {
              if (session.id !== activeSessionId) return session;
              const msgs = [...session.messages, msg];
              const firstUserMsg = msgs.find((m) => m.role === "user");
              const title = firstUserMsg
                ? firstUserMsg.content.slice(0, 40) + (firstUserMsg.content.length > 40 ? "…" : "")
                : session.title;
              return { ...session, messages: msgs, title, updatedAt: now };
            }),
          };
        });
      },

      setMessages: (msgs) => {
        const { activeSessionId } = get();
        if (!activeSessionId) return;
        set((s) => ({
          sessions: s.sessions.map((session) =>
            session.id === activeSessionId
              ? { ...session, messages: msgs, updatedAt: new Date().toISOString() }
              : session
          ),
        }));
      },

      setActionsForMessage: (msgId, actions) => {
        const { activeSessionId } = get();
        if (!activeSessionId) return;
        set((s) => ({
          sessions: s.sessions.map((session) =>
            session.id === activeSessionId
              ? { ...session, actionsMap: { ...session.actionsMap, [msgId]: actions } }
              : session
          ),
        }));
      },

      clearActiveSession: (welcomeMsg) => {
        const { activeSessionId } = get();
        if (!activeSessionId) return;
        set((s) => ({
          sessions: s.sessions.map((session) =>
            session.id === activeSessionId
              ? {
                  ...session,
                  messages: [welcomeMsg],
                  actionsMap: {},
                  title: "New Chat",
                  updatedAt: new Date().toISOString(),
                }
              : session
          ),
        }));
      },

      deleteSession: (id) => {
        set((s) => {
          const sessions = s.sessions.filter((session) => session.id !== id);
          const activeSessionId =
            s.activeSessionId === id ? (sessions[0]?.id ?? null) : s.activeSessionId;
          return { sessions, activeSessionId };
        });
      },
    }),
    {
      name: "scms-chat-sessions",
    }
  )
);
