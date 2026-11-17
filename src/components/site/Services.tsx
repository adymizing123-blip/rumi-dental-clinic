"use client";

import { useRef, type MouseEvent } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  ArrowUpRight,
  Activity,
  Baby,
  Bone,
  Crown,
  HeartPulse,
  Layers,
  ShieldPlus,
  Siren,
  Smile,
  Sparkles,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import { services } from "@/config/site";
import { formatPKR } from "@/lib/utils";
import { Reveal } from "./Reveal";

const ICONS: Record<string, LucideIcon> = {
  stethoscope: Stethoscope,
  sparkles: Sparkles,
  smile: Smile,
  shield: ShieldPlus,
  heart: HeartPulse,
  baby: Baby,
  crown: Crown,
  siren: Siren,
  layers: Layers,
  bone: Bone,
  activity: Activity,
};

/** Card that tilts toward the cursor and shows a soft spotlight where the mouse is. */
function TiltCard({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(my, [0, 1], [6, -6]), { stiffness: 200, damping: 18 });
  const rotateY = useSpring(useTransform(mx, [0, 1], [-6, 6]), { stiffness: 200, damping: 18 });
  const spotlight = useTransform(
    [mx, my],
    ([x, y]: number[]) => `radial-gradient(320px circle at ${x * 100}% ${y * 100}%, rgba(90,147,245,0.16), transparent 60%)`,
  );

  function onMove(e: MouseEvent<HTMLDivElement>) {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    mx.set((e.clientX - r.left) / r.width);
    my.set((e.clientY - r.top) / r.height);
  }
  function onLeave() {
    mx.set(0.5);
    my.set(0.5);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      className="group relative h-full overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm transition-shadow duration-500 hover:shadow-soft"
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: spotlight }}
      />
      {children}
    </motion.div>
  );
}

export function Services() {
  return (
    <section id="services" className="relative py-24 sm:py-32">
      <div className="container">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="section-eyebrow">Our treatments</span>
          <h2 className="section-title mt-4">Everything your smile needs, in one clinic</h2>
          <p className="mt-4 text-lg text-slate-600">
            From routine check-ups to complete smile makeovers, planned with modern scans and explained in plain words.
          </p>
        </Reveal>

        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {services.map((s, i) => {
            const Icon = ICONS[s.icon] ?? Smile;
            return (
              <Reveal key={s.key} delay={(i % 4) * 0.08}>
                <TiltCard>
                  <div className="relative">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700 transition-all duration-500 group-hover:scale-110 group-hover:bg-brand-600 group-hover:text-white">
                      <Icon className="h-6 w-6" />
                    </span>
                    <h3 className="mt-5 font-display text-lg font-bold text-ink">{s.name}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.desc}</p>
                    <ul className="mt-4 space-y-1.5 text-xs text-slate-600">
                      {s.points.map((pt) => (
                        <li key={pt} className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />{pt}</li>
                      ))}
                    </ul>
                    <p className="mt-4 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{s.time}</p>
                    <div className="mt-5 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500">
                        From <span className="text-brand-700">{formatPKR(s.from)}</span>
                      </span>
                      <a
                        href="#book"
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-all duration-300 group-hover:rotate-45 group-hover:border-brand-600 group-hover:bg-brand-600 group-hover:text-white"
                        aria-label={`Book ${s.name}`}
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                </TiltCard>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
