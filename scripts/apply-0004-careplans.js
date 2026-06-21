/**
 * Apply the care-plan column extension (migration 0004) to a Postgres DB.
 * SAFE / idempotent: every statement is `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
 *
 * Usage:
 *   DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require" node scripts/apply-0004-careplans.js
 *   node scripts/apply-0004-careplans.js "postgresql://...neon.tech/neondb"
 *
 * Fixes the prod care-plan wizard 500s (missing columns in care.care_plans).
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const DB = process.env.DATABASE_URL || process.argv[2];
if (!DB) {
  console.error('ERROR: provide the connection string via DATABASE_URL env or argv[1].');
  console.error('Get it from the Neon console (Connect -> connection string).');
  process.exit(1);
}

const SQL_FILE = path.join(__dirname, '..', 'db', 'migrations', '0004_extend_care_plans.sql.skip');

(async () => {
  const sql = fs.readFileSync(SQL_FILE, 'utf8');
  const client = new Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected. Columns on care.care_plans BEFORE:');
  const before = await client.query(
    `SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='care' AND table_name='care_plans'`
  );
  console.log('  count =', before.rows[0].n);

  console.log('Applying 0004 (idempotent ADD COLUMN IF NOT EXISTS)...');
  await client.query(sql); // whole file in one batch; all statements are IF NOT EXISTS
  console.log('Applied.');

  const after = await client.query(
    `SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='care' AND table_name='care_plans'`
  );
  console.log('Columns on care.care_plans AFTER:  count =', after.rows[0].n);
  const check = await client.query(
    `SELECT string_agg(column_name, ', ' ORDER BY column_name) AS cols
       FROM information_schema.columns
      WHERE table_schema='care' AND table_name='care_plans'
        AND column_name IN ('step_1_completed','submitted_at','isp_team_members','selected_domains','crisis_warning_signs','client_signature','goal1_statement')`
  );
  console.log('Wizard sentinel columns now present:', check.rows[0].cols || '(none — something went wrong)');
  await client.end();
  console.log('\nDone. Re-run the care-plan wizard — it should now save (200).');
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
