import { prisma } from '@/lib/prisma.js';

/**
 * Run a callback inside a single Prisma transaction with the per-request RLS
 * context applied — the Prisma equivalent of `withRequestContext` in
 * src/lib/db.js.
 *
 * SECURITY: the app connects as the NOBYPASSRLS `colaris_app` role and every
 * tenant table has FORCE ROW LEVEL SECURITY. The RLS policies read the
 * `app.*` GUCs that are set by the SECURITY DEFINER function
 * `app.set_request_context(user_id, staff_id, organization_id, facility_id, action)`.
 * We MUST call that function first, on the SAME connection, before issuing any
 * tenant query — otherwise RLS evaluates against unset context and returns
 * zero rows. Because `$transaction` pins one connection for the whole
 * callback, the GUCs set here apply to every query the caller runs on `tx`.
 *
 * The user-supplied values are passed as bind parameters to
 * `$queryRawUnsafe` (Prisma still parameterizes the trailing values) — there
 * is NO string interpolation of user input, matching the raw-pg path exactly.
 *
 * Never run tenant queries through a bare `prisma` client: always go through
 * this wrapper so the RLS context is guaranteed.
 *
 * @template T
 * @param {object} user   Authenticated user (id, staffId, organizationId/tenantId, facilityId).
 * @param {string} action Audit/action label forwarded to set_request_context.
 * @param {(tx: import('@prisma/client').Prisma.TransactionClient) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withPrismaContext(user, action, fn) {
  return prisma.$transaction(
    async (tx) => {
      // Prisma binds parameters as `text`, so we must cast to the function's
      // declared types (uuid…). The raw-pg path gets away without casts because
      // node-postgres sends params as type-unknown, letting Postgres infer uuid.
      // Use $executeRawUnsafe (not $queryRawUnsafe): set_request_context returns
      // `void`, which $queryRaw cannot deserialize. $executeRaw runs the statement
      // and returns a row count, which is all we need here.
      await tx.$executeRawUnsafe(
        'select app.set_request_context($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::text)',
        user?.id || null,
        user?.staffId || null,
        user?.organizationId || user?.tenantId || null,
        user?.facilityId || null,
        action || null
      );
      return fn(tx);
    },
    // Mirror the 30s statement_timeout used by the raw-pg pool so a slow
    // tenant query behaves consistently across both data-access paths.
    { timeout: 30_000, maxWait: 5_000 }
  );
}

export default withPrismaContext;
