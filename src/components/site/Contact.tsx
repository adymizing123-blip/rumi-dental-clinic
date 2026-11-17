import { Clock, MapPin, Phone } from "lucide-react";
import { site } from "@/config/site";
import { Reveal } from "./Reveal";

export function Contact() {
  const q = encodeURIComponent(site.address);
  return (
    <section id="contact" className="bg-slate-50 py-24 sm:py-32">
      <div className="container grid gap-10 lg:grid-cols-[1fr_1.3fr]">
        <Reveal>
          <span className="section-eyebrow">Visit us</span>
          <h2 className="section-title mt-4">Find us in {site.city.split(",")[0]}</h2>
          <ul className="mt-8 space-y-6">
            <li className="flex gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-100 text-brand-700"><MapPin className="h-5 w-5" /></span>
              <div><p className="font-semibold text-ink">Address</p><p className="mt-1 text-sm text-slate-600">{site.address}</p></div>
            </li>
            <li className="flex gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-100 text-brand-700"><Clock className="h-5 w-5" /></span>
              <div>
                <p className="font-semibold text-ink">Clinic hours</p>
                {site.timings.map((t) => (
                  <p key={t.days} className="mt-1 text-sm text-slate-600">{t.days}: {t.hours}</p>
                ))}
              </div>
            </li>
            <li className="flex gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-100 text-brand-700"><Phone className="h-5 w-5" /></span>
              <div><p className="font-semibold text-ink">Call or WhatsApp</p><p className="mt-1 text-sm text-slate-600">{site.phone}</p></div>
            </li>
          </ul>
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${q}`} target="_blank" rel="noopener noreferrer" className="btn-brand mt-8">Get directions</a>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="aspect-[4/3] overflow-hidden rounded-3xl bg-slate-200 shadow-soft ring-1 ring-slate-200">
            <iframe title="Clinic location" src={`https://www.google.com/maps?q=${q}&output=embed`} loading="lazy" className="h-full w-full border-0" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
