import { CalendarCheck, MessageCircle } from "lucide-react";
import { cta, whatsappLink } from "@/config/site";
import { Reveal } from "./Reveal";

/** Brand-coloured band over a photo, leading into the booking form. */
export function CtaBand() {
  return (
    <section className="relative isolate overflow-hidden bg-brand-700 py-20 text-white sm:py-24">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={cta.image} alt="" aria-hidden="true" loading="lazy" className="absolute inset-0 -z-20 h-full w-full object-cover" />
      <div aria-hidden className="cta-overlay absolute inset-0 -z-10" />
      <div className="container">
        <Reveal className="max-w-2xl">
          <h2 className="section-title max-w-[20ch] text-white">{cta.title}</h2>
          <p className="mt-4 max-w-xl text-lg text-white/85">{cta.text}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#book" className="btn-primary px-6 text-base">
              <CalendarCheck className="h-5 w-5" /> Book appointment
            </a>
            <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="btn-ghost px-6 text-base">
              <MessageCircle className="h-5 w-5" /> Chat on WhatsApp
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
