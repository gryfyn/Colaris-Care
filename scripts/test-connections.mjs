import { createClient } from 'redis';
import pkg from 'pg';
const { Pool } = pkg;

console.log('Testing Database and Redis Connections...\n');

// Test PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:1234@localhost:5432/dcllc_db'
});

pool.query('SELECT 1', (err, res) => {
  if (err) {
    console.log('✗ PostgreSQL: Connection failed');
    console.log('  Error:', err.message);
  } else {
    console.log('✓ PostgreSQL: Connected successfully');
  }
  pool.end();
  testRedis();
});

// Test Redis
async function testRedis() {
  const client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });

  client.on('error', (err) => {
    console.log('✗ Redis: Connection failed');
    console.log('  Error:', err.message);
    process.exit(0);
  });

  client.on('connect', () => {
    console.log('✓ Redis: Connected successfully');
    client.ping((err, reply) => {
      if (err) {
        console.log('  Ping failed:', err.message);
      } else {
        console.log('  Ping successful');
      }
      client.quit(() => process.exit(0));
    });
  });

  await client.connect();
}
