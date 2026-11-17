"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarPlus,
  Filter,
  Hand,
  Loader2,
  MessageCircle,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { refreshSummary } from "@/app/crm/inbox/actions";
import { NewLeadForm } from "./NewLeadForm";
import { ChannelIcon } from "./ChannelIcon";
import {
  CHANNEL_LABEL,
  CONVERSATION_SELECT,
  isReplyable,
  WINDOWED_CHANNELS,
  type Channel,
  type Conversation,
  type Message,
  type Patient,
  type Stage,
} from "@/types/db";
import { cn, fmtTime, formatPKR, initials, timeAgo } from "@/lib/utils";

const CHANNELS: Channel[] = ["whatsapp", "instagram", "facebook", "google", "tiktok", "website", "phone"];
const DAY_MS = 24 * 60 * 60 * 1000;

type AiStatus = { configured: boolean; clinicEnabled: boolean };

function normalise(row: Record<string, unknown>): Conversation {
  const p = row.patient;
  return { ...(row as unknown as Conversation), patient: (Array.isArray(p) ? p[0] : p) as Patient | null };
}

export function InboxClient({
  initialConversations,
  stages,
  initialActiveId,
  ai,
}: {
  initialConversations: Conversation[];
  stages: Stage[];
  initialActiveId: string | null;
  ai: AiStatus;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [conversations, setConversations] = useState(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(initialActiveId ?? initialConversations[0]?.id ?? null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [filter, setFilter] = useState<Channel | "all">("all");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileChatOpen, setMobileChatOpen] = useState(Boolean(initialActiveId));
  const [showNewLead, setShowNewLead] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summarising, startSummary] = useTransition();
  const activeRef = useRef(activeId);
  const bottomRef = useRef<HTMLDivElement>(null);
  const conversationsRef = useRef(conversations);
  activeRef.current = activeId;
  conversationsRef.current = conversations;
  const active = conversations.find((c) => c.id === activeId) ?? null;

  const patchConversation = (id: string, patch: Partial<Conversation>) =>
    setConversations((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  // Load the selected conversation's messages and mark it as read.
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    setLoadingMessages(true);
    setError(null);
    setSummaryError(null);
    supabase
      .from("messages")
      .select("id, conversation_id, sender, body, status, created_at")
      .eq("conversation_id", activeId)
      .order("created_at", { ascending: true })
      .limit(500)
      .then(({ data }) => {
        if (cancelled) return;
        setMessages((data ?? []) as Message[]);
        setLoadingMessages(false);
      });
    supabase.from("conversations").update({ unread_count: 0 }).eq("id", activeId).then(() => undefined);
    patchConversation(activeId, { unread_count: 0 });
    return () => {
      cancelled = true;
    };
  }, [activeId, supabase]);

  // Live updates from every channel: new messages, chat changes (AI switch, summary) and patient changes (lead score).
  useEffect(() => {
    const channel = supabase
      .channel("inbox-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const msg = payload.new as Message;
        if (msg.conversation_id === activeRef.current) {
          setMessages((list) => (list.some((m) => m.id === msg.id) ? list : [...list, msg]));
          if (msg.sender === "patient") {
            supabase.from("conversations").update({ unread_count: 0 }).eq("id", msg.conversation_id).then(() => undefined);
          }
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
        const msg = payload.new as Message;
        setMessages((list) => list.map((m) => (m.id === msg.id ? { ...m, status: msg.status } : m)));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, async (payload) => {
        const row = payload.new as Partial<Conversation> & { id?: string };
        if (!row?.id) return;
        if (!conversationsRef.current.some((c) => c.id === row.id)) {
          const { data } = await supabase.from("conversations").select(CONVERSATION_SELECT).eq("id", row.id).maybeSingle();
          if (data) setConversations((list) => [normalise(data), ...list.filter((c) => c.id !== data.id)]);
          return;
        }
        setConversations((list) =>
          list
            .map((c) =>
              c.id === row.id
                ? {
                    ...c,
                    last_message_text: row.last_message_text ?? c.last_message_text,
                    last_message_at: row.last_message_at ?? c.last_message_at,
                    last_patient_message_at: row.last_patient_message_at ?? c.last_patient_message_at,
                    unread_count: c.id === activeRef.current ? 0 : (row.unread_count ?? c.unread_count),
                    ai_receptionist: row.ai_receptionist ?? c.ai_receptionist,
                    ai_summary: row.ai_summary ?? c.ai_summary,
                    ai_summary_at: row.ai_summary_at ?? c.ai_summary_at,
                    needs_human: row.needs_human ?? c.needs_human,
                  }
                : c,
            )
            .sort((a, b) => +new Date(b.last_message_at) - +new Date(a.last_message_at)),
        );
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "patients" }, (payload) => {
        const p = payload.new as Patient;
        setConversations((list) => list.map((c) => (c.patient?.id === p.id ? { ...c, patient: { ...c.patient, ...p } } : c)));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, activeId]);

  const counts = useMemo(() => {
    const m = new Map<Channel, number>();
    for (const c of conversations) m.set(c.channel, (m.get(c.channel) ?? 0) + 1);
    return m;
  }, [conversations]);

  const visible = conversations.filter((c) => {
    if (filter !== "all" && c.channel !== filter) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return c.patient?.name.toLowerCase().includes(q) || c.patient?.phone?.includes(q) || c.last_message_text?.toLowerCase().includes(q);
  });

  const replyable = active ? isReplyable(active) : false;
  const windowClosed =
    Boolean(active && replyable && WINDOWED_CHANNELS.includes(active.channel)) &&
    (!active!.last_patient_message_at || Date.now() - new Date(active!.last_patient_message_at).getTime() > DAY_MS);

  const aiBlockedReason = !ai.configured
    ? "Add an AI key (AI_API_KEY) in .env to use the AI receptionist."
    : !ai.clinicEnabled
      ? "AI receptionist is off for the clinic. Turn it on in Settings."
      : !replyable
        ? "AI can't reply on this kind of chat. Call or WhatsApp the patient."
        : null;

  async function setAi(on: boolean) {
    if (!active) return;
    const id = active.id;
    const before = { ai_receptionist: active.ai_receptionist, needs_human: active.needs_human };
    patchConversation(id, { ai_receptionist: on, ...(on ? { needs_human: false } : {}) });
    const { error: e } = await supabase
      .from("conversations")
      .update({ ai_receptionist: on, ...(on ? { needs_human: false } : {}) })
      .eq("id", id);
    if (e) {
      patchConversation(id, before);
      setError(e.message);
    }
  }

  async function send() {
    if (!active || !draft.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/inbox/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: active.id, body: draft }),
      });
      const json = (await res.json()) as { message?: Message; aiPaused?: boolean; error?: string };
      if (!res.ok || !json.message) throw new Error(json.error || "Could not send");
      const sent = json.message;
      setMessages((list) => (list.some((m) => m.id === sent.id) ? list : [...list, sent]));
      patchConversation(active.id, { needs_human: false, ...(json.aiPaused ? { ai_receptionist: false } : {}) });
      setDraft("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function updatePatient(patch: Partial<Patient>) {
    if (!active?.patient) return;
    const id = active.patient.id;
    setConversations((list) => list.map((c) => (c.patient?.id === id ? { ...c, patient: { ...c.patient!, ...patch } } : c)));
    const { error: e } = await supabase.from("patients").update(patch).eq("id", id);
    if (e) setError(e.message);
  }

  function onRefreshSummary() {
    if (!active) return;
    const id = active.id;
    setSummaryError(null);
    startSummary(async () => {
      const res = await refreshSummary(id);
      if (!res.ok) {
        setSummaryError(res.error);
        return;
      }
      setConversations((list) =>
        list.map((c) =>
          c.id === id
            ? {
                ...c,
                ai_summary: res.summary,
                ai_summary_at: new Date().toISOString(),
                patient: c.patient
                  ? { ...c.patient, lead_score: res.lead_score ?? c.patient.lead_score, interest: res.interest || c.patient.interest }
                  : c.patient,
              }
            : c,
        ),
      );
    });
  }

  async function openNewConversation(id: string) {
    const { data } = await supabase.from("conversations").select(CONVERSATION_SELECT).eq("id", id).maybeSingle();
    if (data) setConversations((list) => [normalise(data), ...list.filter((c) => c.id !== id)]);
    setFilter("all");
    setActiveId(id);
    setMobileChatOpen(true);
    setShowNewLead(false);
  }

  const firstName = active?.patient?.name.split(" ")[0] ?? "Patient";

  return (
    <div className="flex h-[calc(100dvh-53px)] flex-col lg:h-screen">
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">Omnichannel Inbox</h1>
            <p className="text-sm text-slate-500">
              Every patient message, one inbox.{" "}
              {ai.configured && ai.clinicEnabled ? (
                <span className="font-medium text-brand-700">AI receptionist is on.</span>
              ) : (
                <Link href="/crm/settings#ai" className="font-medium text-brand-700 hover:underline">
                  Set up the AI receptionist
                </Link>
              )}
            </p>
          </div>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          <Chip active={filter === "all"} onClick={() => setFilter("all")} label="All channels" count={conversations.length} />
          {CHANNELS.map((ch) => (
            <Chip
              key={ch}
              active={filter === ch}
              onClick={() => setFilter(ch)}
              label={CHANNEL_LABEL[ch]}
              count={counts.get(ch) ?? 0}
              icon={<ChannelIcon channel={ch} />}
            />
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Conversation list */}
        <aside className={cn("w-full shrink-0 flex-col border-r border-slate-200 bg-white md:flex md:w-80", mobileChatOpen ? "hidden" : "flex")}>
          <div className="space-y-2 border-b border-slate-100 p-3">
            <div className="flex gap-2">
              <label className="relative block flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, phone or message" className="crm-input pl-9" />
              </label>
              <button
                type="button"
                onClick={() => setShowNewLead((v) => !v)}
                className={cn("crm-btn-outline px-2.5", showNewLead && "border-brand-400 text-brand-700")}
                aria-label="Log a new lead"
                title="Log a phone call or other lead"
              >
                {showNewLead ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              </button>
            </div>
            {showNewLead && <NewLeadForm onCreated={openNewConversation} />}
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {visible.length === 0 && <li className="p-6 text-center text-sm text-slate-500">No conversations.</li>}
            {visible.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveId(c.id);
                    setMobileChatOpen(true);
                  }}
                  className={cn(
                    "flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition",
                    c.id === activeId ? "bg-brand-50/70" : "hover:bg-slate-50",
                  )}
                >
                  <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-800">
                    {initials(c.patient?.name)}
                    <span className="absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-white">
                      <ChannelIcon channel={c.channel} />
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-ink">{c.patient?.name ?? "Unknown"}</span>
                      {c.ai_receptionist && ai.clinicEnabled && isReplyable(c) && (
                        <Sparkles className="h-3 w-3 shrink-0 text-brand-500" aria-label="AI on" />
                      )}
                      <span className="ml-auto shrink-0 text-[11px] text-slate-400">{timeAgo(c.last_message_at)}</span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-2">
                      <span className="truncate text-xs text-slate-500">{c.last_message_text}</span>
                      {c.needs_human && (
                        <span className="ml-auto shrink-0 rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-800">Needs reply</span>
                      )}
                      {c.unread_count > 0 && (
                        <span className={cn("shrink-0 rounded-full bg-brand-600 px-1.5 text-[10px] font-bold text-white", !c.needs_human && "ml-auto")}>
                          {c.unread_count}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Chat */}
        <section className={cn("min-w-0 flex-1 flex-col bg-slate-50", mobileChatOpen ? "flex" : "hidden md:flex")}>
          {!active ? (
            <div className="grid flex-1 place-items-center text-sm text-slate-500">Select a conversation</div>
          ) : (
            <>
              <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
                <button type="button" className="md:hidden" onClick={() => setMobileChatOpen(false)} aria-label="Back">
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <ChannelIcon channel={active.channel} size="md" />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{active.patient?.name}</p>
                  <p className="text-xs text-slate-500">{CHANNEL_LABEL[active.channel]}</p>
                </div>
                {active.source_tag && (
                  <span className="hidden rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 sm:inline">{active.source_tag}</span>
                )}
                <AiSwitch on={active.ai_receptionist} blockedReason={aiBlockedReason} onChange={setAi} />
              </header>

              {active.needs_human && (
                <p className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
                  <Hand className="h-4 w-4 shrink-0" />
                  The AI handed this chat to the team. Reply to the patient; switch AI back on when you want.
                </p>
              )}

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-6">
                {loadingMessages && (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                  </div>
                )}
                {messages.map((m) =>
                  m.sender === "system" ? (
                    <div key={m.id} className="flex justify-center">
                      <span className="rounded-full bg-slate-200/70 px-3 py-1 text-center text-[11px] font-medium text-slate-600">{m.body}</span>
                    </div>
                  ) : (
                    <div key={m.id} className={cn("flex", m.sender === "patient" ? "justify-start" : "justify-end")}>
                      <div
                        className={cn(
                          "max-w-[78%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                          m.sender === "patient" && "rounded-bl-md bg-white text-ink ring-1 ring-slate-100",
                          m.sender === "ai" && "rounded-br-md bg-brand-50 text-ink ring-1 ring-brand-100",
                          m.sender === "staff" && "rounded-br-md bg-brand-600 text-white",
                          m.sender === "automation" && "rounded-br-md bg-slate-100 text-ink ring-1 ring-slate-200",
                        )}
                      >
                        <p
                          className={cn(
                            "mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider",
                            m.sender === "staff" ? "text-brand-100" : m.sender === "ai" ? "text-brand-700" : "text-slate-400",
                          )}
                        >
                          {m.sender === "ai" && <Sparkles className="h-3 w-3" />}
                          {m.sender === "patient"
                            ? firstName
                            : m.sender === "ai"
                              ? "AI receptionist"
                              : m.sender === "automation"
                                ? "Automatic message"
                                : "Staff"}{" "}
                          · {fmtTime(m.created_at)}
                          {m.sender !== "patient" && m.status && (
                            <span className={cn("normal-case tracking-normal", m.status === "failed" && "text-red-500")}>· {m.status}</span>
                          )}
                        </p>
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      </div>
                    </div>
                  ),
                )}
                <div ref={bottomRef} />
              </div>

              <footer className="border-t border-slate-200 bg-white p-3">
                {windowClosed && (
                  <p className="mb-2 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    24 hours have passed since the patient&apos;s last message. Meta only allows an approved template now.
                  </p>
                )}
                {!replyable && (
                  <p className="mb-2 text-xs text-slate-500">
                    This lead came from {active.source_tag ?? CHANNEL_LABEL[active.channel]}. Call or WhatsApp the patient; anything you type here is
                    saved as a note.
                  </p>
                )}
                {replyable && active.ai_receptionist && !aiBlockedReason && (
                  <p className="mb-2 flex items-center gap-1.5 text-xs text-brand-700">
                    <Sparkles className="h-3.5 w-3.5" /> AI is answering this chat. If you reply, AI pauses here.
                  </p>
                )}
                {error && <p className="mb-2 text-xs font-medium text-red-600">{error}</p>}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void send();
                  }}
                  className="flex items-end gap-2"
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
                    placeholder={windowClosed ? "Reply window closed" : replyable ? "Reply as staff…  (Enter to send)" : "Add a note…"}
                    disabled={windowClosed}
                    className="crm-input max-h-40 min-h-[42px] flex-1 resize-y"
                  />
                  <button type="submit" disabled={sending || !draft.trim() || windowClosed} className="crm-btn h-[42px]">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    <span className="hidden sm:inline">{replyable ? "Send" : "Save"}</span>
                  </button>
                </form>
              </footer>
            </>
          )}
        </section>

        {/* Patient card */}
        {active?.patient && (
          <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-5 xl:block">
            <PatientCard
              conversation={active}
              patient={active.patient}
              stages={stages}
              onUpdate={updatePatient}
              onRefreshSummary={onRefreshSummary}
              summarising={summarising}
              summaryError={summaryError}
              aiConfigured={ai.configured}
            />
          </aside>
        )}
      </div>
    </div>
  );
}

function AiSwitch({ on, blockedReason, onChange }: { on: boolean; blockedReason: string | null; onChange: (on: boolean) => void }) {
  const blocked = Boolean(blockedReason);
  const checked = on && !blocked;
  return (
    <div className="ml-auto flex items-center gap-2" title={blockedReason ?? (checked ? "AI replies to this chat" : "AI is paused on this chat")}>
      <span className="hidden text-xs font-medium text-slate-500 sm:inline">AI receptionist</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label="AI receptionist for this chat"
        disabled={blocked}
        onClick={() => onChange(!on)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-brand-600" : "bg-slate-300",
          blocked ? "cursor-not-allowed opacity-50" : "hover:brightness-110",
        )}
      >
        <span className={cn("absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", checked && "translate-x-5")} />
      </button>
    </div>
  );
}

function Chip({ active, onClick, label, count, icon }: { active: boolean; onClick: () => void; label: string; count: number; icon?: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
        active ? "border-brand-500 bg-brand-50 text-brand-800" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
      )}
    >
      {icon}
      {label}
      <span className={cn("rounded-full px-1.5", active ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-500")}>{count}</span>
    </button>
  );
}

function PatientCard({
  conversation,
  patient,
  stages,
  onUpdate,
  onRefreshSummary,
  summarising,
  summaryError,
  aiConfigured,
}: {
  conversation: Conversation;
  patient: Patient;
  stages: Stage[];
  onUpdate: (patch: Partial<Patient>) => void;
  onRefreshSummary: () => void;
  summarising: boolean;
  summaryError: string | null;
  aiConfigured: boolean;
}) {
  const score = patient.lead_score;
  const firstStage = stages.find((s) => !s.is_side);
  return (
    <div>
      <div className="flex items-start gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-100 font-bold text-brand-800">{initials(patient.name)}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink">{patient.name}</p>
          <p className="font-mono text-xs text-slate-500">{patient.phone ? `+${patient.phone}` : "No phone"}</p>
        </div>
        {score != null && (
          <span
            title="Lead score (how likely to book)"
            className={cn(
              "grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-bold",
              score >= 80 ? "bg-rose-100 text-rose-700" : score >= 50 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600",
            )}
          >
            {score}
          </span>
        )}
      </div>

      <dl className="mt-5 space-y-3 text-sm">
        <Row label="Channel">{CHANNEL_LABEL[conversation.channel]}</Row>
        <Row label="Source">{conversation.source_tag ?? patient.source ?? "-"}</Row>
        <Row label="Stage">
          <select
            value={patient.stage_id ?? ""}
            onChange={(e) => onUpdate({ stage_id: e.target.value || null })}
            className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
          >
            <option value="">Not in pipeline</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Interest">{patient.interest ?? "-"}</Row>
        <Row label="Value">{formatPKR(patient.expected_value)}</Row>
      </dl>

      <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50 p-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-wider text-violet-700">AI summary</p>
          <button
            type="button"
            onClick={onRefreshSummary}
            disabled={summarising || !aiConfigured}
            className="rounded-full p-1 text-violet-600 transition hover:bg-violet-100 disabled:opacity-40"
            title={aiConfigured ? "Refresh summary" : "Add an AI key to use summaries"}
            aria-label="Refresh summary"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", summarising && "animate-spin")} />
          </button>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-violet-950">
          {conversation.ai_summary ??
            (aiConfigured ? "No summary yet. Tap refresh to summarise this chat." : "Add an AI key in .env to get automatic summaries.")}
        </p>
        {conversation.ai_summary_at && (
          <p className="mt-2 text-[10px] text-violet-500">
            Updated {timeAgo(conversation.ai_summary_at) === "now" ? "just now" : `${timeAgo(conversation.ai_summary_at)} ago`}
          </p>
        )}
        {summaryError && <p className="mt-2 text-xs font-medium text-red-600">{summaryError}</p>}
      </div>

      <div className="mt-4 space-y-2">
        <Link href={`/crm/appointments?patient=${patient.id}`} className="crm-btn w-full">
          <CalendarPlus className="h-4 w-4" /> Book appointment
        </Link>
        {patient.stage_id ? (
          <Link href="/crm/pipeline" className="crm-btn-outline w-full">
            <Filter className="h-4 w-4" /> View in pipeline
          </Link>
        ) : (
          <button
            type="button"
            className="crm-btn-outline w-full"
            disabled={!firstStage}
            onClick={() => firstStage && onUpdate({ stage_id: firstStage.id })}
          >
            <Filter className="h-4 w-4" /> Add to pipeline
          </button>
        )}
        {patient.phone && (
          <>
            <a href={`tel:+${patient.phone}`} className="crm-btn-outline w-full">
              <Phone className="h-4 w-4" /> Call patient
            </a>
            <a href={`https://wa.me/${patient.phone}`} target="_blank" rel="noopener noreferrer" className="crm-btn-outline w-full">
              <MessageCircle className="h-4 w-4" /> Open in WhatsApp
            </a>
          </>
        )}
        <Link href={`/crm/patients/${patient.id}`} className="block pt-2 text-center text-xs font-semibold text-brand-700 hover:underline">
          View full patient record
        </Link>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[84px_1fr] items-center gap-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-ink">{children}</dd>
    </div>
  );
}
