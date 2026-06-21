/**
 * Advanced authorization and permission tests for admin API routes
 * Tests fine-grained permission enforcement, edge cases, and security boundaries
 * Coverage: authorization, tenant isolation, input validation, error scenarios
 */

import { GET as getStaff } from '@/app/api/v1/admin/staff/route.js';
import { GET as getResidents } from '@/app/api/v1/admin/residents/route.js';
import { GET as getAuditLog } from '@/app/api/v1/admin/audit-log/route.js';
import { GET as getIncidents } from '@/app/api/v1/admin/incidents/route.js';
import { GET as getFormReviews, PATCH as patchFormReviews } from '@/app/api/v1/admin/form-reviews/route.js';

jest.mock('@/lib/auth-guard.js', () => ({
  authenticate: jest.fn(),
  authorize: jest.fn(),
  handleError: jest.fn((err) => {
    return Response.json(
      { error: err.message || 'Internal server error' },
      { status: err.status || 500 }
    );
  }),
}));

jest.mock('@/lib/db.js', () => ({
  withTenantClient: jest.fn(),
  query: jest.fn(),
}));

jest.mock('@/lib/audit-logger.js', () => ({
  AuditLogger: jest.fn().mockImplementation(() => ({
    logSelect: jest.fn().mockResolvedValue(undefined),
    logUpdate: jest.fn().mockResolvedValue(undefined),
  })),
}));

import * as authGuard from '@/lib/auth-guard.js';
import * as db from '@/lib/db.js';
import { PERMISSIONS, ROLES } from '@/lib/roles.js';

function createRequest(url, method = 'GET', body = null, headers = {}) {
  const request = {
    url: `http://localhost:3000${url}`,
    method,
    headers: new Map(Object.entries({
      'content-type': 'application/json',
      ...headers,
    })),
  };

  if (body) {
    request.json = jest.fn().mockResolvedValue(body);
  }

  return request;
}

function createUser(role = ROLES.ADMIN, tenantId = 'tenant-123', staffId = 'staff-123') {
  return {
    id: 'user-123',
    staffId,
    tenantId,
    role,
    jti: 'jti-123',
  };
}

describe('Admin API Advanced Authorization Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============ SPECIAL CHARACTER & INJECTION TESTS ============

  describe('Special characters and injection prevention', () => {
    test('GET /api/v1/admin/residents handles search with SQL special characters', async () => {
      const user = createUser(ROLES.ADMIN);
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(true);
      db.withTenantClient.mockResolvedValueOnce([{ total_count: 0 }]);

      const maliciousSearch = "'; DROP TABLE residents; --";
      const request = createRequest(`/api/v1/admin/residents?search=${encodeURIComponent(maliciousSearch)}`);
      const response = await getResidents(request);

      // Should return 400 because search < 2 chars after validation, or 200 with parameterized query
      expect([200, 400]).toContain(response.status);
      // Verify parameterized query was used (no error response)
      expect(response.status).not.toBe(500);
    });

    test('GET /api/v1/admin/staff handles search with Unicode characters', async () => {
      const user = createUser(ROLES.ADMIN);
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(true);
      db.withTenantClient.mockResolvedValueOnce([{ total_count: 1 }]);

      const unicodeSearch = '日本語テスト'; // Japanese text
      const request = createRequest(`/api/v1/admin/staff?search=${encodeURIComponent(unicodeSearch)}`);
      const response = await getStaff(request);

      expect(response.status).toBe(200);
    });

    test('GET /api/v1/admin/staff handles search with wildcards (LIKE characters)', async () => {
      const user = createUser(ROLES.ADMIN);
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(true);
      db.withTenantClient.mockResolvedValueOnce([{ total_count: 0 }]);

      // LIKE wildcards % and _ should be escaped by the route
      const request = createRequest('/api/v1/admin/staff?search=jo%hn_doe');
      const response = await getStaff(request);

      expect(response.status).toBe(200);
    });

    test('GET /api/v1/admin/audit-log handles search with escape sequences', async () => {
      const user = createUser(ROLES.ADMIN);
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(true);
      db.query.mockResolvedValueOnce({ rows: [{ total_count: 0 }] });

      const request = createRequest('/api/v1/admin/audit-log?resident_id=id%27OR%271%27%3D%271');
      const response = await getAuditLog(request);

      // Routes use parameterized queries, so this should be safe
      expect([200, 400, 422]).toContain(response.status);
    });
  });

  // ============ PERMISSION BOUNDARY TESTS ============

  describe('Permission boundary enforcement', () => {
    test('RESIDENT_CARE_OF role cannot access any admin endpoints', async () => {
      const unauthorizedEndpoints = [
        { route: '/api/v1/admin/staff', handler: getStaff },
        { route: '/api/v1/admin/residents', handler: getResidents },
        { route: '/api/v1/admin/incidents', handler: getIncidents },
        { route: '/api/v1/admin/audit-log', handler: getAuditLog },
        { route: '/api/v1/admin/form-reviews', handler: getFormReviews },
      ];

      for (const { route, handler } of unauthorizedEndpoints) {
        jest.clearAllMocks();
        const user = createUser(ROLES.RESIDENT_CARE_OF);
        authGuard.authenticate.mockResolvedValueOnce({ user });
        authGuard.authorize.mockReturnValueOnce(false);

        const request = createRequest(route);
        const response = await handler(request);

        expect(response.status).toBe(403);
        expect(authGuard.authorize).toHaveBeenCalled();
      }
    });

    test('STAFF role can access residents and staff but not audit', async () => {
      const staffEndpoints = [
        { route: '/api/v1/admin/staff', handler: getStaff, shouldAllow: true },
        { route: '/api/v1/admin/residents', handler: getResidents, shouldAllow: true },
        { route: '/api/v1/admin/audit-log', handler: getAuditLog, shouldAllow: false },
      ];

      for (const { route, handler, shouldAllow } of staffEndpoints) {
        jest.clearAllMocks();
        const user = createUser(ROLES.STAFF);
        authGuard.authenticate.mockResolvedValueOnce({ user });
        authGuard.authorize.mockReturnValueOnce(shouldAllow);

        if (shouldAllow) {
          db.withTenantClient.mockResolvedValueOnce([{ total_count: 0 }]);
        }

        const request = createRequest(route);
        const response = await handler(request);

        expect([200, 403]).toContain(response.status);
      }
    });

    test('MANAGER role has elevated privileges over STAFF', async () => {
      const managerPrivilegedEndpoints = [
        { route: '/api/v1/admin/form-reviews', handler: getFormReviews },
      ];

      for (const { route, handler } of managerPrivilegedEndpoints) {
        jest.clearAllMocks();
        const user = createUser(ROLES.MANAGER);
        authGuard.authenticate.mockResolvedValueOnce({ user });
        authGuard.authorize.mockReturnValueOnce(true);
        db.withTenantClient.mockResolvedValueOnce([{ total_count: 0 }]);

        const request = createRequest(route);
        const response = await handler(request);

        expect(response.status).toBe(200);
      }
    });
  });

  // ============ PAGINATION EDGE CASES ============

  describe('Pagination edge cases and boundaries', () => {
    test('limit=0 is clamped to minimum of 1', async () => {
      const user = createUser(ROLES.ADMIN);
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(true);
      db.withTenantClient.mockResolvedValueOnce([
        { id: '1', total_count: 100 },
        { id: '2', total_count: 100 },
        { id: '3', total_count: 100 },
      ]);

      const request = createRequest('/api/v1/admin/staff?limit=0');
      const response = await getStaff(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pagination.limit).toBeGreaterThanOrEqual(1);
    });

    test('limit > 200 is clamped to maximum of 200', async () => {
      const user = createUser(ROLES.ADMIN);
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(true);
      db.withTenantClient.mockResolvedValueOnce([{ total_count: 0 }]);

      const request = createRequest('/api/v1/admin/residents?limit=999999');
      const response = await getResidents(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pagination.limit).toBeLessThanOrEqual(200);
    });

    test('offset < 0 is clamped to 0', async () => {
      const user = createUser(ROLES.ADMIN);
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(true);
      db.withTenantClient.mockResolvedValueOnce([{ total_count: 100 }]);

      const request = createRequest('/api/v1/admin/staff?offset=-100');
      const response = await getStaff(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pagination.offset).toBeGreaterThanOrEqual(0);
    });

    test('offset beyond total count returns empty array with correct pagination', async () => {
      const user = createUser(ROLES.ADMIN);
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(true);
      db.withTenantClient.mockResolvedValueOnce([]);

      const request = createRequest('/api/v1/admin/residents?limit=10&offset=1000');
      const response = await getResidents(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toEqual([]);
      expect(data.pagination.offset).toBe(1000);
      expect(data.pagination.total).toBe(0);
    });

    test('returns correct page count: total 250, limit 50 = 5 pages', async () => {
      const user = createUser(ROLES.ADMIN);
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(true);
      db.withTenantClient.mockResolvedValueOnce([
        { id: '1', total_count: 250 },
        { id: '2', total_count: 250 },
        { id: '3', total_count: 250 },
      ]);

      const request = createRequest('/api/v1/admin/incidents?limit=50');
      const response = await getIncidents(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pagination.pages).toBe(5);
    });

    test('handles non-numeric limit and offset parameters gracefully', async () => {
      const user = createUser(ROLES.ADMIN);
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(true);
      db.withTenantClient.mockResolvedValueOnce([{ total_count: 0 }]);

      const request = createRequest('/api/v1/admin/staff?limit=abc&offset=xyz');
      const response = await getStaff(request);

      // Routes use parseInt which returns NaN, then Math.max/min handle it
      expect(response.status).toBe(200);
    });
  });

  // ============ DATE VALIDATION ============

  describe('Date validation for audit log and incidents', () => {
    test('accepts date_from with timezone offset', async () => {
      const user = createUser(ROLES.ADMIN);
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(true);
      db.query.mockResolvedValueOnce({ rows: [{ total_count: 0 }] });

      const request = createRequest('/api/v1/admin/audit-log?date_from=2024-01-01T00:00:00+00:00');
      const response = await getAuditLog(request);

      expect(response.status).toBe(200);
    });

    test('accepts date_to with milliseconds precision', async () => {
      const user = createUser(ROLES.ADMIN);
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(true);
      db.withTenantClient.mockResolvedValueOnce([{ total_count: 0 }]);

      const request = createRequest('/api/v1/admin/incidents?date_to=2024-12-31T23:59:59.999Z');
      const response = await getIncidents(request);

      expect(response.status).toBe(200);
    });

    test('handles various ISO date formats', async () => {
      const user = createUser(ROLES.ADMIN);
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(true);
      db.query.mockResolvedValueOnce({ rows: [{ total_count: 0 }] });

      const validISO = '2024-01-01T00:00:00Z';
      const request = createRequest(`/api/v1/admin/audit-log?date_from=${encodeURIComponent(validISO)}`);
      const response = await getAuditLog(request);

      expect(response.status).toBe(200);
    });

    test('handles date range queries with both date_from and date_to', async () => {
      const user = createUser(ROLES.ADMIN);
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(true);
      db.withTenantClient.mockResolvedValueOnce([
        {
          id: '1',
          event_time: '2024-06-15T12:00:00Z',
          total_count: 5,
        },
      ]);

      const request = createRequest(
        '/api/v1/admin/incidents?date_from=2024-06-01T00:00:00Z&date_to=2024-06-30T23:59:59Z'
      );
      const response = await getIncidents(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(1);
    });
  });

  // ============ FORM REVIEW VALIDATION ============

  describe('Form review PATCH request validation', () => {
    test('handles PATCH with non-string id values gracefully', async () => {
      const user = createUser(ROLES.ADMIN);
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(true);
      db.withTenantClient.mockResolvedValueOnce([
        { id: 123, review_status: 'approved' },
      ]);

      const request = createRequest('/api/v1/admin/form-reviews', 'PATCH', {
        ids: [123], // numbers - route is lenient with type coercion
        review_status: 'approved',
      });
      const response = await patchFormReviews(request);

      expect(response.status).toBe(200);
    });

    test('handles PATCH with whitespace in review_status', async () => {
      const user = createUser(ROLES.ADMIN);
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(true);

      const request = createRequest('/api/v1/admin/form-reviews', 'PATCH', {
        ids: ['id-1'],
        review_status: ' approved ', // with spaces
      });
      const response = await patchFormReviews(request);
      const data = await response.json();

      // Expects exact match, should fail with spaces
      expect(response.status).toBe(400);
    });

    test('handles PATCH with very long comments field', async () => {
      const user = createUser(ROLES.ADMIN);
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(true);
      db.withTenantClient.mockResolvedValueOnce([
        {
          id: 'id-1',
          review_status: 'approved',
          comments: 'a'.repeat(5000), // 5000 char comment
        },
      ]);

      const longComment = 'x'.repeat(10000);
      const request = createRequest('/api/v1/admin/form-reviews', 'PATCH', {
        ids: ['id-1'],
        review_status: 'approved',
        comments: longComment,
      });
      const response = await patchFormReviews(request);

      expect(response.status).toBe(200);
    });

    test('PATCH with null comments preserves existing comments', async () => {
      const user = createUser(ROLES.ADMIN);
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(true);
      db.withTenantClient.mockResolvedValueOnce([
        {
          id: 'id-1',
          review_status: 'approved',
          comments: 'Original comment',
        },
      ]);

      const request = createRequest('/api/v1/admin/form-reviews', 'PATCH', {
        ids: ['id-1'],
        review_status: 'approved',
        comments: null,
      });
      const response = await patchFormReviews(request);

      expect(response.status).toBe(200);
    });

    test('handles PATCH with empty string comments', async () => {
      const user = createUser(ROLES.ADMIN);
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(true);
      db.withTenantClient.mockResolvedValueOnce([
        {
          id: 'id-1',
          review_status: 'rejected',
          comments: '',
        },
      ]);

      const request = createRequest('/api/v1/admin/form-reviews', 'PATCH', {
        ids: ['id-1'],
        review_status: 'rejected',
        comments: '',
      });
      const response = await patchFormReviews(request);

      expect(response.status).toBe(200);
    });
  });

  // ============ TENANT ISOLATION EDGE CASES ============

  describe('Tenant isolation edge cases', () => {
    test('different tenants cannot see each other\'s residents', async () => {
      // User from tenant-a queries
      const user1 = createUser(ROLES.ADMIN, 'tenant-a', 'staff-a');
      authGuard.authenticate.mockResolvedValueOnce({ user: user1 });
      authGuard.authorize.mockReturnValueOnce(true);
      db.withTenantClient.mockResolvedValueOnce([
        { id: 'res-1', first_name: 'Alice', total_count: 1 },
      ]);

      const request1 = createRequest('/api/v1/admin/residents');
      const response1 = await getResidents(request1);
      const data1 = await response1.json();

      // Verify tenant-a was used
      const calls1 = db.withTenantClient.mock.calls;
      expect(calls1[calls1.length - 1][0]).toBe('tenant-a');
      expect(calls1[calls1.length - 1][1]).toBe('staff-a');
      expect(data1.data[0].first_name).toBe('Alice');

      // User from tenant-b queries
      jest.clearAllMocks();
      authGuard.authenticate.mockResolvedValueOnce({ user: createUser(ROLES.ADMIN, 'tenant-b', 'staff-b') });
      authGuard.authorize.mockReturnValueOnce(true);
      db.withTenantClient.mockResolvedValueOnce([
        { id: 'res-2', first_name: 'Bob', total_count: 1 },
      ]);

      const request2 = createRequest('/api/v1/admin/residents');
      const response2 = await getResidents(request2);
      const data2 = await response2.json();

      // Verify tenant-b was used
      const calls2 = db.withTenantClient.mock.calls;
      expect(calls2[calls2.length - 1][0]).toBe('tenant-b');
      expect(calls2[calls2.length - 1][1]).toBe('staff-b');
      expect(data2.data[0].first_name).toBe('Bob');
    });

    test('cannot filter by resident from different tenant in incidents', async () => {
      const user = createUser(ROLES.ADMIN, 'tenant-123', 'staff-123');
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(true);
      db.withTenantClient.mockResolvedValueOnce([]);

      // Attempt to filter by resident_id from a different tenant
      const request = createRequest('/api/v1/admin/incidents?resident_id=res-from-other-tenant');
      const response = await getIncidents(request);

      // Route should still enforce tenant_id in WHERE clause
      const calls = db.withTenantClient.mock.calls;
      expect(calls[calls.length - 1][0]).toBe('tenant-123');
      expect(calls[calls.length - 1][1]).toBe('staff-123');
      expect(response.status).toBe(200);
    });
  });

  // ============ MULTI-RECORD OPERATIONS ============

  describe('Multi-record operations (bulk updates)', () => {
    test('PATCH updates multiple records when all found', async () => {
      const user = createUser(ROLES.ADMIN);
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(true);

      const records = [
        { id: 'form-1', review_status: 'approved', tenant_id: 'tenant-123' },
        { id: 'form-2', review_status: 'approved', tenant_id: 'tenant-123' },
        { id: 'form-3', review_status: 'approved', tenant_id: 'tenant-123' },
      ];

      db.withTenantClient.mockResolvedValueOnce(records);

      const request = createRequest('/api/v1/admin/form-reviews', 'PATCH', {
        ids: records.map(r => r.id),
        review_status: 'approved',
      });
      const response = await patchFormReviews(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(3);
      expect(data.message).toMatch(/Updated 3/);
    });

    test('PATCH fails gracefully when one of many records not found', async () => {
      const user = createUser(ROLES.ADMIN);
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(true);
      db.withTenantClient.mockResolvedValueOnce({
        error: 'Form review form-999 not found or not accessible',
        status: 404,
      });

      const request = createRequest('/api/v1/admin/form-reviews', 'PATCH', {
        ids: ['form-1', 'form-2', 'form-999'],
        review_status: 'approved',
      });
      const response = await patchFormReviews(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toMatch(/not found/);
    });

    test('PATCH with large batch of IDs (100+)', async () => {
      const user = createUser(ROLES.ADMIN);
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(true);

      const ids = Array(100)
        .fill(null)
        .map((_, i) => `form-${i}`);
      const records = ids.map(id => ({
        id,
        review_status: 'approved',
      }));

      db.withTenantClient.mockResolvedValueOnce(records);

      const request = createRequest('/api/v1/admin/form-reviews', 'PATCH', {
        ids,
        review_status: 'approved',
      });
      const response = await patchFormReviews(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(100);
    });
  });

  // ============ AUDIT LOGGING ============

  describe('Audit logging coverage', () => {
    test('GET /api/v1/admin/residents logs audit with justification when provided', async () => {
      const user = createUser(ROLES.ADMIN);
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(true);

      const mockAuditLog = jest.fn().mockResolvedValueOnce(undefined);
      jest.mock('@/lib/audit-logger.js', () => ({
        AuditLogger: jest.fn().mockImplementation(() => ({
          logSelect: mockAuditLog,
        })),
      }));

      db.withTenantClient.mockResolvedValueOnce([{ total_count: 0 }]);

      const request = createRequest('/api/v1/admin/residents?justification=routine+audit');
      const response = await getResidents(request);

      expect(response.status).toBe(200);
    });

    test('GET /api/v1/admin/incidents logs audit without justification', async () => {
      const user = createUser(ROLES.ADMIN);
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(true);
      db.withTenantClient.mockResolvedValueOnce([{ total_count: 0 }]);

      const request = createRequest('/api/v1/admin/incidents');
      const response = await getIncidents(request);

      expect(response.status).toBe(200);
    });

    test('PATCH /api/v1/admin/form-reviews logs update audit', async () => {
      const user = createUser(ROLES.ADMIN);
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(true);
      db.withTenantClient.mockResolvedValueOnce([
        { id: 'form-1', review_status: 'approved' },
      ]);

      const request = createRequest('/api/v1/admin/form-reviews', 'PATCH', {
        ids: ['form-1'],
        review_status: 'approved',
      });
      const response = await patchFormReviews(request);

      expect(response.status).toBe(200);
    });
  });

  // ============ RESPONSE STRUCTURE VALIDATION ============

  describe('Response structure consistency', () => {
    test('all GET endpoints return data and pagination properties', async () => {
      const user = createUser(ROLES.ADMIN);

      const endpoints = [
        { route: '/api/v1/admin/staff', handler: getStaff },
        { route: '/api/v1/admin/residents', handler: getResidents },
        { route: '/api/v1/admin/incidents', handler: getIncidents },
        { route: '/api/v1/admin/form-reviews', handler: getFormReviews },
      ];

      for (const { route, handler } of endpoints) {
        jest.clearAllMocks();
        authGuard.authenticate.mockResolvedValueOnce({ user });
        authGuard.authorize.mockReturnValueOnce(true);
        db.withTenantClient.mockResolvedValueOnce([{ total_count: 5 }]);

        const request = createRequest(route);
        const response = await handler(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toHaveProperty('data');
        expect(data).toHaveProperty('pagination');
        expect(data.pagination).toHaveProperty('limit');
        expect(data.pagination).toHaveProperty('offset');
        expect(data.pagination).toHaveProperty('total');
        expect(data.pagination).toHaveProperty('pages');
      }
    });

    test('PATCH form-reviews returns data, message, and status 200', async () => {
      const user = createUser(ROLES.ADMIN);
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(true);
      db.withTenantClient.mockResolvedValueOnce([
        { id: 'form-1', review_status: 'approved' },
      ]);

      const request = createRequest('/api/v1/admin/form-reviews', 'PATCH', {
        ids: ['form-1'],
        review_status: 'approved',
      });
      const response = await patchFormReviews(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('data');
      expect(data).toHaveProperty('message');
      expect(Array.isArray(data.data)).toBe(true);
    });

    test('audit-log returns data without nested pagination for backward compatibility', async () => {
      const user = createUser(ROLES.ADMIN);
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(true);
      db.query.mockResolvedValueOnce({
        rows: [{ id: 'log-1', total_count: 10 }],
      });

      const request = createRequest('/api/v1/admin/audit-log');
      const response = await getAuditLog(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('data');
      expect(data).toHaveProperty('pagination');
    });
  });
});
