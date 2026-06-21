const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkSchema() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'care' AND table_name = 'care_plans'
      ORDER BY ordinal_position
    `);
    console.log('care_plans columns:');
    result.rows.forEach(row => console.log(`  ${row.column_name}: ${row.data_type}`));
  } finally {
    client.release();
    await pool.end();
  }
}

checkSchema();
