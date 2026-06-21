const { Pool } = require('pg');
const crypto = require('crypto');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function seedCarePlans() {
  const client = await pool.connect();
  try {
    const staffResult = await client.query(`SELECT id FROM ref.staff LIMIT 1`);
    const staffId = staffResult.rows[0].id;
    console.log(`Using staff ID: ${staffId}\n`);

    const residentsResult = await client.query(`
      SELECT r.id, r.tenant_id
      FROM care.residents r
      LEFT JOIN care.care_plans cp ON r.id = cp.resident_id AND cp.deleted_at IS NULL
      WHERE r.deleted_at IS NULL AND cp.id IS NULL
    `);

    console.log(`Found ${residentsResult.rows.length} residents without care plans. Creating...\n`);

    let count = 0;
    const today = new Date().toISOString().split('T')[0];
    const reviewDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    for (const resident of residentsResult.rows) {
      const planId = crypto.randomUUID();
      
      try {
        await client.query(
          `INSERT INTO care.care_plans (
            id, tenant_id, resident_id, plan_type, status, 
            effective_date, review_date,
            goal1_statement, goal2_statement, goal3_statement,
            crisis_warning_signs, suicide_protocol,
            guardianship, advanced_directive,
            step_1_completed, step_2_completed, step_3_completed,
            step_4_completed, step_5_completed, step_6_completed, step_7_completed,
            created_by, updated_by, version
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                    true, true, true, true, true, true, true, $15, $16, 1)`,
          [
            planId, resident.tenant_id, resident.id, 'initial', 'active',
            today, reviewDate,
            'Goal 1', 'Goal 2', 'Goal 3',
            'Warning signs', 'Suicide plan',
            'None', 'None',
            staffId, staffId
          ]
        );
        
        count++;
        console.log(`  ✓ Created for ${resident.id}`);
      } catch (err) {
        console.error(`  ✗ Error: ${err.message.split('\n')[0]}`);
      }
    }

    console.log(`\n✓ Successfully created ${count} care plans!`);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

seedCarePlans();
