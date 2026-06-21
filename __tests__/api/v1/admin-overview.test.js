// File: __tests__/api/v1/admin-overview.test.js
import { GET, POST } from '@/app/api/v1/admin/overview/route';

const mockRequest = (url = '/api/v1/admin/overview', method = 'GET') => {
  const headers = new Map();
  headers.set('authorization', 'Bearer test-token');
  return {
    url,
    method,
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

describe('GET /api/v1/admin/overview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Authentication & Authorization', () => {
    test('returns 401 when unauthenticated', async () => {
      const { authenticate } = require('@/lib/auth-guard.js');
      authenticate.mockReturnValueOnce({
        error: 'Invalid token',
        status: 401,
      });

      const req = mockRequest();
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid token');
    });

    test('returns 403 when user lacks ADMIN_REPORTS permission', async () => {
      const { authorize } = require('@/lib/auth-guard.js');
      authorize.mockReturnValueOnce(false);

      const req = mockRequest();
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });
  });

  describe('HIPAA Compliance - Tenant Isolation', () => {
    test('uses withTenantClient to ensure tenant isolation', async () => {
      const { withTenantClient } = require('@/lib/db.js');
      withTenantClient.mockClear();

      mockDbClient.query.mockResolvedValueOnce({
        rows: [
          {
            pending_admissions: 0,
            pending_incidents: 0,
            recent_incidents_7d: 0,
            active_staff: 5,
            inactive_staff: 0,
            active_residents: 10,
            occupied_beds: 10,
            total_bed_capacity: 20,
            expiring_plans_30d: 1,
            roi_expiring_soon: 0,
            query_timestamp: new Date().toISOString(),
          },
        ],
      });

      const req = mockRequest();
      await GET(req);

      expect(withTenantClient).toHaveBeenCalledWith('tenant123', 'staff123', expect.any(Function));
    });

    test('filters all counts by tenant_id', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [
          {
            pending_admissions: 0,
            pending_incidents: 0,
            recent_incidents_7d: 0,
            active_staff: 5,
            inactive_staff: 0,
            active_residents: 10,
            occupied_beds: 10,
            total_bed_capacity: 20,
            expiring_plans_30d: 1,
            roi_expiring_soon: 0,
            query_timestamp: new Date().toISOString(),
          },
        ],
      });

      const req = mockRequest();
      await GET(req);

      const queryCall = mockDbClient.query.mock.calls[0];
      expect(queryCall[1][0]).toBe('tenant123');
    });
  });

  describe('Data Consistency', () => {
    test('returns all required metrics', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [
          {
            pending_admissions: 2,
            pending_incidents: 1,
            recent_incidents_7d: 3,
            active_staff: 5,
            inactive_staff: 1,
            active_residents: 10,
            occupied_beds: 10,
            total_bed_capacity: 20,
            expiring_plans_30d: 1,
            roi_expiring_soon: 2,
            query_timestamp: new Date().toISOString(),
          },
        ],
      });

      const req = mockRequest();
      const response = await GET(req);
      const data = await response.json();

      expect(data.data).toHaveProperty('pending_admissions');
      expect(data.data).toHaveProperty('pending_incidents');
      expect(data.data).toHaveProperty('recent_incidents_7d');
      expect(data.data).toHaveProperty('active_staff');
      expect(data.data).toHaveProperty('inactive_staff');
      expect(data.data).toHaveProperty('active_residents');
      expect(data.data).toHaveProperty('bed_capacity');
      expect(data.data).toHaveProperty('care_plans_expiring_30d');
      expect(data.data).toHaveProperty('roi_expiring_soon');
    });

    test('returns correct numeric values', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [
          {
            pending_admissions: 2,
            pending_incidents: 1,
            recent_incidents_7d: 3,
            active_staff: 5,
            inactive_staff: 1,
            active_residents: 10,
            occupied_beds: 10,
            total_bed_capacity: 20,
            expiring_plans_30d: 1,
            roi_expiring_soon: 2,
            query_timestamp: new Date().toISOString(),
          },
        ],
      });

      const req = mockRequest();
      const response = await GET(req);
      const data = await response.json();

      expect(data.data.pending_admissions).toBe(2);
      expect(data.data.pending_incidents).toBe(1);
      expect(data.data.active_staff).toBe(5);
      expect(data.data.active_residents).toBe(10);
    });

    test('calculates bed capacity metrics correctly', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [
          {
            pending_admissions: 0,
            pending_incidents: 0,
            recent_incidents_7d: 0,
            active_staff: 5,
            inactive_staff: 0,
            active_residents: 15,
            occupied_beds: 15,
            total_bed_capacity: 20,
            expiring_plans_30d: 0,
            roi_expiring_soon: 0,
            query_timestamp: new Date().toISOString(),
          },
        ],
      });

      const req = mockRequest();
      const response = await GET(req);
      const data = await response.json();

      expect(data.data.bed_capacity.occupied).toBe(15);
      expect(data.data.bed_capacity.total).toBe(20);
      expect(data.data.bed_capacity.available).toBe(5);
      expect(data.data.bed_capacity.occupancy_rate).toBe('75.0');
    });

    test('handles zero bed capacity gracefully', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [
          {
            pending_admissions: 0,
            pending_incidents: 0,
            recent_incidents_7d: 0,
            active_staff: 5,
            inactive_staff: 0,
            active_residents: 0,
            occupied_beds: 0,
            total_bed_capacity: null,
            expiring_plans_30d: 0,
            roi_expiring_soon: 0,
            query_timestamp: new Date().toISOString(),
          },
        ],
      });

      const req = mockRequest();
      const response = await GET(req);
      const data = await response.json();

      expect(data.data.bed_capacity.total).toBe(0);
      expect(data.data.bed_capacity.occupancy_rate).toBe('0');
    });

    test('handles null values with defaults', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [
          {
            pending_admissions: null,
            pending_incidents: null,
            recent_incidents_7d: null,
            active_staff: null,
            inactive_staff: null,
            active_residents: null,
            occupied_beds: null,
            total_bed_capacity: null,
            expiring_plans_30d: null,
            roi_expiring_soon: null,
            query_timestamp: new Date().toISOString(),
          },
        ],
      });

      const req = mockRequest();
      const response = await GET(req);
      const data = await response.json();

      expect(data.data.pending_admissions).toBe(0);
      expect(data.data.pending_incidents).toBe(0);
      expect(data.data.active_staff).toBe(0);
    });
  });

  describe('Caching', () => {
    test('returns cached data on second request within 60 seconds', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [
          {
            pending_admissions: 1,
            pending_incidents: 0,
            recent_incidents_7d: 0,
            active_staff: 5,
            inactive_staff: 0,
            active_residents: 10,
            occupied_beds: 10,
            total_bed_capacity: 20,
            expiring_plans_30d: 0,
            roi_expiring_soon: 0,
            query_timestamp: new Date().toISOString(),
          },
        ],
      });

      const req1 = mockRequest();
      const response1 = await GET(req1);
      const data1 = await response1.json();

      expect(data1.cached).toBe(false);

      // Second request should use cache
      const req2 = mockRequest();
      const response2 = await GET(req2);
      const data2 = await response2.json();

      expect(data2.cached).toBe(true);
      expect(mockDbClient.query).toHaveBeenCalledTimes(1);
    });

    test('invalidates cache after 60 seconds', async () => {
      mockDbClient.query.mockResolvedValue({
        rows: [
          {
            pending_admissions: 1,
            pending_incidents: 0,
            recent_incidents_7d: 0,
            active_staff: 5,
            inactive_staff: 0,
            active_residents: 10,
            occupied_beds: 10,
            total_bed_capacity: 20,
            expiring_plans_30d: 0,
            roi_expiring_soon: 0,
            query_timestamp: new Date().toISOString(),
          },
        ],
      });

      const req1 = mockRequest();
      await GET(req1);

      jest.advanceTimersByTime(61000); // Advance by 61 seconds

      const req2 = mockRequest();
      await GET(req2);

      expect(mockDbClient.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('Response Format', () => {
    test('returns 200 status on success', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [
          {
            pending_admissions: 0,
            pending_incidents: 0,
            recent_incidents_7d: 0,
            active_staff: 5,
            inactive_staff: 0,
            active_residents: 10,
            occupied_beds: 10,
            total_bed_capacity: 20,
            expiring_plans_30d: 0,
            roi_expiring_soon: 0,
            query_timestamp: new Date().toISOString(),
          },
        ],
      });

      const req = mockRequest();
      const response = await GET(req);

      expect(response.status).toBe(200);
    });

    test('returns data object and cached flag', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [
          {
            pending_admissions: 0,
            pending_incidents: 0,
            recent_incidents_7d: 0,
            active_staff: 5,
            inactive_staff: 0,
            active_residents: 10,
            occupied_beds: 10,
            total_bed_capacity: 20,
            expiring_plans_30d: 0,
            roi_expiring_soon: 0,
            query_timestamp: new Date().toISOString(),
          },
        ],
      });

      const req = mockRequest();
      const response = await GET(req);
      const data = await response.json();

      expect(data).toHaveProperty('data');
      expect(data).toHaveProperty('cached');
      expect(typeof data.cached).toBe('boolean');
    });
  });

  describe('Error Handling', () => {
    test('returns 500 on database error', async () => {
      mockDbClient.query.mockRejectedValueOnce(new Error('Connection timeout'));

      const req = mockRequest();
      const response = await GET(req);

      expect(response.status).toBe(500);
    });
  });
});

describe('POST /api/v1/admin/overview (refresh)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication & Authorization', () => {
    test('returns 401 when unauthenticated', async () => {
      const { authenticate } = require('@/lib/auth-guard.js');
      authenticate.mockReturnValueOnce({
        error: 'Invalid token',
        status: 401,
      });

      const req = mockRequest('/api/v1/admin/overview', 'POST');
      const response = await POST(req);

      expect(response.status).toBe(401);
    });

    test('returns 403 when user lacks ADMIN_REPORTS permission', async () => {
      const { authorize } = require('@/lib/auth-guard.js');
      authorize.mockReturnValueOnce(false);

      const req = mockRequest('/api/v1/admin/overview', 'POST');
      const response = await POST(req);

      expect(response.status).toBe(403);
    });
  });

  describe('Cache Refresh', () => {
    test('clears cache and returns fresh data', async () => {
      mockDbClient.query.mockResolvedValue({
        rows: [
          {
            pending_admissions: 1,
            pending_incidents: 0,
            recent_incidents_7d: 0,
            active_staff: 5,
            inactive_staff: 0,
            active_residents: 10,
            occupied_beds: 10,
            total_bed_capacity: 20,
            expiring_plans_30d: 0,
            roi_expiring_soon: 0,
            query_timestamp: new Date().toISOString(),
          },
        ],
      });

      // First GET to populate cache
      const getReq = mockRequest();
      await GET(getReq);

      // POST should clear cache and fetch fresh data
      const postReq = mockRequest('/api/v1/admin/overview', 'POST');
      const response = await POST(postReq);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('refreshed');
      expect(data.refreshed).toBe(true);
    });
  });

  describe('Response Format', () => {
    test('returns 200 status on success', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [
          {
            pending_admissions: 0,
            pending_incidents: 0,
            recent_incidents_7d: 0,
            active_staff: 5,
            inactive_staff: 0,
            active_residents: 10,
            occupied_beds: 10,
            total_bed_capacity: 20,
            expiring_plans_30d: 0,
            roi_expiring_soon: 0,
            query_timestamp: new Date().toISOString(),
          },
        ],
      });

      const req = mockRequest('/api/v1/admin/overview', 'POST');
      const response = await POST(req);

      expect(response.status).toBe(200);
    });

    test('returns refreshed flag in response', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [
          {
            pending_admissions: 0,
            pending_incidents: 0,
            recent_incidents_7d: 0,
            active_staff: 5,
            inactive_staff: 0,
            active_residents: 10,
            occupied_beds: 10,
            total_bed_capacity: 20,
            expiring_plans_30d: 0,
            roi_expiring_soon: 0,
            query_timestamp: new Date().toISOString(),
          },
        ],
      });

      const req = mockRequest('/api/v1/admin/overview', 'POST');
      const response = await POST(req);
      const data = await response.json();

      expect(data).toHaveProperty('refreshed');
      expect(data.refreshed).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('returns 500 on database error', async () => {
      mockDbClient.query.mockRejectedValueOnce(new Error('Connection failed'));

      const req = mockRequest('/api/v1/admin/overview', 'POST');
      const response = await POST(req);

      expect(response.status).toBe(500);
    });
  });
});
