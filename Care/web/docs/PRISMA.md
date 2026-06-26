# Prisma data-access layer (coexists with raw pg)

Prisma is a **typed, additive** data-access layer that runs **alongside** the
existing raw `pg` code in `src/lib/db.js`. Both paths talk to the same Neon
database, as the same `colaris_app` role, under the same security model. Neither
replaces the other — routes are migrated to Prisma one at a time, and the rest
keep using raw pg.

The raw SQL migrations in `db/migrations/` remain the **single source of truth**
for the schema. Do **not** run `prisma migrate`, `prisma db pull`, or
`prisma db push`, and do not hand-edit `prisma/schema.prisma` — it is introspected
from the live DB (multiSchema: `app`, `care`, `audit_log`) and the client is
already generated.

## The non-negotiable rule: always go through `withPrismaContext`

The app connects as the **`NOBYPASSRLS`** role `colaris_app`, and every tenant
table has **`FORCE ROW LEVEL SECURITY`**. The RLS policies read a set of
`app.*` GUCs (e.g. `app.organization_id`, `app.facility_id`, `app.staff_id`).
Those GUCs are populated by the `SECURITY DEFINER` function:

```sql
app.set_request_context(user_id, staff_id, organization_id, facility_id, action)
```

If the context is not set on the connection running a query, **RLS evaluates
against unset context and returns zero rows** (and writes fail policy checks).

The raw-pg path handles this in `withRequestContext(user, action, fn)` — it opens
a transaction, calls `set_request_context`, then runs the callback on that one
pinned connection. Prisma mirrors this **exactly** in
`src/lib/prisma-context.js`:

```js
import { withPrismaContext } from '@/lib/prisma-context.js';

const rows = await withPrismaContext(user, 'residents:read', async (tx) => {
  // tx is a Prisma transaction client already under the correct RLS context
  return tx.residents.findMany({ where: { status: 'active' } });
});
```

`withPrismaContext`:

1. Opens an interactive `prisma.$transaction(async (tx) => { ... })` (one pinned
   connection for the whole callback).
2. **First** calls the same `app.set_request_context($1,$2,$3,$4,$5)` via
   `tx.$queryRawUnsafe`, passing the user fields as **bind parameters** (no
   string interpolation of user input).
3. Then runs your `fn(tx)` and returns its result.

**Never** issue tenant queries through a bare `prisma` client (e.g.
`import prisma from '@/lib/prisma.js'; prisma.residents.findMany(...)`). Without
the context transaction, RLS returns nothing. Always go through
`withPrismaContext` (or `withPrismaApiContext`, below).

## Route helpers

`src/lib/api-helpers.js` provides two parallel orchestrators with identical RBAC,
response shape (`{ data }`), and error handling:

| Helper | Data access | Handler arg |
| --- | --- | --- |
| `withApiContext` | raw pg (`withRequestContext`) | `{ client, user }` |
| `withPrismaApiContext` | Prisma (`withPrismaContext`) | `{ tx, user }` |

Both run `requireUser(request, permission)` for RBAC **before** opening the
context transaction. A route can even mix them per method (e.g. `GET` on Prisma,
`POST` on raw pg) — see `src/app/api/v1/care-plans/route.js`.

## Migrated routes (reference implementations)

- `src/app/api/v1/residents/route.js` — `GET` + `POST` on Prisma. Preserves the
  `ssn_last4` envelope encryption (encrypt-on-write, decrypt + `maskPHI` on read)
  and writes the audit event via `tx.audit_events.create` (sanitized metadata,
  same shape as `recordAuditEvent`). Because the introspected Prisma field names
  are the snake_case columns, rows feed straight into the existing
  `mapResident()` / `maskPHI()` helpers unchanged.
- `src/app/api/v1/care-plans/route.js` — `GET` on Prisma (with the STAFF
  assignment scoping expressed as a relation filter); `POST` stays on raw pg.

All other routes remain on raw pg for now. Coexistence is intentional.

## `prisma.js` singleton & PgBouncer

`src/lib/prisma.js` exports a `PrismaClient` singleton guarded against
hot-reload duplication via `globalThis`, using the same `DATABASE_URL` as the pg
pool. Neon's **pooled** endpoint (`-pooler` host) runs PgBouncer in
transaction-pooling mode, which is incompatible with Prisma's prepared
statements. The singleton appends `pgbouncer=true` to pooled connection strings
(idempotently) so Prisma disables prepared statements and queries don't break.

## Things to keep intact

Do not weaken any of: **RLS** (always via `withPrismaContext`), **RBAC**
(`requireUser`), **PHI encryption** (`encryptPHI`/`decryptPHI`/`lookupHashPHI`),
or **masking** (`maskPHI`). When migrating a route, swap only the data access —
keep the encryption/masking/audit helpers exactly as the raw-pg routes use them.
