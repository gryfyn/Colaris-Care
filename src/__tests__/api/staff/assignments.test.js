/**
 * Unit tests for /api/v1/staff/assignments endpoint
 * Tests authentication, authorization, tenant isolation, validation, and data consistency
 */

import { GET as getAssignments, POST as postAssignment } from '@/app/api/v1/staff/assignments/route.js';

// Mock auth-guard
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

// Mock db
jest.mock('@/lib/db.js', () => ({
  withTenantClient: jest.fn(),
}));

// Mock encryption
jest.mock('@/lib/encryption.js', () => ({
  decryptFields: jest.fn((row, fields, key) => row),
}));

// Mock audit logger
jest.mock('@/lib/audit-logger.js', () => ({
  AuditLogger: jest.fn().mockImplementation(() => ({
    logSelect: jest.fn().mockResolvedValue(undefined),
    logInsert: jest.fn().mockResolvedValue(undefined),
  })),
}));

import * as authGuard from '@/lib/auth-guard.js';
import * as db from '@/lib/db.js';
import { PERMISSIONS, ROLES } from '@/lib/roles.js';

function createRequest(url, method = 'GET', body = null) {
  const mockHeaders = {
    get: jest.fn(() => 'application/json'),
  };
  const request = {
    url: `http://localhost:3000${url}`,
    method,
    headers: mockHeaders,
  };
  if (body) {
    request.json = jest.fn().mockResolvedValue(body);
  }
  return request;
}

function createUser(role = ROLES.ADMIN, tenantId = 'tenant-123', staffId = 'staff-123') {
  return { id: 'user-123', staffId, tenantId, role, jti: 'jti-123' };
}

function createMockClient() {
  return { query: jest.fn(), release: jest.fn() };
}

describe('GET /api/v1/staff/assignments — List staff assignments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 401 when not authenticated', async () => {
    authGuard.authenticate.mockResolvedValueOnce({ error: 'Unauthorized', status: 401 });
    const request = createRequest('/api/v1/staff/assignments');
    const response = await getAssignments(request);
    expect(response.status).toBe(401);
  });

  test('returns 403 when user lacks STAFF_READ permission', async () => {
    const user = createUser(ROLES.RESIDENT_CARE_OF);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(false);

    const request = createRequest('/api/v1/staff/assignments');
    const response = await getAssignments(request);
    expect(response.status).toBe(403);
    expect(authGuard.authorize).toHaveBeenCalledWith(ROLES.RESIDENT_CARE_OF, PERMISSIONS.STAFF_READ);
  });

  test('returns paginated list of assignments for authorized user', async () => {
    const user = createUser(ROLES.ADMIN, 'tenant-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    const mockRows = [
      {
        id: 'assign-1',
        staff_id: 'staff-1',
        resident_id: 'res-1',
        staff_first_name: 'John',
        staff_last_name: 'Doe',
        role: 'RN',
        first_name: 'Alice',
        last_name: 'Adams',
        status: 'active',
        primary_diagnosis: 'Diabetes',
        assignment_date: '2024-01-01',
        end_date: null,
        is_active: true,
        created_at: '2024-01-01',
        total_count: 2,
      },
      {
        id: 'assign-2',
        staff_id: 'staff-1',
        resident_id: 'res-2',
        staff_first_name: 'John',
        staff_last_name: 'Doe',
        role: 'RN',
        first_name: 'Bob',
        last_name: 'Brown',
        status: 'active',
        primary_diagnosis: 'Hypertension',
        assignment_date: '2024-02-01',
        end_date: null,
        is_active: true,
        created_at: '2024-02-01',
        total_count: 2,
      },
    ];

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      expect(tenantId).toBe('tenant-123');
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: mockRows });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/staff/assignments');
    const response = await getAssignments(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(2);
    expect(data.pagination.total).toBe(2);
    expect(data.pagination).toHaveProperty('limit');
    expect(data.pagination).toHaveProperty('offset');
  });

  test('staff users default to seeing only their own assignments', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-123', 'staff-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    const mockRows = [
      {
        id: 'assign-1',
        staff_id: 'staff-123',
        resident_id: 'res-1',
        staff_first_name: 'John',
        staff_last_name: 'Doe',
        role: 'RN',
        first_name: 'Alice',
        last_name: 'Adams',
        status: 'active',
        total_count: 1,
      },
    ];

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: mockRows });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/staff/assignments');
    const response = await getAssignments(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data[0].staff_id).toBe('staff-123');
  });

  test('enforces tenant isolation in assignments query', async () => {
    const user = createUser(ROLES.ADMIN, 'tenant-xyz', 'staff-admin');
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      expect(tenantId).toBe('tenant-xyz');
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/staff/assignments');
    await getAssignments(request);

    expect(db.withTenantClient).toHaveBeenCalledWith('tenant-xyz', 'staff-admin', expect.any(Function));
  });

  test('filters by staff_id when provided', async () => {
    const user = createUser(ROLES.ADMIN);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      const queryCall = mockClient.query;
      queryCall.mockResolvedValueOnce({ rows: [{ total_count: 1 }] });

      callback(mockClient);

      // Verify staff_id filter is in the query
      const queryText = queryCall.mock.calls[0][0];
      expect(queryText).toMatch(/staff_id/i);
      return [{ total_count: 1 }];
    });

    const request = createRequest('/api/v1/staff/assignments?staff_id=staff-xyz');
    const response = await getAssignments(request);
    expect(response.status).toBe(200);
  });

  test('respects pagination limits (1-200)', async () => {
    const user = createUser(ROLES.ADMIN);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/staff/assignments?limit=300&offset=0');
    const response = await getAssignments(request);
    const data = await response.json();

    expect(data.pagination.limit).toBeLessThanOrEqual(200);
  });

  test('handles database errors gracefully', async () => {
    const user = createUser(ROLES.ADMIN);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async () => {
      throw new Error('Database connection failed');
    });

    const request = createRequest('/api/v1/staff/assignments');
    const response = await getAssignments(request);

    expect(response.status).toBe(500);
  });
});

describe('POST /api/v1/staff/assignments — Create staff assignment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 401 when not authenticated', async () => {
    authGuard.authenticate.mockResolvedValueOnce({ error: 'Unauthorized', status: 401 });

    const request = createRequest('/api/v1/staff/assignments', 'POST', {
      staff_id: 'staff-123',
      resident_id: 'res-123',
    });
    const response = await postAssignment(request);
    expect(response.status).toBe(401);
  });

  test('returns 403 when user lacks STAFF_WRITE permission', async () => {
    const user = createUser(ROLES.STAFF);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(false);

    const request = createRequest('/api/v1/staff/assignments', 'POST', {
      staff_id: 'staff-123',
      resident_id: 'res-123',
    });
    const response = await postAssignment(request);
    expect(response.status).toBe(403);
  });

  test('returns 422 when required fields are missing', async () => {
    const user = createUser(ROLES.ADMIN);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    const testCases = [
      { data: { resident_id: 'res-123' }, missing: 'staff_id' },
      { data: { staff_id: 'staff-123' }, missing: 'resident_id' },
      { data: {}, missing: 'both' },
    ];

    for (const testCase of testCases) {
      jest.clearAllMocks();
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(true);

      const request = createRequest('/api/v1/staff/assignments', 'POST', testCase.data);
      const response = await postAssignment(request);
      expect(response.status).toBe(422);
    }
  });

  test('returns 400 when staff_id format is invalid', async () => {
    const user = createUser(ROLES.ADMIN);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    const request = createRequest('/api/v1/staff/assignments', 'POST', {
      staff_id: 'invalid-uuid',
      resident_id: '550e8400-e29b-41d4-a716-446655440000',
    });
    const response = await postAssignment(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/staff_id/i);
  });

  test('returns 400 when resident_id format is invalid', async () => {
    const user = createUser(ROLES.ADMIN);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    const request = createRequest('/api/v1/staff/assignments', 'POST', {
      staff_id: '550e8400-e29b-41d4-a716-446655440000',
      resident_id: 'not-a-uuid',
    });
    const response = await postAssignment(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/resident_id/i);
  });

  test('returns 404 when staff member not found', async () => {
    const user = createUser(ROLES.ADMIN, 'tenant-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // Staff not found
      return callback(mockClient);
    });

    const staffId = '550e8400-e29b-41d4-a716-446655440000';
    const residentId = '550e8400-e29b-41d4-a716-446655440001';

    const request = createRequest('/api/v1/staff/assignments', 'POST', {
      staff_id: staffId,
      resident_id: residentId,
    });
    const response = await postAssignment(request);
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toMatch(/Staff member not found/i);
  });

  test('returns 404 when resident not found', async () => {
    const user = createUser(ROLES.ADMIN, 'tenant-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'staff-123' }] }) // Staff found
        .mockResolvedValueOnce({ rows: [] }); // Resident not found
      return callback(mockClient);
    });

    const staffId = '550e8400-e29b-41d4-a716-446655440000';
    const residentId = '550e8400-e29b-41d4-a716-446655440001';

    const request = createRequest('/api/v1/staff/assignments', 'POST', {
      staff_id: staffId,
      resident_id: residentId,
    });
    const response = await postAssignment(request);
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toMatch(/Resident not found/i);
  });

  test('returns 409 when assignment already exists', async () => {
    const user = createUser(ROLES.ADMIN, 'tenant-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'staff-123' }] }) // Staff found
        .mockResolvedValueOnce({ rows: [{ id: 'res-123' }] }) // Resident found
        .mockResolvedValueOnce({ rows: [{ id: 'assign-existing' }] }); // Assignment exists
      return callback(mockClient);
    });

    const staffId = '550e8400-e29b-41d4-a716-446655440000';
    const residentId = '550e8400-e29b-41d4-a716-446655440001';

    const request = createRequest('/api/v1/staff/assignments', 'POST', {
      staff_id: staffId,
      resident_id: residentId,
    });
    const response = await postAssignment(request);
    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error).toMatch(/already assigned/i);
  });

  test('creates assignment successfully with valid data', async () => {
    const user = createUser(ROLES.ADMIN, 'tenant-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    const staffId = '550e8400-e29b-41d4-a716-446655440000';
    const residentId = '550e8400-e29b-41d4-a716-446655440001';

    db.withTenantClient.mockImplementationOnce(async (tenantId, callbackStaffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: staffId }] }) // Staff found
        .mockResolvedValueOnce({ rows: [{ id: residentId }] }) // Resident found
        .mockResolvedValueOnce({ rows: [] }) // No existing assignment
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'assign-new',
              staff_id: staffId,
              resident_id: residentId,
              assignment_date: '2024-05-20',
              end_date: null,
              created_at: '2024-05-20T10:00:00Z',
            },
          ],
        }); // INSERT returns new assignment
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/staff/assignments', 'POST', {
      staff_id: staffId,
      resident_id: residentId,
    });
    const response = await postAssignment(request);
    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.data).toHaveProperty('id', 'assign-new');
    expect(data.data.staff_id).toBe(staffId);
    expect(data.data.resident_id).toBe(residentId);
  });

  test('includes assignment_date in request when provided', async () => {
    const user = createUser(ROLES.ADMIN, 'tenant-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    const staffId = '550e8400-e29b-41d4-a716-446655440000';
    const residentId = '550e8400-e29b-41d4-a716-446655440001';
    const assignmentDate = '2024-06-01';

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: staffId }] })
        .mockResolvedValueOnce({ rows: [{ id: residentId }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'assign-new',
              staff_id: staffId,
              resident_id: residentId,
              assignment_date: assignmentDate,
              end_date: null,
              created_at: '2024-06-01T10:00:00Z',
            },
          ],
        });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/staff/assignments', 'POST', {
      staff_id: staffId,
      resident_id: residentId,
      assignment_date: assignmentDate,
    });
    const response = await postAssignment(request);
    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.data.assignment_date).toBe(assignmentDate);
  });

  test('enforces tenant isolation - cannot assign across tenants', async () => {
    const user = createUser(ROLES.ADMIN, 'tenant-a', 'staff-a');
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      expect(tenantId).toBe('tenant-a');
      const mockClient = createMockClient();
      mockClient.query.mockRejectedValueOnce(new Error('Staff member not found in tenant')); // Staff not in tenant-a
      return callback(mockClient);
    });

    const staffId = '550e8400-e29b-41d4-a716-446655440000';
    const residentId = '550e8400-e29b-41d4-a716-446655440001';

    const request = createRequest('/api/v1/staff/assignments', 'POST', {
      staff_id: staffId,
      resident_id: residentId,
    });
    const response = await postAssignment(request);
    expect(response.status).toBe(500);
  });

  test('handles database errors gracefully', async () => {
    const user = createUser(ROLES.ADMIN);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async () => {
      throw new Error('Database error');
    });

    const staffId = '550e8400-e29b-41d4-a716-446655440000';
    const residentId = '550e8400-e29b-41d4-a716-446655440001';

    const request = createRequest('/api/v1/staff/assignments', 'POST', {
      staff_id: staffId,
      resident_id: residentId,
    });
    const response = await postAssignment(request);
    expect(response.status).toBe(500);
  });
});
