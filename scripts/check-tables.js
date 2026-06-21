import pg from 'pg';
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
  const result = await client.query(`
    SELECT table_schema, table_name 
    FROM information_schema.tables 
    WHERE table_schema IN ('ref', 'care', 'audit_log')
    ORDER BY table_schema, table_name
  `);
  
  console.log('Database Tables:');
  result.rows.forEach(r => console.log(`  ${r.table_schema}.${r.table_name}`));
} finally {
  client.release();
  await pool.end();
}
