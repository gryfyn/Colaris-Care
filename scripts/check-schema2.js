import pg from 'pg';
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
  console.log('=== care_plans columns ===');
  let result = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'care' AND table_name = 'care_plans'
    ORDER BY ordinal_position
    LIMIT 20
  `);
  
  result.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));
} finally {
  client.release();
  await pool.end();
}
