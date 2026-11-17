import { Phone, Siren } from "lucide-react";
import { emergency, site, whatsappLink } from "@/config/site";
import { Reveal } from "./Reveal";

export function Emergency() {
  return (
    <section id="emergency" className="py-6 sm:py-10">
      <div className="container">
        <Reveal>
          <div className="grain relative overflow-hidden rounded-[2rem] bg-[linear-gradient(120deg,#111d3d_0%,#1f3b82_60%,#2558c9_100%)] p-8 text-white sm:p-12">
            <div className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-coral/30 blur-3xl" />
            <div className="relative grid items-center gap-8 lg:grid-cols-[1.4fr_1fr]">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-coral px-3 py-1 text-xs font-semibold text-white">
                  <Siren className="h-3.5 w-3.5" /> Dental emergency
                </span>
                <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">{emergency.title}</h2>
                <p className="mt-3 max-w-xl text-brand-100/85">{emergency.text}</p>
                <ul className="mt-5 grid gap-2 text-sm text-white/90 sm:grid-cols-2">
                  {emergency.cases.map((c) => (
                    <li key={c} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-coral" /> {c}</li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col gap-3">
                <a href={`tel:${site.phone.replace(/\s/g, "")}`} className="btn-primary text-base"><Phone className="h-4 w-4" /> Call {site.phone}</a>
                <a href={whatsappLink("Assalam o Alaikum, I have a dental emergency.")} target="_blank" rel="noopener noreferrer" className="btn-ghost">WhatsApp us now</a>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
