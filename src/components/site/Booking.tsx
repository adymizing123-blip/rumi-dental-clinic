"use client";

import { useActionState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Clock, Loader2, MapPin, MessageCircle, Phone } from "lucide-react";
import { bookAppointment, type BookingState } from "@/app/actions/booking";
import { services, site, whatsappLink } from "@/config/site";
import { Reveal } from "./Reveal";

const initial: BookingState = { ok: false };

export function Booking() {
  const [state, action, pending] = useActionState(bookAppointment, initial);
  const minDate = new Date().toISOString().slice(0, 10);

  return (
    <section id="book" className="relative overflow-hidden py-24 sm:py-32">
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(135deg,#eef5ff_0%,#ffffff_45%,#f0f9ff_100%)]" />
      <div className="container grid items-start gap-12 lg:grid-cols-[1fr_1.1fr]">
        <Reveal>
          <span className="section-eyebrow">Book a visit</span>
          <h2 className="section-title mt-4">Pick a time. We will confirm on WhatsApp.</h2>
          <p className="mt-4 max-w-md text-lg text-slate-600">
            Send your details and our front desk will call or message you within clinic hours to confirm the slot.
          </p>

          <ul className="mt-10 space-y-5">
            <li className="flex items-start gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-100 text-brand-700">
                <MapPin className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-ink">Visit us</p>
                <p className="text-sm text-slate-600">{site.address}</p>
              </div>
            </li>
            <li className="flex items-start gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-100 text-brand-700">
                <Clock className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-ink">Clinic hours</p>
                {site.timings.map((t) => (
                  <p key={t.days} className="text-sm text-slate-600">
                    {t.days}: {t.hours}
                  </p>
                ))}
              </div>
            </li>
            <li className="flex items-start gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-100 text-brand-700">
                <Phone className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-ink">Call or WhatsApp</p>
                <p className="text-sm text-slate-600">{site.phone}</p>
              </div>
            </li>
          </ul>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="relative rounded-[2rem] border border-white bg-white/80 p-6 shadow-soft backdrop-blur-xl sm:p-8">
            <AnimatePresence mode="wait">
              {state.ok ? (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center py-10 text-center"
                >
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 260, damping: 14 }}
                    className="grid h-16 w-16 place-items-center rounded-full bg-brand-100 text-brand-600"
                  >
                    <CheckCircle2 className="h-9 w-9" />
                  </motion.span>
                  <h3 className="mt-5 font-display text-2xl font-bold text-ink">Request received</h3>
                  <p className="mt-2 max-w-sm text-slate-600">
                    Thank you. Our team will contact you shortly to confirm your appointment.
                  </p>
                  <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="btn-brand mt-6">
                    <MessageCircle className="h-4 w-4" /> Message us on WhatsApp
                  </a>
                </motion.div>
              ) : (
                <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
                  {/* Honeypot field for bots */}
                  <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

                  <Field label="Full name" error={state.fieldErrors?.name}>
                    <input name="name" required placeholder="e.g. Ali Raza" className="input" autoComplete="name" />
                  </Field>
                  <Field label="Mobile number" error={state.fieldErrors?.phone}>
                    <input
                      name="phone"
                      required
                      inputMode="tel"
                      placeholder="03xx xxxxxxx"
                      className="input"
                      autoComplete="tel"
                    />
                  </Field>
                  <Field label="Treatment">
                    <select name="service" className="input" defaultValue="">
                      <option value="">Not sure yet</option>
                      {services.map((s) => (
                        <option key={s.key} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Preferred date" error={state.fieldErrors?.date}>
                    <input name="date" type="date" min={minDate} className="input" suppressHydrationWarning />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Anything we should know? (optional)">
                      <textarea name="note" rows={3} maxLength={1000} placeholder="Tooth pain, preferred time…" className="input resize-none" />
                    </Field>
                  </div>

                  {state.error && <p className="text-sm font-medium text-red-600 sm:col-span-2">{state.error}</p>}

                  <button type="submit" disabled={pending} className="btn-brand w-full py-3.5 text-base sm:col-span-2">
                    {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Request appointment"}
                  </button>
                  <p className="text-center text-xs text-slate-500 sm:col-span-2">
                    We only use your number to contact you about this booking.
                  </p>
                </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs font-medium text-red-600">{error}</span>}
    </label>
  );
}
