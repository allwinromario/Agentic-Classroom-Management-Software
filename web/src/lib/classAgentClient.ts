import { z } from "zod";

const responseSchema = z.object({
  reply: z.string().min(1),
  sessionId: z.string().min(1),
  meta: z
    .object({
      fallbackUsed: z.boolean().optional(),
      durationMs: z.number().int().nonnegative().optional(),
    })
    .optional(),
});

export class ClassAgentClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClassAgentClientError";
  }
}

const SERVICE_URL = process.env.CLASS_AGENT_SERVICE_URL ?? "http://localhost:8001";
const TIMEOUT_MS = Number(process.env.CLASS_AGENT_TIMEOUT_MS ?? "30000");

export interface ClassAgentChatInput {
  userId: string;
  message: string;
  conversationId?: string;
}

export interface ClassAgentChatResult {
  reply: string;
  sessionId: string;
}

export async function sendToClassAgent(input: ClassAgentChatInput): Promise<ClassAgentChatResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${SERVICE_URL}/agent/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: controller.signal,
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = typeof json?.detail === "string" ? json.detail : "service unavailable";
      throw new ClassAgentClientError(`Class agent request failed: ${detail}`);
    }

    const parsed = responseSchema.safeParse(json);
    if (!parsed.success) {
      throw new ClassAgentClientError("Class agent response format invalid");
    }

    return {
      reply: parsed.data.reply,
      sessionId: parsed.data.sessionId,
    };
  } catch (error) {
    if (error instanceof ClassAgentClientError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new ClassAgentClientError("Class agent request timed out");
    }

    throw new ClassAgentClientError("Class agent is unreachable");
  } finally {
    clearTimeout(timer);
  }
}
