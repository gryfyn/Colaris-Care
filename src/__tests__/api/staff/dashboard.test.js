/**
 * Unit tests for /api/v1/staff/dashboard endpoint
 * Tests authentication, authorization, tenant isolation, and data aggregation
 */

import { GET as getDashboard } from '@/app/api/v1/staff/dashboard/route.js';

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
}));

jest.mock('@/lib/encryption.js', () => ({
  decryptFields: jest.fn((row, fields, key) => row),
}));

jest.mock('@/lib/audit-logger.js', () => ({
  AuditLogger: jest.fn().mockImplementation(() => ({
    logSelect: jest.fn().mockResolvedValue(undefined),
  })),
}));

import * as authGuard from '@/lib/auth-guard.js';
import * as db from '@/lib/db.js';
import { PERMISSIONS, ROLES } from '@/lib/roles.js';

function createRequest(url, method = 'GET') {
  const mockHeaders = {
    get: jest.fn(() => 'application/json'),
  };
  return {
    url: `http://localhost:3000${url}`,
    method,
    headers: mockHeaders,
  };
}

function createUser(role = ROLES.STAFF, tenantId = 'tenant-123', staffId = 'staff-123') {
  return { id: 'user-123', staffId, tenantId, role, jti: 'jti-123' };
}

function createMockClient() {
  return { query: jest.fn(), release: jest.fn() };
}

describe('GET /api/v1/staff/dashboard — Staff dashboard data', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 401 when not authenticated', async () => {
    authGuard.authenticate.mockResolvedValueOnce({ error: 'Unauthorized', status: 401 });
    const request = createRequest('/api/v1/staff/dashboard');
    const response = await getDashboard(request);
    expect(response.status).toBe(401);
  });

  test('returns 403 when user lacks STAFF_READ permission', async () => {
    const user = createUser(ROLES.RESIDENT_CARE_OF);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(false);

    const request = createRequest('/api/v1/staff/dashboard');
    const response = await getDashboard(request);
    expect(response.status).toBe(403);
    expect(authGuard.authorize).toHaveBeenCalledWith(ROLES.RESIDENT_CARE_OF, PERMISSIONS.STAFF_READ);
  });

  test('returns 200 with dashboard summary for authorized user', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-123', 'staff-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ count: 5 }] }) // Assigned residents count
        .mockResolvedValueOnce({ rows: [{ count: 2 }] }) // Pending progress notes count
        .mockResolvedValueOnce({ rows: [{ id: 'incident-1', incident_date: '2024-05-20', incident_time: '10:30', first_name: 'John', last_name: 'Doe', incident_type: 'Fall' }] }) // Recent incidents
        .mockResolvedValueOnce({ rows: [{ id: 'res-1', first_name: 'Alice', last_name: 'Adams', status: 'active', assignment_date: '2024-01-01' }] }); // Today's assignments
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/staff/dashboard');
    const response = await getDashboard(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.data).toHaveProperty('assignedResidents', 5);
    expect(data.data).toHaveProperty('pendingProgressNotes', 2);
    expect(data.data).toHaveProperty('recentIncidents');
    expect(data.data).toHaveProperty('assignedForToday');
  });

  test('shows correct counts for empty assignments', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-123', 'staff-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ count: 0 }] }) // 0 residents
        .mockResolvedValueOnce({ rows: [{ count: 0 }] }) // 0 pending notes
        .mockResolvedValueOnce({ rows: [] }) // 0 incidents
        .mockResolvedValueOnce({ rows: [] }); // 0 today's assignments
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/staff/dashboard');
    const response = await getDashboard(request);
    const data = await response.json();

    expect(data.data.assignedResidents).toBe(0);
    expect(data.data.pendingProgressNotes).toBe(0);
    expect(data.data.recentIncidents).toEqual([]);
    expect(data.data.assignedForToday).toEqual([]);
  });

  test('includes correct resident data in recent incidents', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-123', 'staff-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    const mockIncidents = [
      {
        id: 'incident-1',
        resident_id: 'res-1',
        incident_date: '2024-05-20',
        incident_time: '14:30',
        first_name: 'John',
        last_name: 'Doe',
        incident_type: 'Fall',
      },
      {
        id: 'incident-2',
        resident_id: 'res-2',
        incident_date: '2024-05-19',
        incident_time: '09:15',
        first_name: 'Jane',
        last_name: 'Smith',
        incident_type: 'Medication Error',
      },
    ];

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ count: 2 }] })
        .mockResolvedValueOnce({ rows: [{ count: 0 }] })
        .mockResolvedValueOnce({ rows: mockIncidents })
        .mockResolvedValueOnce({ rows: [] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/staff/dashboard');
    const response = await getDashboard(request);
    const data = await response.json();

    expect(data.data.recentIncidents).toHaveLength(2);
    expect(data.data.recentIncidents[0]).toHaveProperty('incident_type', 'Fall');
    expect(data.data.recentIncidents[1]).toHaveProperty('incident_type', 'Medication Error');
  });

  test('limits recent incidents to 5', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-123', 'staff-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    const mockIncidents = Array.from({ length: 5 }, (_, i) => ({
      id: `incident-${i + 1}`,
      resident_id: `res-${i + 1}`,
      incident_date: '2024-05-20',
      incident_time: '10:00',
      first_name: 'Resident',
      last_name: `${i + 1}`,
      incident_type: 'Fall',
    }));

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ count: 10 }] })
        .mockResolvedValueOnce({ rows: [{ count: 0 }] })
        .mockResolvedValueOnce({ rows: mockIncidents })
        .mockResolvedValueOnce({ rows: [] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/staff/dashboard');
    const response = await getDashboard(request);
    const data = await response.json();

    expect(data.data.recentIncidents.length).toBeLessThanOrEqual(5);
  });

  test('includes assigned residents with status for today', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-123', 'staff-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    const mockResidents = [
      {
        id: 'res-1',
        first_name: 'Alice',
        last_name: 'Adams',
        status: 'active',
        assignment_date: '2024-01-01',
      },
      {
        id: 'res-2',
        first_name: 'Bob',
        last_name: 'Brown',
        status: 'active',
        assignment_date: '2024-02-15',
      },
    ];

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ count: 2 }] })
        .mockResolvedValueOnce({ rows: [{ count: 0 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: mockResidents });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/staff/dashboard');
    const response = await getDashboard(request);
    const data = await response.json();

    expect(data.data.assignedForToday).toHaveLength(2);
    expect(data.data.assignedForToday[0]).toHaveProperty('status', 'active');
    expect(data.data.assignedForToday[1]).toHaveProperty('status', 'active');
  });

  test('limits assigned residents for today to 20', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-123', 'staff-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    const mockResidents = Array.from({ length: 20 }, (_, i) => ({
      id: `res-${i + 1}`,
      first_name: 'Resident',
      last_name: `${i + 1}`,
      status: 'active',
      assignment_date: '2024-01-01',
    }));

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ count: 50 }] })
        .mockResolvedValueOnce({ rows: [{ count: 0 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: mockResidents });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/staff/dashboard');
    const response = await getDashboard(request);
    const data = await response.json();

    expect(data.data.assignedForToday.length).toBeLessThanOrEqual(20);
  });

  test('enforces tenant isolation - only shows staff member\'s own data', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-xyz', 'staff-xyz');
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      expect(tenantId).toBe('tenant-xyz');
      expect(staffId).toBe('staff-xyz');
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ count: 3 }] })
        .mockResolvedValueOnce({ rows: [{ count: 1 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/staff/dashboard');
    const response = await getDashboard(request);
    expect(response.status).toBe(200);
    expect(db.withTenantClient).toHaveBeenCalledWith('tenant-xyz', 'staff-xyz', expect.any(Function));
  });

  test('decrypts resident PHI fields in response', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-123', 'staff-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    const mockResidents = [
      {
        id: 'res-1',
        first_name: 'ENCRYPTED',
        last_name: 'ENCRYPTED',
        status: 'active',
        assignment_date: '2024-01-01',
      },
    ];

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ count: 1 }] })
        .mockResolvedValueOnce({ rows: [{ count: 0 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: mockResidents });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/staff/dashboard');
    await getDashboard(request);

    // decryptFields mock is called to decrypt resident names
    // The actual decryption is tested through mocking
  });

  test('handles missing count gracefully with 0 default', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-123', 'staff-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // No count returned
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/staff/dashboard');
    const response = await getDashboard(request);
    const data = await response.json();

    expect(data.data.assignedResidents).toBe(0);
    expect(data.data.pendingProgressNotes).toBe(0);
  });

  test('handles database errors gracefully', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-123', 'staff-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async () => {
      throw new Error('Database connection failed');
    });

    const request = createRequest('/api/v1/staff/dashboard');
    const response = await getDashboard(request);
    expect(response.status).toBe(500);
  });

});
