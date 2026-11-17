-- Seed data for one clinic. Run AFTER all migrations (0001 to 0005).
-- Everything below is SAMPLE data so the CRM is not empty on first login.
-- Change the clinic details, doctors and services to the real clinic's before going live.

do $$
declare
  v_clinic uuid;
  s_new uuid; s_engaged uuid; s_booked uuid; s_visited uuid; s_nurture uuid; s_lost uuid;
  d1 uuid; d2 uuid; d3 uuid;
  sv_check uuid; sv_white uuid; sv_braces uuid; sv_rct uuid; sv_implant uuid; sv_kids uuid;
  p_ali uuid; p_maham uuid; p_imran uuid; p_nimra uuid; p_usman uuid; p_sobia uuid; p_zainab uuid;
  p_rabia uuid; p_waqas uuid; p_danish uuid; p_komal uuid; p_nadia uuid; p_zara uuid;
  c uuid;
  v_today date := (now() at time zone 'Asia/Karachi')::date;
begin
  insert into public.clinics (name, phone, email, address, ai_instructions)
  values (
    'Rumi Dental Clinic', '+92 330 2988880', null, 'Al-Shifa Hospital, opposite Mushtaq Mui-ud-Din Hospital, Pindi Road, Kotli, Azad Kashmir',
    E'SAMPLE: replace with the clinic''s real details.\nPayment: cash, card, bank transfer, JazzCash, Easypaisa. Instalments for braces and implants.\nParking: free parking in front of the clinic.\nFirst consultation: Rs 1,500 (adjusted if treatment starts the same day).'
  )
  returning id into v_clinic;

  -- Pipeline. auto_key links each stage to an automatic step (see 0003_pipeline_automation.sql).
  insert into public.pipeline_stages (clinic_id, name, color, position, auto_key) values (v_clinic, 'New enquiry', '#3b82f6', 1, 'new') returning id into s_new;
  insert into public.pipeline_stages (clinic_id, name, color, position, auto_key) values (v_clinic, 'AI engaged', '#6366f1', 2, 'engaged') returning id into s_engaged;
  insert into public.pipeline_stages (clinic_id, name, color, position, auto_key) values (v_clinic, 'Appointment booked', '#14aea6', 3, 'booked') returning id into s_booked;
  insert into public.pipeline_stages (clinic_id, name, color, position, auto_key) values (v_clinic, 'Visited', '#22c55e', 4, 'visited') returning id into s_visited;
  insert into public.pipeline_stages (clinic_id, name, color, position, auto_key) values (v_clinic, 'Nurturing', '#f59e0b', 5, 'nurturing') returning id into s_nurture;
  insert into public.pipeline_stages (clinic_id, name, color, position, auto_key, is_side) values (v_clinic, 'Lost', '#94a3b8', 6, 'lost', true) returning id into s_lost;

  insert into public.doctors (clinic_id, name, degree, pmdc_no, specialization, fee) values
    (v_clinic, 'Dr. Daniyal', null, null, 'Dentist', 3000) returning id into d1;
  -- Doctor's WhatsApp number (for appointment alerts) is added on the Automations page.
  d2 := d1; d3 := d1; -- single-doctor clinic: sample appointments below all go to Dr. Daniyal

  insert into public.services (clinic_id, name, price, duration_min) values (v_clinic, 'Check-up & Cleaning', 2500, 30) returning id into sv_check;
  insert into public.services (clinic_id, name, price, duration_min) values (v_clinic, 'Teeth Whitening', 18000, 60) returning id into sv_white;
  insert into public.services (clinic_id, name, price, duration_min) values (v_clinic, 'Braces Consultation', 3000, 45) returning id into sv_braces;
  insert into public.services (clinic_id, name, price, duration_min) values (v_clinic, 'Root Canal', 15000, 60) returning id into sv_rct;
  insert into public.services (clinic_id, name, price, duration_min) values (v_clinic, 'Dental Implant', 120000, 90) returning id into sv_implant;
  insert into public.services (clinic_id, name, price, duration_min) values (v_clinic, 'Kids Check-up', 2000, 30) returning id into sv_kids;

  -- ------------------------------------------------------------------
  -- Sample leads (fake people, fake numbers), one or two per channel
  -- ------------------------------------------------------------------

  -- AI engaged · WhatsApp from an Instagram ad · HOT
  insert into public.patients (clinic_id, name, phone, source, interest, expected_value, lead_score)
  values (v_clinic, 'Ali Raza', '923010000001', 'whatsapp', 'Teeth Whitening', 18000, 92) returning id into p_ali;
  insert into public.conversations (clinic_id, patient_id, channel, external_id, source_tag, ai_summary, ai_summary_at)
  values (v_clinic, p_ali, 'whatsapp', '923010000001', 'Instagram ad',
          'Ali asked about teeth whitening (from Rs 18,000) and picked the 4:00 PM slot tomorrow. High intent: ready to book.', now() - interval '45 minutes')
  returning id into c;
  insert into public.messages (clinic_id, conversation_id, sender, body, created_at) values
    (v_clinic, c, 'patient', 'Assalam o alaikum, teeth whitening hoti hai? fee kitni hai?', now() - interval '50 minutes'),
    (v_clinic, c, 'ai', 'Walaikum assalam! Ji, teeth whitening hoti hai, Rs 18,000 se shuru. Final plan dentist check-up ke baad batate hain. Kal 12:30 PM ya 4:00 PM ka slot khaali hai, kaunsa theek rahega?', now() - interval '49 minutes'),
    (v_clinic, c, 'patient', '4 baje theek hai', now() - interval '45 minutes');

  -- New enquiry · Facebook Messenger from an ad
  insert into public.patients (clinic_id, name, phone, source, interest, expected_value, lead_score)
  values (v_clinic, 'Maham Saleem', null, 'facebook', 'Braces Consultation', 95000, 78) returning id into p_maham;
  insert into public.conversations (clinic_id, patient_id, channel, external_id, source_tag)
  values (v_clinic, p_maham, 'facebook', '7000000000000002', 'Facebook ad') returning id into c;
  insert into public.messages (clinic_id, conversation_id, sender, body, created_at) values
    (v_clinic, c, 'patient', 'Braces lagwane mein kitna time lagta hai aur total kharcha kitna hoga?', now() - interval '1 day');

  -- New enquiry · Instagram DM from a reel
  insert into public.patients (clinic_id, name, phone, source, interest, expected_value, lead_score)
  values (v_clinic, 'Imran Latif', null, 'instagram', 'Teeth Whitening', 18000, 64) returning id into p_imran;
  insert into public.conversations (clinic_id, patient_id, channel, external_id, source_tag)
  values (v_clinic, p_imran, 'instagram', '1780000000000003', 'Instagram reel') returning id into c;
  insert into public.messages (clinic_id, conversation_id, sender, body, created_at) values
    (v_clinic, c, 'patient', 'Whitening ke baad sensitivity to nahi hoti?', now() - interval '2 hours');

  -- New enquiry · Google Ads lead form · HOT
  insert into public.patients (clinic_id, name, phone, source, interest, expected_value, lead_score)
  values (v_clinic, 'Nimra Fayyaz', '923010000004', 'google', 'Check-up & Cleaning', 2500, 88) returning id into p_nimra;
  insert into public.conversations (clinic_id, patient_id, channel, external_id, source_tag)
  values (v_clinic, p_nimra, 'google', 'lead:923010000004', 'Google Ads form') returning id into c;
  insert into public.messages (clinic_id, conversation_id, sender, body, created_at) values
    (v_clinic, c, 'patient', E'New lead from Google Ads form\nPhone: 0301 0000004\nService: Check-up & Cleaning\nPreferred time: evening', now() - interval '20 hours');

  -- New enquiry · Website chat
  insert into public.patients (clinic_id, name, phone, source, interest, expected_value, lead_score)
  values (v_clinic, 'Usman Tariq', '923010000006', 'website', 'Kids Check-up', 2000, 58) returning id into p_usman;
  insert into public.conversations (clinic_id, patient_id, channel, external_id, source_tag)
  values (v_clinic, p_usman, 'website', 'chat:SAMPLEusmanToken0000000001', 'Website chat') returning id into c;
  insert into public.messages (clinic_id, conversation_id, sender, body, created_at) values
    (v_clinic, c, 'patient', 'Bachay ka pehla dental check-up karwana hai, Saturday ko clinic open hai?', now() - interval '3 hours');

  -- AI engaged · WhatsApp, staff replied
  insert into public.patients (clinic_id, name, phone, source, interest, expected_value, lead_score)
  values (v_clinic, 'Sobia Naz', '923010000007', 'whatsapp', 'Check-up & Cleaning', 2500, 45) returning id into p_sobia;
  insert into public.conversations (clinic_id, patient_id, channel, external_id)
  values (v_clinic, p_sobia, 'whatsapp', '923010000007') returning id into c;
  insert into public.messages (clinic_id, conversation_id, sender, body, created_at) values
    (v_clinic, c, 'patient', 'Scaling ki fee kitni hai?', now() - interval '26 hours'),
    (v_clinic, c, 'staff', 'Check-up aur cleaning Rs 2,500 hai. Aap kis din aana chahengi?', now() - interval '25 hours');

  -- AI engaged · Instagram · HOT (handed to staff: pain)
  insert into public.patients (clinic_id, name, phone, source, interest, expected_value, lead_score)
  values (v_clinic, 'Zainab Iqbal', null, 'instagram', 'Root Canal', 15000, 90) returning id into p_zainab;
  insert into public.conversations (clinic_id, patient_id, channel, external_id, source_tag, needs_human, ai_receptionist, ai_summary, ai_summary_at)
  values (v_clinic, p_zainab, 'instagram', '1780000000000008', 'Instagram ad', true, false,
          'Zainab has strong tooth pain and asked about root canal cost (from Rs 15,000). Needs a quick call to book an urgent check-up.', now() - interval '2 days')
  returning id into c;
  insert into public.messages (clinic_id, conversation_id, sender, body, created_at) values
    (v_clinic, c, 'patient', 'Daant mein bohat dard hai, root canal ka kya kharcha hai?', now() - interval '2 days 10 minutes'),
    (v_clinic, c, 'ai', 'Bohat afsos hua sun kar. Root canal Rs 15,000 se shuru hota hai, lekin dard mein jaldi check-up zaroori hai. Hamari team abhi aap se rabta karti hai.', now() - interval '2 days 9 minutes'),
    (v_clinic, c, 'system', 'AI handed this chat to the team and paused. Turn AI back on any time.', now() - interval '2 days 9 minutes');

  -- Appointment booked · TikTok (logged by front desk)
  insert into public.patients (clinic_id, name, phone, source, interest, expected_value, lead_score)
  values (v_clinic, 'Rabia Anwar', '923010000009', 'tiktok', 'Braces Consultation', 3000, 66) returning id into p_rabia;
  insert into public.conversations (clinic_id, patient_id, channel, external_id, source_tag)
  values (v_clinic, p_rabia, 'tiktok', 'manual:923010000009', 'TikTok (logged)') returning id into c;
  insert into public.messages (clinic_id, conversation_id, sender, body, created_at) values
    (v_clinic, c, 'patient', 'TikTok par video dekhi, braces consultation chahiye.', now() - interval '4 days'),
    (v_clinic, c, 'system', 'Lead logged by Front desk', now() - interval '4 days');

  -- Appointment booked · Phone call · HOT
  insert into public.patients (clinic_id, name, phone, source, interest, expected_value, lead_score)
  values (v_clinic, 'Waqas Hameed', '923010000010', 'phone_call', 'Root Canal', 15000, 88) returning id into p_waqas;
  insert into public.conversations (clinic_id, patient_id, channel, external_id, source_tag)
  values (v_clinic, p_waqas, 'phone', 'manual:923010000010', 'Phone call') returning id into c;
  insert into public.messages (clinic_id, conversation_id, sender, body, created_at) values
    (v_clinic, c, 'patient', 'Called: root canal ke liye aaj ka time chahiye.', now() - interval '1 day'),
    (v_clinic, c, 'system', 'Lead logged by Front desk', now() - interval '1 day');

  -- Visited · Facebook
  insert into public.patients (clinic_id, name, phone, source, interest, expected_value, lead_score)
  values (v_clinic, 'Danish Kamal', '923010000011', 'facebook', 'Dental Implant', 120000, 64) returning id into p_danish;
  insert into public.conversations (clinic_id, patient_id, channel, external_id, source_tag)
  values (v_clinic, p_danish, 'facebook', '7000000000000011', 'Facebook ad') returning id into c;
  insert into public.messages (clinic_id, conversation_id, sender, body, created_at) values
    (v_clinic, c, 'patient', 'Implant ke baare mein detail chahiye.', now() - interval '6 days'),
    (v_clinic, c, 'staff', 'Ji zaroor. Pehle Dr. Daniyal X-ray dekh kar plan banayenge. Kya Thursday 11 baje aa sakte hain?', now() - interval '6 days' + interval '20 minutes');

  -- Visited · Website booking form
  insert into public.patients (clinic_id, name, phone, source, interest, expected_value, lead_score)
  values (v_clinic, 'Komal Riaz', '923010000012', 'website', 'Check-up & Cleaning', 2500, 94) returning id into p_komal;
  insert into public.conversations (clinic_id, patient_id, channel, external_id, source_tag)
  values (v_clinic, p_komal, 'website', '923010000012', 'Booking form') returning id into c;
  insert into public.messages (clinic_id, conversation_id, sender, body, created_at) values
    (v_clinic, c, 'patient', E'New appointment request from the website\nTreatment: Check-up & Cleaning\nPreferred date: tomorrow', now() - interval '3 days');

  -- Nurturing · WhatsApp (missed her appointment)
  insert into public.patients (clinic_id, name, phone, source, interest, expected_value, lead_score)
  values (v_clinic, 'Nadia Hussain', '923010000013', 'whatsapp', 'Teeth Whitening', 18000, 48) returning id into p_nadia;
  insert into public.conversations (clinic_id, patient_id, channel, external_id)
  values (v_clinic, p_nadia, 'whatsapp', '923010000013') returning id into c;
  insert into public.messages (clinic_id, conversation_id, sender, body, created_at) values
    (v_clinic, c, 'patient', 'Whitening par koi offer chal rahi hai?', now() - interval '12 days'),
    (v_clinic, c, 'ai', 'Abhi koi offer nahi, lekin whitening Rs 18,000 se shuru hai. Kya main aap ke liye slot rakh doon?', now() - interval '12 days' + interval '1 minute');

  -- Lost · TikTok
  insert into public.patients (clinic_id, name, phone, source, interest, expected_value, lead_score)
  values (v_clinic, 'Zara Mumtaz', '923010000014', 'tiktok', 'Teeth Whitening', 18000, 30) returning id into p_zara;
  insert into public.conversations (clinic_id, patient_id, channel, external_id, source_tag)
  values (v_clinic, p_zara, 'tiktok', 'manual:923010000014', 'TikTok (logged)') returning id into c;
  insert into public.messages (clinic_id, conversation_id, sender, body, created_at) values
    (v_clinic, c, 'patient', 'Price list bhej dein.', now() - interval '40 days');

  -- Appointments (today's schedule shows on the dashboard)
  insert into public.appointments (clinic_id, patient_id, doctor_id, service_id, starts_at, duration_min, type, status) values
    (v_clinic, p_danish, d2, sv_implant, (v_today + time '11:00') at time zone 'Asia/Karachi', 90, 'new', 'arrived'),
    (v_clinic, p_waqas, d2, sv_rct, (v_today + time '12:30') at time zone 'Asia/Karachi', 60, 'procedure', 'confirmed'),
    (v_clinic, p_rabia, d1, sv_braces, (v_today + 1 + time '17:00') at time zone 'Asia/Karachi', 45, 'new', 'booked'),
    (v_clinic, p_komal, d3, sv_check, (v_today - 1 + time '16:00') at time zone 'Asia/Karachi', 30, 'new', 'done'),
    (v_clinic, p_nadia, d1, sv_white, (v_today - 10 + time '18:00') at time zone 'Asia/Karachi', 60, 'new', 'no_show');

  -- The automatic pipeline reacted to the sample messages above; put each sample lead in its intended column.
  update public.patients set stage_id = s_new where id in (p_maham, p_imran, p_nimra, p_usman);
  update public.patients set stage_id = s_engaged where id in (p_ali, p_sobia, p_zainab);
  update public.patients set stage_id = s_booked where id in (p_rabia, p_waqas);
  update public.patients set stage_id = s_visited where id in (p_danish, p_komal);
  update public.patients set stage_id = s_nurture where id = p_nadia;
  update public.patients set stage_id = s_lost where id = p_zara;

  -- Default WhatsApp automations (created after the sample appointments, so no messages are queued for them).
  perform public.ensure_default_automations(v_clinic);
end $$;
