import pg from 'pg';
import { resolveDatabaseUrl } from './database-connection.mjs';

// FIX D — least-privilege application runtime role.
//
// Run this as the migration/owner role (a privileged role that OWNS the tables
// and functions and carries BYPASSRLS). It provisions / hardens the *application*
// runtime role, which:
//   * is NOT a superuser and does NOT have BYPASSRLS — every query it runs is
//     filtered by the forced RLS policies (migration 0004 FIX A);
//   * does NOT own any table or function (so FORCE RLS binds it too);
//   * gets DML only — select/insert/update — on care tables, never DELETE;
//   * can only select/insert immutable evidence (audit_log.audit_events,
//     care.outbox_events) — never update or delete it.
//
// Env:
//   APP_DB_ROLE       (required) e.g. colaris_app
//   APP_DB_PASSWORD   (optional) if set, the role is created with LOGIN + password;
//                     otherwise it is created NOLOGIN and you must set auth later.

const runtimeRole = process.env.APP_DB_ROLE;
const runtimePassword = process.env.APP_DB_PASSWORD;

if (!runtimeRole) {
  console.error('APP_DB_ROLE is required, e.g. colaris_app');
  process.exit(1);
}

if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(runtimeRole)) {
  console.error('APP_DB_ROLE must be a simple PostgreSQL identifier');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: resolveDatabaseUrl({ preferMigration: true }),
  ssl: process.env.DATABASE_SSL === 'true'
    ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' }
    : false,
});

const qRole = `"${runtimeRole.replaceAll('"', '""')}"`;
const quoteLiteral = (value) => `'${String(value).replaceAll("'", "''")}'`;

await client.connect();

try {
  // 1. Ensure the runtime role exists (outside a transaction so CREATE ROLE is
  //    not rolled back by an unrelated failure below).
  const existing = await client.query('select 1 from pg_roles where rolname = $1', [runtimeRole]);
  if (!existing.rowCount) {
    if (runtimePassword) {
      await client.query(
        `create role ${qRole} login nosuperuser nocreatedb nocreaterole nobypassrls password ${quoteLiteral(runtimePassword)}`
      );
      console.log(`Created runtime role ${runtimeRole} (login).`);
    } else {
      await client.query(
        `create role ${qRole} nologin nosuperuser nocreatedb nocreaterole nobypassrls`
      );
      console.warn(`Created runtime role ${runtimeRole} (NOLOGIN — set a password/auth before app use).`);
    }
  }

  // 2. Verify the least-privilege attributes rather than blindly ALTERing them.
  //
  //    On managed Postgres (e.g. Neon) the connection owner is NOT a superuser,
  //    so *any* ALTER ROLE that names the SUPERUSER or BYPASSRLS attributes is
  //    rejected — even when turning them OFF (ERROR 42501). Naming them here would
  //    abort before the GRANTs below ever run. So: inspect the current attributes
  //    and only issue ALTERs that are both necessary and permitted.
  const roleAttrs = await client.query(
    'select rolsuper, rolbypassrls, rolcreatedb, rolcreaterole from pg_roles where rolname = $1',
    [runtimeRole]
  );
  const { rolsuper, rolbypassrls, rolcreatedb, rolcreaterole } = roleAttrs.rows[0];

  // The role is dangerously over-privileged and we cannot safely fix it without
  // naming SUPERUSER/BYPASSRLS — which managed owners are not allowed to do.
  if (rolsuper || rolbypassrls) {
    throw new Error(
      `Runtime role ${runtimeRole} has ${rolsuper ? 'SUPERUSER ' : ''}${rolbypassrls ? 'BYPASSRLS ' : ''}` +
      `set, which defeats RLS enforcement. The current connection cannot alter these attributes ` +
      `(only a SUPERUSER may), so refusing to continue. Recreate the role with ` +
      `'nosuperuser nobypassrls', or run this script (or 'alter role ${runtimeRole} nosuperuser nobypassrls') ` +
      `as a superuser.`
    );
  }

  // CREATEDB / CREATEROLE can be turned off without superuser. Only ALTER when needed.
  if (rolcreatedb || rolcreaterole) {
    await client.query(`alter role ${qRole} nocreatedb nocreaterole`);
    console.log(`Narrowed ${runtimeRole}: dropped CREATEDB/CREATEROLE.`);
  } else {
    console.log(`Role ${runtimeRole} attributes already least-privilege (no superuser/bypassrls/createdb/createrole).`);
  }

  await client.query('begin');

  // 3. Schema usage + the security-definer functions (request context + identity).
  await client.query(`
    grant usage on schema app, care, audit_log to ${qRole};
    grant execute on function app.set_request_context(uuid, uuid, uuid, uuid, text) to ${qRole};
    grant execute on function app.login_identity(text) to ${qRole};
    grant execute on function app.refresh_identity(uuid, uuid, uuid) to ${qRole};
  `);

  // 4. DML on care tables — no DELETE anywhere.
  await client.query(`
    grant select, insert, update on all tables in schema care to ${qRole};
    revoke delete on all tables in schema care from ${qRole};
  `);

  // 5. Immutable evidence: append + read only. The app may write new rows but can
  //    never update or delete existing audit / outbox records.
  await client.query(`
    revoke update, delete on care.outbox_events from ${qRole};
    grant select, insert on care.outbox_events to ${qRole};

    revoke update, delete on audit_log.audit_events from ${qRole};
    grant select, insert on audit_log.audit_events to ${qRole};
  `);

  // 6. Future care tables inherit the same DML-only default for the owner that
  //    runs migrations, so new tables are not accidentally over-granted.
  await client.query(`
    alter default privileges in schema care
      grant select, insert, update on tables to ${qRole};
  `);

  await client.query('commit');

  // 7. Report the resulting attributes so a reviewer can confirm the hardening.
  const attrs = await client.query(
    'select rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolcanlogin from pg_roles where rolname = $1',
    [runtimeRole]
  );
  console.log(`Runtime grants applied to ${runtimeRole}.`);
  console.log('Role attributes:', attrs.rows[0]);
  if (attrs.rows[0]?.rolsuper || attrs.rows[0]?.rolbypassrls) {
    console.error('WARNING: runtime role still has superuser or BYPASSRLS — this is unsafe.');
    process.exit(1);
  }
} catch (err) {
  await client.query('rollback').catch(() => {});
  throw err;
} finally {
  await client.end();
}
