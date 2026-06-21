const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function updateCarePlans() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      UPDATE care.care_plans SET
        goal1_statement = 'Maintain stability',
        goal2_statement = 'Build coping skills',
        goal3_statement = 'Achieve independence',
        crisis_warning_signs = 'Mood changes, withdrawal',
        crisis_coping_strategies = 'Grounding, call support',
        suicide_protocol = 'Call crisis line',
        peer_support = 'Monthly support groups',
        other_resources = 'Mental health services',
        discharge_housing = 'Supported housing',
        guardianship = 'None',
        advanced_directive = 'None',
        psychiatric_strengths = 'Engaged in treatment',
        psychiatric_needs = 'Ongoing monitoring',
        selected_domains = ARRAY[1,3,4,6,7,10,11]
      WHERE status = 'active'
    `);

    console.log(`✓ Updated ${result.rowCount} care plans with comprehensive data`);
  } catch (err) {
    console.error('Error updating care plans:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

updateCarePlans();
