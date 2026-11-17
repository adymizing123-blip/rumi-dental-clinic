"use client";

import { motion, type Variants } from "framer-motion";
import { CalendarCheck, Clock, Phone, ShieldCheck, Star } from "lucide-react";
import { doctors, site } from "@/config/site";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: 0.08 + i * 0.08, duration: 0.8, ease: [0.16, 1, 0.3, 1] } }),
};

/** Shows the highlighted words of the title in the brand colour. */
function Title() {
  const { title, titleHighlight } = site.hero;
  const at = titleHighlight ? title.indexOf(titleHighlight) : -1;
  if (at < 0) return <>{title}</>;
  return (
    <>
      {title.slice(0, at)}
      <span className="text-brand-600">{titleHighlight}</span>
      {title.slice(at + titleHighlight.length)}
    </>
  );
}

/**
 * Centred hero (as in the Pearl Dental demo): clinic pill, headline, actions and a trust line,
 * then a wide photo banner with small cards resting on its bottom edge.
 */
export function Hero() {
  const lead = doctors[0];
  const hours = site.timings[0];
  const cards = [
    { icon: ShieldCheck, title: "Sterilised every visit", text: "Hospital-grade hygiene" },
    { icon: CalendarCheck, title: "Book online", text: "Confirmed on WhatsApp" },
    { icon: Clock, title: hours.days.replace(" to ", " – "), text: hours.hours.replace(" to ", " – ") },
  ];

  return (
    <section className="relative isolate overflow-hidden bg-brand-50 pb-16 pt-32 sm:pt-36 lg:pt-40">
      <div aria-hidden className="hero-grid absolute inset-0 -z-10" />

      <div className="container">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <motion.p
            custom={0}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="inline-flex items-center gap-2 rounded-full bg-white py-1.5 pl-3 pr-4 text-sm font-semibold text-slate-700 shadow-sm"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            {site.name}
            <span className="hidden text-slate-500 sm:inline">· {site.city}</span>
          </motion.p>

          <motion.h1
            custom={1}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="mt-6 max-w-[15ch] font-display text-[2.6rem] font-extrabold leading-[1.05] text-ink sm:text-6xl lg:text-[4.2rem]"
          >
            <Title />
          </motion.h1>

          <motion.p custom={2} variants={fadeUp} initial="hidden" animate="show" className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
            {site.hero.subtitle}
          </motion.p>

          <motion.div custom={3} variants={fadeUp} initial="hidden" animate="show" className="mt-9 flex w-full flex-wrap justify-center gap-3">
            <a href="#book" className="btn-brand px-6 text-base shadow-lg shadow-brand-600/30">
              <CalendarCheck className="h-5 w-5" /> Book appointment
            </a>
            <a href={`tel:${site.phone.replace(/\s/g, "")}`} className="btn-outline px-6 text-base">
              <Phone className="h-4 w-4" /> Call {site.phone}
            </a>
          </motion.div>

          <motion.div custom={4} variants={fadeUp} initial="hidden" animate="show" className="mt-8 flex items-center gap-3 text-left">
            {lead && (
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-600 font-display text-sm font-bold text-white ring-4 ring-white">
                {lead.initials}
              </span>
            )}
            <p className="text-sm leading-snug text-slate-600">
              {site.rating ? (
                <>
                  <span className="mr-1 inline-flex translate-y-0.5 gap-0.5 text-amber-400">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-current" />
                    ))}
                  </span>
                  <strong className="text-ink">{site.rating}</strong> average rating
                </>
              ) : (
                <>
                  <strong className="text-ink">{lead ? `${lead.name}` : site.name}</strong> and team
                </>
              )}
              <br />
              Clear prices before any treatment
            </p>
          </motion.div>
        </div>

        {/* Wide photo banner */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="relative mt-12 sm:mt-16"
        >
          <div className="aspect-[4/3] overflow-hidden rounded-[2rem] bg-brand-100 shadow-lift sm:aspect-[21/9]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={site.hero.image} alt={site.hero.imageAlt} fetchPriority="high" className="h-full w-full object-cover" />
          </div>

          <div className="absolute inset-x-0 -bottom-9 flex justify-center gap-4 px-3">
            {cards.map(({ icon: Icon, title, text }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + i * 0.12, duration: 0.6 }}
                className={`flex items-center gap-3 rounded-2xl bg-white/95 px-4 py-3 shadow-lift backdrop-blur ${i === 2 ? "hidden md:flex" : i === 1 ? "hidden sm:flex" : ""}`}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-600 text-white">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-left">
                  <span className="block text-sm font-semibold leading-tight text-ink">{title}</span>
                  <span className="block text-xs text-slate-500">{text}</span>
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
