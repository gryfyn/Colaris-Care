import { PrismaClient } from '@prisma/client';

/**
 * Resolve the connection string Prisma should use.
 *
 * The app talks to Neon through its POOLED endpoint (host contains `-pooler`),
 * which runs PgBouncer in transaction-pooling mode. PgBouncer does not support
 * the session-level prepared statements Prisma creates by default, so queries
 * intermittently fail with "prepared statement ... already exists". Prisma
 * disables prepared statements when the connection string carries
 * `pgbouncer=true`, so we append it for pooled hosts (idempotently).
 *
 * We deliberately reuse the SAME `DATABASE_URL` the raw-pg pool uses
 * (src/lib/db.js), so both data-access paths connect as the NOBYPASSRLS
 * `colaris_app` role and are subject to FORCE ROW LEVEL SECURITY identically.
 */
function resolveDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) return url;
  try {
    const parsed = new URL(url);
    const isPooled =
      parsed.hostname.includes('-pooler') || parsed.hostname.includes('pgbouncer');
    if (isPooled && !parsed.searchParams.has('pgbouncer')) {
      parsed.searchParams.set('pgbouncer', 'true');
    }
    return parsed.toString();
  } catch {
    // Not a parseable URL (let Prisma surface its own error downstream).
    return url;
  }
}

// Guard against hot-reload creating a new client (and a new connection pool)
// on every module re-evaluation in development.
const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.__colarisPrisma ??
  new PrismaClient({
    datasourceUrl: resolveDatabaseUrl(),
    log: process.env.PRISMA_LOG === 'true' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__colarisPrisma = prisma;
}

export default prisma;
