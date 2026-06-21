#!/usr/bin/env node
/**
 * Comprehensive test data seeding script for DCLLC healthcare management system.
 *
 * Populates:
 * - 1 tenant for testing
 * - Staff members (1 admin, 1 manager, 2 staff)
 * - Residents (3-4 with different statuses)
 * - User accounts (staff + residents)
 * - Staff assignments
 * - Pending admission forms (different statuses)
 * - Daily progress notes (different review statuses)
 * - Care plans with goals
 *
 * Usage:
 *   node scripts/seed-test-data.js
 *
 * Idempotent: Skips entities that already exist (no duplicate errors).
 */

import dotenv from 'dotenv';
import { resolve } from 'path';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import crypto from 'crypto';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Encryption constants
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LEN = 16;
const RESIDENT_ENCRYPTED_FIELDS = [
  'first_name', 'last_name', 'preferred_name',
  'medicaid_id', 'phone', 'email',
  'address_line1', 'address_line2',
  'ssn_last4',
];

// Helper: get or create tenant key
function getTenantKey() {
  const keyStr = process.env.DEV_TENANT_ENCRYPTION_KEY || 'dev-only-32-char-key-change-me!!';
  return Buffer.from(keyStr).toString('hex').slice(0, 64).padEnd(64, '0');
}

// Encrypt plaintext PHI using AES-256-GCM
function encryptPHI(plaintext, keyHex) {
  if (!plaintext) return null;
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64');
}

// Encrypt fields in an object
function encryptFields(obj, fields, keyHex) {
  const result = { ...obj };
  for (const field of fields) {
    if (result[field] != null) {
      result[field] = encryptPHI(String(result[field]), keyHex);
    }
  }
  return result;
}

// Track what we've created
const summary = {
  tenant: 0,
  staff: 0,
  residents: 0,
  userAccounts: 0,
  staffAssignments: 0,
  pendingAdmissions: 0,
  dailyProgressNotes: 0,
  carePlans: 0,
  goals: 0,
};

async function seedTestData() {
  const client = await pool.connect();
  const tenantKey = getTenantKey();

  try {
    await client.query('BEGIN');

    // ──────────────────────────────────────────────────────────────────────────
    // 1. TENANT
    // ──────────────────────────────────────────────────────────────────────────
    let tenantId;
    let { rows: tenants } = await client.query('SELECT id FROM ref.tenants LIMIT 1');

    if (tenants.length > 0) {
      tenantId = tenants[0].id;
      console.log(`✓ Using existing tenant: ${tenantId}`);
    } else {
      tenantId = uuidv4();
      await client.query(
        `INSERT INTO ref.tenants (id, name, timezone, is_active)
         VALUES ($1, $2, $3, $4)`,
        [tenantId, 'Test Facility - DCLLC', 'America/Los_Angeles', true]
      );
      summary.tenant++;
      console.log(`✓ Created tenant: ${tenantId}`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. STAFF MEMBERS
    // ──────────────────────────────────────────────────────────────────────────
    const staffData = [
      {
        first_name: 'Alice',
        last_name: 'Administrator',
        email: 'alice.admin@dcllc.org',
        phone: '(555) 100-0001',
        role: 'admin',
        hire_date: '2022-01-15',
        employee_id: 'SA-001',
        license_no: 'RN-A001',
      },
      {
        first_name: 'Margaret',
        last_name: 'Manager',
        email: 'margaret.mgr@dcllc.org',
        phone: '(555) 100-0002',
        role: 'manager',
        hire_date: '2022-06-01',
        employee_id: 'SM-001',
        license_no: 'LCSW-M001',
      },
      {
        first_name: 'Sarah',
        last_name: 'Clinical',
        email: 'sarah.clinical@dcllc.org',
        phone: '(555) 100-0003',
        role: 'staff',
        hire_date: '2023-03-15',
        employee_id: 'SS-001',
        license_no: 'RN-S001',
      },
      {
        first_name: 'David',
        last_name: 'Diarist',
        email: 'david.diarist@dcllc.org',
        phone: '(555) 100-0004',
        role: 'staff',
        hire_date: '2023-09-10',
        employee_id: 'SS-002',
        license_no: 'CNA-001',
      },
    ];

    const staffIds = [];
    for (const staffMember of staffData) {
      // Check if staff already exists
      let { rows: existing } = await client.query(
        'SELECT id FROM ref.staff WHERE tenant_id = $1 AND email = $2',
        [tenantId, staffMember.email]
      );

      let staffId;
      if (existing.length > 0) {
        staffId = existing[0].id;
        console.log(`✓ Staff already exists: ${staffMember.first_name} ${staffMember.last_name}`);
      } else {
        staffId = uuidv4();
        await client.query(
          `INSERT INTO ref.staff (id, tenant_id, first_name, last_name, email, phone, role, hire_date, license_no, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            staffId,
            tenantId,
            staffMember.first_name,
            staffMember.last_name,
            staffMember.email,
            staffMember.phone,
            staffMember.role,
            staffMember.hire_date,
            staffMember.license_no,
            true,
          ]
        );
        summary.staff++;
        console.log(`✓ Created staff: ${staffMember.first_name} ${staffMember.last_name}`);
      }
      staffIds.push({ id: staffId, role: staffMember.role, email: staffMember.email });
    }

    const adminStaff = staffIds.find((s) => s.role === 'admin') || staffIds[0];
    const careStaff = staffIds.filter((s) => s.role === 'staff');

    // ──────────────────────────────────────────────────────────────────────────
    // 3. RESIDENTS
    // ──────────────────────────────────────────────────────────────────────────
    const residentData = [
      {
        first_name: 'Robert',
        last_name: 'Williams',
        preferred_name: 'Bob',
        date_of_birth: '1945-03-15',
        gender: 'Male',
        medicaid_id: 'MCD-1001-2345',
        ssn_last4: '1234',
        phone: '(555) 200-1001',
        email: 'robert.williams@example.com',
        address_line1: '123 Oak Street',
        address_line2: 'Apt 4B',
        city: 'Portland',
        state: 'OR',
        postal_code: '97201',
        primary_diagnosis: 'Major Depressive Disorder',
        status: 'active',
      },
      {
        first_name: 'Patricia',
        last_name: 'Anderson',
        preferred_name: 'Patty',
        date_of_birth: '1950-07-22',
        gender: 'Female',
        medicaid_id: 'MCD-2002-3456',
        ssn_last4: '5678',
        phone: '(555) 200-1002',
        email: 'patricia.anderson@example.com',
        address_line1: '456 Elm Avenue',
        address_line2: null,
        city: 'Portland',
        state: 'OR',
        postal_code: '97202',
        primary_diagnosis: 'Bipolar Disorder II',
        status: 'active',
      },
      {
        first_name: 'James',
        last_name: 'Martinez',
        preferred_name: 'Jim',
        date_of_birth: '1965-11-08',
        gender: 'Male',
        medicaid_id: 'MCD-3003-4567',
        ssn_last4: '9012',
        phone: '(555) 200-1003',
        email: 'james.martinez@example.com',
        address_line1: '789 Maple Drive',
        address_line2: null,
        city: 'Portland',
        state: 'OR',
        postal_code: '97203',
        primary_diagnosis: 'Substance Use Disorder',
        status: 'inactive',
      },
      {
        first_name: 'Linda',
        last_name: 'Davis',
        preferred_name: 'Lin',
        date_of_birth: '1955-05-30',
        gender: 'Female',
        medicaid_id: 'MCD-4004-5678',
        ssn_last4: '3456',
        phone: '(555) 200-1004',
        email: 'linda.davis@example.com',
        address_line1: '321 Pine Road',
        address_line2: null,
        city: 'Portland',
        state: 'OR',
        postal_code: '97204',
        primary_diagnosis: 'Anxiety Disorder',
        status: 'active',
      },
    ];

    const residentIds = [];
    for (let idx = 0; idx < residentData.length; idx++) {
      const resident = residentData[idx];
      // Check by medicaid_id (unencrypted matching via index position)
      let { rows: existing } = await client.query(
        `SELECT id FROM care.residents
         WHERE tenant_id = $1
         AND (created_at > NOW() - INTERVAL '1 hour')
         AND gender = $2
         AND date_of_birth = $3
         LIMIT 1`,
        [tenantId, resident.gender, resident.date_of_birth]
      );

      let residentId;
      if (existing.length > 0) {
        residentId = existing[0].id;
        console.log(`✓ Resident already exists: ${resident.first_name} ${resident.last_name}`);
      } else {
        residentId = uuidv4();

        // Encrypt PHI fields
        const encrypted = encryptFields(resident, RESIDENT_ENCRYPTED_FIELDS, tenantKey);

        await client.query(
          `INSERT INTO care.residents
           (id, tenant_id, first_name, last_name, preferred_name, date_of_birth, gender, medicaid_id, ssn_last4, phone, email, address_line1, address_line2, city, state, postal_code, primary_diagnosis, intake_date, status, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
          [
            residentId,
            tenantId,
            encrypted.first_name,
            encrypted.last_name,
            encrypted.preferred_name,
            resident.date_of_birth,
            resident.gender,
            encrypted.medicaid_id,
            encrypted.ssn_last4,
            encrypted.phone,
            encrypted.email,
            encrypted.address_line1,
            encrypted.address_line2,
            resident.city,
            resident.state,
            resident.postal_code,
            resident.primary_diagnosis,
            new Date().toISOString().split('T')[0],
            resident.status,
            adminStaff.id,
          ]
        );
        summary.residents++;
        console.log(`✓ Created resident: ${resident.first_name} ${resident.last_name}`);
      }
      residentIds.push(residentId);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 4. USER ACCOUNTS (Staff + Residents)
    // ──────────────────────────────────────────────────────────────────────────

    // Staff user accounts
    const staffRoleMap = {
      admin: 'admin',
      manager: 'manager',
      staff: 'staff',
      superadmin: 'superadmin',
    };

    for (const staff of staffIds) {
      let { rows: existing } = await client.query(
        'SELECT id FROM care.user_accounts WHERE tenant_id = $1 AND email = $2',
        [tenantId, staff.email]
      );

      if (existing.length === 0) {
        const hash = await bcrypt.hash('TestPassword123!', 12);
        await client.query(
          `INSERT INTO care.user_accounts (id, tenant_id, staff_id, email, password_hash, role, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            uuidv4(),
            tenantId,
            staff.id,
            staff.email,
            hash,
            staffRoleMap[staff.role] || 'staff',
            true,
          ]
        );
        summary.userAccounts++;
        console.log(`✓ Created staff user account: ${staff.email}`);
      } else {
        console.log(`✓ Staff user account already exists: ${staff.email}`);
      }
    }

    // Resident user accounts
    for (const residentId of residentIds) {
      let { rows: resident } = await client.query(
        `SELECT id FROM care.residents WHERE id = $1`,
        [residentId]
      );

      if (resident.length > 0) {
        let { rows: existing } = await client.query(
          'SELECT id FROM care.user_accounts WHERE tenant_id = $1 AND resident_id = $2',
          [tenantId, residentId]
        );

        if (existing.length === 0) {
          const hash = await bcrypt.hash('ResidentPass123!', 12);
          const email = `resident.${uuidv4().slice(0, 8)}@dependablecare.org`;
          await client.query(
            `INSERT INTO care.user_accounts (id, tenant_id, resident_id, email, password_hash, role, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              uuidv4(),
              tenantId,
              residentId,
              email,
              hash,
              'resident_care_of',
              true,
            ]
          );
          summary.userAccounts++;
          console.log(`✓ Created resident user account: ${email}`);
        }
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 5. STAFF ASSIGNMENTS
    // ──────────────────────────────────────────────────────────────────────────
    for (let i = 0; i < residentIds.length; i++) {
      const residentId = residentIds[i];
      const assignedStaff = careStaff[i % careStaff.length];

      let { rows: existing } = await client.query(
        'SELECT id FROM care.staff_assignments WHERE resident_id = $1 AND staff_id = $2',
        [residentId, assignedStaff.id]
      );

      if (existing.length === 0) {
        await client.query(
          `INSERT INTO care.staff_assignments (id, tenant_id, resident_id, staff_id, assignment_date, is_active)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            uuidv4(),
            tenantId,
            residentId,
            assignedStaff.id,
            new Date().toISOString().split('T')[0],
            true,
          ]
        );
        summary.staffAssignments++;
        console.log(`✓ Created staff assignment: Staff → Resident ${i + 1}`);
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 6. PENDING ADMISSIONS (Different Statuses)
    // ──────────────────────────────────────────────────────────────────────────
    const admissionData = [
      {
        status: 'pending',
        full_name: 'Michael Johnson',
        date_of_birth: '1960-02-10',
        gender: 'Male',
        contact_phone: '(555) 300-1001',
        email: 'michael.johnson@example.com',
        primary_diagnosis: 'Post-Traumatic Stress Disorder',
        allergies: 'Penicillin',
        current_medications: 'Sertraline 100mg daily',
        primary_physician: 'Dr. Sarah Chen',
        primary_physician_phone: '(555) 400-0001',
        legal_status: 'voluntary',
        insurance_type: 'Medicaid',
        insurance_member_id: 'MCD-5005-6789',
        medicaid_id: 'MCD-5005-6789',
        ssn_last4: '7890',
        pre_screening_complete: true,
        nursing_assessment_complete: false,
        advance_directive_complete: false,
      },
      {
        status: 'approved',
        full_name: 'Jennifer Thompson',
        date_of_birth: '1948-11-25',
        gender: 'Female',
        contact_phone: '(555) 300-1002',
        email: 'jennifer.thompson@example.com',
        primary_diagnosis: 'Generalized Anxiety Disorder',
        allergies: 'None',
        current_medications: 'Escitalopram 10mg daily, Hydroxyzine PRN',
        primary_physician: 'Dr. Robert Walsh',
        primary_physician_phone: '(555) 400-0002',
        legal_status: 'voluntary',
        insurance_type: 'Medicare',
        insurance_member_id: 'MED-6006-7890',
        pre_screening_complete: true,
        nursing_assessment_complete: true,
        advance_directive_complete: true,
        approved_at: new Date(Date.now() - 7 * 86400000).toISOString(), // 7 days ago
      },
      {
        status: 'rejected',
        full_name: 'Thomas Wilson',
        date_of_birth: '1970-06-12',
        gender: 'Male',
        contact_phone: '(555) 300-1003',
        email: 'thomas.wilson@example.com',
        primary_diagnosis: 'Adjustment Disorder',
        allergies: 'Sulfa drugs',
        current_medications: 'None',
        primary_physician: 'Dr. Amanda Lee',
        primary_physician_phone: '(555) 400-0003',
        legal_status: 'voluntary',
        insurance_type: 'Private',
        insurance_member_id: 'PRIV-7007-8901',
        pre_screening_complete: true,
        nursing_assessment_complete: true,
        advance_directive_complete: false,
        rejection_reason: 'Does not meet admission criteria at this time',
      },
    ];

    for (const admission of admissionData) {
      let { rows: existing } = await client.query(
        `SELECT id FROM care.pending_admissions WHERE tenant_id = $1 AND full_name = $2`,
        [tenantId, admission.full_name]
      );

      if (existing.length === 0) {
        const approvedBy = admission.status === 'approved' ? adminStaff.id : null;

        await client.query(
          `INSERT INTO care.pending_admissions
           (id, tenant_id, status, created_by, approved_by, approved_at, rejection_reason,
            pre_screening_complete, nursing_assessment_complete, advance_directive_complete,
            full_name, date_of_birth, gender, contact_phone, email, primary_diagnosis,
            allergies, current_medications, primary_physician, primary_physician_phone,
            legal_status, insurance_type, insurance_member_id, medicaid_id, ssn_last4)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)`,
          [
            uuidv4(),
            tenantId,
            admission.status,
            adminStaff.id,
            approvedBy,
            admission.approved_at || null,
            admission.rejection_reason || null,
            admission.pre_screening_complete,
            admission.nursing_assessment_complete,
            admission.advance_directive_complete,
            admission.full_name,
            admission.date_of_birth,
            admission.gender,
            admission.contact_phone,
            admission.email,
            admission.primary_diagnosis,
            admission.allergies,
            admission.current_medications,
            admission.primary_physician,
            admission.primary_physician_phone,
            admission.legal_status,
            admission.insurance_type,
            admission.insurance_member_id,
            admission.medicaid_id,
            admission.ssn_last4,
          ]
        );
        summary.pendingAdmissions++;
        console.log(`✓ Created pending admission: ${admission.full_name} (${admission.status})`);
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 7. DAILY PROGRESS NOTES (Different Review Statuses)
    // ──────────────────────────────────────────────────────────────────────────
    const noteTemplates = [
      {
        mood: 'stable',
        affect: 'congruent',
        participation: 'Attended morning group therapy, participated actively',
        medications: 'All medications taken as prescribed',
        incidents: 'None reported',
        sleep: 'Slept well, no disturbances',
        meals: 'Ate all meals, good appetite',
      },
      {
        mood: 'anxious',
        affect: 'somewhat anxious but appropriate',
        participation: 'Attended afternoon yoga class, seemed relaxed after',
        medications: 'Morning dose taken, evening pending',
        incidents: 'Minor argument during group resolved peacefully',
        sleep: 'Reported some restlessness, used relaxation techniques',
        meals: 'Skipped lunch, ate dinner fully',
      },
      {
        mood: 'depressed',
        affect: 'flat',
        participation: 'Declined activities, spent time in room reading',
        medications: 'All doses taken',
        incidents: 'None',
        sleep: 'Slept 10+ hours',
        meals: 'Ate breakfast and dinner, refused lunch',
      },
    ];

    for (let i = 0; i < residentIds.length; i++) {
      const residentId = residentIds[i];
      const assignedStaff = careStaff[i % careStaff.length];

      // Create 3 notes per resident (different dates, different review statuses)
      for (let day = 0; day < 3; day++) {
        const noteBody = noteTemplates[day % noteTemplates.length];
        const reviewStatus = day === 0 ? 'pending' : day === 1 ? 'approved' : 'rejected';

        let { rows: existing } = await client.query(
          `SELECT id FROM care.daily_progress_notes
           WHERE resident_id = $1 AND note_date = (CURRENT_DATE - ($2::int))::date AND shift = $3`,
          [residentId, day, day % 2 === 0 ? 'morning' : 'afternoon']
        );

        if (existing.length === 0) {
          await client.query(
            `INSERT INTO care.daily_progress_notes
             (id, tenant_id, resident_id, staff_id, note_date, shift, note_body, review_status)
             VALUES ($1, $2, $3, $4, (CURRENT_DATE - ($5::int))::date, $6, $7::jsonb, $8)`,
            [
              uuidv4(),
              tenantId,
              residentId,
              assignedStaff.id,
              day,
              day % 2 === 0 ? 'morning' : 'afternoon',
              JSON.stringify(noteBody),
              reviewStatus,
            ]
          );
          summary.dailyProgressNotes++;
          console.log(
            `✓ Created progress note for Resident ${i + 1}: ${reviewStatus} (${day} days ago)`
          );
        }
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 8. CARE PLANS WITH GOALS (for active residents)
    // ──────────────────────────────────────────────────────────────────────────
    if (residentIds.length > 0) {
      const activeResidents = residentIds.slice(0, Math.min(2, residentIds.length)); // First 2 residents

      for (const residentId of activeResidents) {
        let { rows: existing } = await client.query(
          'SELECT id FROM care.care_plans WHERE resident_id = $1 AND status = $2 AND created_at > NOW() - INTERVAL \'1 hour\'',
          [residentId, 'active']
        );

        if (existing.length === 0) {
          const carePlanId = uuidv4();
          await client.query(
            `INSERT INTO care.care_plans
             (id, tenant_id, resident_id, status, created_by, effective_date)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [carePlanId, tenantId, residentId, 'active', adminStaff.id, new Date().toISOString().split('T')[0]]
          );
          summary.carePlans++;
          console.log(`✓ Created care plan for resident`);

          // Create 2 goals per care plan
          for (let g = 0; g < 2; g++) {
            const goalId = uuidv4();
            const goals = [
              'Improve mood and emotional stability',
              'Develop healthy coping strategies',
              'Improve social engagement and participation',
              'Stabilize medication regimen and compliance',
            ];

            await client.query(
              `INSERT INTO care.goals
               (id, care_plan_id, tenant_id, goal_text, status, goal_number)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [goalId, carePlanId, tenantId, goals[g % goals.length], 'in_progress', g + 1]
            );
            summary.goals++;
            console.log(`  ✓ Created goal: ${goals[g % goals.length]}`);
          }
        }
      }
    }

    await client.query('COMMIT');
    console.log('\n' + '═'.repeat(70));
    console.log('SEED SUMMARY');
    console.log('═'.repeat(70));
    Object.entries(summary).forEach(([key, count]) => {
      if (count > 0) {
        console.log(`  ${key.padEnd(30)} ${count}`);
      }
    });
    console.log('═'.repeat(70) + '\n');

    console.log('Test Data Ready!\n');
    console.log('Sample Login Credentials:');
    console.log('  Admin:    alice.admin@dcllc.org / TestPassword123!');
    console.log('  Manager:  margaret.mgr@dcllc.org / TestPassword123!');
    console.log('  Staff:    sarah.clinical@dcllc.org / TestPassword123!');
    console.log('  Resident: resident.* / ResidentPass123!');
    console.log('\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('✗ Seed failed:', err.message);
    if (err.detail) console.error('  Detail:', err.detail);
    console.error(err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedTestData().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
