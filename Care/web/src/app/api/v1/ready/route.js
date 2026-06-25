import { pool } from '@/lib/db.js';

export async function GET() {
  const checks = {
    database: false,
    rlsContext: false,
  };

  try {
    const db = await pool.query('select 1 as ok');
    checks.database = db.rows[0]?.ok === 1;

    const context = await pool.query(`
      select
        to_regprocedure('app.set_request_context(uuid, uuid, uuid, uuid, text)') is not null as has_context
    `);
    checks.rlsContext = context.rows[0]?.has_context === true;
  } catch (err) {
    return Response.json({
      ok: false,
      status: 'not_ready',
      checks,
      error: process.env.NODE_ENV === 'production' ? 'readiness check failed' : err.message,
      ts: new Date().toISOString(),
    }, { status: 503 });
  }

  const ok = Object.values(checks).every(Boolean);
  return Response.json({
    ok,
    status: ok ? 'ready' : 'not_ready',
    checks,
    ts: new Date().toISOString(),
  }, { status: ok ? 200 : 503 });
}
