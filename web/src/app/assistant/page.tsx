"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, User, Sparkles, RotateCcw } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth";
import { cn, getInitials } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  createdAt?: string;
}

const QUICK_PROMPTS = [
  "What classes do I have today?",
  "Show my attendance status",
  "How does face recognition work?",
  "Request retake because my appearance changed",
  "What can you help me with?",
];

function MessageBubble({ msg, userName }: { msg: Message; userName: string }) {
  const isUser = msg.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}
    >
      <div className={cn(
        "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-semibold",
        isUser ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white" : "bg-gradient-to-br from-violet-600 to-pink-600 text-white"
      )}>
        {isUser ? getInitials(userName) : <Bot className="h-4 w-4" />}
      </div>
      <div className={cn(
        "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
        isUser
          ? "bg-indigo-600/20 border border-indigo-600/30 text-indigo-100"
          : "glass border-zinc-700/50 text-zinc-200"
      )}>
        {isUser ? (
          <p>{msg.content}</p>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0 text-zinc-200">{children}</p>,
                strong: ({ children }) => <strong className="text-zinc-100 font-semibold">{children}</strong>,
                em: ({ children }) => <em className="text-zinc-300 italic">{children}</em>,
                ul: ({ children }) => <ul className="list-disc list-inside space-y-1 text-zinc-300 mb-2">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 text-zinc-300 mb-2">{children}</ol>,
                li: ({ children }) => <li className="text-zinc-300">{children}</li>,
                // Prevent the Markdown lib from passing object children to <code>
                code: ({ children }) => (
                  <code className="px-1.5 py-0.5 rounded-md bg-zinc-800 text-indigo-300 text-xs font-mono">
                    {String(children ?? "")}
                  </code>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-indigo-500/40 pl-3 text-zinc-400 italic my-2">
                    {children}
                  </blockquote>
                ),
              }}
            >
              {typeof msg.content === "string" ? msg.content : ""}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function AssistantPage() {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/chat")
      .then((r) => r.json())
      .then((data) => {
        const msgs = (data.messages ?? []).map((m: { id: string; content: string; role: string; createdAt?: string }) => ({ ...m }));
        if (msgs.length === 0) {
          setMessages([{
            id: "welcome",
            role: "assistant",
            content: `Hello ${user?.name?.split(" ")[0] ?? "there"}! 👋 I'm your SCMS AI assistant. I can help you with timetable queries, attendance information, and navigating the system. What can I help you with today?`,
          }]);
        } else {
          setMessages(msgs);
        }
        setFetching(false);
      })
      .catch(() => setFetching(false));
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
      });
      const data = await r.json();
      // data.message is a ChatMessage object { id, content, role, ... }
      const raw = data.message;
      const assistantMsg: Message = {
        id: typeof raw === "object" && raw?.id ? String(raw.id) : (Date.now() + 1).toString(),
        role: "assistant",
        content:
          typeof raw === "object" && raw?.content
            ? String(raw.content)
            : typeof raw === "string"
            ? raw
            : "Sorry, I encountered an error. Please try again.",
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "assistant", content: "Network error. Please check your connection and try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto h-[calc(100vh-8rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600 to-pink-600 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-zinc-100">AI Assistant</h1>
              <p className="text-xs text-zinc-500">Context-aware SCMS helper</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setMessages([{
                id: "welcome",
                role: "assistant",
                content: "Chat cleared! How can I help you?",
              }]);
            }}
          >
            <RotateCcw className="h-4 w-4" />
            Clear
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2 min-h-0">
          {fetching ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
            </div>
          ) : (
            <AnimatePresence>
              {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} userName={user?.name ?? "User"} />
              ))}
            </AnimatePresence>
          )}

          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-pink-600 flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="glass rounded-2xl px-4 py-3">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </motion.div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick Prompts */}
        {messages.length <= 1 && (
          <div className="flex flex-wrap gap-2 my-4">
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => sendMessage(p)}
                className="text-xs px-3 py-2 rounded-xl border border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-all"
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="mt-4">
          <div className="flex items-end gap-3 glass rounded-2xl border border-zinc-700/50 p-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Ask about timetables, attendance, or type 'help'..."
              rows={1}
              className="flex-1 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 resize-none focus:outline-none max-h-32"
            />
            <Button
              size="icon"
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="flex-shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-zinc-700 text-center mt-2">Press Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
