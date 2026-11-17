"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, CalendarCheck, MessageCircle, ShieldCheck, Star } from "lucide-react";
import { site, whatsappLink } from "@/config/site";
import { Counter } from "./Counter";

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: 0.15 + i * 0.12, duration: 0.8, ease: [0.21, 0.6, 0.35, 1] } }),
};

/**
 * Full-bleed hero: the video fills the whole section, and a brand gradient covers the left side
 * and fades out toward the right, so the text sits on colour and the video plays on the right.
 */
export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const videoY = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const textY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);

  return (
    <section ref={ref} className="relative isolate flex min-h-[100svh] items-center overflow-hidden bg-brand-950">
      {/* Background video (right side visible through the gradient) */}
      <motion.div style={reduce ? undefined : { y: videoY }} className="absolute inset-0 -z-20">
        <video
          className="h-full w-full object-cover"
          src={site.hero.video}
          poster={site.hero.poster}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
        />
      </motion.div>

      {/* Left gradient that fades into the video */}
      <div className="grain absolute inset-0 -z-10 bg-[linear-gradient(100deg,#111d3d_0%,#1c3267_28%,rgba(37,88,201,0.88)_48%,rgba(53,115,232,0.35)_68%,rgba(17,29,61,0)_85%)]" />
      {/* Slow-moving colour glow for depth */}
      <div className="absolute -left-40 top-1/4 -z-10 h-[520px] w-[520px] rounded-full bg-brand-400/30 blur-[120px] motion-safe:animate-float" />
      {/* Bottom fade into the next (white) section */}
      <div className="absolute inset-x-0 bottom-0 -z-10 h-24 bg-gradient-to-t from-white to-transparent" />

      <motion.div style={reduce ? undefined : { y: textY }} className="container relative pb-20 pt-32 lg:pt-28">
        <div className="max-w-2xl">
          <motion.span
            custom={0}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-brand-100 backdrop-blur"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-300 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-300" />
            </span>
            {site.hero.eyebrow}
          </motion.span>

          <motion.h1
            custom={1}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="mt-6 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl"
          >
            {site.hero.title}
          </motion.h1>

          <motion.p
            custom={2}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="mt-6 max-w-xl text-lg leading-relaxed text-brand-50/85"
          >
            {site.hero.subtitle}
          </motion.p>

          <motion.div custom={3} variants={fadeUp} initial="hidden" animate="show" className="mt-9 flex flex-wrap gap-3">
            <a href="#book" className="btn-primary group">
              <CalendarCheck className="h-4 w-4" /> Book an appointment
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
            <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="btn-ghost">
              <MessageCircle className="h-4 w-4" /> Chat on WhatsApp
            </a>
          </motion.div>

          {site.stats.length > 0 && (
          <motion.dl
            custom={4}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="mt-14 grid max-w-lg grid-cols-3 gap-6 border-t border-white/15 pt-8"
          >
            {site.stats.map((s) => (
              <div key={s.label}>
                <dt className="text-xs font-medium uppercase tracking-wider text-brand-100/70">{s.label}</dt>
                <dd className="mt-1 font-display text-2xl font-bold text-white sm:text-3xl">
                  <Counter value={s.value} suffix={s.suffix} decimals={s.decimals ?? 0} />
                </dd>
              </div>
            ))}
          </motion.dl>
          )}
        </div>
      </motion.div>

      {/* Floating cards over the video side (large screens) */}
      <div className="pointer-events-none absolute right-[6%] top-1/2 hidden -translate-y-1/2 flex-col gap-4 xl:flex">
        {site.rating && (
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.9, duration: 0.8 }}
          className="pointer-events-auto w-64 rounded-2xl border border-white/20 bg-white/15 p-4 text-white shadow-glow backdrop-blur-xl transition-transform duration-500 hover:-translate-y-1 motion-safe:animate-float"
        >
          <div className="flex items-center gap-1 text-amber-300">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="h-4 w-4 fill-current" />
            ))}
          </div>
          <p className="mt-2 text-sm font-semibold">Rated {site.rating} by our patients</p>
          <p className="text-xs text-white/70">Gentle care, clear prices</p>
        </motion.div>
        )}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.1, duration: 0.8 }}
          className="pointer-events-auto ml-10 w-64 rounded-2xl border border-white/20 bg-white/90 p-4 text-ink shadow-soft backdrop-blur-xl transition-transform duration-500 hover:-translate-y-1"
        >
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-100 text-brand-700">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">Sterilised every visit</p>
              <p className="text-xs text-slate-500">Hospital-grade protocols</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Scroll cue */}
      <a
        href="#services"
        className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-xs font-medium text-white/70 transition hover:text-white sm:flex"
      >
        Scroll
        <span className="flex h-9 w-5 justify-center rounded-full border border-white/40 pt-1.5">
          <span className="h-2 w-1 animate-bounce rounded-full bg-white/80" />
        </span>
      </a>
    </section>
  );
}
