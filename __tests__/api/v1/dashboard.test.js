// File: __tests__/api/v1/dashboard.test.js
import { GET } from '@/app/api/v1/dashboard/route';

const mockRequest = (url = '/api/v1/dashboard') => {
  const headers = new Map();
  headers.set('authorization', 'Bearer test-token');
  return {
    url,
    headers,
  };
};

const mockDbClient = {
  query: jest.fn(),
};

jest.mock('@/lib/auth-guard.js', () => ({
  authenticate: jest.fn((req) => ({
    user: {
      id: 'user123',
      tenantId: 'tenant123',
      staffId: 'staff123',
      role: 'admin',
    },
  })),
  authorize: jest.fn((role, ...perms) => role === 'admin'),
  handleError: jest.fn((err) => Response.json({ error: err.message }, { status: 500 })),
}));

jest.mock('@/lib/db.js', () => ({
  withTenantClient: jest.fn((tenantId, staffId, fn) => fn(mockDbClient)),
}));

jest.mock('@/lib/roles.js', () => ({
  PERMISSIONS: {
    ADMIN_REPORTS: 'admin:reports',
    RESIDENTS_READ: 'residents:read',
  },
}));

jest.mock('@/lib/audit-logger.js', () => ({
  AuditLogger: jest.fn().mockImplementation(() => ({
    logSelect: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@/lib/logger.js', () => ({
  error: jest.fn(),
  warn: jest.fn(),
}));

describe('GET /api/v1/dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication & Authorization', () => {
    test('returns 401 when unauthenticated', async () => {
      const { authenticate } = require('@/lib/auth-guard.js');
      authenticate.mockReturnValueOnce({
        error: 'Missing or malformed Authorization header',
        status: 401,
      });

      const req = mockRequest();
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Missing or malformed Authorization header');
    });

    test('returns 403 when user lacks ADMIN_REPORTS or RESIDENTS_READ permission', async () => {
      const { authorize } = require('@/lib/auth-guard.js');
      authorize.mockReturnValueOnce(false);

      const req = mockRequest();
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });

    test('allows user with ADMIN_REPORTS permission', async () => {
      const { authorize } = require('@/lib/auth-guard.js');
      authorize.mockReturnValueOnce(true);

      mockDbClient.query.mockResolvedValueOnce({
        rows: [
          {
            active_residents: 10,
            active_plans: 8,
            plans_expiring_soon: 2,
            reviews_overdue: 1,
            high_risk_residents: 3,
            roi_expiring_soon: 0,
          },
        ],
      });

      const req = mockRequest();
      const response = await GET(req);

      expect(response.status).toBe(200);
    });

    test('allows user with RESIDENTS_READ permission', async () => {
      const { authorize } = require('@/lib/auth-guard.js');
      authorize.mockReturnValueOnce(true);

      mockDbClient.query.mockResolvedValueOnce({
        rows: [
          {
            active_residents: 10,
            active_plans: 8,
            plans_expiring_soon: 2,
            reviews_overdue: 1,
            high_risk_residents: 3,
            roi_expiring_soon: 0,
          },
        ],
      });

      const req = mockRequest();
      const response = await GET(req);

      expect(response.status).toBe(200);
    });
  });

  describe('HIPAA Compliance - Tenant Isolation', () => {
    test('uses withTenantClient to ensure tenant isolation', async () => {
      const { withTenantClient } = require('@/lib/db.js');
      withTenantClient.mockClear();

      mockDbClient.query.mockResolvedValueOnce({
        rows: [
          {
            active_residents: 10,
            active_plans: 8,
            plans_expiring_soon: 2,
            reviews_overdue: 1,
            high_risk_residents: 3,
            roi_expiring_soon: 0,
          },
        ],
      });

      const req = mockRequest();
      await GET(req);

      expect(withTenantClient).toHaveBeenCalledWith('tenant123', 'staff123', expect.any(Function));
    });

    test('only returns data for authenticated tenant', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [
          {
            active_residents: 10,
            active_plans: 8,
            plans_expiring_soon: 2,
            reviews_overdue: 1,
            high_risk_residents: 3,
            roi_expiring_soon: 0,
          },
        ],
      });

      const req = mockRequest();
      await GET(req);

      const queryCall = mockDbClient.query.mock.calls[0];
      const sql = queryCall[0];
      expect(sql).toContain('FROM care.residents');
      expect(sql).toContain('FROM care.care_plans');
    });
  });

  describe('Data Consistency', () => {
    test('returns all required dashboard metrics', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [
          {
            active_residents: 10,
            active_plans: 8,
            plans_expiring_soon: 2,
            reviews_overdue: 1,
            high_risk_residents: 3,
            roi_expiring_soon: 0,
          },
        ],
      });

      const req = mockRequest();
      const response = await GET(req);
      const data = await response.json();

      expect(data.data).toHaveProperty('active_residents');
      expect(data.data).toHaveProperty('active_plans');
      expect(data.data).toHaveProperty('plans_expiring_soon');
      expect(data.data).toHaveProperty('reviews_overdue');
      expect(data.data).toHaveProperty('high_risk_residents');
      expect(data.data).toHaveProperty('roi_expiring_soon');
    });

    test('returns numeric values for all metrics', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [
          {
            active_residents: 10,
            active_plans: 8,
            plans_expiring_soon: 2,
            reviews_overdue: 1,
            high_risk_residents: 3,
            roi_expiring_soon: 0,
          },
        ],
      });

      const req = mockRequest();
      const response = await GET(req);
      const data = await response.json();

      expect(typeof data.data.active_residents).toBe('number');
      expect(typeof data.data.active_plans).toBe('number');
      expect(typeof data.data.plans_expiring_soon).toBe('number');
      expect(typeof data.data.reviews_overdue).toBe('number');
      expect(typeof data.data.high_risk_residents).toBe('number');
      expect(typeof data.data.roi_expiring_soon).toBe('number');
    });

    test('returns zero values when no matching records exist', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [
          {
            active_residents: 0,
            active_plans: 0,
            plans_expiring_soon: 0,
            reviews_overdue: 0,
            high_risk_residents: 0,
            roi_expiring_soon: 0,
          },
        ],
      });

      const req = mockRequest();
      const response = await GET(req);
      const data = await response.json();

      expect(data.data.active_residents).toBe(0);
      expect(data.data.active_plans).toBe(0);
    });
  });

  describe('Response Format', () => {
    test('returns 200 status on success', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [
          {
            active_residents: 10,
            active_plans: 8,
            plans_expiring_soon: 2,
            reviews_overdue: 1,
            high_risk_residents: 3,
            roi_expiring_soon: 0,
          },
        ],
      });

      const req = mockRequest();
      const response = await GET(req);

      expect(response.status).toBe(200);
    });

    test('returns data object in response', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [
          {
            active_residents: 10,
            active_plans: 8,
            plans_expiring_soon: 2,
            reviews_overdue: 1,
            high_risk_residents: 3,
            roi_expiring_soon: 0,
          },
        ],
      });

      const req = mockRequest();
      const response = await GET(req);
      const data = await response.json();

      expect(data).toHaveProperty('data');
      expect(typeof data.data).toBe('object');
    });
  });

  describe('Error Handling', () => {
    test('returns 500 on database error', async () => {
      mockDbClient.query.mockRejectedValueOnce(new Error('Database connection failed'));

      const req = mockRequest();
      const response = await GET(req);

      expect(response.status).toBe(500);
    });

    test('returns error message in response body', async () => {
      mockDbClient.query.mockRejectedValueOnce(new Error('Query timeout'));

      const req = mockRequest();
      const response = await GET(req);
      const data = await response.json();

      expect(data.error).toBeDefined();
    });
  });

  describe('Audit Logging', () => {
    test('logs select operation', async () => {
      const { AuditLogger } = require('@/lib/audit-logger.js');
      const mockAudit = { logSelect: jest.fn().mockResolvedValue(undefined) };
      AuditLogger.mockImplementationOnce(() => mockAudit);

      mockDbClient.query.mockResolvedValueOnce({
        rows: [
          {
            active_residents: 10,
            active_plans: 8,
            plans_expiring_soon: 2,
            reviews_overdue: 1,
            high_risk_residents: 3,
            roi_expiring_soon: 0,
          },
        ],
      });

      const req = mockRequest();
      await GET(req);

      expect(mockAudit.logSelect).toHaveBeenCalled();
    });
  });
});
