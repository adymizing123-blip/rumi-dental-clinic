# Rumi Dental Clinic: Website + CRM

Dental clinic ki animated website (landing page) aur us ke saath CRM, ek hi Next.js project mein.
Backend Supabase par hai (database, login, realtime).

> Clinic ka naam, Dr. Daniyal, phone aur address asli hain. Services ke prices, timings, FAQs aur CRM ke sample patients/appointments **SAMPLE** hain.
> Har client ke liye `src/config/site.ts` aur `supabase/seed.sql` mein asli maloomat daalein.

---

## Kya kya bana hai

**Website (`/`)**
- Hero: poore section ke peeche video, left side par brand gradient jo right ki taraf video mein ghul jata hai, parallax scroll, counters, floating cards
- Services: mouse ke saath jhukne wale (tilt) cards aur spotlight hover
- Doctors, "How it works" (scroll ke saath bharne wali line), testimonials marquee (hover par rukta hai), FAQ accordion
- Booking form: seedha CRM ke Inbox (Website channel) aur Leads Pipeline mein jata hai. Spam se bachne ke liye honeypot field
- **Website live chat:** neeche right par chat bubble. Visitor naam aur number de kar chat shuru karta hai; message CRM Inbox ("Website chat") mein aata hai, aur staff ya AI ka jawab visitor ko wahin milta hai
- WhatsApp ka floating button, mobile menu, `prefers-reduced-motion` ka khayal

**CRM (`/crm`, sirf staff login ke saath)**
- **Growth Center (dashboard):** is mahine ki growth report (AI ne kitni chats sambhali, kitni appointments book keen aur un ki qeemat, front-desk ka bacha hua waqt), aaj ki appointments, naye enquiries (pichle hafte se muqabla), AI ka average reply time, enquiry → booking %, jawab ke muntazir chats, 30 din ka demand chart, Live activity, patient journey, leads kahan se aaye, sab se masroof ghante
- **Omnichannel Inbox:** WhatsApp, Instagram, Facebook, Google, TikTok, Website chat aur Phone call, sab ek jagah (channel chips ginti ke saath). Live updates (Supabase Realtime), reply usi channel se jata hai (24 ghante ka qanoon check hota hai)
  - **Har chat par AI receptionist ka on/off switch** (header mein)
  - **Patient card:** lead score, **AI Summary** (refresh button), Book appointment, Add to pipeline, Call, Open in WhatsApp
  - **+ button:** phone call, walk-in ya TikTok/Google ki lead khud likh kar daalein
- **AI receptionist:** Settings se on karein. Clinic ki services, prices, doctors, timings aur aap ki di hui maloomat se jawab deta hai, khaali slots offer karta hai aur book karta hai. Patient ki zubaan mein (English, Urdu, Roman Urdu). Emergency, shikayat ya unknown sawal par chat staff ko de kar khud ruk jata hai. Staff reply kare to AI us chat par ruk jata hai
- **Leads Pipeline (khud ba khud):** New enquiry → AI engaged → Appointment booked → Visited → Nurturing → Lost. Cards par channel, HOT badge, interest, value, source, AI score aur last activity. Source filter, Add lead, open pipeline value. Drag & drop bhi chalta hai
- **Appointments (calendar):** har doctor ka alag column, 30 minute ki rows, har doctor ka apna rang, abhi ke waqt ki laal line. Khaali jagah dabayein to usi doctor aur waqt ke saath booking khulti hai. Appointment dabayein to details, status, WhatsApp reminder, aur reschedule (doctor ya waqt badalna). Doctor ka waqt takra raha ho to booking nahi hoti. AI bhi booking karte waqt khaali doctor chunta hai
- **Automations (WhatsApp, khud ba khud):** patient ko confirmation, 24 ghante pehle reminder, no-show ke baad naya time, treatment ke agle din haal-chaal, Google review request, lead follow-up, 90 din baad win-back. **Doctor ko** nayi appointment ka message aur har subah aaj ka schedule. Har automation on/off, message edit, WhatsApp template ka naam, aur bheje gaye messages ka log
- **Patients:** search, naya patient, poora record (appointments, chats, notes), Recycle Bin (soft delete)
- **Settings:** AI receptionist (on/off, clinic ki maloomat, opening hours, slot length, chhutti ke din), Channels (WhatsApp / Instagram / Facebook jodna, Test button, Google/TikTok lead webhooks), clinic profile, pipeline stages

Security: har table par Row Level Security. Staff sirf apne clinic ka data dekhte hain, aur pipeline stages sirf admin badal sakta hai.

---

## Setup (pehli dafa)

**1. Packages install karein** (Node.js 20 ya naya)

```bash
npm install
```

**2. Supabase project banayein** (supabase.com → New project)

SQL Editor mein ye files **isi tarteeb se** chalayein:

1. `supabase/migrations/0001_init.sql` (tables, security, realtime)
2. `supabase/migrations/0002_ai_omnichannel.sql` (AI receptionist, channels)
3. `supabase/migrations/0003_pipeline_automation.sql` (khud ba khud pipeline)
4. `supabase/migrations/0004_growth_center.sql` (dashboard)
5. `supabase/migrations/0005_automations.sql` (WhatsApp automations)
6. `supabase/seed.sql` (clinic, stages, doctors, services aur demo data)

Pipeline ke "Nurturing" aur "Lost" wale qadam har ghante chalte hain. Is ke liye **Database → Extensions → pg_cron** ON karein (0003 khud schedule kar deta hai). Agar 0003 chalate waqt pg_cron ON nahi tha, to ON kar ke SQL Editor mein ye ek line chalayein:

```sql
select cron.schedule('age-leads-hourly', '17 * * * *', 'select public.age_leads()');
```

**3. Staff login set karein**

- **Authentication → Providers → Email** mein "Allow new users to sign up" **OFF** karein, taake koi bahar ka banda account na bana sake
- **Authentication → Users → Invite user** se pehla user (aap ya clinic ka maalik) add karein. **Pehla user khud Admin ban jata hai**, baad wale Receptionist
- Kisi ka role badalna ho to SQL Editor mein: `update profiles set role = 'doctor' where id = '<user id>';`

**4. `.env.local` banayein**

`.env.example` ko copy kar ke `.env.local` naam dein aur Supabase ki values bharein (Project Settings → API):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

**5. Chalayein**

```bash
npm run dev
```

- Website: http://localhost:3000
- CRM: http://localhost:3000/login

**6. AI receptionist (marzi se, CRM is ke baghair bhi chalta hai)**

`.env.local` mein AI ki key daalein, phir CRM → Settings → AI receptionist ON karein:

```
# Claude (Anthropic)
AI_PROVIDER=anthropic
AI_API_KEY=sk-ant-...

# ya Google Gemini (OpenAI-compatible tareeqe se)
AI_PROVIDER=openai
AI_API_KEY=...
AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
AI_MODEL=<Google AI Studio mein jo flash model nazar aaye>
```

Test karne ka sab se aasan tareeqa: website ka chat bubble kholein, naam/number daal kar sawal poochein ("whitening ki fee?", "kal ka time hai?"). Jawab chat mein aayega, aur Inbox mein AI ka message, summary aur lead score nazar aayega.

---

## Automations (WhatsApp messages patient aur doctor ko)

Jab appointment book, reschedule, no-show ya done hoti hai, database message ko queue mein daal deta hai. Har 5 minute ek chhota sa worker (`/api/cron/automations`) jo message ka waqt aa chuka ho woh bhej deta hai, aur patient ki WhatsApp chat mein "Automatic message" ke naam se dikhata hai.

**1. WhatsApp ka qanoon (zaroori):** free-text message sirf us waqt ja sakta hai jab us bande ne pichle 24 ghante mein clinic ko message kiya ho. Reminder aur doctor wale messages aksar is waqt ke bahar hote hain, is liye un ke liye **approved template** chahiye:
- WhatsApp Manager → Message templates → Create. Automations page par har automation ke "Edit message & template" mein woh text likha hai jo template mein daalna hai ({{1}}, {{2}}…)
- Approve hone ke baad template ka naam (jaise `appointment_reminder`) aur zubaan (`en`) usi automation mein save karein
- Template ke baghair bhi automation chalti hai, magar sirf un logon ko jinhon ne 24 ghante ke andar message kiya ho. Baaqi "skipped" log mein dikhenge
- Utility templates (reminder, confirmation) ke paise Meta per message leta hai (bohat kam). Marketing (review, win-back) zyada mehnge hain

**2. Doctors ke numbers aur Google review link:** Automations page ke neeche bharein.

**3. Har 5 minute chalana:** `.env` / Vercel mein `CRON_SECRET` (lambi random string) daalein. Phir Supabase SQL Editor mein (apna domain aur secret daal kar) ek dafa chalayein:

```sql
create extension if not exists pg_net;
select cron.schedule('crm-automations', '*/5 * * * *', $job$
  select net.http_get(
    url := 'https://YOUR-CRM-DOMAIN/api/cron/automations',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET'),
    timeout_milliseconds := 55000
  );
$job$);
```

Test ke liye Automations page par **Run now** dabayein. "Last run" wahan nazar aata hai.

---

## Har client ke liye badalna

| Kya | Kahan |
|---|---|
| Naam, phone, WhatsApp, address, timings, hero ka text | `src/config/site.ts` |
| Services, doctors, FAQ, testimonials (website) | `src/config/site.ts` |
| Rang (brand colour) | `tailwind.config.ts` → `colors.brand` |
| Hero video | `public/videos/hero.mp4` aur `hero-poster.jpg` badal dein |
| CRM ka clinic, doctors, services, stages | `supabase/seed.sql` (ya CRM ki Settings) |

**Hero video:** abhi ek placeholder (halki roshniyon wali) video lagi hai. Clinic ki apni video, ya Pexels ya Pixabay jaisi free stock sites se dental video lein. Behtar hai: MP4, 1280×720 ya 1920×1080, 10–15 second, awaaz ke baghair, 5 MB se kam.

---

## Channels jodna (developer khud jodega)

Sab channels **CRM → Settings → Channels** se add hote hain (token database mein mehfooz rehta hai, browser tak nahi jata). Har channel ke baad **Test** dabayein.

**Meta app (sab Meta channels ke liye ek dafa):** `.env` mein `META_APP_SECRET` (App settings → Basic) aur `META_WEBHOOK_VERIFY_TOKEN` (koi bhi lambi random string) daalein.

**WhatsApp**
1. Clinic ke Meta Business portfolio mein admin access lein, wahan app banayein aur WhatsApp product add karein
2. WhatsApp Manager mein clinic ka number add karein (OTP clinic ke phone par). Number kisi WhatsApp app par chal na raha ho
3. Business Settings → System Users mein permanent token banayein (`whatsapp_business_messaging`, `whatsapp_business_management`)
4. App → WhatsApp → Configuration: Callback URL `https://<crm-domain>/api/webhooks/whatsapp`, verify token, **messages** subscribe
5. Settings → Channels → WhatsApp: **Phone number ID** + token. (Purana tareeqa, `.env` mein `WHATSAPP_PHONE_NUMBER_ID` + `WHATSAPP_ACCESS_TOKEN`, bhi chalta hai)

**Facebook Messenger aur Instagram DM**
1. Usi app mein Messenger aur Instagram products add karein, clinic ka Page aur Instagram professional account link karein
2. Webhooks: Callback URL `https://<crm-domain>/api/webhooks/meta` (Page aur Instagram dono ke liye), subscribe: `messages`, `messaging_postbacks`. Lead Ads ke liye Page par `leadgen` bhi
3. Page access token lein (permissions: `pages_messaging`, `instagram_manage_messages`; lead forms ke liye `leads_retrieval`)
4. Settings → Channels: Facebook → **Page ID** + Page token. Instagram → **Instagram account ID** + token
5. Doosre logon ke messages ke liye app ko Live mode aur App Review chahiye; developer/tester accounts se pehle test karein

**Google Ads lead form / TikTok lead form / koi aur form**
1. Settings → Channels → "Add a lead source" → naam likhein (jaise "Google Ads form") → webhook URL copy karein
2. Google Ads: lead form → Lead delivery → Webhook URL mein paste karein (key URL mein hi hai). TikTok: Zapier/Make se isi URL par `name`, `phone`, `message` bhejein
3. Lead Inbox aur Pipeline (New enquiry) mein aa jati hai. In leads ko call ya WhatsApp se jawab dein

**Phone calls aur walk-ins:** Inbox ka **+** button ya Pipeline ka **Add lead**.

## Deploy (Vercel)

1. Code GitHub par push karein, Vercel par project import karein
2. Vercel → Settings → Environment Variables mein `.env.local` wali saari values daalein (`NEXT_PUBLIC_SITE_URL` = live domain)
3. Supabase → Authentication → URL Configuration mein Site URL = live domain
4. Client ke kaam ke liye Vercel ka Pro plan chahiye (Hobby plan commercial kaam ke liye nahi)

---

## Folder structure

```
src/
  config/site.ts            clinic ki saari maloomat (website)
  app/page.tsx              landing page
  app/actions/booking.ts    booking form → CRM
  app/login/                staff login
  app/crm/                  dashboard, inbox, appointments, pipeline, patients, settings
  app/api/webhooks/whatsapp WhatsApp webhook
  app/api/webhooks/meta     Facebook Messenger + Instagram DM + Lead Ads
  app/api/webhooks/leads    Google / TikTok / doosre forms
  app/api/chat              website live chat
  app/api/cron/automations  har 5 minute automations bhejne wala worker
  app/api/inbox/send        inbox se reply bhejna
  components/site/          website ke sections
  components/crm/           CRM ke components
  lib/supabase/             browser, server aur admin clients
  lib/ai/                   AI receptionist (provider, free slots, replies, summary)
  lib/automations/          automations ki list aur worker (template / 24 ghante ka qanoon)
  lib/channels.ts           har channel par message bhejna (text aur WhatsApp template)
  lib/inbox-store.ts        har channel se aaya message → patient + chat + message
  lib/whatsapp.ts           Meta webhook helpers
supabase/
  migrations/0001_init.sql  database, RLS, triggers, realtime
  migrations/0002_...sql    AI receptionist + channel connections
  migrations/0003_...sql    khud ba khud pipeline (triggers + hourly job)
  migrations/0004_...sql    Growth Center (booked_by, AI reply time)
  migrations/0005_...sql    WhatsApp automations (queue + triggers)
  seed.sql                  sample clinic data
```

---

## Agla kaam (baqi Phase 1 aur Phase 2)

- Rx Pad (live preview, print, PDF, WhatsApp)
- Billing aur receipts
- Archive page aur Recycle Bin screen
- Images/voice notes chat mein dikhana (abhi sirf label aata hai)
- Doctors & Staff page (doctor add/edit, staff roles), Owner reports
- Reminder ke jawab ("1" = confirm) par appointment khud Confirmed karna

## Note

Ye project jis jagah likha gaya wahan npm packages install nahi ho sakte the, is liye `npm run build` wahan nahi chal saka.
Code ke types check kiye gaye hain. Saari SQL migrations aur seed ek asli Postgres 16 par chala kar pipeline ke automatic qadam aur automations ki queue (confirmation, doctor alert, reminder, reschedule, no-show, done) test ki gayi hain. Apne computer par `npm install` aur `npm run build` chalayein. Koi error aaye to us ka text bhej dein.
