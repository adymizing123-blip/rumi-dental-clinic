import { Quote } from "lucide-react";
import { testimonials } from "@/config/site";
import { Reveal } from "./Reveal";

export function Testimonials() {
  if (testimonials.length === 0) return null;
  const row = [...testimonials, ...testimonials];
  return (
    <section id="reviews" className="relative overflow-hidden bg-brand-950 py-24 text-white sm:py-32">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(90,147,245,0.25),transparent_60%)]" />
      <div className="container relative">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-200">
            Patient stories
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Smiles our patients talk about
          </h2>
        </Reveal>
      </div>

      {/* Infinite marquee; pauses on hover */}
      <div className="group relative mt-14 [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
        <div className="flex w-max animate-marquee gap-5 group-hover:[animation-play-state:paused]">
          {row.map((t, i) => (
            <figure
              key={i}
              className="w-[340px] shrink-0 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur transition-colors duration-300 hover:border-brand-300/50 hover:bg-white/10"
            >
              <Quote className="h-7 w-7 text-brand-300" />
              <blockquote className="mt-4 text-base leading-relaxed text-white/90">{t.text}</blockquote>
              <figcaption className="mt-5 text-sm font-semibold text-brand-200">{t.name}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
