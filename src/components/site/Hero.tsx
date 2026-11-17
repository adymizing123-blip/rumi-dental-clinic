"use client";

import { motion, type Variants } from "framer-motion";
import { ArrowRight, CalendarCheck, Clock, HeartPulse, Phone, ShieldCheck, Star, Wallet } from "lucide-react";
import { doctors, site } from "@/config/site";
import { Counter } from "./Counter";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: 0.1 + i * 0.1, duration: 0.7, ease: [0.21, 0.6, 0.35, 1] } }),
};

/** Splits the title so the highlighted words can be shown in the brand colour with an underline. */
function Title() {
  const { title, titleHighlight } = site.hero;
  const at = titleHighlight ? title.indexOf(titleHighlight) : -1;
  if (at < 0) return <>{title}</>;
  return (
    <>
      {title.slice(0, at)}
      <span className="relative whitespace-nowrap text-brand-600">
        {titleHighlight}
        <svg
          aria-hidden="true"
          viewBox="0 0 300 12"
          preserveAspectRatio="none"
          className="absolute -bottom-2 left-0 h-3 w-full text-brand-200"
        >
          <path d="M2 9c60-6 140-8 296-3" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        </svg>
      </span>
      {title.slice(at + titleHighlight.length)}
    </>
  );
}

/**
 * Light split hero: text and actions on the left, a framed photo with floating info cards on the right.
 */
export function Hero() {
  const lead = doctors[0];
  const trust = [
    { icon: ShieldCheck, label: "Sterilised every visit" },
    { icon: Wallet, label: "Clear prices upfront" },
    { icon: Clock, label: `Open ${site.timings[0].days.replace(" to ", " – ")}` },
  ];

  return (
    <section className="relative isolate overflow-hidden bg-gradient-to-b from-brand-50 via-white to-white pb-20 pt-32 sm:pt-36 lg:pb-28 lg:pt-44">
      {/* Soft background shapes */}
      <div aria-hidden className="absolute -right-40 -top-40 -z-10 h-[560px] w-[560px] rounded-full bg-brand-100/70 blur-3xl" />
      <div aria-hidden className="absolute -left-32 top-1/2 -z-10 h-80 w-80 rounded-full bg-sky-100/60 blur-3xl" />
      <div
        aria-hidden
        className="absolute right-0 top-28 -z-10 hidden h-64 w-64 opacity-60 lg:block"
        style={{ backgroundImage: "radial-gradient(#bcd5ff 1.5px, transparent 1.5px)", backgroundSize: "18px 18px" }}
      />

      <div className="container grid items-center gap-16 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
        {/* Left: copy and actions */}
        <div className="max-w-2xl">
          <motion.span
            custom={0}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-brand-700 shadow-sm ring-1 ring-brand-100"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            {site.hero.eyebrow}
          </motion.span>

          <motion.h1
            custom={1}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="mt-6 font-display text-4xl font-extrabold leading-[1.1] tracking-tight text-ink sm:text-5xl lg:text-6xl"
          >
            <Title />
          </motion.h1>

          <motion.p custom={2} variants={fadeUp} initial="hidden" animate="show" className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
            {site.hero.subtitle}
          </motion.p>

          <motion.div custom={3} variants={fadeUp} initial="hidden" animate="show" className="mt-9 flex flex-wrap gap-3">
            <a href="#book" className="btn-brand group px-6 py-3.5 text-base shadow-lg shadow-brand-600/25">
              <CalendarCheck className="h-5 w-5" /> Book an appointment
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
            <a href={`tel:${site.phone.replace(/\s/g, "")}`} className="btn-outline px-6 py-3.5 text-base">
              <Phone className="h-4 w-4" /> {site.phone}
            </a>
          </motion.div>

          <motion.ul custom={4} variants={fadeUp} initial="hidden" animate="show" className="mt-10 grid gap-3 sm:grid-cols-3">
            {trust.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2.5 text-sm font-medium text-slate-700">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-brand-600 shadow-sm ring-1 ring-slate-200/80">
                  <Icon className="h-4 w-4" />
                </span>
                {label}
              </li>
            ))}
          </motion.ul>

          {site.stats.length > 0 && (
            <motion.dl
              custom={5}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="mt-10 grid max-w-lg grid-cols-3 gap-6 border-t border-slate-200 pt-8"
            >
              {site.stats.map((s) => (
                <div key={s.label}>
                  <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">{s.label}</dt>
                  <dd className="mt-1 font-display text-2xl font-bold text-ink sm:text-3xl">
                    <Counter value={s.value} suffix={s.suffix} decimals={s.decimals ?? 0} />
                  </dd>
                </div>
              ))}
            </motion.dl>
          )}
        </div>

        {/* Right: framed photo with floating cards */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.8, ease: [0.21, 0.6, 0.35, 1] }}
          className="relative mx-auto w-full max-w-md lg:max-w-none"
        >
          {/* Brand slab behind the photo */}
          <div aria-hidden className="absolute -inset-3 rotate-3 rounded-[2.5rem] bg-gradient-to-br from-brand-500 to-brand-700 sm:-inset-4" />

          <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] bg-brand-100 shadow-soft ring-8 ring-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={site.hero.image} alt={site.hero.imageAlt} fetchPriority="high" className="h-full w-full object-cover" />
            <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink/40 to-transparent" />
          </div>

          {/* Card: online booking */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="absolute -left-4 bottom-10 w-60 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-200/70 sm:-left-10"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-600 text-white">
                <CalendarCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">Book online</p>
                <p className="text-xs text-slate-500">Confirmed on WhatsApp</p>
              </div>
            </div>
          </motion.div>

          {/* Card: rating if available, otherwise emergency help */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.6 }}
            className="absolute -right-3 top-8 w-56 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-200/70 motion-safe:animate-float sm:-right-8"
          >
            {site.rating ? (
              <>
                <div className="flex items-center gap-0.5 text-amber-400">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="mt-1.5 text-sm font-semibold text-ink">Rated {site.rating} by patients</p>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-rose-50 text-rose-500">
                  <HeartPulse className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">Toothache?</p>
                  <p className="text-xs text-slate-500">Same-day emergency help</p>
                </div>
              </div>
            )}
          </motion.div>

          {/* Card: lead dentist */}
          {lead && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.2, duration: 0.6 }}
              className="absolute -bottom-6 right-6 hidden items-center gap-3 rounded-full bg-white py-2 pl-2 pr-5 shadow-soft ring-1 ring-slate-200/70 sm:flex"
            >
              <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 font-display text-sm font-bold text-white">
                {lead.initials}
              </span>
              <div>
                <p className="text-sm font-semibold leading-tight text-ink">{lead.name}</p>
                <p className="text-xs text-slate-500">{lead.role}</p>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
