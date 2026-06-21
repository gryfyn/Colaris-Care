import dotenv from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';
import pg from 'pg';

dotenv.config({ path: join(process.cwd(), '.env.local') });
dotenv.config();

const connectionString = process.env.VERIFY_DATABASE_URL || process.env.REBUILD_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('ERROR: set VERIFY_DATABASE_URL or REBUILD_DATABASE_URL to the target PostgreSQL connection string.');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString,
  ssl: process.env.VERIFY_DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

const routeFiles = [
  'src/app/api/v1/auth/login/route.js',
  'src/app/api/v1/auth/me/route.js',
  'src/app/api/v1/admission/forms/route.js',
  'src/app/api/v1/admission/forms/[id]/route.js',
  'src/app/api/v1/admission/pending/route.js',
  'src/app/api/v1/admission/approved/route.js',
  'src/app/api/v1/admission/[id]/review/route.js',
  'src/app/api/v1/residents/route.js',
  'src/app/api/v1/residents/[id]/route.js',
  'src/app/api/v1/admin/residents/route.js',
  'src/app/api/v1/staff/route.js',
  'src/app/api/v1/staff/create/route.js',
  'src/app/api/v1/staff/assignments/route.js',
  'src/app/api/v1/care-plans/route.js',
  'src/app/api/v1/care-plans-wizard/route.js',
  'src/app/api/v1/medications/route.js',
  'src/app/api/v1/medication-administrations/route.js',
  'src/app/api/v1/appointments/route.js',
  'src/app/api/v1/announcements/route.js',
  'src/app/api/v1/notifications/route.js',
  'src/app/api/v1/resident-requests/route.js',
  'src/app/api/v1/activities/route.js',
  'src/app/api/v1/incidents/route.js',
  'src/app/api/v1/drug-disposal/route.js',
  'src/app/api/v1/evacuation-drills/route.js',
  'src/app/api/v1/daily-progress-notes/route.js',
  'src/app/api/v1/face-sheets/route.js',
  'src/app/api/v1/admin/forms-history/pre-screening/route.js',
  'src/app/api/v1/admin/forms-history/nursing-assessment/route.js',
  'src/app/api/v1/admin/forms-history/advance-directive/route.js',
  'src/app/api/v1/admin/forms-history/care-plans/route.js',
  'src/app/api/v1/admin/accounts/route.js',
  'src/app/api/v1/admin/overview/route.js',
];

const requiredTables = [
  ['ref', 'tenants'],
  ['ref', 'staff'],
  ['ref', 'staff_certifications'],
  ['ref', 'organizations'],
  ['care', 'user_accounts'],
  ['care', 'residents'],
  ['care', 'pending_admissions'],
  ['care', 'pre_admission_screenings'],
  ['care', 'nursing_admissions'],
  ['care', 'advance_directives'],
  ['care', 'admission_documents'],
  ['care', 'resident_face_sheets'],
  ['care', 'staff_assignments'],
  ['care', 'care_plans'],
  ['care', 'goals'],
  ['care', 'objectives'],
  ['care', 'safety_plans'],
  ['care', 'medications'],
  ['care', 'medication_administrations'],
  ['care', 'appointments'],
  ['care', 'announcements'],
  ['care', 'notifications'],
  ['care', 'resident_requests'],
  ['care', 'activities'],
  ['care', 'incident_reports'],
  ['care', 'drug_disposal_records'],
  ['care', 'evacuation_drills'],
  ['care', 'daily_progress_notes'],
  ['care', 'password_reset_tokens'],
  ['audit_log', 'event_log'],
  ['audit_log', 'credential_history'],
];

const requiredColumns = {
  'ref.staff': ['id', 'tenant_id', 'first_name', 'last_name', 'role', 'email', 'license_no', 'employee_id', 'is_active'],
  'care.user_accounts': [
    'id', 'tenant_id', 'staff_id', 'resident_id', 'email', 'password_hash', 'role',
    'is_active', 'failed_attempts', 'locked_until', 'last_login', 'password_changed_required',
  ],
  'care.residents': [
    'id', 'tenant_id', 'first_name', 'last_name', 'date_of_birth', 'gender',
    'status', 'deleted_at', 'created_at', 'updated_at',
  ],
  'care.pending_admissions': [
    'id', 'tenant_id', 'form_type', 'full_name', 'status', 'pre_screening_data',
    'nursing_assessment_data', 'advance_directive_data', 'submitted_at',
  ],
  'care.care_plans': ['id', 'tenant_id', 'resident_id', 'status', 'form_data', 'version', 'deleted_at'],
  'care.medications': ['id', 'tenant_id', 'resident_id', 'drug_name', 'dosage', 'frequency', 'is_active'],
  'care.appointments': ['id', 'tenant_id', 'resident_id', 'title', 'appointment_at', 'is_facility_event'],
  'care.notifications': ['id', 'tenant_id', 'user_id', 'title', 'body', 'is_read', 'type', 'category'],
  'care.resident_requests': ['id', 'tenant_id', 'resident_id', 'request_type', 'description', 'status'],
  'care.activities': ['id', 'tenant_id', 'title', 'activity_date', 'day_of_week', 'is_active'],
  'care.incident_reports': ['id', 'tenant_id', 'resident_id', 'incident_date', 'incident_type', 'review_status'],
  'care.drug_disposal_records': ['id', 'tenant_id', 'resident_id', 'disposal_date', 'drug_name', 'review_status'],
  'care.evacuation_drills': ['id', 'tenant_id', 'drill_date', 'location', 'review_status'],
  'care.daily_progress_notes': ['id', 'tenant_id', 'resident_id', 'staff_id', 'note_date', 'shift', 'review_status'],
  'care.resident_face_sheets': ['id', 'tenant_id', 'resident_id', 'form_data', 'photo_url'],
};

function describeError(error) {
  const nested = Array.isArray(error?.errors) ? error.errors.filter(Boolean) : [];
  const details = nested.map((item) => [item.code, item.address, item.port].filter(Boolean).join(' '));
  return [error?.code, error?.message, ...details].filter(Boolean).join(' | ') || String(error);
}

async function tableExists(client, schema, table) {
  const { rows } = await client.query(
    `SELECT 1 FROM information_schema.tables
      WHERE table_schema = $1 AND table_name = $2 AND table_type = 'BASE TABLE'`,
    [schema, table]
  );
  return rows.length > 0;
}

async function columnSet(client, schema, table) {
  const { rows } = await client.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2`,
    [schema, table]
  );
  return new Set(rows.map((row) => row.column_name));
}

async function countAdmins(client) {
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS n
       FROM care.user_accounts
      WHERE role IN ('admin', 'superadmin')
        AND staff_id IS NOT NULL
        AND is_active = TRUE`
  );
  return rows[0].n;
}

async function run() {
  let client;
  const failures = [];

  try {
    client = await pool.connect();
    for (const routeFile of routeFiles) {
      if (!existsSync(join(process.cwd(), routeFile))) {
        failures.push(`Missing route file: ${routeFile}`);
      }
    }

    for (const [schema, table] of requiredTables) {
      if (!(await tableExists(client, schema, table))) {
        failures.push(`Missing table: ${schema}.${table}`);
      }
    }

    for (const [relation, columns] of Object.entries(requiredColumns)) {
      const [schema, table] = relation.split('.');
      if (!(await tableExists(client, schema, table))) continue;
      const existing = await columnSet(client, schema, table);
      for (const column of columns) {
        if (!existing.has(column)) failures.push(`Missing column: ${relation}.${column}`);
      }
    }

    const admins = await countAdmins(client);
    if (admins < 1) failures.push('No active admin/superadmin staff login account exists.');

    if (failures.length) {
      console.error('\nVerification failed:');
      for (const failure of failures) console.error(`- ${failure}`);
      process.exitCode = 1;
      return;
    }

    console.log(`Verification passed: ${routeFiles.length} route files, ${requiredTables.length} tables, and active admin credentials are present.`);
  } catch (error) {
    console.error('Verification error:', describeError(error));
    process.exitCode = 1;
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

run();
