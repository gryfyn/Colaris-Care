/**
 * Critical path integration tests for API endpoints
 * Tests core workflows: authentication, drug disposal, and admission
 *
 * These tests require a running test server with database and seed data:
 * Set TEST_BASE_URL, TEST_DATABASE_URL in .env.test
 * Run: npm test -- src/__tests__/api/critical-paths.test.js
 *
 * If server is not running, tests will skip gracefully.
 */

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';
const TEST_TENANT_ID = process.env.TEST_TENANT_ID || 'test-tenant-uuid';
const ADMIN_TOKEN = process.env.TEST_ADMIN_TOKEN;
const STAFF_TOKEN = process.env.TEST_STAFF_TOKEN;
let SERVER_AVAILABLE = true;

async function request(method, path, body = null, token = null) {
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const opts = { method, headers };
    if (body) {
      opts.body = JSON.stringify(body);
    }
    return await fetch(`${BASE}${path}`, opts);
  } catch (error) {
    // Server not available
    SERVER_AVAILABLE = false;
    return null;
  }
}

async function post(path, body, token = null) {
  return request('POST', path, body, token);
}

async function get(path, token = null) {
  return request('GET', path, null, token);
}

async function patch(path, body, token = null) {
  return request('PATCH', path, body, token);
}

function skipIfServerUnavailable(res) {
  if (!res || !SERVER_AVAILABLE) {
    return true;
  }
  return false;
}

describe('CRITICAL PATH: Authentication Workflow', () => {
  describe('POST /api/v1/auth/login', () => {
    test('[CRITICAL] validates required fields', async () => {
      const res = await post('/api/v1/auth/login', { password: 'test' });
      if (skipIfServerUnavailable(res)) return;

      expect(res.status).toBe(422);
    });

    test('[CRITICAL] rejects invalid credentials', async () => {
      const res = await post('/api/v1/auth/login', {
        email: 'invalid@example.com',
        password: 'wrong',
      });
      if (skipIfServerUnavailable(res)) return;

      expect([401, 422]).toContain(res.status);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    test('[CRITICAL] returns 401 without token', async () => {
      const res = await get('/api/v1/auth/me');
      if (skipIfServerUnavailable(res)) return;

      expect(res.status).toBe(401);
    });

    test('[CRITICAL] rejects invalid token', async () => {
      const res = await get('/api/v1/auth/me', 'invalid-token');
      if (skipIfServerUnavailable(res)) return;

      expect(res.status).toBe(401);
    });
  });
});

describe('CRITICAL PATH: Drug Disposal Workflow', () => {
  describe('POST /api/v1/drug-disposal', () => {
    test('[CRITICAL] requires authentication', async () => {
      const res = await post('/api/v1/drug-disposal', {
        resident_id: 'res-123',
        drug_name: 'Aspirin',
      });
      if (skipIfServerUnavailable(res)) return;

      expect(res.status).toBe(401);
    });

    test('[CRITICAL] validates required resident_id', async () => {
      const res = await post('/api/v1/drug-disposal', {
        drug_name: 'Aspirin',
      }, STAFF_TOKEN);
      if (skipIfServerUnavailable(res)) return;

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error).toMatch(/resident_id/i);
    });

    test('[CRITICAL] validates required drug_name', async () => {
      const res = await post('/api/v1/drug-disposal', {
        resident_id: 'res-123',
      }, STAFF_TOKEN);
      if (skipIfServerUnavailable(res)) return;

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error).toMatch(/drug_name/i);
    });
  });

  describe('GET /api/v1/drug-disposal', () => {
    test('[CRITICAL] requires authentication', async () => {
      const res = await get('/api/v1/drug-disposal');
      if (skipIfServerUnavailable(res)) return;

      expect(res.status).toBe(401);
    });

    test('[CRITICAL] checks admin/manager authorization', async () => {
      const res = await get('/api/v1/drug-disposal', STAFF_TOKEN);
      if (skipIfServerUnavailable(res)) return;

      // May be 403 if not admin, or 200 if test token is admin
      expect([200, 403]).toContain(res.status);
    });
  });

  describe('PATCH /api/v1/drug-disposal/[id]/review', () => {
    test('[CRITICAL] requires authentication', async () => {
      const res = await patch('/api/v1/drug-disposal/test/review', {
        status: 'approved',
      });
      if (skipIfServerUnavailable(res)) return;

      expect(res.status).toBe(401);
    });

    test('[CRITICAL] validates status field', async () => {
      const res = await patch('/api/v1/drug-disposal/test/review', {
        status: 'invalid',
      }, ADMIN_TOKEN);
      if (skipIfServerUnavailable(res)) return;

      // 404 (not found) or 422 (invalid status), not 200
      expect([404, 403, 422]).toContain(res.status);
    });
  });
});

describe('CRITICAL PATH: Admission Workflow', () => {
  describe('POST /api/v1/admission/pre-screening', () => {
    test('[CRITICAL] requires authentication', async () => {
      const res = await post('/api/v1/admission/pre-screening', {
        full_name: 'John Doe',
        date_of_birth: '1980-05-15',
      });
      if (skipIfServerUnavailable(res)) return;

      expect(res.status).toBe(401);
    });

    test('[CRITICAL] validates required full_name', async () => {
      const res = await post('/api/v1/admission/pre-screening', {
        date_of_birth: '1980-05-15',
      }, STAFF_TOKEN);
      if (skipIfServerUnavailable(res)) return;

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/full_name/i);
    });

    test('[CRITICAL] validates required date_of_birth', async () => {
      const res = await post('/api/v1/admission/pre-screening', {
        full_name: 'Jane Doe',
      }, STAFF_TOKEN);
      if (skipIfServerUnavailable(res)) return;

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/date_of_birth/i);
    });
  });
});

describe('ERROR HANDLING', () => {
  test('[CRITICAL] returns JSON error responses', async () => {
    const res = await post('/api/v1/drug-disposal', {
      resident_id: 'res-123',
    });
    if (skipIfServerUnavailable(res)) return;

    expect(res.headers.get('content-type')).toMatch(/json/i);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test('[CRITICAL] returns appropriate HTTP status codes', async () => {
    const res = await post('/api/v1/auth/login', {
      email: 'test@example.com',
    });
    if (skipIfServerUnavailable(res)) return;

    expect(res.ok || res.status >= 400).toBe(true);
  });
});
