/**
 * What each automation does. The message text, on/off switch and template name are stored per clinic
 * in the `automations` table (editable on the Automations page); this file holds the fixed parts.
 * Safe to import in both server and client code.
 */
export type AutomationKey =
  | "confirmation"
  | "doctor_new"
  | "reminder"
  | "doctor_schedule"
  | "no_show"
  | "aftercare"
  | "review"
  | "lead_follow_up"
  | "win_back";

export type VarKey = "name" | "date" | "time" | "doctor" | "service" | "clinic" | "address" | "phone" | "review_link" | "interest" | "count" | "schedule";

export type AutomationDef = {
  key: AutomationKey;
  title: string;
  trigger: string;
  recipient: "patient" | "doctor";
  /** Variables, in order, for the WhatsApp template's {{1}}, {{2}}... */
  params: VarKey[];
  /** Text to submit to Meta when creating the template (WhatsApp Manager → Message templates). */
  templateExample: string;
  category: "Utility" | "Marketing";
};

export const AUTOMATIONS: AutomationDef[] = [
  {
    key: "confirmation",
    title: "Appointment confirmation",
    trigger: "Right after staff books an appointment",
    recipient: "patient",
    params: ["name", "date", "time", "doctor", "clinic"],
    templateExample: "Assalam o alaikum {{1}}! Aap ki appointment {{2}} ko {{3}} baje {{4}} ke saath confirm ho gayi hai. - {{5}}",
    category: "Utility",
  },
  {
    key: "doctor_new",
    title: "New appointment → doctor",
    trigger: "When an appointment is booked or moved to a doctor",
    recipient: "doctor",
    params: ["name", "date", "time", "service"],
    templateExample: "New appointment: {{1}} on {{2}} at {{3}} for {{4}}.",
    category: "Utility",
  },
  {
    key: "reminder",
    title: "Appointment reminder, 24 hours before",
    trigger: "24 hours before every booked appointment",
    recipient: "patient",
    params: ["name", "date", "time", "doctor", "clinic"],
    templateExample: "Assalam o alaikum {{1}}! Reminder: aap ki appointment {{2}} ko {{3}} baje {{4}} ke saath hai. - {{5}}",
    category: "Utility",
  },
  {
    key: "doctor_schedule",
    title: "Doctor's daily schedule",
    trigger: "Every morning at 8:00 AM, if the doctor has appointments",
    recipient: "doctor",
    params: ["doctor", "count", "schedule"],
    templateExample: "Good morning {{1}}! Aaj aap ki {{2}} appointments hain: {{3}}",
    category: "Utility",
  },
  {
    key: "no_show",
    title: "No-show recovery",
    trigger: "30 minutes after an appointment is marked no-show",
    recipient: "patient",
    params: ["name", "clinic"],
    templateExample: "{{1}}, aaj aap appointment par tashreef nahi la sakay. Naya time choose karne ke liye isi number par reply karein. - {{2}}",
    category: "Utility",
  },
  {
    key: "aftercare",
    title: "Post-treatment care",
    trigger: "1 day after a visit is marked done",
    recipient: "patient",
    params: ["name", "clinic"],
    templateExample: "{{1}}, treatment ke baad aap ki tabiyat kaisi hai? Koi takleef ho to isi number par batayein. - {{2}}",
    category: "Utility",
  },
  {
    key: "review",
    title: "Google review request",
    trigger: "2 hours after a visit is marked done",
    recipient: "patient",
    params: ["name", "review_link"],
    templateExample: "Shukriya {{1}}! Aap ka tajurba kaisa raha? Google par review de kar hamari madad karein: {{2}}",
    category: "Marketing",
  },
  {
    key: "lead_follow_up",
    title: "Lead follow-up (no booking)",
    trigger: "About 20 hours after an enquiry went quiet without a booking",
    recipient: "patient",
    params: ["name", "interest", "clinic"],
    templateExample: "Hi {{1}}, aap ne {{2}} ke baare mein poocha tha. Is hafte slot available hai, book karein? - {{3}}",
    category: "Marketing",
  },
  {
    key: "win_back",
    title: "Win back inactive patients",
    trigger: "90 days after the last visit, with nothing booked",
    recipient: "patient",
    params: ["name", "clinic"],
    templateExample: "{{1}}, kaafi time ho gaya! Is mahine check-up ke liye slot book karein. - {{2}}",
    category: "Marketing",
  },
];

export const AUTOMATION_BY_KEY = Object.fromEntries(AUTOMATIONS.map((a) => [a.key, a])) as Record<AutomationKey, AutomationDef>;

export const VARIABLES: { key: VarKey; label: string }[] = [
  { key: "name", label: "patient name" },
  { key: "date", label: "appointment day" },
  { key: "time", label: "appointment time" },
  { key: "doctor", label: "doctor" },
  { key: "service", label: "treatment" },
  { key: "clinic", label: "clinic name" },
  { key: "address", label: "clinic address" },
  { key: "phone", label: "patient phone" },
  { key: "review_link", label: "Google review link" },
  { key: "interest", label: "what they asked about" },
  { key: "count", label: "number of appointments (doctor)" },
  { key: "schedule", label: "today's list (doctor)" },
];

/** Fills {name}, {time}... into a message. Unknown placeholders are left as they are. */
export function renderMessage(body: string, vars: Partial<Record<VarKey, string>>) {
  return body.replace(/\{(\w+)\}/g, (match, key: string) => vars[key as VarKey] ?? match);
}
