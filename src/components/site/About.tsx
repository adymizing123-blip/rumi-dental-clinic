import { CheckCircle2, ShieldCheck } from "lucide-react";
import { about } from "@/config/site";
import { SmartImage } from "@/components/ui-skeleton";
import { Reveal } from "./Reveal";

/** Two overlapping photos with a small trust badge. */
function PhotoCollage() {
  return (
    <div className="relative pb-16 pr-10 sm:pr-16">
      <div aria-hidden className="absolute -left-6 -top-6 h-40 w-40 rounded-[2rem] bg-brand-100" />
      <SmartImage
        src={about.image}
        alt={about.imageAlt}
        className="relative aspect-[4/3] rounded-3xl shadow-soft ring-1 ring-slate-200/70"
      />
      <div className="absolute bottom-0 right-0 w-[42%] overflow-hidden rounded-3xl shadow-soft ring-8 ring-white">
        <SmartImage src={about.sideImage} alt={about.sideImageAlt} className="aspect-square" />
      </div>
      <div className="absolute bottom-6 left-6 flex items-center gap-3 rounded-2xl bg-white/95 p-3 pr-5 shadow-soft ring-1 ring-slate-200/70 backdrop-blur">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-semibold text-ink">Hospital-grade hygiene</p>
          <p className="text-xs text-slate-500">Sterilised for every patient</p>
        </div>
      </div>
    </div>
  );
}

export function About() {
  return (
    <section id="about" className="py-24 sm:py-32">
      <div className="container grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
        <Reveal>
          <PhotoCollage />
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
              <li key={p} className="flex items-start gap-2.5 rounded-xl bg-brand-50/60 p-3 text-sm font-medium text-ink">
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
