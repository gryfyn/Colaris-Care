// READ-ONLY: find objects that depend on the orphan candidates (incoming FKs +
// views). If any active object depends on them, dropping is NOT safe.
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const candidates = [
  'daily_progress_notes_v2', 'initial_screenings', 'care_plan_signatures',
  'care_plan_cultural_identity', 'resident_specific_plans', 'mental_status_exams',
  'suicide_risk_assessments', 'blood_glucose_readings', 'incident_injury_zones',
  'evacuation_drill_participants', 'staff_time_records',
];

const run = async () => {
  const client = await pool.connect();
  try {
    // 1) Foreign keys in OTHER tables that reference a candidate (incoming refs)
    const fks = await client.query(
      `SELECT con.conrelid::regclass AS referencing_table,
              con.confrelid::regclass AS referenced_table,
              con.conname
         FROM pg_constraint con
        WHERE con.contype = 'f'
          AND con.confrelid::regclass::text = ANY($1)
          AND con.conrelid <> con.confrelid`,
      [candidates.map((t) => `care.${t}`)]
    );
    console.log('\n=== INCOMING FOREIGN KEYS (other tables -> candidate) ===');
    console.log(fks.rows.length ? fks.rows : '  none');

    // 2) Views depending on candidates
    const views = await client.query(
      `SELECT DISTINCT dependent.relname AS view_name, src.relname AS candidate_table
         FROM pg_depend d
         JOIN pg_rewrite r   ON r.oid = d.objid
         JOIN pg_class dependent ON dependent.oid = r.ev_class
         JOIN pg_class src   ON src.oid = d.refobjid
         JOIN pg_namespace n ON n.oid = src.relnamespace
        WHERE n.nspname = 'care'
          AND src.relname = ANY($1)
          AND dependent.relkind = 'v'
          AND dependent.relname <> src.relname`,
      [candidates]
    );
    console.log('\n=== VIEWS DEPENDING ON CANDIDATES ===');
    console.log(views.rows.length ? views.rows : '  none');
  } finally {
    client.release();
    await pool.end();
  }
};

run().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
