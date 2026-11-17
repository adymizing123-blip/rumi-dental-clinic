import { Award, CalendarCheck } from "lucide-react";
import { doctors } from "@/config/site";
import { SmartImage } from "@/components/ui-skeleton";
import { Reveal } from "./Reveal";

const gradients = [
  "from-brand-500 via-brand-600 to-brand-800",
  "from-brand-400 via-brand-600 to-brand-900",
  "from-brand-600 via-brand-700 to-brand-900",
];

export function Doctors() {
  return (
    <section id="doctors" className="relative overflow-hidden bg-brand-50/50 py-24 sm:py-32">
      <div className="absolute -right-32 top-10 h-96 w-96 rounded-full bg-brand-200/40 blur-3xl" />
      <div className="container relative">
        <Reveal className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-xl">
            <span className="section-eyebrow">Meet the team</span>
            <h2 className="section-title mt-4">Dentists who take time to explain</h2>
          </div>
          <p className="max-w-md text-slate-600">
            Every plan is made by a specialist and talked through with you before treatment starts. No rush, no surprises.
          </p>
        </Reveal>

        <div className={`mt-14 grid gap-6 ${doctors.length === 1 ? "mx-auto max-w-sm" : doctors.length === 2 ? "mx-auto max-w-3xl md:grid-cols-2" : doctors.length === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3"}`}>
          {doctors.map((d, i) => (
            <Reveal key={d.name} delay={i * 0.1}>
              <article className="group relative overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200/70 transition-all duration-500 hover:-translate-y-2 hover:shadow-soft">
                <div className={`relative grid aspect-[4/3] place-items-center overflow-hidden bg-gradient-to-br ${gradients[i % gradients.length]}`}>
                  <div className="absolute inset-0">
                    <SmartImage src={d.image} alt={d.name} className="h-full w-full" imgClassName="transition-transform duration-700 group-hover:scale-105" />
                  </div>
                  {d.years ? (
                    <span className="absolute bottom-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                      <Award className="h-3.5 w-3.5" /> {d.years}+ years
                    </span>
                  ) : null}
                </div>
                <div className="p-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">{d.role}</p>
                  <h3 className="mt-1 font-display text-xl font-bold text-ink">{d.name}</h3>
                  {d.degree && <p className="mt-1 text-sm text-slate-500">{d.degree}</p>}
                  <a
                    href="#book"
                    className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand-700 transition-all group-hover:gap-3"
                  >
                    <CalendarCheck className="h-4 w-4" /> Book with {d.name.split(" ").slice(0, 2).join(" ")}
                  </a>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
