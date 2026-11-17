"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, MessageCircle, MessagesSquare, Send, X } from "lucide-react";
import { site, whatsappLink } from "@/config/site";
import { cn, fmtTime } from "@/lib/utils";

type ChatMessage = { id: string; sender: "patient" | "staff" | "ai"; body: string | null; created_at: string };

const TOKEN_KEY = `${site.shortName.toLowerCase()}-chat-token`;
const POLL_OPEN_MS = 3000;
const POLL_CLOSED_MS = 20000;

function readToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null) {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Private mode: the chat still works until the page is closed.
  }
}

/** Website live chat. Messages go to the CRM inbox ("Website chat"); replies come from staff or the AI receptionist. */
export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [aiOn, setAiOn] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [unread, setUnread] = useState(0);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastAt = useRef<string | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  openRef.current = open;

  const merge = useCallback((incoming: ChatMessage[]) => {
    if (!incoming.length) return;
    const firstLoad = lastAt.current === null;
    lastAt.current = incoming[incoming.length - 1]!.created_at;
    const seen = new Set(messagesRef.current.map((m) => m.id));
    const fresh = incoming.filter((m) => !seen.has(m.id));
    if (!fresh.length) return;
    messagesRef.current = [...messagesRef.current, ...fresh];
    setMessages(messagesRef.current);
    const replies = fresh.filter((m) => m.sender !== "patient").length;
    if (replies) {
      setWaiting(false);
      if (!openRef.current && !firstLoad) setUnread((n) => n + replies);
    }
  }, []);

  // Resume an earlier chat from this browser.
  useEffect(() => {
    setToken(readToken());
  }, []);

  const poll = useCallback(async () => {
    if (!token) return;
    const qs = new URLSearchParams({ token });
    if (lastAt.current) qs.set("after", lastAt.current);
    const res = await fetch(`/api/chat?${qs}`, { cache: "no-store" }).catch(() => null);
    if (!res) return;
    if (res.status === 404) {
      writeToken(null);
      setToken(null);
      messagesRef.current = [];
      setMessages([]);
      lastAt.current = null;
      return;
    }
    if (!res.ok) return;
    const json = (await res.json()) as { messages: ChatMessage[]; ai: boolean };
    setAiOn(json.ai);
    merge(json.messages);
  }, [token, merge]);

  useEffect(() => {
    if (!token) return;
    void poll();
    const id = window.setInterval(() => void poll(), open ? POLL_OPEN_MS : POLL_CLOSED_MS);
    return () => window.clearInterval(id);
  }, [token, open, poll]);

  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, waiting, open]);

  // Stop the typing dots if nobody answers within 25 seconds.
  useEffect(() => {
    if (!waiting) return;
    const id = window.setTimeout(() => setWaiting(false), 25000);
    return () => window.clearTimeout(id);
  }, [waiting]);

  async function start(form: HTMLFormElement) {
    const fd = new FormData(form);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          name: fd.get("name"),
          phone: fd.get("phone"),
          text: fd.get("text"),
          company: fd.get("company"),
        }),
      });
      const json = (await res.json()) as { token?: string; messages?: ChatMessage[]; ai?: boolean; error?: string };
      if (!res.ok || !json.token) throw new Error(json.error || "Could not start the chat.");
      writeToken(json.token);
      setToken(json.token);
      setAiOn(Boolean(json.ai));
      merge(json.messages ?? []);
      setWaiting(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    const text = draft.trim();
    if (!text || !token || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", token, text }),
      });
      const json = (await res.json()) as { message?: ChatMessage; error?: string };
      if (!res.ok || !json.message) throw new Error(json.error || "Message not sent.");
      merge([json.message]);
      setDraft("");
      setWaiting(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.section
            role="dialog"
            aria-label={`Chat with ${site.name}`}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className="fixed inset-x-3 bottom-24 z-50 flex max-h-[min(600px,calc(100dvh-120px))] origin-bottom-right flex-col overflow-hidden rounded-3xl bg-white shadow-[0_30px_80px_-20px_rgba(17,29,61,0.45)] ring-1 ring-slate-200 sm:inset-x-auto sm:right-6 sm:w-[380px]"
          >
            <header className="relative overflow-hidden bg-gradient-to-br from-brand-950 via-brand-800 to-brand-600 px-5 pb-5 pt-4 text-white">
              <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-bold">{site.name}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-brand-100">
                    <span className="h-2 w-2 rounded-full bg-emerald-300" />
                    {aiOn ? "Replies in a few seconds" : "Our front desk usually replies within minutes"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full p-1.5 text-white/80 transition hover:bg-white/10 hover:text-white"
                  aria-label="Close chat"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </header>

            {!token ? (
              <form
                className="space-y-3 overflow-y-auto p-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  void start(e.currentTarget);
                }}
              >
                <p className="text-sm text-slate-600">
                  Assalam o alaikum! Ask about treatments, prices or a time to visit. Share your name and number so we can follow up.
                </p>
                <input name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
                <input name="name" required minLength={2} placeholder="Your name" autoComplete="name" className="input" />
                <input name="phone" required inputMode="tel" placeholder="Mobile number (03xx xxxxxxx)" autoComplete="tel" className="input" />
                <textarea name="text" required rows={3} maxLength={1000} placeholder="How can we help?" className="input resize-none" />
                {error && <p className="text-xs font-medium text-red-600">{error}</p>}
                <button type="submit" disabled={busy} className="btn btn-brand w-full justify-center">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Start chat
                </button>
              </form>
            ) : (
              <>
                <div className="min-h-[260px] flex-1 space-y-2.5 overflow-y-auto bg-slate-50 px-4 py-4">
                  {messages.map((m) => {
                    const mine = m.sender === "patient";
                    return (
                      <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                        <div
                          className={cn(
                            "max-w-[82%] rounded-2xl px-3.5 py-2 text-sm shadow-sm",
                            mine ? "rounded-br-md bg-brand-600 text-white" : "rounded-bl-md bg-white text-ink ring-1 ring-slate-100",
                          )}
                        >
                          <p className="whitespace-pre-wrap break-words">{m.body}</p>
                          <p className={cn("mt-0.5 text-right text-[10px]", mine ? "text-brand-100" : "text-slate-400")}>
                            {fmtTime(m.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {waiting && aiOn && (
                    <div className="flex justify-start" aria-label="Typing">
                      <div className="flex gap-1 rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm ring-1 ring-slate-100">
                        {[0, 1, 2].map((i) => (
                          <motion.span
                            key={i}
                            className="h-1.5 w-1.5 rounded-full bg-slate-400"
                            animate={{ y: [0, -4, 0] }}
                            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>
                <div className="border-t border-slate-100 bg-white p-3">
                  {error && <p className="mb-2 text-xs font-medium text-red-600">{error}</p>}
                  <form
                    className="flex items-end gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void send();
                    }}
                  >
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void send();
                        }
                      }}
                      rows={1}
                      maxLength={1000}
                      placeholder="Type a message…"
                      className="input max-h-28 min-h-[44px] flex-1 resize-none py-2.5"
                    />
                    <button
                      type="submit"
                      disabled={busy || !draft.trim()}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-600 text-white transition hover:bg-brand-700 disabled:opacity-50"
                      aria-label="Send"
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                  </form>
                  <a
                    href={whatsappLink()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-[#128C7E]"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> Prefer WhatsApp? Continue there
                  </a>
                </div>
              </>
            )}
          </motion.section>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1.2, type: "spring", stiffness: 220, damping: 16 }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.95 }}
        aria-label={open ? "Close chat" : "Chat with us"}
        aria-expanded={open}
        className="fixed bottom-6 right-6 z-50 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-800 text-white shadow-glow"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={open ? "x" : "chat"}
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {open ? <X className="h-6 w-6" /> : <MessagesSquare className="h-6 w-6" />}
          </motion.span>
        </AnimatePresence>
        {unread > 0 && !open && (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[11px] font-bold">
            {unread}
          </span>
        )}
      </motion.button>
    </>
  );
}
