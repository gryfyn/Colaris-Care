const { Pool } = require('pg');
const crypto = require('crypto');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function test() {
  const client = await pool.connect();
  try {
    const residents = await client.query(`
      SELECT id, tenant_id FROM care.residents WHERE deleted_at IS NULL LIMIT 1
    `);
    const resident = residents.rows[0];
    const planId = crypto.randomUUID();
    const today = new Date().toISOString().split('T')[0];

    console.log('Testing insert with minimal fields...');
    console.log('Plan ID:', planId);
    console.log('Resident:', resident.id);

    try {
      const result = await client.query(
        `INSERT INTO care.care_plans (
          id, tenant_id, resident_id, plan_type, status, 
          effective_date, review_date,
          created_by, updated_by, version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          planId, resident.tenant_id, resident.id, 'initial', 'active',
          today, today,
          '00000000-0000-0000-0000-000000000000',
          '00000000-0000-0000-0000-000000000000',
          1
        ]
      );
      console.log('✓ Insert successful!');
    } catch (err) {
      console.error('✗ Insert failed:', err.message);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

test();
