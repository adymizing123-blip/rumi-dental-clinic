/** Free Unsplash stock photo URL (used for DUMMY images until the clinic's own photos are added). */
function stock(id: string, width = 1200) {
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=80`;
}

/**
 * Everything clinic-specific for the public website lives here.
 * Change these values for each client; no other file needs editing for branding.
 * Services, prices, timings and FAQs below are still SAMPLE content: replace them with Rumi Dental Clinic's real data.
 */
export const site = {
  name: "Rumi Dental Clinic",
  shortName: "Rumi",
  tagline: "Gentle, modern dentistry",
  city: "Kotli, Azad Kashmir",
  phone: "+92 330 2988880",
  whatsapp: "923302988880", // international format, digits only (used for wa.me links)
  email: "", // not provided yet: hidden on the site while empty
  address: "Al-Shifa Hospital, opposite Mushtaq Mui-ud-Din Hospital, Pindi Road, Kotli, Azad Kashmir",
  timezone: "Asia/Karachi", // used to display times in the CRM
  timezoneOffset: "+05:00", // Pakistan Standard Time, used by the CRM calendar
  timings: [
    { days: "Monday to Saturday", hours: "10:00 AM to 9:00 PM" },
    { days: "Sunday", hours: "Closed" },
  ],
  hero: {
    // DUMMY stock photo (Unsplash, free licence). Replace with a real photo of the clinic or Dr. Daniyal.
    image: stock("photo-1606811971618-4486d14f3f99", 1100),
    imageAlt: "Smiling patient during a dental check-up",
    eyebrow: "Now booking new patients",
    title: "Confident smiles start with gentle care.",
    titleHighlight: "gentle care", // part of the title shown in brand colour
    subtitle:
      "Painless check-ups, whitening, braces and implants under one roof. Modern equipment, clear prices and dentists who take time to explain.",
  },
  rating: "", // add the real Google rating (e.g. "4.8") to show the rating card on the hero
  stats: [] as { value: number; suffix: string; label: string; decimals?: number }[], // add real numbers here to show the stats row
};

export const services = [
  { key: "checkup", name: "Check-up & Cleaning", desc: "Scaling, polishing and a full oral exam with digital X-rays.", icon: "stethoscope", from: 2500, time: "30 to 45 min", points: ["Digital X-rays if needed", "Tartar and stain removal", "Gum health check"] },
  { key: "fillings", name: "Tooth-coloured Fillings", desc: "Repairs cavities and chipped teeth with a shade matched to your tooth.", icon: "layers", from: 3500, time: "30 to 60 min", points: ["Mercury-free material", "Matched to your tooth shade", "Done in one visit"] },
  { key: "rootcanal", name: "Root Canal", desc: "Pain-relieving treatment that saves your natural tooth.", icon: "heart", from: 15000, time: "1 to 2 visits", points: ["Local anaesthesia", "Rotary instruments, less chair time", "Crown advice afterwards"] },
  { key: "crowns", name: "Crowns & Bridges", desc: "Caps that strengthen weak teeth and fixed bridges that fill gaps.", icon: "crown", from: 18000, time: "2 visits", points: ["Zirconia and porcelain options", "Natural bite and colour", "Temporary crown between visits"] },
  { key: "implants", name: "Dental Implants", desc: "Permanent, natural-looking replacements for missing teeth.", icon: "shield", from: 120000, time: "3 to 6 months", points: ["3D scan planning", "Titanium implant with crown", "Written step-by-step plan"] },
  { key: "braces", name: "Braces & Aligners", desc: "Metal, ceramic and clear aligners planned with 3D scans.", icon: "smile", from: 95000, time: "12 to 24 months", points: ["Metal, ceramic or clear", "Monthly adjustment visits", "Retainers included in plan"] },
  { key: "whitening", name: "Teeth Whitening", desc: "In-clinic whitening for a visibly brighter smile in one visit.", icon: "sparkles", from: 18000, time: "60 min", points: ["Gum protection during the session", "Brighter in one visit", "Aftercare tips for lasting results"] },
  { key: "veneers", name: "Cosmetic Veneers", desc: "Thin porcelain shells that reshape and brighten front teeth.", icon: "crown", from: 35000, time: "2 to 3 visits", points: ["Smile preview before we start", "Minimal tooth shaping", "Stain-resistant finish"] },
  { key: "extraction", name: "Extractions & Wisdom Teeth", desc: "Gentle removal of damaged teeth and impacted wisdom teeth.", icon: "bone", from: 3000, time: "20 to 60 min", points: ["Numbing before every extraction", "Surgical removal when needed", "Clear healing instructions"] },
  { key: "dentures", name: "Dentures", desc: "Complete and partial dentures that restore chewing, speech and your smile.", icon: "smile", from: 25000, time: "3 to 4 visits", points: ["Complete and partial sets", "Fit checked and adjusted", "Repairs and relining"] },
  { key: "kids", name: "Kids Dentistry", desc: "Friendly visits, fluoride care and sealants for children.", icon: "baby", from: 2000, time: "20 to 30 min", points: ["From the first tooth", "Fluoride and sealants", "Calm, child-friendly visits"] },
  { key: "tmj", name: "Jaw Pain (TMJ)", desc: "Relief for jaw pain, clicking and night-time clenching.", icon: "activity", from: 8000, time: "Assessment + plan", points: ["Bite and joint assessment", "Night guard if needed", "Home exercises"] },
  { key: "emergency", name: "Emergency Care", desc: "Same-day help for toothache, swelling or a broken tooth.", icon: "siren", from: 3000, time: "Same day", points: ["Pain relief first", "Swelling and infection care", "Broken or knocked-out teeth"] },
] as const;

export const doctors: { name: string; role: string; degree: string; years?: number; initials: string; image: string }[] = [
  { name: "Dr. Daniyal", role: "Dentist", degree: "", initials: "D", image: "/images/doctor-1.svg" }, // add degree / years of experience when available
  // SAMPLE doctors below: dummy names, roles and images. Replace or delete before going live.
  { name: "Dr. Ayesha Khan", role: "Orthodontist", degree: "BDS, MCPS (sample)", years: 8, initials: "A", image: "/images/doctor-2.svg" },
  { name: "Dr. Hamza Rauf", role: "Oral Surgeon", degree: "BDS, FCPS (sample)", years: 10, initials: "H", image: "/images/doctor-3.svg" },
  { name: "Dr. Sana Malik", role: "Paediatric Dentist", degree: "BDS (sample)", years: 6, initials: "S", image: "/images/doctor-4.svg" },
];

/** About section. Images are DUMMY stock photos; swap for real photos of the clinic. */
export const about = {
  image: stock("photo-1777331903190-341a3dd0441b", 1000),
  imageAlt: "Dentist explaining a treatment plan to a patient",
  sideImage: stock("photo-1629909613654-28e377c37b09", 600),
  sideImageAlt: "Modern treatment room with dental chair",
  eyebrow: "About the clinic",
  title: "A calm clinic that explains before it treats",
  text: [
    "We believe a dental visit should feel unhurried. Your dentist examines, shows you what they see and talks through the options and prices before any treatment starts.",
    "Under one roof you get check-ups, cosmetic work, braces, implants and emergency care, with sterilised instruments for every patient and modern low-pain techniques.",
  ],
  points: ["Clear prices before treatment", "Instruments sterilised for every patient", "Digital X-rays and 3D scans", "Same-day emergency help"],
};

/** DUMMY stock photos (Unsplash, free licence). Replace with real photos of the clinic. */
export const gallery = [
  { src: stock("photo-1629909613654-28e377c37b09", 1200), alt: "Treatment room with dental chair" },
  { src: stock("photo-1762625570087-6d98fca29531", 800), alt: "Waiting area" },
  { src: stock("photo-1606811856475-5e6fcdc6e509", 800), alt: "Sterilised dental instruments" },
  { src: stock("photo-1593022356769-11f762e25ed9", 800), alt: "Implant planning model" },
];

export const emergency = {
  title: "Toothache, swelling or a broken tooth?",
  text: "Do not wait it out. Call or message us and we will find the earliest slot for you, the same day wherever we can.",
  cases: ["Severe toothache", "Swelling of the face or gums", "Broken or knocked-out tooth", "Bleeding that will not stop"],
};

/** Real, consented patient reviews only. The section stays hidden while this list is empty. */
export const testimonials: { name: string; text: string }[] = []; // add real, consented patient reviews here

export const faqs = [
  { q: "Do I need an appointment?", a: "Appointments are recommended so we can keep waiting time short, but we also see walk-in and emergency patients during clinic hours." },
  { q: "Where is the clinic?", a: "We are at Al-Shifa Hospital, opposite Mushtaq Mui-ud-Din Hospital, Pindi Road, Kotli. Call or WhatsApp us if you need directions." },
  { q: "How much will my treatment cost?", a: "After the examination your dentist gives you a written estimate for every option, so you decide with the full picture. The prices on this page are starting prices." },
  { q: "Is teeth whitening safe?", a: "Whitening done under a dentist's supervision is a common cosmetic treatment. We check your teeth and gums first and advise if it suits you." },
  { q: "Does a root canal hurt?", a: "The tooth is numbed first, so the treatment itself is comfortable. Most patients feel relief from the toothache once the infection is cleaned out." },
  { q: "How long do braces take?", a: "It depends on your teeth. Most treatment plans run between 12 and 24 months; your orthodontist gives an estimate after the first scan." },
  { q: "Do you treat children?", a: "Yes. Our paediatric dentist sees children from their first tooth, with gentle visits designed to keep them comfortable." },
  { q: "Do you see dental emergencies?", a: "Yes. Call or WhatsApp us and we will fit you in as early as we can, usually the same day." },
  { q: "Which payment methods do you accept?", a: "Cash, bank transfer, JazzCash, Easypaisa and cards. Treatment packages can be paid in instalments." },
] as const;

export const process = [
  { title: "Book in a minute", text: "Send the form or message us on WhatsApp. We confirm a time that suits you." },
  { title: "Examination & plan", text: "Your dentist examines, takes X-rays or 3D scans if needed and explains the options with clear prices." },
  { title: "Comfortable treatment", text: "Modern, low-pain techniques in a calm, sterilised room." },
  { title: "Follow-up care", text: "We check in after your visit and remind you of your next appointment." },
] as const;

export const whatsappLink = (text = "Assalam o Alaikum, I want to book an appointment.") =>
  `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(text)}`;
