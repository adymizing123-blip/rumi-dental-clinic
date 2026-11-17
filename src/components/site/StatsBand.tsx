import { facts } from "@/config/site";
import { Reveal } from "./Reveal";

/** White card with four facts, sitting just under the hero banner. */
export function StatsBand() {
  return (
    <section aria-label="Clinic at a glance" className="relative z-10 pb-6 pt-16 sm:pt-20">
      <div className="container">
        <Reveal>
          <dl className="grid grid-cols-2 overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-slate-200/60 lg:grid-cols-4">
            {facts.map((f, i) => (
              <div
                key={f.label}
                className={`relative grid gap-1 px-5 py-6 transition-colors hover:bg-brand-50 sm:px-8 sm:py-8 ${i % 2 === 1 ? "border-l border-slate-200/80" : ""} ${i >= 2 ? "border-t border-slate-200/80 lg:border-t-0" : ""} ${i === 2 ? "lg:border-l" : ""}`}
              >
                <dt className="text-sm text-slate-500">{f.label}</dt>
                <dd className="order-first font-display text-2xl font-extrabold text-ink sm:text-3xl">{f.value}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  );
}
