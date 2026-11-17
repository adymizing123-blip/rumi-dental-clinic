"use client";

import { useRef } from "react";
import { motion, useScroll, useSpring } from "framer-motion";
import { process } from "@/config/site";
import { Reveal } from "./Reveal";

export function Process() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 75%", "end 60%"] });
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 24 });

  return (
    <section id="process" className="bg-brand-50 py-24 sm:py-32">
      <div className="container">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="section-eyebrow">How it works</span>
          <h2 className="section-title mt-4">From first message to a healthy smile</h2>
        </Reveal>

        <div ref={ref} className="relative mt-16">
          {/* Progress line that fills as you scroll */}
          <div className="absolute left-0 right-0 top-6 hidden h-0.5 bg-slate-200 lg:block" />
          <motion.div
            style={{ scaleX }}
            className="absolute left-0 right-0 top-6 hidden h-0.5 origin-left bg-gradient-to-r from-brand-400 to-brand-700 lg:block"
          />
          <ol className="grid gap-10 lg:grid-cols-4">
            {process.map((step, i) => (
              <Reveal key={step.title} delay={i * 0.12}>
                <li className="group relative">
                  <span className="relative z-10 grid h-12 w-12 place-items-center rounded-full border-4 border-white bg-brand-600 font-display text-lg font-bold text-white shadow-glow transition-transform duration-500 group-hover:scale-110">
                    {i + 1}
                  </span>
                  <h3 className="mt-6 font-display text-lg font-bold text-ink">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.text}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
