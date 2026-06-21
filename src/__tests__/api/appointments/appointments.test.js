/**
 * Unit tests for /api/v1/appointments and /api/v1/appointments/[id] endpoints
 * Tests authentication, authorization, validation, tenant isolation, and staff scoping
 */

import { GET as getAppointments, POST as postAppointment } from '@/app/api/v1/appointments/route.js';
import { GET as getAppointmentById, PATCH as patchAppointment, DELETE as deleteAppointment } from '@/app/api/v1/appointments/[id]/route.js';

jest.mock('@/lib/auth-guard.js', () => ({
  authenticate: jest.fn(),
  authorize: jest.fn(),
  handleError: jest.fn((err) => {
    return Response.json(
      { error: err.message || 'Internal server error' },
      { status: err.status || 500 }
    );
  }),
  getRequestContext: jest.fn(() => ({ user: {} })),
}));

jest.mock('@/lib/db.js', () => ({
  withTenantClient: jest.fn(),
}));

jest.mock('@/lib/audit-logger.js', () => ({
  AuditLogger: jest.fn().mockImplementation(() => ({
    logSelect: jest.fn().mockResolvedValue(undefined),
    logInsert: jest.fn().mockResolvedValue(undefined),
    logUpdate: jest.fn().mockResolvedValue(undefined),
    logDelete: jest.fn().mockResolvedValue(undefined),
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

function createUser(role = ROLES.STAFF, tenantId = 'tenant-123', staffId = 'staff-123') {
  return { id: 'user-123', staffId, tenantId, role, jti: 'jti-123' };
}

function createMockClient() {
  return { query: jest.fn(), release: jest.fn() };
}

function createContext(id = 'apt-123') {
  return {
    params: Promise.resolve({ id }),
  };
}

describe('GET /api/v1/appointments — List appointments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // clearAllMocks does not flush mockImplementationOnce queues; tests that
    // return early (401/403/422) would otherwise leave a stale withTenantClient
    // implementation that offsets every later test in the file.
    db.withTenantClient.mockReset();
  });

  test('returns 401 when not authenticated', async () => {
    authGuard.authenticate.mockResolvedValueOnce({ error: 'Unauthorized', status: 401 });
    const request = createRequest('/api/v1/appointments');
    const response = await getAppointments(request);
    expect(response.status).toBe(401);
  });

  test('returns 403 when user lacks RESIDENTS_READ permission', async () => {
    const user = createUser(ROLES.RESIDENT_CARE_OF);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(false);

    const request = createRequest('/api/v1/appointments');
    const response = await getAppointments(request);
    expect(response.status).toBe(403);
    expect(authGuard.authorize).toHaveBeenCalledWith(ROLES.RESIDENT_CARE_OF, PERMISSIONS.RESIDENTS_READ);
  });

  test('returns paginated list of appointments for authorized user', async () => {
    const user = createUser(ROLES.STAFF);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    const mockRows = [
      {
        id: 'apt-1',
        resident_id: 'res-1',
        staff_id: 'staff-1',
        appointment_type: 'medical',
        title: 'Checkup',
        scheduled_at: '2024-05-20T10:00:00Z',
        status: 'scheduled',
        first_name: 'John',
        last_name: 'Doe',
        staff_first_name: 'Jane',
        staff_last_name: 'Smith',
        total_count: 1,
      },
    ];

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: mockRows });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/appointments');
    const response = await getAppointments(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(1);
    expect(data.pagination.total).toBe(1);
  });

  test('filters by resident_id when provided', async () => {
    const user = createUser(ROLES.STAFF);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [{ total_count: 1 }] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/appointments?resident_id=res-123');
    const response = await getAppointments(request);
    expect(response.status).toBe(200);
  });

  test('passes tenant and staff context for staff list (facility-wide policy)', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-123', 'staff-abc');
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/appointments');
    await getAppointments(request);

    const callArgs = db.withTenantClient.mock.calls[0];
    expect(callArgs[0]).toBe('tenant-123');
    expect(callArgs[1]).toBe('staff-abc');
  });

  test('enforces tenant isolation', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-xyz');
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      expect(tenantId).toBe('tenant-xyz');
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/appointments');
    await getAppointments(request);

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

    const request = createRequest('/api/v1/appointments?limit=500');
    const response = await getAppointments(request);
    const data = await response.json();

    expect(data.pagination.limit).toBeLessThanOrEqual(200);
  });

  test('filters by status when provided', async () => {
    const user = createUser(ROLES.STAFF);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/appointments?status=completed');
    const response = await getAppointments(request);
    expect(response.status).toBe(200);
  });

  test('admin can filter by staff_id', async () => {
    const user = createUser(ROLES.ADMIN, 'tenant-123', 'admin-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/appointments?staff_id=staff-456');
    const response = await getAppointments(request);
    expect(response.status).toBe(200);
  });
});

describe('POST /api/v1/appointments — Create appointment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // clearAllMocks does not flush mockImplementationOnce queues; tests that
    // return early (401/403/422) would otherwise leave a stale withTenantClient
    // implementation that offsets every later test in the file.
    db.withTenantClient.mockReset();
  });

  test('returns 401 when not authenticated', async () => {
    authGuard.authenticate.mockResolvedValueOnce({ error: 'Unauthorized', status: 401 });

    const request = createRequest('/api/v1/appointments', 'POST', {
      resident_id: 'res-123',
      appointment_type: 'medical',
      title: 'Checkup',
      scheduled_at: '2024-05-20T10:00:00Z',
    });
    const response = await postAppointment(request);
    expect(response.status).toBe(401);
  });

  test('returns 403 for resident role', async () => {
    const user = createUser(ROLES.RESIDENT_CARE_OF);
    authGuard.authenticate.mockResolvedValueOnce({ user });

    const request = createRequest('/api/v1/appointments', 'POST', {
      resident_id: 'res-123',
      appointment_type: 'medical',
      title: 'Checkup',
      scheduled_at: '2024-05-20T10:00:00Z',
    });
    const response = await postAppointment(request);
    expect(response.status).toBe(403);
  });

  test('returns 422 when required fields are missing', async () => {
    const user = createUser(ROLES.STAFF);
    authGuard.authenticate.mockResolvedValueOnce({ user });

    const testCases = [
      { data: { appointment_type: 'medical', title: 'Checkup', scheduled_at: '2024-05-20T10:00:00Z' }, missing: 'resident_id' },
      { data: { resident_id: 'res-123', title: 'Checkup', scheduled_at: '2024-05-20T10:00:00Z' }, missing: 'appointment_type' },
      { data: { resident_id: 'res-123', appointment_type: 'medical', scheduled_at: '2024-05-20T10:00:00Z' }, missing: 'title' },
      { data: { resident_id: 'res-123', appointment_type: 'medical', title: 'Checkup' }, missing: 'scheduled_at' },
    ];

    for (const testCase of testCases) {
      jest.clearAllMocks();
      authGuard.authenticate.mockResolvedValueOnce({ user });

      const request = createRequest('/api/v1/appointments', 'POST', testCase.data);
      const response = await postAppointment(request);
      expect(response.status).toBe(422);
    }
  });

  test('returns 404 when resident not found', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // Resident not found
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/appointments', 'POST', {
      resident_id: 'res-nonexistent',
      appointment_type: 'medical',
      title: 'Checkup',
      scheduled_at: '2024-05-20T10:00:00Z',
    });
    const response = await postAppointment(request);
    expect(response.status).toBe(404);
  });

  test('staff can create for any resident (facility-wide policy)', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-123', 'staff-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'res-123' }] }) // Resident found
        .mockResolvedValueOnce({ rows: [] }) // No conflicts
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'apt-new',
              resident_id: 'res-123',
              appointment_type: 'medical',
              title: 'Checkup',
              scheduled_at: '2024-05-20T10:00:00Z',
              status: 'scheduled',
              created_at: '2024-05-20T09:00:00Z',
            },
          ],
        }); // INSERT returns new appointment
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/appointments', 'POST', {
      resident_id: 'res-123',
      appointment_type: 'medical',
      title: 'Checkup',
      scheduled_at: '2024-05-20T10:00:00Z',
    });
    const response = await postAppointment(request);
    expect(response.status).toBe(201);
    const denied = await response.json();
    expect(denied.data).toHaveProperty('id', 'apt-new');
  });

  test('creates appointment successfully for staff', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-123', 'staff-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'res-123' }] }) // Resident found
        .mockResolvedValueOnce({ rows: [] }) // No conflicts
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'apt-new',
              resident_id: 'res-123',
              appointment_type: 'medical',
              title: 'Checkup',
              scheduled_at: '2024-05-20T10:00:00Z',
              status: 'scheduled',
              created_at: '2024-05-20T09:00:00Z',
            },
          ],
        }); // INSERT returns new appointment
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/appointments', 'POST', {
      resident_id: 'res-123',
      appointment_type: 'medical',
      title: 'Checkup',
      scheduled_at: '2024-05-20T10:00:00Z',
    });
    const response = await postAppointment(request);
    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.data).toHaveProperty('id', 'apt-new');
    expect(data.data).toHaveProperty('appointment_type', 'medical');
  });

  test('creates appointment for admin with any resident', async () => {
    const user = createUser(ROLES.ADMIN, 'tenant-123', 'admin-123');
    authGuard.authenticate.mockReset();
    authGuard.authenticate.mockResolvedValue({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'res-999' }] }) // Resident found
        .mockResolvedValueOnce({ rows: [] }) // No conflicts
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'apt-new',
              resident_id: 'res-999',
              appointment_type: 'therapy',
              title: 'Physical Therapy',
              scheduled_at: '2024-05-25T14:00:00Z',
              status: 'scheduled',
              created_at: '2024-05-20T09:00:00Z',
            },
          ],
        });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/appointments', 'POST', {
      resident_id: 'res-999',
      appointment_type: 'therapy',
      title: 'Physical Therapy',
      scheduled_at: '2024-05-25T14:00:00Z',
    });
    const response = await postAppointment(request);
    expect(response.status).toBe(201);
  });

  test('enforces tenant isolation on create', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-xyz', 'staff-123');
    authGuard.authenticate.mockReset();
    authGuard.authenticate.mockResolvedValue({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      expect(tenantId).toBe('tenant-xyz');
      const mockClient = createMockClient();
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/appointments', 'POST', {
      resident_id: 'res-123',
      appointment_type: 'medical',
      title: 'Checkup',
      scheduled_at: '2024-05-20T10:00:00Z',
    });

    try {
      await postAppointment(request);
    } catch (e) {
      // Expected to fail during mock query
    }

    expect(db.withTenantClient).toHaveBeenCalledWith('tenant-xyz', expect.any(String), expect.any(Function));
  });
});

describe('GET /api/v1/appointments/[id] — Get single appointment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // clearAllMocks does not flush mockImplementationOnce queues; tests that
    // return early (401/403/422) would otherwise leave a stale withTenantClient
    // implementation that offsets every later test in the file.
    db.withTenantClient.mockReset();
  });

  test('returns 401 when not authenticated', async () => {
    authGuard.authenticate.mockReset(); authGuard.authenticate.mockResolvedValue({ error: 'Unauthorized', status: 401 });
    const request = createRequest('/api/v1/appointments/apt-123');
    const response = await getAppointmentById(request, createContext('apt-123'));
    expect(response.status).toBe(401);
  });

  test('returns 403 when user lacks RESIDENTS_READ permission', async () => {
    const user = createUser(ROLES.RESIDENT_CARE_OF);
    authGuard.authenticate.mockReset(); authGuard.authenticate.mockResolvedValue({ user });
    authGuard.authorize.mockReturnValueOnce(false);

    const request = createRequest('/api/v1/appointments/apt-123');
    const response = await getAppointmentById(request, createContext('apt-123'));
    expect(response.status).toBe(403);
  });

  test('returns 404 when appointment not found', async () => {
    const user = createUser(ROLES.STAFF);
    authGuard.authenticate.mockReset(); authGuard.authenticate.mockResolvedValue({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/appointments/apt-nonexistent');
    const response = await getAppointmentById(request, createContext('apt-nonexistent'));
    expect(response.status).toBe(404);
  });

  test('staff can view any resident appointment (facility-wide policy)', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-123', 'staff-123');
    authGuard.authenticate.mockReset(); authGuard.authenticate.mockResolvedValue({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'apt-123', resident_id: 'res-456' }] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/appointments/apt-123');
    const response = await getAppointmentById(request, createContext('apt-123'));
    expect(response.status).toBe(200);
  });

  test('retrieves appointment for authorized user', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-123', 'staff-123');
    authGuard.authenticate.mockReset(); authGuard.authenticate.mockResolvedValue({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'apt-123',
              resident_id: 'res-456',
              appointment_type: 'medical',
              title: 'Checkup',
              scheduled_at: '2024-05-20T10:00:00Z',
              first_name: 'John',
              last_name: 'Doe',
            },
          ],
        });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/appointments/apt-123');
    const response = await getAppointmentById(request, createContext('apt-123'));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.data.id).toBe('apt-123');
  });
});

describe('PATCH /api/v1/appointments/[id] — Update appointment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // clearAllMocks does not flush mockImplementationOnce queues; tests that
    // return early (401/403/422) would otherwise leave a stale withTenantClient
    // implementation that offsets every later test in the file.
    db.withTenantClient.mockReset();
  });

  test('returns 401 when not authenticated', async () => {
    authGuard.authenticate.mockReset(); authGuard.authenticate.mockResolvedValue({ error: 'Unauthorized', status: 401 });
    const request = createRequest('/api/v1/appointments/apt-123', 'PATCH', { title: 'Updated' });
    const response = await patchAppointment(request, createContext('apt-123'));
    expect(response.status).toBe(401);
  });

  test('returns 403 for resident role', async () => {
    const user = createUser(ROLES.RESIDENT_CARE_OF);
    authGuard.authenticate.mockReset(); authGuard.authenticate.mockResolvedValue({ user });

    const request = createRequest('/api/v1/appointments/apt-123', 'PATCH', { title: 'Updated' });
    const response = await patchAppointment(request, createContext('apt-123'));
    expect(response.status).toBe(403);
  });

  test('returns 404 when appointment not found', async () => {
    const user = createUser(ROLES.STAFF);
    authGuard.authenticate.mockReset(); authGuard.authenticate.mockResolvedValue({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/appointments/apt-nonexistent', 'PATCH', { title: 'Updated' });
    const response = await patchAppointment(request, createContext('apt-nonexistent'));
    expect(response.status).toBe(404);
  });

  test('staff can update any resident appointment (facility-wide policy)', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-123', 'staff-123');
    authGuard.authenticate.mockReset(); authGuard.authenticate.mockResolvedValue({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'apt-123', resident_id: 'res-456' }] })
        .mockResolvedValueOnce({
          rows: [{ id: 'apt-123', resident_id: 'res-456', title: 'Updated', updated_at: '2024-05-20T09:15:00Z' }],
        });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/appointments/apt-123', 'PATCH', { title: 'Updated' });
    const response = await patchAppointment(request, createContext('apt-123'));
    expect(response.status).toBe(200);
  });

  test('updates appointment successfully for staff', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-123', 'staff-123');
    authGuard.authenticate.mockReset(); authGuard.authenticate.mockResolvedValue({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'apt-123', resident_id: 'res-456' }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'apt-123',
              resident_id: 'res-456',
              title: 'Updated Title',
              updated_at: '2024-05-20T09:15:00Z',
            },
          ],
        });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/appointments/apt-123', 'PATCH', { title: 'Updated Title' });
    const response = await patchAppointment(request, createContext('apt-123'));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.data.title).toBe('Updated Title');
  });
});

describe('DELETE /api/v1/appointments/[id] — Delete appointment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // clearAllMocks does not flush mockImplementationOnce queues; tests that
    // return early (401/403/422) would otherwise leave a stale withTenantClient
    // implementation that offsets every later test in the file.
    db.withTenantClient.mockReset();
  });

  test('returns 401 when not authenticated', async () => {
    authGuard.authenticate.mockReset(); authGuard.authenticate.mockResolvedValue({ error: 'Unauthorized', status: 401 });
    const request = createRequest('/api/v1/appointments/apt-123', 'DELETE');
    const response = await deleteAppointment(request, createContext('apt-123'));
    expect(response.status).toBe(401);
  });

  test('returns 403 for resident role', async () => {
    const user = createUser(ROLES.RESIDENT_CARE_OF);
    authGuard.authenticate.mockReset(); authGuard.authenticate.mockResolvedValue({ user });

    const request = createRequest('/api/v1/appointments/apt-123', 'DELETE');
    const response = await deleteAppointment(request, createContext('apt-123'));
    expect(response.status).toBe(403);
  });

  test('returns 404 when appointment not found', async () => {
    const user = createUser(ROLES.STAFF);
    authGuard.authenticate.mockReset(); authGuard.authenticate.mockResolvedValue({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/appointments/apt-nonexistent', 'DELETE');
    const response = await deleteAppointment(request, createContext('apt-nonexistent'));
    expect(response.status).toBe(404);
  });

  test('staff can delete any resident appointment (facility-wide policy)', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-123', 'staff-123');
    authGuard.authenticate.mockReset(); authGuard.authenticate.mockResolvedValue({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'apt-123', resident_id: 'res-456' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'apt-123', status: 'cancelled' }] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/appointments/apt-123', 'DELETE');
    const response = await deleteAppointment(request, createContext('apt-123'));
    expect(response.status).toBe(200);
  });

  test('cancels appointment for authorized staff', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-123', 'staff-123');
    authGuard.authenticate.mockReset(); authGuard.authenticate.mockResolvedValue({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'apt-123', resident_id: 'res-456' }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'apt-123',
              status: 'cancelled',
              updated_at: '2024-05-20T09:20:00Z',
            },
          ],
        });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/appointments/apt-123', 'DELETE');
    const response = await deleteAppointment(request, createContext('apt-123'));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.data.status).toBe('cancelled');
  });

  test('admin can delete any appointment', async () => {
    const user = createUser(ROLES.ADMIN, 'tenant-123', 'admin-123');
    authGuard.authenticate.mockReset(); authGuard.authenticate.mockResolvedValue({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'apt-123', resident_id: 'res-999' }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'apt-123',
              status: 'cancelled',
              updated_at: '2024-05-20T09:20:00Z',
            },
          ],
        });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/appointments/apt-123', 'DELETE');
    const response = await deleteAppointment(request, createContext('apt-123'));
    expect(response.status).toBe(200);
  });
});

describe('Appointment Duration Field Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // clearAllMocks does not flush mockImplementationOnce queues; tests that
    // return early (401/403/422) would otherwise leave a stale withTenantClient
    // implementation that offsets every later test in the file.
    db.withTenantClient.mockReset();
  });

  test('creates appointment with custom duration_minutes', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-123', 'staff-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'res-123' }] }) // Resident found
        .mockResolvedValueOnce({ rows: [] }) // No conflicts
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'apt-new',
              resident_id: 'res-123',
              appointment_type: 'medical',
              title: 'Checkup',
              scheduled_at: '2024-05-20T10:00:00Z',
              duration_minutes: 45,
              status: 'scheduled',
              created_at: '2024-05-20T09:00:00Z',
            },
          ],
        }); // INSERT returns new appointment
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/appointments', 'POST', {
      resident_id: 'res-123',
      appointment_type: 'medical',
      title: 'Checkup',
      scheduled_at: '2024-05-20T10:00:00Z',
      duration_minutes: 45,
    });
    const response = await postAppointment(request);
    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.data).toHaveProperty('duration_minutes', 45);
  });

  test('defaults to 30 minutes when duration_minutes not provided', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-123', 'staff-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'res-123' }] }) // Resident found
        .mockResolvedValueOnce({ rows: [] }) // No conflicts
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'apt-new',
              resident_id: 'res-123',
              appointment_type: 'medical',
              title: 'Checkup',
              scheduled_at: '2024-05-20T10:00:00Z',
              duration_minutes: 30,
              status: 'scheduled',
              created_at: '2024-05-20T09:00:00Z',
            },
          ],
        });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/appointments', 'POST', {
      resident_id: 'res-123',
      appointment_type: 'medical',
      title: 'Checkup',
      scheduled_at: '2024-05-20T10:00:00Z',
    });
    const response = await postAppointment(request);
    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.data).toHaveProperty('duration_minutes', 30);
  });

  test('detects conflicts using duration_minutes', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-123', 'staff-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'res-123' }] }) // Resident found
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'apt-existing',
              title: 'Existing Checkup',
              scheduled_at: '2024-05-20T10:00:00Z',
              duration_minutes: 60,
            },
          ],
        }); // Conflict found (10:00-11:00 conflicts with new 10:30-11:00)
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/appointments', 'POST', {
      resident_id: 'res-123',
      appointment_type: 'medical',
      title: 'New Checkup',
      scheduled_at: '2024-05-20T10:30:00Z',
      duration_minutes: 30,
    });
    const response = await postAppointment(request);
    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error).toContain('conflicts');
  });

  test('updates appointment with new duration_minutes', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-123', 'staff-123');
    authGuard.authenticate.mockReset(); authGuard.authenticate.mockResolvedValue({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'apt-123', resident_id: 'res-456', duration_minutes: 30 }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'apt-123',
              resident_id: 'res-456',
              duration_minutes: 60,
              updated_at: '2024-05-20T09:15:00Z',
            },
          ],
        });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/appointments/apt-123', 'PATCH', { duration_minutes: 60 });
    const response = await patchAppointment(request, createContext('apt-123'));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.data).toHaveProperty('duration_minutes', 60);
  });

  test('GET includes duration_minutes in response', async () => {
    const user = createUser(ROLES.STAFF);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    const mockRows = [
      {
        id: 'apt-1',
        resident_id: 'res-1',
        staff_id: 'staff-1',
        appointment_type: 'medical',
        title: 'Checkup',
        scheduled_at: '2024-05-20T10:00:00Z',
        duration_minutes: 45,
        status: 'scheduled',
        first_name: 'John',
        last_name: 'Doe',
        staff_first_name: 'Jane',
        staff_last_name: 'Smith',
        total_count: 1,
      },
    ];

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: mockRows });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/appointments');
    const response = await getAppointments(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data[0]).toHaveProperty('duration_minutes', 45);
  });
});
