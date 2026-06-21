import dotenv from 'dotenv';
import { readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

dotenv.config({ path: join(process.cwd(), '.env.local') });
dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const isApply = process.argv.includes('--apply');
const connectionString = process.env.REBUILD_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('ERROR: set REBUILD_DATABASE_URL to the target PostgreSQL connection string.');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString,
  ssl: process.env.REBUILD_DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

const ADMIN_ROLES = ['superadmin', 'admin'];

function describeError(error) {
  const nested = Array.isArray(error?.errors) ? error.errors.filter(Boolean) : [];
  const details = nested.map((item) => [item.code, item.address, item.port].filter(Boolean).join(' '));
  return [error?.code, error?.message, ...details].filter(Boolean).join(' | ') || String(error);
}

function migrationFiles() {
  const migrationsDir = join(__dirname, '../db/migrations');
  return readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => ({
      name: file,
      sql: readFileSync(join(migrationsDir, file), 'utf8'),
    }));
}

async function relationExists(client, schema, table) {
  const { rows } = await client.query(
    `SELECT 1
       FROM information_schema.tables
      WHERE table_schema = $1
        AND table_name = $2
        AND table_type = 'BASE TABLE'`,
    [schema, table]
  );
  return rows.length > 0;
}

async function backupAdminIdentities(client) {
  if (!(await relationExists(client, 'care', 'user_accounts'))) return [];

  const { rows } = await client.query(
    `SELECT
        ua.id AS account_id,
        ua.tenant_id,
        ua.staff_id,
        ua.email AS account_email,
        ua.password_hash,
        ua.username,
        ua.role AS account_role,
        ua.is_active AS account_is_active,
        ua.failed_attempts,
        ua.locked_until,
        ua.last_login,
        ua.password_changed_required,
        ua.password_changed_at,
        ua.created_at AS account_created_at,
        ua.updated_at AS account_updated_at,
        t.name AS tenant_name,
        t.oregon_npi,
        t.oar_license,
        t.timezone,
        t.is_active AS tenant_is_active,
        COALESCE(s.first_name, 'System') AS first_name,
        COALESCE(s.last_name, 'Administrator') AS last_name,
        COALESCE(s.role, ua.role) AS staff_role,
        COALESCE(s.email, ua.email) AS staff_email,
        s.phone,
        s.license_no,
        COALESCE(s.is_active, ua.is_active) AS staff_is_active,
        s.hire_date,
        s.termination_date,
        s.employee_id,
        s.shift,
        s.emergency_contact,
        s.certifications,
        s.notes,
        s.created_at AS staff_created_at,
        s.updated_at AS staff_updated_at
       FROM care.user_accounts ua
       LEFT JOIN ref.tenants t ON t.id = ua.tenant_id
       LEFT JOIN ref.staff s ON s.id = ua.staff_id
      WHERE ua.role = ANY($1)
        AND ua.staff_id IS NOT NULL
        AND ua.password_hash IS NOT NULL
      ORDER BY ua.created_at NULLS LAST, ua.email`,
    [ADMIN_ROLES]
  );

  return rows;
}

async function restoreAdminIdentities(client, admins) {
  for (const admin of admins) {
    await client.query(
      `INSERT INTO ref.tenants (id, name, oregon_npi, oar_license, timezone, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, COALESCE($5, 'America/Los_Angeles'), COALESCE($6, TRUE),
               COALESCE($7, CURRENT_TIMESTAMP), COALESCE($8, CURRENT_TIMESTAMP))
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         oregon_npi = EXCLUDED.oregon_npi,
         oar_license = EXCLUDED.oar_license,
         timezone = EXCLUDED.timezone,
         is_active = EXCLUDED.is_active,
         updated_at = CURRENT_TIMESTAMP`,
      [
        admin.tenant_id,
        admin.tenant_name || 'Dependable Care Wellness Centre',
        admin.oregon_npi,
        admin.oar_license,
        admin.timezone,
        admin.tenant_is_active,
        admin.account_created_at,
        admin.account_updated_at,
      ]
    );

    await client.query(
      `INSERT INTO ref.staff (
         id, tenant_id, first_name, last_name, role, email, phone, license_no, is_active,
         hire_date, termination_date, employee_id, shift, emergency_contact,
         certifications, notes, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, TRUE),
               $10, $11, $12, $13, $14, $15, $16,
               COALESCE($17, CURRENT_TIMESTAMP), COALESCE($18, CURRENT_TIMESTAMP))
       ON CONFLICT (tenant_id, email) DO UPDATE SET
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         role = EXCLUDED.role,
         phone = EXCLUDED.phone,
         license_no = EXCLUDED.license_no,
         is_active = EXCLUDED.is_active,
         employee_id = EXCLUDED.employee_id,
         shift = EXCLUDED.shift,
         emergency_contact = EXCLUDED.emergency_contact,
         certifications = EXCLUDED.certifications,
         notes = EXCLUDED.notes,
         updated_at = CURRENT_TIMESTAMP`,
      [
        admin.staff_id,
        admin.tenant_id,
        admin.first_name,
        admin.last_name,
        admin.staff_role || admin.account_role,
        admin.staff_email || admin.account_email,
        admin.phone,
        admin.license_no,
        admin.staff_is_active,
        admin.hire_date,
        admin.termination_date,
        admin.employee_id,
        admin.shift,
        admin.emergency_contact,
        admin.certifications,
        admin.notes,
        admin.staff_created_at,
        admin.staff_updated_at,
      ]
    );

    await client.query(
      `INSERT INTO care.user_accounts (
         id, tenant_id, staff_id, email, password_hash, username, role, is_active,
         failed_attempts, locked_until, last_login, password_changed_required,
         password_changed_at, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, TRUE),
               COALESCE($9, 0), $10, $11, COALESCE($12, FALSE),
               $13, COALESCE($14, CURRENT_TIMESTAMP), COALESCE($15, CURRENT_TIMESTAMP))
       ON CONFLICT (email) DO UPDATE SET
         tenant_id = EXCLUDED.tenant_id,
         staff_id = EXCLUDED.staff_id,
         password_hash = EXCLUDED.password_hash,
         username = EXCLUDED.username,
         role = EXCLUDED.role,
         is_active = EXCLUDED.is_active,
         failed_attempts = EXCLUDED.failed_attempts,
         locked_until = EXCLUDED.locked_until,
         last_login = EXCLUDED.last_login,
         password_changed_required = EXCLUDED.password_changed_required,
         password_changed_at = EXCLUDED.password_changed_at,
         updated_at = CURRENT_TIMESTAMP`,
      [
        admin.account_id,
        admin.tenant_id,
        admin.staff_id,
        admin.account_email,
        admin.password_hash,
        admin.username,
        admin.account_role,
        admin.account_is_active,
        admin.failed_attempts,
        admin.locked_until,
        admin.last_login,
        admin.password_changed_required,
        admin.password_changed_at,
        admin.account_created_at,
        admin.account_updated_at,
      ]
    );
  }
}

async function run() {
  let client;
  try {
    client = await pool.connect();
    console.log(`\n=== DATABASE REBUILD (${isApply ? 'APPLY' : 'DRY RUN'}) ===\n`);
    const admins = await backupAdminIdentities(client);
    console.log(`Admin/staff login identities found for preservation: ${admins.length}`);

    if (!admins.length) {
      throw new Error('No existing admin accounts were found. Aborting to avoid creating unknown credentials.');
    }

    if (!isApply) {
      console.log('Dry run only. Re-run with --apply to drop and rebuild app schemas.');
      console.log('Schemas that will be dropped/recreated: audit_log, care, ref, admission.');
      return;
    }

    await client.query('BEGIN');

    await client.query('DROP SCHEMA IF EXISTS admission CASCADE');
    await client.query('DROP SCHEMA IF EXISTS audit_log CASCADE');
    await client.query('DROP SCHEMA IF EXISTS care CASCADE');
    await client.query('DROP SCHEMA IF EXISTS ref CASCADE');

    await client.query(readFileSync(join(__dirname, '../db/db.sql'), 'utf8'));

    for (const migration of migrationFiles()) {
      process.stdout.write(`Applying ${migration.name}... `);
      try {
        await client.query(migration.sql);
        console.log('done');
      } catch (error) {
        if (['42710', '42P07', '42701', '42P16'].includes(error.code)) {
          console.log(`skip (${error.code})`);
        } else {
          throw error;
        }
      }
    }

    await restoreAdminIdentities(client, admins);
    await client.query('COMMIT');

    console.log(`\nRebuild complete. Restored ${admins.length} admin login account(s); no resident/operational data was restored.`);
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Ignore rollback errors when no transaction is open.
      }
    }
    console.error('\nREBUILD FAILED:', describeError(error));
    process.exitCode = 1;
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

run();
