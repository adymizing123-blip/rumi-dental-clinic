import Link from "next/link";
import { services, site } from "@/config/site";

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-ink text-slate-300">
      <div className="container grid gap-10 py-16 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-600 font-display text-lg font-extrabold text-white">
              {site.shortName[0]}
            </span>
            <span className="font-display text-lg font-bold text-white">{site.name}</span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">
            {site.tagline} in {site.city}. Check-ups, cosmetic and specialist treatment with clear prices.
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Treatments</p>
          <ul className="mt-4 space-y-2 text-sm">
            {services.slice(0, 6).map((s) => (
              <li key={s.key}>
                <a href="#services" className="transition hover:text-brand-300">
                  {s.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Contact</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>{site.address}</li>
            <li>
              <a href={`tel:${site.phone.replace(/\s/g, "")}`} className="transition hover:text-brand-300">
                {site.phone}
              </a>
            </li>
            {site.timings.map((t) => (
              <li key={t.days}>{t.days}: {t.hours}</li>
            ))}
            {site.email && (
              <li>
                <a href={`mailto:${site.email}`} className="transition hover:text-brand-300">
                  {site.email}
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container flex flex-col items-center justify-between gap-3 py-6 text-xs text-slate-500 sm:flex-row">
          <p>
            © {new Date().getFullYear()} {site.name}. All rights reserved.
          </p>
          <Link href="/login" className="transition hover:text-slate-300">
            Staff login
          </Link>
        </div>
      </div>
    </footer>
  );
}
