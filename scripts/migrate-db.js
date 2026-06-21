import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config();
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));

function resolveSsl() {
  const flag = process.env.DATABASE_SSL;
  const enabled = flag === undefined ? process.env.NODE_ENV === 'production' : flag === 'true';
  if (!enabled) return false;
  return { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' };
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: resolveSsl(),
});

// ---------------------------------------------------------------------------
// Incremental migrations applied AFTER db.sql
// (db.sql is idempotent; add new columns / constraints here over time)
// ---------------------------------------------------------------------------
const migrations = [

  // 001: safety_plans unique constraint  (db.sql already declares UNIQUE inline;
  //      this is a no-op guard for databases that had the old stub schema)
  {
    name: 'inline_001_safety_plans_unique_constraint',
    sql: `DO $$
   BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'safety_plans_care_plan_id_key'
     ) THEN
       ALTER TABLE care.safety_plans ADD CONSTRAINT safety_plans_care_plan_id_key UNIQUE (care_plan_id);
     END IF;
   END $$`,
  },

  // 002: daily_living_needs unique constraint  (same guard)
  {
    name: 'inline_002_daily_living_needs_unique_constraint',
    sql: `DO $$
   BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'daily_living_needs_care_plan_id_key'
     ) THEN
       ALTER TABLE care.daily_living_needs ADD CONSTRAINT daily_living_needs_care_plan_id_key UNIQUE (care_plan_id);
     END IF;
   END $$`,
  },
];

// Read migration files from db/migrations directory
const migrationsDir = join(__dirname, '../db/migrations');
try {
  const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    migrations.push({ name: file, sql });
  }
} catch (e) {
  // migrations directory may not exist yet
}

async function migrate() {
  const client = await pool.connect();
  try {
    // ── Step 1: apply the full base schema ──────────────────────────────────
    console.log('Applying base schema (db/db.sql)…');
    const sql = readFileSync(join(__dirname, '../db/db.sql'), 'utf8');
    await client.query(sql);
    console.log('  Base schema applied.\n');

    // ── Step 2: apply incremental migrations ────────────────────────────────
    console.log('Running incremental migrations…');
    for (let i = 0; i < migrations.length; i++) {
      const migration = migrations[i];
      process.stdout.write(`  ${migration.name}... `);
      try {
        await client.query(migration.sql);
        console.log('done');
      } catch (err) {
        // 42710 = duplicate_object (trigger/policy already exists)
        // 42P07 = duplicate_table
        // 42701 = duplicate_column
        // 42P16 = invalid_table_definition (constraint already exists)
        if (['42710', '42P07', '42701', '42P16'].includes(err.code)) {
          console.log(`skip (${err.code}: already applied)`);
        } else {
          throw err;
        }
      }
    }
    console.log('\nAll migrations applied successfully.\n');
  } catch (err) {
    console.error('\nMigration failed:', err.message);
    console.error(err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
