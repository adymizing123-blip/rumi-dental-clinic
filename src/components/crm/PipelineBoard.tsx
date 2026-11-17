"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { Plus, Sparkles, X, Zap } from "lucide-react";
import { movePatient } from "@/app/crm/pipeline/actions";
import { createClient } from "@/lib/supabase/client";
import { ChannelIcon } from "./ChannelIcon";
import { NewLeadForm } from "./NewLeadForm";
import { AUTO_STAGE_RULE, CHANNEL_LABEL, sourceLabel, type Channel, type Patient, type Stage } from "@/types/db";
import { cn, dayLabel, formatPKR } from "@/lib/utils";

export type Lead = Pick<Patient, "id" | "name" | "phone" | "source" | "stage_id" | "interest" | "expected_value" | "lead_score" | "created_at"> & {
  channel: Channel | null;
  sourceTag: string | null;
  lastActivity: string;
  conversationId: string | null;
};

const HOT_SCORE = 85;
const CHANNEL_FILTERS: Channel[] = ["whatsapp", "instagram", "facebook", "google", "tiktok", "website", "phone"];

export function PipelineBoard({ stages, leads: initial }: { stages: Stage[]; leads: Lead[] }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [leads, setLeads] = useState(initial);
  const [source, setSource] = useState<Channel | "all">("all");
  const [showAdd, setShowAdd] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  // A small drag distance keeps clicks on the card working.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const leadsRef = useRef(leads);
  leadsRef.current = leads;

  useEffect(() => {
    setLeads(initial);
  }, [initial]);

  // Cards move by themselves when the AI, staff or the hourly job changes a lead.
  useEffect(() => {
    const channel = supabase
      .channel("pipeline-live")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "patients" }, (payload) => {
        const p = payload.new as Patient & { deleted_at?: string | null };
        if (!leadsRef.current.some((l) => l.id === p.id)) {
          if (p.stage_id && !p.deleted_at) router.refresh(); // a lead just entered the pipeline
          return;
        }
        setLeads((list) =>
          p.deleted_at || !p.stage_id
            ? list.filter((l) => l.id !== p.id)
            : list.map((l) =>
                l.id === p.id
                  ? { ...l, name: p.name, stage_id: p.stage_id, interest: p.interest, expected_value: p.expected_value, lead_score: p.lead_score }
                  : l,
              ),
        );
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "patients" }, () => router.refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, router]);

  function onDragEnd(e: DragEndEvent) {
    const leadId = String(e.active.id);
    const stageId = e.over ? String(e.over.id) : null;
    if (!stageId) return;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.stage_id === stageId) return;
    const previous = lead.stage_id;
    setLeads((list) => list.map((l) => (l.id === leadId ? { ...l, stage_id: stageId } : l)));
    start(async () => {
      const res = await movePatient(leadId, stageId);
      if ("error" in res && res.error) {
        setError(res.error);
        setLeads((list) => list.map((l) => (l.id === leadId ? { ...l, stage_id: previous } : l)));
      }
    });
  }

  const visible = source === "all" ? leads : leads.filter((l) => (l.channel ?? l.source) === source);
  const closedStageIds = new Set(stages.filter((s) => s.auto_key === "lost" || s.auto_key === "visited").map((s) => s.id));
  const openValue = visible.filter((l) => !closedStageIds.has(l.stage_id ?? "")).reduce((sum, l) => sum + Number(l.expected_value ?? 0), 0);

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-ink">Leads pipeline</h2>
          <p className="mt-1 text-sm text-slate-500">
            Every enquiry from every channel, scored by AI for buying intent. Open pipeline value:{" "}
            <span className="font-mono font-semibold text-ink">{formatPKR(openValue)}</span>
          </p>
          <button
            type="button"
            onClick={() => setShowRules((v) => !v)}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 transition hover:bg-brand-100"
          >
            <Zap className="h-3.5 w-3.5" /> Leads move automatically {showRules ? "· hide" : "· how?"}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <select value={source} onChange={(e) => setSource(e.target.value as Channel | "all")} className="crm-input w-44" aria-label="Filter by source">
            <option value="all">All sources</option>
            {CHANNEL_FILTERS.map((ch) => (
              <option key={ch} value={ch}>
                {CHANNEL_LABEL[ch]}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => setShowAdd((v) => !v)} className="crm-btn">
            {showAdd ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />} Add lead
          </button>
        </div>
      </div>

      {showRules && (
        <ul className="mt-4 grid gap-2 rounded-2xl border border-brand-100 bg-brand-50/50 p-4 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-3">
          {stages
            .filter((s) => s.auto_key)
            .map((s) => (
              <li key={s.id} className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
                <span>
                  <b className="text-ink">{s.name}:</b> {AUTO_STAGE_RULE[s.auto_key!]}
                </span>
              </li>
            ))}
          <li className="text-slate-500 sm:col-span-2 lg:col-span-3">You can still drag any card by hand.</li>
        </ul>
      )}

      {showAdd && (
        <div className="mt-4 max-w-sm">
          <NewLeadForm
            onCreated={() => {
              setShowAdd(false);
              router.refresh();
            }}
          />
        </div>
      )}

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="mt-5 flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => {
            const items = visible.filter((l) => l.stage_id === stage.id);
            return (
              <Column key={stage.id} stage={stage} count={items.length}>
                {items.map((l) => (
                  <LeadCard key={l.id} lead={l} />
                ))}
              </Column>
            );
          })}
        </div>
      </DndContext>
    </div>
  );
}

function Column({ stage, count, children }: { stage: Stage; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex w-[272px] shrink-0 flex-col rounded-2xl border bg-slate-50 transition-colors",
        isOver ? "border-brand-400 bg-brand-50" : "border-slate-200",
      )}
    >
      <header className="flex items-center gap-2 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: stage.color }} />
        <h3 className="truncate text-sm font-bold text-ink">{stage.name}</h3>
        {stage.auto_key && <Sparkles className="h-3 w-3 shrink-0 text-brand-400" aria-label="Automatic stage" />}
        <span className="ml-auto text-xs font-semibold text-slate-500">{count}</span>
      </header>
      <div className="flex min-h-[140px] flex-1 flex-col gap-2.5 px-2.5 pb-3">{children}</div>
    </section>
  );
}

function LeadCard({ lead }: { lead: Lead }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const score = lead.lead_score;
  const hot = score != null && score >= HOT_SCORE;
  const channel = lead.channel ?? (CHANNEL_FILTERS.includes(lead.source as Channel) ? (lead.source as Channel) : null);
  const href = lead.conversationId ? `/crm/inbox?c=${lead.conversationId}` : `/crm/patients/${lead.id}`;

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "cursor-grab rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition active:cursor-grabbing",
        isDragging ? "z-50 rotate-1 shadow-soft" : "hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md",
      )}
    >
      <div className="flex items-center gap-2">
        {channel && <ChannelIcon channel={channel} />}
        <Link href={href} className="min-w-0 flex-1 truncate text-sm font-bold text-ink hover:text-brand-700">
          {lead.name}
        </Link>
        {hot && <span className="shrink-0 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide text-rose-700">HOT</span>}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {lead.interest ?? "Interest not known yet"}
        {lead.expected_value != null && <span className="font-mono"> · {formatPKR(lead.expected_value)}</span>}
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">
          {lead.sourceTag ?? sourceLabel(lead.source)}
        </span>
        {score != null && (
          <span
            title="AI lead score"
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-bold",
              score >= 80 ? "bg-rose-50 text-rose-600" : score >= 60 ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600",
            )}
          >
            {score}
          </span>
        )}
        <span className="ml-auto text-[11px] text-slate-400">{dayLabel(lead.lastActivity)}</span>
      </div>
    </article>
  );
}
