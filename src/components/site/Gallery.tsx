import { gallery } from "@/config/site";
import { SmartImage } from "@/components/ui-skeleton";
import { Reveal } from "./Reveal";

export function Gallery() {
  return (
    <section id="clinic" className="py-24 sm:py-32">
      <div className="container">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="section-eyebrow">Inside the clinic</span>
          <h2 className="section-title mt-4">Clean, calm and well equipped</h2>
          <p className="mt-4 text-lg text-slate-600">A quick look at where your visit happens. These are dummy images until real photos are added.</p>
        </Reveal>
        <div className="mt-14 grid grid-cols-2 gap-4 md:grid-cols-4">
          {gallery.map((g, i) => (
            <Reveal key={g.src} delay={i * 0.08} className={i === 0 ? "col-span-2 row-span-2" : ""}>
              <SmartImage src={g.src} alt={g.alt} className={`rounded-3xl ring-1 ring-slate-200 ${i === 0 ? "aspect-square md:h-full md:aspect-auto" : "aspect-[4/3]"}`} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
