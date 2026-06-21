/**
 * Seeds care plans (+ goals), medications, appointments, and staff assignments
 * for every resident, so the resident portal, admin care-plan view, and staff
 * care-plan view all have realistic data to render.
 *
 * Idempotent: skips residents that already have an active care plan, and uses
 * INSERT ... ON CONFLICT DO NOTHING patterns where applicable.
 */
import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config();
import pg from 'pg';
import crypto from 'crypto';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const GOAL_BLUEPRINTS = [
  { section: 'Mental Health', domain: 'mental_health', text: 'Engage in weekly CBT sessions and apply coping skills to reduce intrusive thoughts.', status: 'in_progress' },
  { section: 'Wellness',      domain: 'wellness',      text: 'Walk 30 minutes daily and attend two group fitness sessions per week.',              status: 'in_progress' },
  { section: 'Social',        domain: 'social',        text: 'Participate in at least one community activity per week to rebuild social connections.', status: 'achieved' },
];

const MED_BLUEPRINTS = [
  { drug_name: 'Sertraline',  drug_strength: '50 mg',  drug_form: 'tablet', route: 'oral', dosage: '1 tablet', frequency: 'Once daily in the morning', prescriber: 'Dr. Sarah Johnson', indication: 'Mood stabilization' },
  { drug_name: 'Melatonin',   drug_strength: '3 mg',   drug_form: 'tablet', route: 'oral', dosage: '1 tablet', frequency: '30 minutes before bedtime',  prescriber: 'Dr. Sarah Johnson', indication: 'Sleep support' },
  { drug_name: 'Multivitamin', drug_strength: '1 ',    drug_form: 'tablet', route: 'oral', dosage: '1 tablet', frequency: 'Once daily with breakfast',  prescriber: 'Dr. Sarah Johnson', indication: 'Nutritional support' },
];

const APPOINTMENT_BLUEPRINTS = [
  // upcoming
  { offsetDays: 2,   appointment_type: 'medical', title: 'Dr. Lin — Psychiatry Follow-up', location: 'Wellness Clinic, Suite 2', duration_minutes: 45, status: 'scheduled', notes: 'Medication review' },
  { offsetDays: 7,   appointment_type: 'social',  title: 'Family Visit',                   location: 'Visiting Room',           duration_minutes: 60, status: 'scheduled', notes: 'Pre-approved family visit' },
  { offsetDays: 14,  appointment_type: 'dental',  title: 'Annual Dental Cleaning',         location: 'Community Dental Clinic', duration_minutes: 60, status: 'scheduled', notes: 'Transport via facility van' },
  // past
  { offsetDays: -10, appointment_type: 'medical', title: 'Dr. Lin — Initial Intake',       location: 'Wellness Clinic, Suite 2', duration_minutes: 90, status: 'completed', notes: 'Initial psychiatric assessment completed.' },
  { offsetDays: -30, appointment_type: 'medical', title: 'PCP Annual Physical',            location: 'Springfield Health Partners', duration_minutes: 60, status: 'completed', notes: 'No acute findings. Continue current medications.' },
];

const client = await pool.connect();
try {
  await client.query('BEGIN');

  const { rows: residents } = await client.query(
    `SELECT id, tenant_id FROM care.residents WHERE deleted_at IS NULL ORDER BY intake_date`
  );
  const { rows: staffRows } = await client.query(
    `SELECT id, first_name, last_name, role FROM ref.staff WHERE is_active = TRUE`
  );
  if (!residents.length) throw new Error('No residents found. Run db:seed first.');
  if (!staffRows.length) throw new Error('No staff found. Run db:seed first.');

  const counselor = staffRows.find(s => s.role === 'admin' || s.role === 'manager') || staffRows[0];
  const director  = staffRows.find(s => s.role === 'manager') || staffRows[0];

  console.log(`Seeding portal data for ${residents.length} residents...`);
  console.log(`  Counselor: ${counselor.first_name} ${counselor.last_name} (${counselor.role})`);
  console.log(`  Director:  ${director.first_name} ${director.last_name} (${director.role})\n`);

  let plansCreated = 0, goalsCreated = 0, medsCreated = 0, apptsCreated = 0, assignmentsCreated = 0;

  for (const r of residents) {
    // ── 1. Care plan (skip if active one exists) ─────────────────────────────
    const { rows: existingPlans } = await client.query(
      `SELECT id FROM care.care_plans WHERE resident_id = $1 AND deleted_at IS NULL AND status = 'active' LIMIT 1`,
      [r.id]
    );
    let carePlanId = existingPlans[0]?.id;
    if (!carePlanId) {
      carePlanId = crypto.randomUUID();
      const today = new Date().toISOString().split('T')[0];
      const reviewDate = new Date(Date.now() + 90 * 86_400_000).toISOString().split('T')[0];
      const expirationDate = new Date(Date.now() + 365 * 86_400_000).toISOString().split('T')[0];
      await client.query(
        `INSERT INTO care.care_plans (
            id, tenant_id, resident_id, plan_type, status,
            effective_date, expiration_date, review_date, review_schedule,
            primary_counselor_id, program_director_id,
            counselor_signed_at, director_signed_at, client_sig_status,
            created_by, updated_by, version
         ) VALUES ($1,$2,$3,'initial','active',$4,$5,$6,'90-day',$7,$8,NOW(),NOW(),'signed',$9,$9,1)`,
        [carePlanId, r.tenant_id, r.id, today, expirationDate, reviewDate, counselor.id, director.id, counselor.id]
      );
      plansCreated++;
    }

    // ── 2. Goals (only if the plan has none) ─────────────────────────────────
    const { rows: existingGoals } = await client.query(
      `SELECT id FROM care.goals WHERE care_plan_id = $1 AND deleted_at IS NULL`,
      [carePlanId]
    );
    if (!existingGoals.length) {
      for (let i = 0; i < GOAL_BLUEPRINTS.length; i++) {
        const g = GOAL_BLUEPRINTS[i];
        await client.query(
          `INSERT INTO care.goals (id, care_plan_id, tenant_id, section, goal_number, goal_text, status, domain, target_date)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [crypto.randomUUID(), carePlanId, r.tenant_id, g.section, i + 1, g.text, g.status, g.domain,
           new Date(Date.now() + 180 * 86_400_000).toISOString().split('T')[0]]
        );
        goalsCreated++;
      }
    }

    // ── 3. Medications (skip if any active meds exist) ───────────────────────
    const { rows: existingMeds } = await client.query(
      `SELECT id FROM care.medications WHERE resident_id = $1 AND is_active = TRUE LIMIT 1`,
      [r.id]
    );
    if (!existingMeds.length) {
      for (const m of MED_BLUEPRINTS) {
        await client.query(
          `INSERT INTO care.medications (
             id, tenant_id, resident_id, drug_name, drug_strength, drug_form, route,
             dosage, frequency, prescriber, indication, start_date,
             is_controlled_substance, is_prn, is_active, created_by
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,FALSE,FALSE,TRUE,$13)`,
          [crypto.randomUUID(), r.tenant_id, r.id, m.drug_name, m.drug_strength, m.drug_form, m.route,
           m.dosage, m.frequency, m.prescriber, m.indication,
           new Date().toISOString().split('T')[0], counselor.id]
        );
        medsCreated++;
      }
    }

    // ── 4. Appointments (skip if any future appointments exist) ──────────────
    const { rows: existingAppts } = await client.query(
      `SELECT id FROM care.appointments WHERE resident_id = $1 LIMIT 1`,
      [r.id]
    );
    if (!existingAppts.length) {
      for (const apt of APPOINTMENT_BLUEPRINTS) {
        const scheduledAt = new Date(Date.now() + apt.offsetDays * 86_400_000);
        scheduledAt.setHours(10, 0, 0, 0); // 10:00 local
        await client.query(
          `INSERT INTO care.appointments (
             id, tenant_id, resident_id, staff_id, appointment_type, title, description,
             location, scheduled_at, duration_minutes, status, notes, created_by
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [crypto.randomUUID(), r.tenant_id, r.id, counselor.id, apt.appointment_type, apt.title,
           apt.title, apt.location, scheduledAt.toISOString(),
           apt.duration_minutes, apt.status, apt.notes, counselor.id]
        );
        apptsCreated++;
      }
    }

    // ── 5. Staff assignments (assign all staff users to all residents) ───────
    const staffUsers = staffRows.filter(s => ['staff', 'manager'].includes(s.role));
    for (const s of staffUsers) {
      const r1 = await client.query(
        `INSERT INTO care.staff_assignments (id, tenant_id, staff_id, resident_id, assignment_date, is_active)
         VALUES ($1, $2, $3, $4, CURRENT_DATE, TRUE)
         ON CONFLICT DO NOTHING`,
        [crypto.randomUUID(), r.tenant_id, s.id, r.id]
      );
      if (r1.rowCount) assignmentsCreated++;
    }
  }

  await client.query('COMMIT');

  console.log('Seed complete:');
  console.log(`  Care plans created:        ${plansCreated}`);
  console.log(`  Goals created:             ${goalsCreated}`);
  console.log(`  Medications created:       ${medsCreated}`);
  console.log(`  Appointments created:      ${apptsCreated}`);
  console.log(`  Staff assignments created: ${assignmentsCreated}`);
} catch (err) {
  await client.query('ROLLBACK');
  console.error('Seed failed:', err);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
