import pg from 'pg';
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
  const result = await client.query(`
    SELECT constraint_name, check_clause
    FROM information_schema.check_constraints
    WHERE table_schema = 'care' AND table_name = 'care_plans'
  `);
  
  console.log('Care Plans Constraints:');
  result.rows.forEach(r => console.log(`  ${r.constraint_name}: ${r.check_clause}`));
} finally {
  client.release();
  await pool.end();
}
