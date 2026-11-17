"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, MapPin, Menu, Phone, X } from "lucide-react";
import { site } from "@/config/site";
import { cn } from "@/lib/utils";

const links = [
  { href: "#about", label: "About" },
  { href: "#services", label: "Services" },
  { href: "#doctors", label: "Doctors" },
  { href: "#clinic", label: "Clinic" },
  { href: "#faq", label: "FAQ" },
  { href: "#contact", label: "Contact" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-500",
        scrolled ? "bg-white/90 py-3 shadow-sm backdrop-blur-xl" : "bg-transparent py-5",
      )}
    >
      {/* Info strip: visible at the top of the page, hides on scroll */}
      <div className={cn("container hidden overflow-hidden text-xs text-slate-500 transition-all duration-500 lg:flex lg:items-center lg:justify-between", scrolled ? "max-h-0 opacity-0" : "mb-3 max-h-8 opacity-100")}>
        <span className="flex items-center gap-4">
          <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {site.address}</span>
          <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {site.timings[0].days}: {site.timings[0].hours}</span>
        </span>
        <a href={`tel:${site.phone.replace(/\s/g, "")}`} className="flex items-center gap-1.5 font-semibold text-ink hover:text-brand-700"><span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Emergency? Call {site.phone}</a>
      </div>
      <nav className="container flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5" aria-label={`${site.name} home`}>
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-600 font-display text-lg font-extrabold text-white shadow-md shadow-brand-600/25">
            {site.shortName[0]}
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-ink">
            {site.name}
          </span>
        </Link>

        <ul className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="group relative rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-brand-700"
              >
                {l.label}
                <span className="absolute inset-x-4 -bottom-0.5 h-0.5 origin-left scale-x-0 rounded-full bg-current transition-transform duration-300 group-hover:scale-x-100" />
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-3 lg:flex">
          <a
            href={`tel:${site.phone.replace(/\s/g, "")}`}
            className="flex items-center gap-2 text-sm font-semibold text-ink transition-colors hover:text-brand-700"
          >
            <Phone className="h-4 w-4" /> {site.phone}
          </a>
          <a href="#book" className="btn-brand">
            Book appointment
          </a>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-xl p-2 text-ink lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="container mt-3 lg:hidden"
          >
            <div className="card space-y-1 p-3">
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-4 py-3 text-sm font-medium text-slate-700 hover:bg-brand-50 hover:text-brand-700"
                >
                  {l.label}
                </a>
              ))}
              <a href="#book" onClick={() => setOpen(false)} className="btn-brand mt-2 w-full">
                Book appointment
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
