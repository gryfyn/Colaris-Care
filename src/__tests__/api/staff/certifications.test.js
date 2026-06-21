/**
 * Unit tests for /api/v1/staff/certifications endpoint
 * Tests authentication, authorization, validation, and tenant isolation
 */

import { GET as getCertifications, POST as postCertification } from '@/app/api/v1/staff/certifications/route.js';

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

describe('GET /api/v1/staff/certifications — List certifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 401 when not authenticated', async () => {
    authGuard.authenticate.mockResolvedValueOnce({ error: 'Unauthorized', status: 401 });
    const request = createRequest('/api/v1/staff/certifications');
    const response = await getCertifications(request);
    expect(response.status).toBe(401);
  });

  test('returns 403 when user lacks STAFF_READ permission', async () => {
    const user = createUser(ROLES.RESIDENT_CARE_OF);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(false);

    const request = createRequest('/api/v1/staff/certifications');
    const response = await getCertifications(request);
    expect(response.status).toBe(403);
    expect(authGuard.authorize).toHaveBeenCalledWith(ROLES.RESIDENT_CARE_OF, PERMISSIONS.STAFF_READ);
  });

  test('returns paginated list of certifications', async () => {
    const user = createUser(ROLES.ADMIN);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    const mockRows = [
      {
        id: 'cert-1',
        staff_id: 'staff-1',
        certification_type: 'RN',
        certification_name: 'Registered Nurse',
        certificate_no: 'RN-12345',
        issued_date: '2020-01-15',
        expiry_date: '2025-01-15',
        verified_date: '2020-01-15',
        first_name: 'John',
        last_name: 'Doe',
        verified_by_first_name: 'Jane',
        verified_by_last_name: 'Smith',
        notes: 'Current and active',
        created_at: '2020-01-15',
        updated_at: '2020-01-15',
        total_count: 2,
      },
      {
        id: 'cert-2',
        staff_id: 'staff-1',
        certification_type: 'BLS',
        certification_name: 'Basic Life Support',
        certificate_no: 'BLS-67890',
        issued_date: '2022-06-01',
        expiry_date: '2024-06-01',
        verified_date: '2022-06-01',
        first_name: 'John',
        last_name: 'Doe',
        verified_by_first_name: 'Jane',
        verified_by_last_name: 'Smith',
        notes: 'Expired',
        created_at: '2022-06-01',
        updated_at: '2024-06-01',
        total_count: 2,
      },
    ];

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: mockRows });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/staff/certifications');
    const response = await getCertifications(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(2);
    expect(data.pagination.total).toBe(2);
  });

  test('filters by staff_id when provided', async () => {
    const user = createUser(ROLES.ADMIN);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [{ total_count: 1 }] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/staff/certifications?staff_id=staff-xyz');
    const response = await getCertifications(request);
    expect(response.status).toBe(200);
  });

  test('filters by certification_type with ILIKE (case-insensitive)', async () => {
    const user = createUser(ROLES.ADMIN);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [{ total_count: 1 }] });

      callback(mockClient);

      // Verify ILIKE is used for case-insensitive search
      const queryText = mockClient.query.mock.calls[0][0];
      expect(queryText).toMatch(/ILIKE/);

      return [{ total_count: 1 }];
    });

    const request = createRequest('/api/v1/staff/certifications?certification_type=RN');
    const response = await getCertifications(request);
    expect(response.status).toBe(200);
  });

  test('enforces tenant isolation in certifications query', async () => {
    const user = createUser(ROLES.ADMIN, 'tenant-xyz');
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      expect(tenantId).toBe('tenant-xyz');
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/staff/certifications');
    await getCertifications(request);

    expect(db.withTenantClient).toHaveBeenCalledWith('tenant-xyz', expect.any(String), expect.any(Function));
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

    const request = createRequest('/api/v1/staff/certifications?limit=500&offset=0');
    const response = await getCertifications(request);
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

    const request = createRequest('/api/v1/staff/certifications');
    const response = await getCertifications(request);
    expect(response.status).toBe(500);
  });
});

describe('POST /api/v1/staff/certifications — Create certification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 401 when not authenticated', async () => {
    authGuard.authenticate.mockResolvedValueOnce({ error: 'Unauthorized', status: 401 });

    const request = createRequest('/api/v1/staff/certifications', 'POST', {
      staff_id: 'staff-123',
      certification_type: 'RN',
      issued_date: '2024-05-20',
    });
    const response = await postCertification(request);
    expect(response.status).toBe(401);
  });

  test('returns 403 when user lacks STAFF_WRITE permission', async () => {
    const user = createUser(ROLES.RESIDENT_CARE_OF);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(false);

    const request = createRequest('/api/v1/staff/certifications', 'POST', {
      staff_id: 'staff-123',
      certification_type: 'RN',
      issued_date: '2024-05-20',
    });
    const response = await postCertification(request);
    expect(response.status).toBe(403);
  });

  test('returns 422 when required fields are missing', async () => {
    const user = createUser(ROLES.ADMIN);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    const testCases = [
      { data: { certification_type: 'RN', issued_date: '2024-05-20' }, missing: 'staff_id' },
      { data: { staff_id: 'staff-123', issued_date: '2024-05-20' }, missing: 'certification_type' },
      { data: { staff_id: 'staff-123', certification_type: 'RN' }, missing: 'issued_date' },
    ];

    for (const testCase of testCases) {
      jest.clearAllMocks();
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(true);

      const request = createRequest('/api/v1/staff/certifications', 'POST', testCase.data);
      const response = await postCertification(request);
      expect(response.status).toBe(422);
    }
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

    const request = createRequest('/api/v1/staff/certifications', 'POST', {
      staff_id: 'staff-nonexistent',
      certification_type: 'RN',
      issued_date: '2024-05-20',
    });
    const response = await postCertification(request);
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toMatch(/Staff member not found/i);
  });

  test('creates certification successfully with required fields only', async () => {
    const user = createUser(ROLES.ADMIN, 'tenant-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    const staffId = 'staff-123';

    const mockClient = createMockClient();
    mockClient.query
      .mockResolvedValueOnce({ rows: [{ id: staffId }] }) // Staff found
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'cert-new',
            staff_id: staffId,
            certification_type: 'RN',
            certification_name: 'Registered Nurse',
            issued_date: '2024-05-20',
            expiry_date: null,
            created_at: '2024-05-20T10:00:00Z',
          },
        ],
      }); // INSERT returns new certification

    db.withTenantClient.mockImplementationOnce(async (tenantId, callbackStaffId, callback) => {
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/staff/certifications', 'POST', {
      staff_id: staffId,
      certification_type: 'RN',
      issued_date: '2024-05-20',
    });
    const response = await postCertification(request);
    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.data).toHaveProperty('id', 'cert-new');
    expect(data.data).toHaveProperty('certification_type', 'RN');
    expect(data.data).toHaveProperty('issued_date', '2024-05-20');
  });

  test('includes optional fields when provided', async () => {
    const user = createUser(ROLES.ADMIN, 'tenant-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    const staffId = 'staff-123';

    const mockClient = createMockClient();
    mockClient.query
      .mockResolvedValueOnce({ rows: [{ id: staffId }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'cert-new',
            staff_id: staffId,
            certification_type: 'RN',
            certification_name: 'Registered Nurse License',
            issued_date: '2024-05-20',
            expiry_date: '2029-05-20',
            created_at: '2024-05-20T10:00:00Z',
          },
        ],
      });

    db.withTenantClient.mockImplementationOnce(async (tenantId, callbackStaffId, callback) => {
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/staff/certifications', 'POST', {
      staff_id: staffId,
      certification_type: 'RN',
      certification_name: 'Registered Nurse License',
      certificate_no: 'RN-98765',
      issued_date: '2024-05-20',
      expiry_date: '2029-05-20',
      notes: 'Valid credential',
    });
    const response = await postCertification(request);
    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.data).toHaveProperty('certification_name', 'Registered Nurse License');
    expect(data.data).toHaveProperty('expiry_date', '2029-05-20');
  });


});
