import { Archivo } from "next/font/google";
import { Navbar } from "@/components/site/Navbar";
import { Hero } from "@/components/site/Hero";
import { StatsBand } from "@/components/site/StatsBand";
import { About } from "@/components/site/About";
import { Why } from "@/components/site/Why";
import { Emergency } from "@/components/site/Emergency";
import { Gallery } from "@/components/site/Gallery";
import { Contact } from "@/components/site/Contact";
import { Services } from "@/components/site/Services";
import { Doctors } from "@/components/site/Doctors";
import { Process } from "@/components/site/Process";
import { Testimonials } from "@/components/site/Testimonials";
import { FAQ } from "@/components/site/FAQ";
import { CtaBand } from "@/components/site/CtaBand";
import { Booking } from "@/components/site/Booking";
import { Footer } from "@/components/site/Footer";
import { WhatsAppFloat } from "@/components/site/WhatsAppFloat";
import { ChatWidget } from "@/components/site/ChatWidget";

// Website font (the CRM keeps its own fonts). Variable width axis allows the slightly wide headings.
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });

export default function HomePage() {
  return (
    <div className={`${archivo.variable} site-theme`}>
      <Navbar />
      <main>
        <Hero />
        <StatsBand />
        <About />
        <Services />
        <Why />
        <Doctors />
        <Process />
        <Emergency />
        <Gallery />
        <Testimonials />
        <FAQ />
        <CtaBand />
        <Booking />
        <Contact />
      </main>
      <Footer />
      <WhatsAppFloat />
      <ChatWidget />
    </div>
  );
}
