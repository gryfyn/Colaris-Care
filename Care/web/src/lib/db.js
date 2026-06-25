import { Pool } from 'pg';
import logger from '@/lib/logger.js';

function resolveSsl() {
  const flag = process.env.DATABASE_SSL;
  const enabled = flag === undefined ? process.env.NODE_ENV === 'production' : flag === 'true';
  if (!enabled) return false;
  return { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' };
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: resolveSsl(),
  max: Number(process.env.DATABASE_POOL_MAX || 20),
  min: Number(process.env.DATABASE_POOL_MIN || 0),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 30_000,
  application_name: 'colaris-care-api',
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected PostgreSQL pool error (idle client)');
});

/**
 * Run a callback in one transaction with transaction-local RLS context.
 * Every tenant-scoped query must execute inside this callback.
 */
export async function withRequestContext(user, action, fn) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(
      'select app.set_request_context($1, $2, $3, $4, $5)',
      [
        user?.id || null,
        user?.staffId || null,
        user?.organizationId || user?.tenantId || null,
        user?.facilityId || null,
        action || null,
      ]
    );
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Backward-compatible alias for older code. Prefer withRequestContext.
 */
export async function withTenantClient(tenantId, staffId, fn) {
  return withRequestContext(
    { id: null, staffId, organizationId: tenantId, facilityId: null },
    null,
    fn
  );
}

export async function query(text, params) {
  return pool.query(text, params);
}

export async function healthCheck() {
  const { rows } = await pool.query('select now() as now');
  return rows[0].now;
}
