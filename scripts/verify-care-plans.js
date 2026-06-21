const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function verify() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT id, resident_id, goal1_statement, goal2_statement, 
             crisis_warning_signs, discharge_housing
      FROM care.care_plans
      WHERE status = 'active'
      LIMIT 3
    `);

    console.log(`✓ Found ${result.rows.length} care plans with data:\n`);
    result.rows.forEach((plan, i) => {
      console.log(`Plan ${i+1}:`);
      console.log(`  - Goal 1: ${plan.goal1_statement}`);
      console.log(`  - Goal 2: ${plan.goal2_statement}`);
      console.log(`  - Crisis: ${plan.crisis_warning_signs}`);
      console.log(`  - Discharge: ${plan.discharge_housing}\n`);
    });
  } finally {
    client.release();
    await pool.end();
  }
}

verify();
