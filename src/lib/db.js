import { Pool } from 'pg';
import logger from '@/lib/logger.js';

// SSL is driven by DATABASE_SSL so it can differ from NODE_ENV:
//   DATABASE_SSL=false → no SSL (in-cluster Postgres on a private network)
//   DATABASE_SSL=true  → SSL on; set DATABASE_SSL_REJECT_UNAUTHORIZED=false
//                        when the managed provider uses a self-signed chain.
// Default: SSL on in production, off otherwise.
function resolveSsl() {
  const flag = process.env.DATABASE_SSL;
  const enabled = flag === undefined ? process.env.NODE_ENV === 'production' : flag === 'true';
  if (!enabled) return false;
  return { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' };
}

export const pool = new Pool({
  connectionString:        process.env.DATABASE_URL,
  ssl:                     resolveSsl(),
  max:                     20,
  min:                     2,
  idleTimeoutMillis:       30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout:       30_000,
  application_name:        'dependable-care-api',
});

pool.on('error', (err) => {
  // Do NOT exit the process: on serverless (Vercel) that turns a recoverable
  // connection blip into a hard 500 and kills the whole function. Log instead;
  // the next query reconnects via the pool.
  logger.error({ err }, 'Unexpected PostgreSQL pool error (idle client)');
});

pool.on('connect', () => logger.debug('PostgreSQL client connected'));

/**
 * Run a callback with a client that has tenant + staff context set.
 * ALL PHI queries must go through this method.
 */
export async function withTenantClient(tenantId, staffId, fn) {
  const client = await pool.connect();
  try {
    await client.query(`
      SELECT
        set_config('app.tenant_id', $1, true),
        set_config('app.staff_id',  $2, true)
    `, [tenantId, staffId || '']);
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function query(text, params) {
  return pool.query(text, params);
}

export async function healthCheck() {
  const { rows } = await pool.query('SELECT NOW() AS now');
  return rows[0].now;
}
