# Database Security Verification

Run these after migrations and seed data are applied.

## FIX PASS 2 — what changed (2026-06-25)

Migration `db/migrations/0004_security_hardening.sql` plus script and route changes:

- **FIX A — Forced RLS.** Every tenant-scoped table (and the self-scoped identity
  tables `care.users` / `care.sessions`) now has both `ENABLE` and `FORCE ROW
  LEVEL SECURITY`, so even the table owner / app role is filtered by policy. The
  table list is enumerated explicitly in 0004; `scripts/verify-rls.mjs` now asserts
  `relforcerowsecurity` too.
- **FIX B — Validated context.** `app.set_request_context(uuid,uuid,uuid,uuid,text)`
  is now `SECURITY DEFINER` and validates the caller before setting any GUC: user
  exists + active, user is an active member of the org (org **or** facility
  membership), a supplied facility belongs to the org and is reachable by the user,
  and a supplied action matches `module:verb`. It RAISEs on failure (transaction
  rolls back). The signature and GUC names are unchanged, so `src/lib/db.js`
  `withRequestContext()` and the existing grants are untouched. Login is stateless
  RS256 JWT (no `care.sessions` rows), so a session row is **not** required; session
  validation is optional and can be added later without changing callers.
  - **Ownership requirement:** because FORCE RLS also binds the table owner, the
    `SECURITY DEFINER` functions (`set_request_context`, `login_identity`,
    `refresh_identity`) must be owned by the migration/owner role, which carries
    `BYPASSRLS` (or is a superuser). They read identity tables *before* any GUC is
    set; without owner bypass they would deny themselves.
- **FIX C — ssn_last4 encryption.** `care.residents.ssn_last4` (plaintext) is
  dropped and replaced by envelope columns `ssn_last4_ciphertext`,
  `ssn_last4_key_version`, `ssn_last4_lookup_hash`. The residents create/read/update
  routes encrypt on write (AES-256-GCM, AAD bound to org+facility+table+row+field
  per schema §8) and decrypt on read; `maskPHI` still returns `[RESTRICTED]` for
  `staff` / `resident_care_of`. `scripts/seed-db.mjs` seeds synthetic SSNs through
  the same encrypted path.
- **FIX D — Least-privilege runtime role.** See the role model below.

## Runtime role model (FIX D)

`scripts/apply-runtime-grants.mjs` provisions/hardens the application runtime role.
Two distinct roles:

| Role | Owns tables/functions? | BYPASSRLS | Privileges |
|---|---|---|---|
| migration/owner | yes | yes (or superuser) | full DDL; owns the SECURITY DEFINER functions |
| app runtime (`APP_DB_ROLE`) | **no** | **no** | DML only on `care` (select/insert/update, **no delete**); **select/insert only** on `audit_log.audit_events` and `care.outbox_events` (immutable evidence — never update/delete); `execute` on the context/identity functions |

The app role is never the table owner and never has `BYPASSRLS`, so forced RLS
binds it on every query. It cannot alter audit or outbox evidence.

> **Managed Postgres (Neon) note:** the connection owner (e.g. `neondb_owner`) is
> not a superuser, so it cannot `ALTER ROLE ... [NO]SUPERUSER/[NO]BYPASSRLS` —
> even to turn the attribute off. Create the runtime role with the least-privilege
> attributes (`nosuperuser nobypassrls nocreatedb nocreaterole`) up front; the
> script verifies them and only narrows CREATEDB/CREATEROLE, raising if the role
> is already superuser/BYPASSRLS.

## RLS Verification

```powershell
node scripts/verify-rls.mjs
```

Expected:

- Every tenant-owned table exists.
- RLS is enabled **and forced**.
- At least one policy exists per tenant-owned table.
- `app.set_request_context(uuid, uuid, uuid, uuid, text)` exists.

## Runtime Grants

Run this as the migration owner, not the app runtime role:

```powershell
$env:APP_DB_ROLE="colaris_app"
node scripts/apply-runtime-grants.mjs
```

Expected:

- Runtime role receives schema usage.
- Runtime role receives execute on context/auth lookup functions.
- Runtime role receives select/insert/update on `care` tables.
- Runtime role receives select/insert on `audit_log.audit_events`.
- Runtime role does not receive delete.

## Manual Role Checks

In PostgreSQL:

```sql
select rolname, rolbypassrls
from pg_roles
where rolname = 'colaris_app';
```

Expected:

- `rolbypassrls = false`

Check table ownership:

```sql
select n.nspname, c.relname, pg_get_userbyid(c.relowner) as owner
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('care', 'audit_log')
  and c.relkind = 'r'
order by 1, 2;
```

Expected:

- Runtime app role is not the table owner.

## Negative Tests

- Without calling `app.set_request_context(...)`, tenant-owned table reads should return no rows or fail closed.
- With organization A/facility A context, organization B/facility B rows must not be visible.
- Staff APIs must still enforce route-level RBAC and assignment scoping.
