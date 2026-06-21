const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function findUsers() {
  const client = await pool.connect();
  try {
    // Try different table names
    const schemas = ['public', 'auth', 'users', 'ref'];
    
    for (const schema of schemas) {
      try {
        const result = await client.query(`
          SELECT table_name FROM information_schema.tables 
          WHERE table_schema = $1 AND table_name LIKE '%user%'
        `, [schema]);
        
        if (result.rows.length > 0) {
          console.log(`Found in schema "${schema}":`);
          result.rows.forEach(row => console.log(`  - ${row.table_name}`));
        }
      } catch (e) {}
    }

    // Try to find staff table
    const staffResult = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_name LIKE '%staff%'
    `);
    
    if (staffResult.rows.length > 0) {
      console.log('\nStaff tables:');
      staffResult.rows.forEach(row => console.log(`  - ${row.table_name}`));
    }

    // Get a sample user/staff
    try {
      const user = await client.query(`SELECT id FROM ref.staff LIMIT 1`);
      if (user.rows.length > 0) {
        console.log(`\nSample staff ID: ${user.rows[0].id}`);
      }
    } catch (e) {
      console.log('ref.staff not found');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

findUsers();
