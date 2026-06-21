import pg from 'pg';
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
  const tables = ['daily_progress_notes', 'care_plans', 'medications', 'incident_reports', 'notifications'];
  
  for (const table of tables) {
    console.log(`\n=== ${table} ===`);
    const result = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'care' AND table_name = $1 ORDER BY ordinal_position`,
      [table]
    );
    result.rows.forEach(r => console.log(`  - ${r.column_name}`));
  }
} finally {
  client.release();
  await pool.end();
}
