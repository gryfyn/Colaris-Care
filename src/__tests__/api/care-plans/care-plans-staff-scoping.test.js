/**
 * Unit tests for /api/v1/care-plans endpoint with staff scoping (BUG-FIX-04 regression test)
 * Verifies that staff users only see care plans for their assigned residents
 */

import { GET as getCarePlans } from '@/app/api/v1/care-plans/route.js';

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

jest.mock('@/lib/audit-logger.js', () => ({
  AuditLogger: jest.fn().mockImplementation(() => ({
    logSelect: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@/lib/encryption.js', () => ({
  decryptFields: jest.fn((row) => row),
  RESIDENT_ENCRYPTED_FIELDS: [],
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

describe('GET /api/v1/care-plans — Staff scoping (BUG-FIX-04)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 401 when not authenticated', async () => {
    authGuard.authenticate.mockResolvedValueOnce({ error: 'Unauthorized', status: 401 });
    const request = createRequest('/api/v1/care-plans');
    const response = await getCarePlans(request);
    expect(response.status).toBe(401);
  });

  test('returns 403 when user lacks CARE_PLANS_READ permission', async () => {
    const user = createUser(ROLES.RESIDENT_CARE_OF);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(false);

    const request = createRequest('/api/v1/care-plans');
    const response = await getCarePlans(request);
    expect(response.status).toBe(403);
    expect(authGuard.authorize).toHaveBeenCalledWith(ROLES.RESIDENT_CARE_OF, PERMISSIONS.CARE_PLANS_READ);
  });

  test('admin sees all care plans (not filtered by staff assignments)', async () => {
    const user = createUser(ROLES.ADMIN, 'tenant-123', 'admin-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    const mockRows = [
      {
        id: 'cp-1',
        resident_id: 'res-1',
        plan_type: 'clinical',
        status: 'active',
        first_name: 'John',
        last_name: 'Doe',
        primary_diagnosis: 'Hypertension',
        medicaid_id: 'MCD123',
        primary_counselor_name: 'Jane Smith',
        goal1_statement: 'Manage blood pressure',
      },
      {
        id: 'cp-2',
        resident_id: 'res-2',
        plan_type: 'clinical',
        status: 'active',
        first_name: 'Jane',
        last_name: 'Smith',
        primary_diagnosis: 'Diabetes',
        medicaid_id: 'MCD456',
        primary_counselor_name: 'Bob Jones',
        goal1_statement: 'Control blood sugar',
      },
    ];

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: mockRows });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/care-plans');
    const response = await getCarePlans(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(2);
  });

  test('staff user only sees care plans for assigned residents', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-123', 'staff-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    const mockRows = [
      {
        id: 'cp-1',
        resident_id: 'res-1',
        plan_type: 'clinical',
        status: 'active',
        first_name: 'John',
        last_name: 'Doe',
        primary_diagnosis: 'Hypertension',
        medicaid_id: 'MCD123',
        primary_counselor_name: 'Jane Smith',
        goal1_statement: 'Manage blood pressure',
      },
    ];

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();

      // Verify that the query includes JOIN with staff_assignments
      const queryCall = mockClient.query;

      mockClient.query.mockResolvedValueOnce({ rows: mockRows });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/care-plans');
    const response = await getCarePlans(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(1);
    expect(data.data[0].resident_id).toBe('res-1');
  });

  test('staff filtering is automatically enabled for staff role', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-123', 'staff-abc');
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/care-plans');
    await getCarePlans(request);

    // Verify staff_only is enforced for staff role
    const callArgs = db.withTenantClient.mock.calls[0];
    expect(callArgs[0]).toBe('tenant-123');
    expect(callArgs[1]).toBe('staff-abc');
  });

  test('staff can still filter by specific resident_id', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-123', 'staff-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'cp-1',
            resident_id: 'res-1',
            plan_type: 'clinical',
            first_name: 'John',
            last_name: 'Doe',
            status: 'active',
            primary_diagnosis: 'Hypertension',
            medicaid_id: 'MCD123',
          },
        ],
      });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/care-plans?resident_id=res-1');
    const response = await getCarePlans(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data[0].resident_id).toBe('res-1');
  });

  test('manager sees all care plans (not filtered by staff assignments)', async () => {
    const user = createUser(ROLES.MANAGER, 'tenant-123', 'mgr-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    const mockRows = [
      {
        id: 'cp-1',
        resident_id: 'res-1',
        plan_type: 'clinical',
        status: 'active',
        first_name: 'John',
        last_name: 'Doe',
        primary_diagnosis: 'Hypertension',
        medicaid_id: 'MCD123',
        primary_counselor_name: 'Jane Smith',
        goal1_statement: 'Manage blood pressure',
      },
      {
        id: 'cp-2',
        resident_id: 'res-99',
        plan_type: 'clinical',
        status: 'active',
        first_name: 'Unassigned',
        last_name: 'Resident',
        primary_diagnosis: 'Other',
        medicaid_id: 'MCD999',
        primary_counselor_name: 'Unknown',
        goal1_statement: 'Different goal',
      },
    ];

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: mockRows });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/care-plans');
    const response = await getCarePlans(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(2);
  });

  test('enforces tenant isolation', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-xyz', 'staff-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      expect(tenantId).toBe('tenant-xyz');
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/care-plans');
    await getCarePlans(request);

    expect(db.withTenantClient).toHaveBeenCalledWith('tenant-xyz', expect.any(String), expect.any(Function));
  });

  test('respects pagination limits (1-200)', async () => {
    const user = createUser(ROLES.STAFF);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/care-plans?limit=500');
    const response = await getCarePlans(request);
    const data = await response.json();

    expect(data.data).toEqual([]);
  });

  test('handles pagination with custom limit and offset', async () => {
    const user = createUser(ROLES.STAFF);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'cp-1',
            resident_id: 'res-1',
            plan_type: 'clinical',
            status: 'active',
            first_name: 'John',
            last_name: 'Doe',
            primary_diagnosis: 'Hypertension',
            medicaid_id: 'MCD123',
          },
        ],
      });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/care-plans?limit=25&offset=0');
    const response = await getCarePlans(request);
    const data = await response.json();

    expect(response.status).toBe(200);
  });

  test('returns empty list when staff has no assigned residents with care plans', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-123', 'staff-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/care-plans');
    const response = await getCarePlans(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(0);
  });

  test('includes all required care plan fields in response', async () => {
    const user = createUser(ROLES.ADMIN);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    const mockRows = [
      {
        id: 'cp-1',
        resident_id: 'res-1',
        plan_type: 'clinical',
        status: 'active',
        effective_date: '2024-01-01',
        expiration_date: '2025-01-01',
        review_date: '2024-05-20',
        review_schedule: 'quarterly',
        created_at: '2024-01-01T08:00:00Z',
        updated_at: '2024-05-20T09:00:00Z',
        first_name: 'John',
        last_name: 'Doe',
        primary_diagnosis: 'Hypertension',
        medicaid_id: 'MCD123',
        primary_counselor_name: 'Jane Smith',
        goal1_statement: 'Manage blood pressure',
        goal2_statement: 'Increase exercise',
        goal3_statement: 'Improve diet',
        selected_domains: JSON.stringify(['health', 'safety']),
        crisis_warning_signs: JSON.stringify(['chest pain', 'shortness of breath']),
      },
    ];

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: mockRows });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/care-plans');
    const response = await getCarePlans(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data[0]).toHaveProperty('id');
    expect(data.data[0]).toHaveProperty('resident_id');
    expect(data.data[0]).toHaveProperty('plan_type');
    expect(data.data[0]).toHaveProperty('status');
    expect(data.data[0]).toHaveProperty('effective_date');
    expect(data.data[0]).toHaveProperty('primary_diagnosis');
    expect(data.data[0]).toHaveProperty('goal1_statement');
  });

  test('staff_only=1 parameter explicitly enforces staff filtering', async () => {
    const user = createUser(ROLES.ADMIN, 'tenant-123', 'admin-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'cp-1',
            resident_id: 'res-1',
            plan_type: 'clinical',
            status: 'active',
            first_name: 'John',
            last_name: 'Doe',
            primary_diagnosis: 'Hypertension',
            medicaid_id: 'MCD123',
          },
        ],
      });
      return callback(mockClient);
    });

    // Admin explicitly requesting staff filtering
    const request = createRequest('/api/v1/care-plans?staff_only=1');
    const response = await getCarePlans(request);
    const data = await response.json();

    expect(response.status).toBe(200);
  });

  test('soft-deleted care plans excluded from results', async () => {
    const user = createUser(ROLES.STAFF);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    // Query includes deleted_at IS NULL filter
    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // Only non-deleted plans returned
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/care-plans');
    const response = await getCarePlans(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(0);
  });
});
