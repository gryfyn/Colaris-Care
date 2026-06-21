/**
 * Comprehensive seed for every table that the admin/staff/resident pages
 * actually read from. Idempotent — skips entities that already exist.
 */
import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config();
import pg from 'pg';
import crypto from 'crypto';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const counts = {};
function inc(t, n = 1) { counts[t] = (counts[t] || 0) + n; }

const client = await pool.connect();
// Helper: wrap a section in a SAVEPOINT so one failure doesn't abort the whole batch.
async function savepoint(name, fn) {
  const sp = 'sp_' + name.replace(/[^a-z0-9_]/gi, '_');
  await client.query(`SAVEPOINT ${sp}`);
  try { await fn(); await client.query(`RELEASE SAVEPOINT ${sp}`); }
  catch (err) {
    await client.query(`ROLLBACK TO SAVEPOINT ${sp}`).catch(() => {});
    console.error(`  ✗ ${name}: ${err.message}`);
    counts[`✗ ${name}`] = err.code || 'FAIL';
  }
}
try {
  await client.query('BEGIN');

  // ── Context ────────────────────────────────────────────────────────────────
  const { rows: tenants }  = await client.query(`SELECT id FROM ref.tenants LIMIT 1`);
  const tenantId           = tenants[0].id;
  const { rows: residents } = await client.query(`SELECT id, tenant_id FROM care.residents WHERE deleted_at IS NULL ORDER BY intake_date`);
  const { rows: staff }    = await client.query(`SELECT id, first_name, last_name, role FROM ref.staff WHERE tenant_id = $1`, [tenantId]);
  const { rows: carePlans } = await client.query(`SELECT id, resident_id, tenant_id FROM care.care_plans WHERE deleted_at IS NULL AND status = 'active'`);
  const { rows: meds }     = await client.query(`SELECT id, resident_id, tenant_id, drug_name, is_active FROM care.medications WHERE is_active = TRUE`);
  const { rows: goals }    = await client.query(`SELECT id, care_plan_id, tenant_id FROM care.goals WHERE deleted_at IS NULL`);

  const adminStaff   = staff.find(s => s.role === 'admin')   || staff[0];
  const managerStaff = staff.find(s => s.role === 'manager') || adminStaff;
  const careStaff    = staff.filter(s => s.role === 'staff' || s.role === 'manager');

  console.log(`Tenant ${tenantId} · ${residents.length} residents · ${staff.length} staff · ${carePlans.length} care plans · ${meds.length} meds`);

  // ── ref.organizations ─────────────────────────────────────────────────────
  const orgsData = [
    { name: 'Oregon DHS',                      org_type: 'state_agency',     phone: '503-945-5944' },
    { name: 'Springfield Medical Center',      org_type: 'hospital',         phone: '503-555-1010' },
    { name: 'Cascade Behavioral Health',       org_type: 'referring_clinic', phone: '503-555-2020' },
    { name: 'Multnomah County Mental Health',  org_type: 'county_agency',    phone: '503-988-4111' },
    { name: 'Lifeworks NW',                    org_type: 'community_mh',     phone: '503-645-9010' },
  ];
  for (const o of orgsData) {
    const r = await client.query(
      `INSERT INTO ref.organizations (id, tenant_id, name, org_type, phone)
       VALUES (gen_random_uuid(), $1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [tenantId, o.name, o.org_type, o.phone]);
    if (r.rowCount) inc('ref.organizations');
  }

  // ── ref.staff_certifications ──────────────────────────────────────────────
  for (const s of staff) {
    const r = await client.query(
      `INSERT INTO ref.staff_certifications (id, staff_id, tenant_id, certification_type, certification_name, certificate_no, issued_date, expiry_date)
       SELECT gen_random_uuid(), $1::uuid, $2::uuid, $3::varchar, $4::text, $5::text, $6::date, $7::date
       WHERE NOT EXISTS (SELECT 1 FROM ref.staff_certifications WHERE staff_id = $1::uuid AND certification_type = $3::varchar)`,
      [s.id, tenantId, 'CPR', 'CPR/First Aid Certification', `CPR-${s.id.slice(0,8)}`,
       new Date(Date.now() - 365 * 86_400_000).toISOString().split('T')[0],
       new Date(Date.now() + 365 * 86_400_000).toISOString().split('T')[0]]);
    if (r.rowCount) inc('ref.staff_certifications');
  }

  // ── care.activities ───────────────────────────────────────────────────────
  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const activitiesData = [
    { day: 'Monday',    time: '09:00', name: 'Morning Walk',      cat: 'Wellness',    loc: 'Courtyard',     dur: 30, desc: 'A gentle group walk to start the week.' },
    { day: 'Monday',    time: '10:00', name: 'CBT Group',         cat: 'Therapy',     loc: 'Common Room',   dur: 60, desc: 'Cognitive Behavioral Therapy group.' },
    { day: 'Monday',    time: '13:00', name: 'Life Skills',       cat: 'Life Skills', loc: 'Kitchen',       dur: 60, desc: 'Cooking, budgeting, everyday skills.' },
    { day: 'Tuesday',   time: '09:00', name: 'Mindfulness & Yoga',cat: 'Wellness',    loc: 'Living Room',   dur: 45, desc: 'Guided breathing and gentle movement.' },
    { day: 'Tuesday',   time: '14:00', name: 'DBT Skills Group',  cat: 'Therapy',     loc: 'Group Room',    dur: 60, desc: 'Emotional regulation and distress tolerance.' },
    { day: 'Wednesday', time: '10:00', name: 'CBT Group',         cat: 'Therapy',     loc: 'Common Room',   dur: 60, desc: 'CBT focused on practical coping tools.' },
    { day: 'Wednesday', time: '15:00', name: 'Art Therapy',       cat: 'Creative',    loc: 'Activity Room', dur: 60, desc: 'Drawing, painting, collage.' },
    { day: 'Thursday',  time: '09:00', name: 'Mindfulness & Yoga',cat: 'Wellness',    loc: 'Living Room',   dur: 45, desc: 'Guided breathing and gentle movement.' },
    { day: 'Thursday',  time: '16:00', name: 'Music Therapy',     cat: 'Creative',    loc: 'Music Room',    dur: 45, desc: 'Rhythm, song, and sound exploration.' },
    { day: 'Friday',    time: '10:00', name: 'CBT Group',         cat: 'Therapy',     loc: 'Common Room',   dur: 60, desc: 'CBT focused on practical coping.' },
    { day: 'Friday',    time: '15:00', name: 'Creative Writing',  cat: 'Creative',    loc: 'Library',       dur: 60, desc: 'Journaling, storytelling, poetry.' },
    { day: 'Friday',    time: '19:00', name: 'Movie Night',       cat: 'Community',   loc: 'Common Room',   dur: 120, desc: 'Community movie night with popcorn.' },
    { day: 'Saturday',  time: '11:00', name: 'Cooking Class',     cat: 'Life Skills', loc: 'Kitchen',       dur: 90, desc: 'Learn a new recipe together.' },
    { day: 'Saturday',  time: '14:00', name: 'Outdoor Recreation',cat: 'Wellness',    loc: 'Courtyard',     dur: 60, desc: 'Outdoor activities and fresh air.' },
    { day: 'Sunday',    time: '10:00', name: 'Reflection',        cat: 'Community',   loc: 'Quiet Room',    dur: 60, desc: 'Peaceful space for reflection.' },
    { day: 'Sunday',    time: '13:00', name: 'Family Visit Hours',cat: 'Community',   loc: 'Visiting Room', dur: 180, desc: 'Pre-approved family visits.' },
  ];
  const { rows: existAct } = await client.query(`SELECT COUNT(*)::int AS n FROM care.activities WHERE tenant_id = $1`, [tenantId]);
  if (existAct[0].n === 0) {
    for (const a of activitiesData) {
      await client.query(
        `INSERT INTO care.activities (id, tenant_id, day_of_week, start_time, name, location, category, description, duration_minutes, active, created_by)
         VALUES (gen_random_uuid(), $1, $2, $3::time, $4, $5, $6, $7, $8, TRUE, $9)`,
        [tenantId, a.day, a.time, a.name, a.loc, a.cat, a.desc, a.dur, adminStaff.id]);
      inc('care.activities');
    }
  }

  // ── care.announcements ────────────────────────────────────────────────────
  const annsData = [
    { title: 'Spring BBQ — Saturday',         body: 'We are hosting a spring BBQ in the courtyard. All residents welcome. Please RSVP with staff.', audience: 'all',       priority: 'normal' },
    { title: 'Visitor Policy Reminder',       body: 'Visitors must check in at the front desk with valid ID. Visiting hours: 10AM–12PM and 2PM–6PM daily.', audience: 'all',     priority: 'normal' },
    { title: 'New Activity: Music Therapy',   body: 'Music Therapy is now scheduled every Thursday at 4:00 PM in the Music Room. Talk to your counselor to join.', audience: 'residents', priority: 'low' },
    { title: 'Staff Training: HIPAA Refresher', body: 'Mandatory HIPAA training for all clinical staff next Wednesday at 2 PM.', audience: 'staff',  priority: 'high' },
    { title: 'Fire Drill This Friday',        body: 'A scheduled fire drill will be conducted Friday at 11 AM. Please cooperate with staff direction.', audience: 'all',  priority: 'high' },
  ];
  const { rows: existAnn } = await client.query(`SELECT COUNT(*)::int AS n FROM care.announcements WHERE tenant_id = $1`, [tenantId]);
  if (existAnn[0].n === 0) {
    for (const a of annsData) {
      await client.query(
        `INSERT INTO care.announcements (id, tenant_id, title, body, audience, priority, published_at, expires_at, created_by, active)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW() - INTERVAL '${Math.floor(Math.random() * 14)} days', NOW() + INTERVAL '30 days', $6, TRUE)`,
        [tenantId, a.title, a.body, a.audience, a.priority, adminStaff.id]);
      inc('care.announcements');
    }
  }

  // ── care.resident_requests ────────────────────────────────────────────────
  const reqsData = [
    { type: 'Appointment Request',         details: 'Could I please schedule a dental cleaning?', status: 'pending' },
    { type: 'Supply/Item Request',         details: 'Need new toothpaste and shampoo.',           status: 'completed' },
    { type: 'Dietary Preference',          details: 'Could I get gluten-free bread at meals?',    status: 'approved' },
    { type: 'Activity Request',            details: 'Would love to try a meditation class.',      status: 'in_review' },
    { type: 'Message to Care Team',        details: 'Feeling more anxious lately, can we talk?',  status: 'completed' },
  ];
  const { rows: existReq } = await client.query(`SELECT COUNT(*)::int AS n FROM care.resident_requests`);
  if (existReq[0].n === 0) {
    for (const r of residents) {
      for (let i = 0; i < 2; i++) {
        const data = reqsData[(Math.floor(Math.random() * reqsData.length))];
        await client.query(
          `INSERT INTO care.resident_requests (id, resident_id, tenant_id, request_type, details, submitted_date, status, response_notes, handled_by)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, CURRENT_DATE - ${i * 3}, $5, $6, $7)`,
          [r.id, r.tenant_id, data.type, data.details, data.status,
           data.status === 'pending' ? null : 'Thanks — we will take care of this.',
           data.status === 'pending' ? null : adminStaff.id]);
        inc('care.resident_requests');
      }
    }
  }

  // ── care.objectives (one per goal) ────────────────────────────────────────
  const { rows: existObj } = await client.query(`SELECT COUNT(*)::int AS n FROM care.objectives`);
  if (existObj[0].n === 0) {
    for (const g of goals) {
      await client.query(
        `INSERT INTO care.objectives (id, goal_id, tenant_id, objective_number, objective_text, intervention, frequency, responsible_party, status)
         VALUES (gen_random_uuid(), $1, $2, 1, $3, $4, 'weekly', 'staff', 'in_progress')`,
        [g.id, g.tenant_id, 'Track progress weekly and review with counselor.', 'Counselor will review with resident in weekly 1:1.']);
      inc('care.objectives');
    }
  }

  // ── care.representatives ──────────────────────────────────────────────────
  const repsData = [
    { fn: 'Mary', ln: 'Williams', rel: 'spouse', phone: '555-100-2001', primary: true,  emer: true,  legal: false },
    { fn: 'John', ln: 'Anderson', rel: 'son',    phone: '555-100-2002', primary: true,  emer: true,  legal: false },
    { fn: 'Sarah', ln: 'Martinez', rel: 'daughter', phone: '555-100-2003', primary: true, emer: true, legal: false },
    { fn: 'David', ln: 'Davis',   rel: 'brother', phone: '555-100-2004', primary: true, emer: true,  legal: false },
    { fn: 'Lisa', ln: 'Wilson',   rel: 'sister', phone: '555-100-2005', primary: true,  emer: true,  legal: false },
  ];
  const { rows: existReps } = await client.query(`SELECT COUNT(*)::int AS n FROM care.representatives`);
  if (existReps[0].n === 0) {
    for (let i = 0; i < residents.length; i++) {
      const r = residents[i]; const d = repsData[i % repsData.length];
      await client.query(
        `INSERT INTO care.representatives (id, resident_id, tenant_id, first_name, last_name, relation_to_resident, primary_phone, is_primary, is_emergency_contact, has_legal_authority)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [r.id, r.tenant_id, d.fn, d.ln, d.rel, d.phone, d.primary, d.emer, d.legal]);
      inc('care.representatives');
    }
  }

  // ── care.care_team_members ────────────────────────────────────────────────
  const { rows: existCTM } = await client.query(`SELECT COUNT(*)::int AS n FROM care.care_team_members`);
  if (existCTM[0].n === 0) {
    for (const r of residents) {
      for (const s of careStaff.slice(0, 3)) {
        await client.query(
          `INSERT INTO care.care_team_members (id, resident_id, tenant_id, staff_id, role, is_primary, start_date)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, CURRENT_DATE)`,
          [r.id, r.tenant_id, s.id, s.role, s === careStaff[0]]);
        inc('care.care_team_members');
      }
    }
  }

  // ── care.resident_face_sheets ─────────────────────────────────────────────
  const { rows: existFS } = await client.query(`SELECT COUNT(*)::int AS n FROM care.resident_face_sheets`);
  if (existFS[0].n === 0) {
    for (const r of residents) {
      await client.query(
        `INSERT INTO care.resident_face_sheets (id, tenant_id, resident_id, admit_date, marital_status, religious_preference,
            insurance, insurance_id, housing, pharmacy, primary_diagnosis,
            emergency_contact_relation, emergency_contact_phone,
            allergies, pcp, emergency_medical)
         VALUES (gen_random_uuid(), $1, $2, CURRENT_DATE - 7, 'single', 'none',
                 'OHP', 'OHP-${Math.floor(Math.random()*1000000)}', 'private_room', 'CVS Springfield', 'Major Depressive Disorder',
                 'family', '555-100-9000',
                 '[{"name":"NKDA"}]'::jsonb, '{"name":"Dr. Lin","phone":"555-200-3001"}'::jsonb, '{"name":"Springfield ER","phone":"503-555-9911"}'::jsonb)`,
        [r.tenant_id, r.id]);
      inc('care.resident_face_sheets');
    }
  }

  // ── care.safety_plans (one per care plan) ─────────────────────────────────
  const { rows: existSP } = await client.query(`SELECT COUNT(*)::int AS n FROM care.safety_plans`);
  if (existSP[0].n === 0) {
    for (const cp of carePlans) {
      await client.query(
        `INSERT INTO care.safety_plans (id, care_plan_id, tenant_id, crisis_plan, crisis_resources, suicide_risk_level, suicide_risk_protocol, self_harm_risk_level, aggression_risk_level, awol_risk_level, de_escalation_techniques)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 'low', $5, 'low', 'low', 'low', $6)`,
        [cp.id, cp.tenant_id,
         'If feeling overwhelmed: 1) Find staff. 2) Use grounding (5-4-3-2-1). 3) Step outside for fresh air. 4) Call counselor.',
         'Crisis Line: 988. On-call counselor: ext 1010.',
         'Standard observation. Weekly check-ins with counselor. Annual reassessment.',
         '1) Active listening 2) Validate emotions 3) Redirect to safe space 4) Offer choices 5) Time-out if escalating.']);
      inc('care.safety_plans');
    }
  }

  // ── care.daily_living_needs ───────────────────────────────────────────────
  const { rows: existDLN } = await client.query(`SELECT COUNT(*)::int AS n FROM care.daily_living_needs`);
  if (existDLN[0].n === 0) {
    for (const cp of carePlans) {
      await client.query(
        `INSERT INTO care.daily_living_needs (id, care_plan_id, tenant_id, hygiene_support, nutrition_support, medication_management, mobility_assistance, sleep_schedule, social_activities)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)`,
        [cp.id, cp.tenant_id,
         'Independent with reminders for grooming.',
         'Three balanced meals daily. Snacks available 2x.',
         'Self-administers with staff observation. Daily MAR review.',
         'Fully ambulatory. No assistive device needed.',
         'Bedtime 10 PM, wake 7 AM. Use sleep hygiene techniques.',
         'Encouraged to attend at least 3 group activities per week.']);
      inc('care.daily_living_needs');
    }
  }

  // ── care.legal_advocacy ───────────────────────────────────────────────────
  const { rows: existLA } = await client.query(`SELECT COUNT(*)::int AS n FROM care.legal_advocacy`);
  if (existLA[0].n === 0) {
    for (const cp of carePlans) {
      await client.query(
        `INSERT INTO care.legal_advocacy (id, care_plan_id, tenant_id, legal_status, legal_obligations, dcs_involvement)
         VALUES (gen_random_uuid(), $1, $2, 'voluntary', 'None', FALSE)`,
        [cp.id, cp.tenant_id]);
      inc('care.legal_advocacy');
    }
  }

  // ── care.discharge_plans ──────────────────────────────────────────────────
  const { rows: existDP } = await client.query(`SELECT COUNT(*)::int AS n FROM care.discharge_plans`);
  if (existDP[0].n === 0) {
    for (const cp of carePlans) {
      await client.query(
        `INSERT INTO care.discharge_plans (id, care_plan_id, resident_id, tenant_id, discharge_type, planned_discharge_date, discharge_destination, housing_plan, follow_up_appointments, medication_plan)
         VALUES (gen_random_uuid(), $1, $2, $3, 'planned', CURRENT_DATE + 180, 'family_home', 'Returning to family home with daily check-ins.', 'PCP at 30/60/90 days. Therapist weekly.', 'Continue current regimen. PCP to manage refills.')`,
        [cp.id, cp.resident_id, cp.tenant_id]);
      inc('care.discharge_plans');
    }
  }

  // ── care.daily_progress_notes ─────────────────────────────────────────────
  await savepoint('care.daily_progress_notes', async () => {
  const { rows: existDPN } = await client.query(`SELECT COUNT(*)::int AS n FROM care.daily_progress_notes`);
  if (existDPN[0].n === 0) {
    const noteBody = {
      mood: 'stable',
      affect: 'congruent',
      participation: 'attended morning CBT group and engaged appropriately',
      medications: 'all PO meds taken as prescribed',
      incidents: 'none',
      sleep: 'reported good night',
      meals: 'ate all meals',
    };
    for (const r of residents) {
      for (let day = 0; day < 3; day++) {
        for (const shift of ['morning','afternoon']) {
          await client.query(
            `INSERT INTO care.daily_progress_notes (id, tenant_id, resident_id, staff_id, note_date, shift, note_body, review_status)
             VALUES (gen_random_uuid(), $1, $2, $3, (CURRENT_DATE - ($4::int))::date, $5, $6::jsonb, $7)`,
            [r.tenant_id, r.id, careStaff[0].id, day, shift,
             JSON.stringify(noteBody), day === 0 ? 'pending' : 'approved']);
          inc('care.daily_progress_notes');
        }
      }
    }
  }
  });

  // ── care.incident_reports ─────────────────────────────────────────────────
  await savepoint('care.incident_reports', async () => {
    const { rows: existIR } = await client.query(`SELECT COUNT(*)::int AS n FROM care.incident_reports`);
    if (existIR[0].n === 0) {
      for (let i = 0; i < 3; i++) {
        const r = residents[i % residents.length];
        await client.query(
          `INSERT INTO care.incident_reports (id, tenant_id, resident_id, incident_date, incident_time, incident_type, incident_location,
                                              was_witnessed, incident_details, staff_actions_taken, follow_up_plan,
                                              completed_by_name, completed_by_staff_id, completed_at, review_status)
           VALUES (gen_random_uuid(), $1, $2, (CURRENT_DATE - ($3::int))::date, '14:30'::time, $4::care.incident_type, 'Common Room',
                   TRUE, $5, 'Assessed for injury (none observed). Documented. Notified RN.', 'Continue routine observation. Review fall risk.',
                   $6, $7, NOW(), $8)`,
          [r.tenant_id, r.id, i + 1, 'accident',
           'Resident reported tripping on a rug. No injury observed. Vitals stable.',
           careStaff[0].first_name + ' ' + careStaff[0].last_name, careStaff[0].id,
           i === 0 ? 'pending' : 'approved']);
        inc('care.incident_reports');
      }
    }
  });

  // ── care.drug_disposal_records ────────────────────────────────────────────
  await savepoint('care.drug_disposal_records', async () => {
    const { rows: existDD } = await client.query(`SELECT COUNT(*)::int AS n FROM care.drug_disposal_records`);
    if (existDD[0].n === 0 && meds.length) {
      for (let i = 0; i < 3; i++) {
        const m = meds[i % meds.length];
        await client.query(
          `INSERT INTO care.drug_disposal_records (id, tenant_id, resident_id, medication_id, disposal_date, drug_name, quantity_disposed, quantity_unit,
                                                   disposal_reason, disposal_method, counting_staff_name, counting_staff_id, is_controlled_substance, hipaa_label_removed, review_status)
           VALUES (gen_random_uuid(), $1, $2, $3, (CURRENT_DATE - ($4::int))::date, $5, 30, 'tablets',
                   'discontinued'::care.drug_disposal_reason, 'pharmacy_take_back'::care.drug_disposal_method,
                   $6, $7, FALSE, TRUE, $8)`,
          [m.tenant_id, m.resident_id, m.id, i + 1, m.drug_name,
           careStaff[0].first_name + ' ' + careStaff[0].last_name, careStaff[0].id,
           i === 0 ? 'pending' : 'approved']);
        inc('care.drug_disposal_records');
      }
    }
  });

  // ── care.evacuation_drills ────────────────────────────────────────────────
  await savepoint('care.evacuation_drills', async () => {
    const { rows: existED } = await client.query(`SELECT COUNT(*)::int AS n FROM care.evacuation_drills`);
    if (existED[0].n === 0) {
      for (let i = 0; i < 2; i++) {
        const r = await client.query(
          `INSERT INTO care.evacuation_drills (id, tenant_id, drill_date, drill_time, drill_type, simulated_fire_location, exit_route,
                                                time_to_initial_safety_secs, time_to_final_safety_secs, staff_conducting_drill,
                                                created_by, staff_id, location_evacuated_to, evacuation_time_seconds, all_residents_accounted, review_status, residents_present)
           VALUES (gen_random_uuid(), $1, (CURRENT_DATE - ($2::int))::date, '11:00'::time, 'fire_morning', 'Kitchen', 'East exit',
                   90, 180, $3, $4, $4, 'Front parking lot', 240, TRUE, $5, $6::jsonb) RETURNING id`,
          [tenantId, i * 30, careStaff[0].first_name + ' ' + careStaff[0].last_name, careStaff[0].id,
           i === 0 ? 'pending' : 'approved', JSON.stringify(residents.map(x => x.id))]);
        inc('care.evacuation_drills');
        for (const res of residents) {
          await client.query(
            `INSERT INTO care.evacuation_drill_participants (id, drill_id, tenant_id, participant_type, resident_id, individual_evac_time_secs, role_during_drill)
             VALUES (gen_random_uuid(), $1, $2, 'resident', $3, $4, 'evacuee')`,
            [r.rows[0].id, tenantId, res.id, 100 + Math.floor(Math.random()*60)]);
          inc('care.evacuation_drill_participants');
        }
      }
    }
  });

  // ── care.medication_administrations ───────────────────────────────────────
  await savepoint('care.medication_administrations', async () => {
    const { rows: existMA } = await client.query(`SELECT COUNT(*)::int AS n FROM care.medication_administrations`);
    if (existMA[0].n === 0 && meds.length) {
      for (const m of meds.slice(0, 10)) {
        for (let day = 0; day < 2; day++) {
          await client.query(
            `INSERT INTO care.medication_administrations (id, tenant_id, medication_id, resident_id, administered_at, shift,
                                                           administered_by, dose_given, was_refused)
             VALUES (gen_random_uuid(), $1, $2, $3, NOW() - INTERVAL '${day} days' - INTERVAL '6 hours', 'day'::care.shift_type,
                     $4, '1 tablet', FALSE)`,
            [m.tenant_id, m.id, m.resident_id, careStaff[0].id]);
          inc('care.medication_administrations');
        }
      }
    }
  });

  // ── care.notifications ────────────────────────────────────────────────────
  const { rows: existN } = await client.query(`SELECT COUNT(*)::int AS n FROM care.notifications WHERE tenant_id = $1`, [tenantId]);
  if (existN[0].n === 0) {
    const { rows: userAccts } = await client.query(`SELECT id, role FROM care.user_accounts WHERE tenant_id = $1`, [tenantId]);
    for (const u of userAccts) {
      await client.query(
        `INSERT INTO care.notifications (id, tenant_id, user_id, type, category, title, body, is_read)
         VALUES (gen_random_uuid(), $1, $2, 'general', 'system', 'Welcome to Dependable Care', 'Your portal is ready. Explore your dashboard.', FALSE)`,
        [tenantId, u.id]);
      inc('care.notifications');
    }
  }

  await client.query('COMMIT');

  console.log('\nSeed summary:');
  Object.entries(counts).sort().forEach(([k, v]) => console.log(`  ${k.padEnd(40)} ${v}`));
  if (!Object.keys(counts).length) console.log('  (everything already seeded)');
} catch (err) {
  await client.query('ROLLBACK');
  console.error('Seed failed:', err.message);
  console.error(err);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
