"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { about } from "@/config/site";
import { SmartImage } from "@/components/ui-skeleton";
import { Reveal } from "./Reveal";

function BeforeAfter() {
  const [pos, setPos] = useState(50);
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-soft ring-1 ring-slate-200">
      <SmartImage src={about.after} alt="Teeth after whitening (dummy)" className="absolute inset-0" />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <SmartImage src={about.before} alt="Teeth before whitening (dummy)" className="h-full w-full" />
      </div>
      <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${pos}%` }}>
        <span className="absolute left-1/2 top-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-xs font-bold text-brand-700 shadow-soft">&lt;&gt;</span>
      </div>
      <span className="absolute left-4 top-4 rounded-full bg-ink/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur">Before</span>
      <span className="absolute right-4 top-4 rounded-full bg-brand-600/90 px-3 py-1 text-xs font-semibold text-white backdrop-blur">After</span>
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label="Compare before and after"
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
      />
    </div>
  );
}

export function About() {
  return (
    <section id="about" className="py-24 sm:py-32">
      <div className="container grid items-center gap-14 lg:grid-cols-2">
        <Reveal>
          <BeforeAfter />
          <p className="mt-3 text-center text-xs text-slate-500">{about.note}</p>
        </Reveal>
        <Reveal delay={0.1}>
          <span className="section-eyebrow">{about.eyebrow}</span>
          <h2 className="section-title mt-4">{about.title}</h2>
          <div className="mt-5 space-y-4 text-slate-600">
            {about.text.map((t) => (
              <p key={t} className="leading-relaxed">{t}</p>
            ))}
          </div>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {about.points.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-sm font-medium text-ink">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" /> {p}
              </li>
            ))}
          </ul>
          <a href="#book" className="btn-brand mt-8">Book an appointment</a>
        </Reveal>
      </div>
    </section>
  );
}
