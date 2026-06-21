// READ-ONLY: checks existence + row counts for orphan-table candidates in prod.
// No writes. Used to decide what is safe to drop.
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const candidates = [
  // 🟢 superseded duplicates
  ['care', 'daily_progress_notes_v2'],
  ['care', 'initial_screenings'],
  ['care', 'care_plan_signatures'],
  ['care', 'care_plan_cultural_identity'],
  ['care', 'resident_specific_plans'],
  // 🔴 clinical PHI, no API
  ['care', 'mental_status_exams'],
  ['care', 'suicide_risk_assessments'],
  ['care', 'blood_glucose_readings'],
  ['care', 'incident_injury_zones'],
  ['care', 'evacuation_drill_participants'],
  ['care', 'staff_time_records'],
];

// active counterparts, for context (NOT drop candidates)
const reference = [
  ['care', 'daily_progress_notes'],
  ['care', 'pre_admission_screenings'],
  ['care', 'care_plans'],
  ['ref', 'tenants'],
];

async function exists(client, schema, table) {
  const { rows } = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema=$1 AND table_name=$2`,
    [schema, table]
  );
  return rows.length > 0;
}

async function countRows(client, schema, table) {
  const { rows } = await client.query(`SELECT COUNT(*)::int AS n FROM ${schema}.${table}`);
  return rows[0].n;
}

async function report(client, list, label) {
  console.log(`\n=== ${label} ===`);
  for (const [schema, table] of list) {
    const present = await exists(client, schema, table);
    if (!present) {
      console.log(`  ${schema}.${table}  ->  NOT IN PROD`);
      continue;
    }
    const n = await countRows(client, schema, table);
    console.log(`  ${schema}.${table}  ->  ${n} rows`);
  }
}

const run = async () => {
  const client = await pool.connect();
  try {
    await report(client, candidates, 'ORPHAN CANDIDATES');
    await report(client, reference, 'ACTIVE COUNTERPARTS (context, do NOT drop)');
  } finally {
    client.release();
    await pool.end();
  }
};

run().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
