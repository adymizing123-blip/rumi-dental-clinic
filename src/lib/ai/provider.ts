import "server-only";

/**
 * Minimal LLM client using fetch, so no extra npm packages are needed.
 *
 *   AI_PROVIDER=anthropic (default)  -> Claude API
 *   AI_PROVIDER=openai               -> any OpenAI-compatible API (OpenAI, Gemini, Groq, OpenRouter...)
 *                                       set AI_BASE_URL for non-OpenAI providers
 */
const PROVIDER = (process.env.AI_PROVIDER || "anthropic").toLowerCase();
const TIMEOUT_MS = 30_000;

export function aiConfigured() {
  if (!process.env.AI_API_KEY) return false;
  // OpenAI-compatible providers have no sensible default model name.
  return PROVIDER === "anthropic" || Boolean(process.env.AI_MODEL);
}

export function aiModelLabel() {
  if (!aiConfigured()) return null;
  return `${PROVIDER === "anthropic" ? "Claude" : "OpenAI-compatible"} · ${modelName()}`;
}

function modelName() {
  return process.env.AI_MODEL || (PROVIDER === "anthropic" ? "claude-haiku-5-5" : "");
}

/** Sends one system prompt + one user message and returns the model's text. */
export async function complete({ system, user, maxTokens = 1200 }: { system: string; user: string; maxTokens?: number }) {
  if (!aiConfigured()) throw new Error("AI is not configured. Add AI_API_KEY (and AI_MODEL) to .env.local.");
  return PROVIDER === "anthropic" ? anthropic(system, user, maxTokens) : openaiCompatible(system, user, maxTokens);
}

async function anthropic(system: string, user: string, maxTokens: number) {
  const res = await fetch(`${process.env.AI_BASE_URL || "https://api.anthropic.com"}/v1/messages`, {
    method: "POST",
    headers: {
      "x-api-key": process.env.AI_API_KEY as string,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: modelName(),
      max_tokens: maxTokens,
      temperature: 0.3,
      system,
      messages: [{ role: "user", content: user }],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const json = (await res.json().catch(() => ({}))) as {
    content?: { type: string; text?: string }[];
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(`AI error ${res.status}: ${json.error?.message ?? "request failed"}`);
  return (json.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
}

async function openaiCompatible(system: string, user: string, maxTokens: number) {
  const base = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.AI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelName(),
      max_tokens: maxTokens,
      temperature: 0.3,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const json = (await res.json().catch(() => ({}))) as {
    choices?: { message?: { content?: string | null } }[];
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(`AI error ${res.status}: ${json.error?.message ?? "request failed"}`);
  return json.choices?.[0]?.message?.content ?? "";
}

/** Pulls the first JSON object out of a model reply (models sometimes wrap it in ```json fences). */
export function parseJsonObject<T>(text: string): T | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
