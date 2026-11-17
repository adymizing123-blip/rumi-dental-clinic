import { Award, Clock, ShieldCheck, Wallet, type LucideIcon } from "lucide-react";
import { why } from "@/config/site";
import { SmartImage } from "@/components/ui-skeleton";
import { Reveal } from "./Reveal";

const ICONS: Record<string, LucideIcon> = { award: Award, wallet: Wallet, clock: Clock, shield: ShieldCheck };

/** Dark "why choose us" section with a photo and four reasons. */
export function Why() {
  return (
    <section id="why" className="relative isolate overflow-hidden bg-ink py-24 text-white sm:py-28">
      <div aria-hidden className="why-glow absolute -right-48 -top-48 -z-10 h-[620px] w-[620px] rounded-full opacity-50" />
      <div className="container grid items-center gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <Reveal>
          <div className="relative">
            <SmartImage src={why.image} alt={why.imageAlt} className="aspect-[4/5] rounded-3xl ring-1 ring-white/10 sm:aspect-[4/3] lg:aspect-[4/5]" />
            <div className="absolute bottom-4 right-4 flex items-center gap-3 rounded-2xl bg-white/95 px-4 py-3 text-ink shadow-lift backdrop-blur">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold leading-tight">Sterilised every visit</span>
                <span className="block text-xs text-slate-500">For every patient</span>
              </span>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <span className="section-eyebrow is-light">Why us</span>
          <h2 className="section-title mt-4 text-white">{why.title}</h2>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/70">{why.text}</p>
          <ul className="mt-10 grid gap-x-8 gap-y-7 sm:grid-cols-2">
            {why.items.map((item) => {
              const Icon = ICONS[item.icon] ?? ShieldCheck;
              return (
                <li key={item.title} className="flex gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10 text-brand-200 ring-1 ring-white/10">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block font-display font-bold text-white">{item.title}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-white/65">{item.text}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
