import { query } from '@/lib/db.js';

// Readiness probe: pings the database so the health check reflects real
// connectivity. Returns 503 when the DB is unreachable.
export async function GET() {
  let db = 'ok';
  let ok = true;
  try {
    await query('select 1');
  } catch {
    db = 'error';
    ok = false;
  }
  return Response.json(
    {
      ok,
      service: 'colaris-care-web',
      status: ok ? 'ready' : 'degraded',
      db,
      ts: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 }
  );
}
