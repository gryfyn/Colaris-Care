jest.mock('@/lib/db.js', () => ({ query: jest.fn(), pool: { query: jest.fn() } }));

import { pool, query } from '@/lib/db.js';
import { GET as health } from '@/app/api/v1/health/route';
import { GET as readiness } from '@/app/api/v1/ready/route';

describe('service probe routes', () => {
  test('health reports database connectivity', async () => {
    query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
    const response = await health();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expect.objectContaining({ ok: true, status: 'ready', db: 'ok', service: 'colaris-care-web' }));
  });

  test('health degrades without exposing the database error', async () => {
    query.mockRejectedValue(new Error('password secret'));
    const response = await health();
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toEqual(expect.objectContaining({ ok: false, status: 'degraded', db: 'error' }));
    expect(JSON.stringify(body)).not.toContain('password secret');
  });

  test('readiness requires both database and RLS context checks', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ ok: 1 }] }).mockResolvedValueOnce({ rows: [{ has_context: true }] });
    const response = await readiness();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expect.objectContaining({ ok: true, status: 'ready', checks: { database: true, rlsContext: true } }));
  });

  test.each([
    [{ ok: 0 }, { has_context: true }, { database: false, rlsContext: true }],
    [{ ok: 1 }, { has_context: false }, { database: true, rlsContext: false }],
  ])('readiness returns 503 when a prerequisite is absent', async (databaseRow, contextRow, checks) => {
    pool.query.mockResolvedValueOnce({ rows: [databaseRow] }).mockResolvedValueOnce({ rows: [contextRow] });
    const response = await readiness();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual(expect.objectContaining({ ok: false, status: 'not_ready', checks }));
  });

  test('readiness includes diagnostic errors outside production', async () => {
    pool.query.mockRejectedValue(new Error('connection refused'));
    const response = await readiness();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual(expect.objectContaining({ error: 'connection refused', checks: { database: false, rlsContext: false } }));
  });
});
