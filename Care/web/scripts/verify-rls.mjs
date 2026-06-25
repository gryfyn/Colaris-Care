import pg from 'pg';
import { resolveDatabaseUrl } from './database-connection.mjs';

const requiredTables = [
  ['care', 'organizations'],
  ['care', 'facilities'],
  ['care', 'users'],
  ['care', 'organization_memberships'],
  ['care', 'facility_memberships'],
  ['care', 'sessions'],
  ['care', 'staff_profiles'],
  ['care', 'residents'],
  ['care', 'staff_assignments'],
  ['care', 'care_plans'],
  ['care', 'medications'],
  ['care', 'medication_administrations'],
  ['care', 'progress_notes'],
  ['care', 'incident_reports'],
  ['care', 'drug_disposals'],
  ['care', 'evacuation_drills'],
  ['care', 'notifications'],
  ['care', 'announcements'],
  ['care', 'appointments'],
  ['care', 'documents'],
  ['care', 'admission_cases'],
  ['care', 'roi_records'],
  ['care', 'discharge_records'],
  ['care', 'resident_requests'],
  ['care', 'outbox_events'],
  ['care', 'idempotency_records'],
  ['audit_log', 'audit_events'],
];

const client = new pg.Client({
  connectionString: resolveDatabaseUrl({ preferMigration: true }),
  ssl: process.env.DATABASE_SSL === 'true'
    ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' }
    : false,
});

await client.connect();

try {
  const { rows } = await client.query(
    `
      select n.nspname as schema_name,
             c.relname as table_name,
             c.relrowsecurity as rls_enabled,
             c.relforcerowsecurity as rls_forced,
             count(p.polname)::int as policy_count
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        left join pg_policy p on p.polrelid = c.oid
       where c.relkind = 'r'
         and (n.nspname, c.relname) in (${requiredTables.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ')})
       group by n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity
    `,
    requiredTables.flat()
  );

  const found = new Map(rows.map((row) => [`${row.schema_name}.${row.table_name}`, row]));
  const failures = [];

  for (const [schema, table] of requiredTables) {
    const key = `${schema}.${table}`;
    const row = found.get(key);
    if (!row) {
      failures.push(`${key}: missing`);
      continue;
    }
    if (!row.rls_enabled) failures.push(`${key}: RLS not enabled`);
    if (!row.rls_forced) failures.push(`${key}: RLS not forced`);
    if (row.policy_count < 1) failures.push(`${key}: no RLS policies`);
  }

  const contextFn = await client.query(
    "select to_regprocedure('app.set_request_context(uuid, uuid, uuid, uuid, text)') is not null as ok"
  );
  if (!contextFn.rows[0]?.ok) {
    failures.push('app.set_request_context(uuid, uuid, uuid, uuid, text): missing');
  }

  if (failures.length) {
    console.error('RLS verification failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log(`RLS verification passed for ${requiredTables.length} tables.`);
} finally {
  await client.end();
}
