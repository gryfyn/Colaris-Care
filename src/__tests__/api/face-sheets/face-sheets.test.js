/**
 * Unit tests for /api/v1/face-sheets endpoints
 * Tests authentication, authorization, validation, tenant isolation, and staff scoping
 */

import { GET as getFaceSheets, POST as postFaceSheet } from '@/app/api/v1/face-sheets/route.js';
import { GET as getFaceSheetById, PATCH as patchFaceSheet } from '@/app/api/v1/face-sheets/[id]/route.js';
import { GET as getFaceSheetByResidentId } from '@/app/api/v1/face-sheets/resident/[residentId]/route.js';

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

function createContext(param = 'id', value = 'fs-123') {
  return {
    params: Promise.resolve({ [param]: value }),
  };
}

describe('GET /api/v1/face-sheets — List face sheets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 401 when not authenticated', async () => {
    authGuard.authenticate.mockResolvedValueOnce({ error: 'Unauthorized', status: 401 });
    const request = createRequest('/api/v1/face-sheets');
    const response = await getFaceSheets(request);
    expect(response.status).toBe(401);
  });

  test('returns 403 when user lacks RESIDENTS_READ permission', async () => {
    const user = createUser(ROLES.RESIDENT_CARE_OF);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(false);

    const request = createRequest('/api/v1/face-sheets');
    const response = await getFaceSheets(request);
    expect(response.status).toBe(403);
  });

  test('returns paginated list of face sheets for authorized user', async () => {
    const user = createUser(ROLES.STAFF);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    const mockRows = [
      {
        id: 'fs-1',
        resident_id: 'res-1',
        emergency_contact_name: 'Jane Doe',
        emergency_contact_phone: '555-1234',
        emergency_contact_relationship: 'daughter',
        first_name: 'John',
        last_name: 'Doe',
        total_count: 1,
      },
    ];

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: mockRows });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/face-sheets');
    const response = await getFaceSheets(request);
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

    const request = createRequest('/api/v1/face-sheets?resident_id=res-123');
    const response = await getFaceSheets(request);
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

    const request = createRequest('/api/v1/face-sheets');
    await getFaceSheets(request);

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

    const request = createRequest('/api/v1/face-sheets');
    await getFaceSheets(request);

    expect(db.withTenantClient).toHaveBeenCalledWith('tenant-xyz', expect.any(String), expect.any(Function));
  });
});

describe('POST /api/v1/face-sheets — Create face sheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const sampleFormData = {
    legal_name: 'John Doe',
    primary_name: 'Jane Doe',
    primary_phone_cell: '555-1234',
    primary_relationship: 'daughter',
  };

  test('returns 401 when not authenticated', async () => {
    authGuard.authenticate.mockReset(); authGuard.authenticate.mockResolvedValue({ error: 'Unauthorized', status: 401 });

    const request = createRequest('/api/v1/face-sheets', 'POST', {
      resident_id: 'res-123',
      form_data: sampleFormData,
    });
    const response = await postFaceSheet(request);
    expect(response.status).toBe(401);
  });

  test('returns 403 for staff role (admin/manager only)', async () => {
    const user = createUser(ROLES.STAFF);
    authGuard.authenticate.mockReset(); authGuard.authenticate.mockResolvedValue({ user });

    const request = createRequest('/api/v1/face-sheets', 'POST', {
      resident_id: 'res-123',
      form_data: sampleFormData,
    });
    const response = await postFaceSheet(request);
    expect(response.status).toBe(403);
  });

  test('returns 422 when resident_id or form_data is missing', async () => {
    const user = createUser(ROLES.ADMIN);

    const testCases = [
      { form_data: sampleFormData },                 // missing resident_id
      { resident_id: 'res-123' },                     // missing form_data
      { resident_id: 'res-123', form_data: 'nope' },  // form_data not an object
    ];

    for (const data of testCases) {
      jest.clearAllMocks();
      authGuard.authenticate.mockReset(); authGuard.authenticate.mockResolvedValue({ user });

      const request = createRequest('/api/v1/face-sheets', 'POST', data);
      const response = await postFaceSheet(request);
      expect(response.status).toBe(422);
    }
  });

  test('returns 404 when resident not found', async () => {
    const user = createUser(ROLES.ADMIN, 'tenant-123');
    authGuard.authenticate.mockReset(); authGuard.authenticate.mockResolvedValue({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // Resident not found
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/face-sheets', 'POST', {
      resident_id: 'res-nonexistent',
      form_data: sampleFormData,
    });
    const response = await postFaceSheet(request);
    expect(response.status).toBe(404);
  });

  test('returns 409 when face sheet already exists for resident', async () => {
    const user = createUser(ROLES.ADMIN, 'tenant-123');
    authGuard.authenticate.mockReset(); authGuard.authenticate.mockResolvedValue({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'res-123' }] }) // Resident found
        .mockResolvedValueOnce({ rows: [{ id: 'fs-existing' }] }); // Face sheet exists
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/face-sheets', 'POST', {
      resident_id: 'res-123',
      form_data: sampleFormData,
    });
    const response = await postFaceSheet(request);
    expect(response.status).toBe(409);
  });

  test('creates face sheet successfully for admin', async () => {
    const user = createUser(ROLES.ADMIN, 'tenant-123', 'admin-123');
    authGuard.authenticate.mockReset(); authGuard.authenticate.mockResolvedValue({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'res-123' }] }) // Resident found
        .mockResolvedValueOnce({ rows: [] }) // No existing face sheet
        .mockResolvedValueOnce({
          rows: [{ id: 'fs-new', resident_id: 'res-123', created_at: '2024-05-20T09:00:00Z' }],
        }); // INSERT returns new face sheet
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/face-sheets', 'POST', {
      resident_id: 'res-123',
      form_data: sampleFormData,
    });
    const response = await postFaceSheet(request);
    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.data).toHaveProperty('id', 'fs-new');
    expect(data.data).toHaveProperty('resident_id', 'res-123');
  });

  test('encrypts sensitive fields (ssn) before persisting', async () => {
    const user = createUser(ROLES.ADMIN, 'tenant-123', 'admin-123');
    authGuard.authenticate.mockReset(); authGuard.authenticate.mockResolvedValue({ user });

    let insertedFormData = null;
    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'res-123' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockImplementationOnce((sql, params) => {
          insertedFormData = JSON.parse(params[2]); // form_data is the 3rd param
          return Promise.resolve({ rows: [{ id: 'fs-new', resident_id: 'res-123', created_at: 'now' }] });
        });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/face-sheets', 'POST', {
      resident_id: 'res-123',
      form_data: { ...sampleFormData, ssn: '123-45-6789' },
    });
    const response = await postFaceSheet(request);
    expect(response.status).toBe(201);
    // SSN must be stored encrypted, never as plaintext.
    expect(insertedFormData.ssn).not.toBe('123-45-6789');
    expect(insertedFormData.ssn).toHaveProperty('__enc');
  });

  test('enforces tenant isolation on create', async () => {
    const user = createUser(ROLES.ADMIN, 'tenant-xyz', 'admin-123');
    authGuard.authenticate.mockReset(); authGuard.authenticate.mockResolvedValue({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      expect(tenantId).toBe('tenant-xyz');
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValue({ rows: [] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/face-sheets', 'POST', {
      resident_id: 'res-123',
      form_data: sampleFormData,
    });

    try {
      await postFaceSheet(request);
    } catch (e) {
      // Expected to fail during mock query (resident lookup returns empty)
    }

    expect(db.withTenantClient).toHaveBeenCalledWith('tenant-xyz', expect.any(String), expect.any(Function));
  });
});

describe('GET /api/v1/face-sheets/[id] — Get single face sheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 401 when not authenticated', async () => {
    authGuard.authenticate.mockReset(); authGuard.authenticate.mockResolvedValue({ error: 'Unauthorized', status: 401 });
    const request = createRequest('/api/v1/face-sheets/fs-123');
    const response = await getFaceSheetById(request, createContext('id', 'fs-123'));
    expect(response.status).toBe(401);
  });

  test('returns 403 when user lacks RESIDENTS_READ permission', async () => {
    const user = createUser(ROLES.RESIDENT_CARE_OF);
    authGuard.authenticate.mockReset(); authGuard.authenticate.mockResolvedValue({ user });
    authGuard.authorize.mockReturnValueOnce(false);

    const request = createRequest('/api/v1/face-sheets/fs-123');
    const response = await getFaceSheetById(request, createContext('id', 'fs-123'));
    expect(response.status).toBe(403);
  });

  test('returns 404 when face sheet not found', async () => {
    const user = createUser(ROLES.STAFF);
    authGuard.authenticate.mockReset(); authGuard.authenticate.mockResolvedValue({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/face-sheets/fs-nonexistent');
    const response = await getFaceSheetById(request, createContext('id', 'fs-nonexistent'));
    expect(response.status).toBe(404);
  });

  test('staff can view any resident face sheet (facility-wide policy)', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-123', 'staff-123');
    authGuard.authenticate.mockReset(); authGuard.authenticate.mockResolvedValue({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'fs-123', resident_id: 'res-456' }] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/face-sheets/fs-123');
    const response = await getFaceSheetById(request, createContext('id', 'fs-123'));
    expect(response.status).toBe(200);
  });

  test('retrieves face sheet for authorized user', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-123', 'staff-123');
    authGuard.authenticate.mockReset(); authGuard.authenticate.mockResolvedValue({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'fs-123',
              resident_id: 'res-456',
              emergency_contact_name: 'Jane Doe',
              emergency_contact_phone: '555-1234',
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ id: 'staff-123' }] }); // Staff assigned
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/face-sheets/fs-123');
    const response = await getFaceSheetById(request, createContext('id', 'fs-123'));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.data.id).toBe('fs-123');
  });
});

describe('PATCH /api/v1/face-sheets/[id] — Update face sheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 401 when not authenticated', async () => {
    authGuard.authenticate.mockReset(); authGuard.authenticate.mockResolvedValue({ error: 'Unauthorized', status: 401 });
    const request = createRequest('/api/v1/face-sheets/fs-123', 'PATCH', { form_data: { primary_name: 'Updated Name' } });
    const response = await patchFaceSheet(request, createContext('id', 'fs-123'));
    expect(response.status).toBe(401);
  });

  test('returns 403 for staff role (admin/manager only)', async () => {
    const user = createUser(ROLES.STAFF);
    authGuard.authenticate.mockReset(); authGuard.authenticate.mockResolvedValue({ user });

    const request = createRequest('/api/v1/face-sheets/fs-123', 'PATCH', { form_data: { primary_name: 'Updated Name' } });
    const response = await patchFaceSheet(request, createContext('id', 'fs-123'));
    expect(response.status).toBe(403);
  });

  test('returns 422 when form_data is missing', async () => {
    const user = createUser(ROLES.ADMIN);
    authGuard.authenticate.mockReset(); authGuard.authenticate.mockResolvedValue({ user });

    const request = createRequest('/api/v1/face-sheets/fs-123', 'PATCH', { not_form_data: true });
    const response = await patchFaceSheet(request, createContext('id', 'fs-123'));
    expect(response.status).toBe(422);
  });

  test('returns 404 when face sheet not found', async () => {
    const user = createUser(ROLES.ADMIN);
    authGuard.authenticate.mockReset(); authGuard.authenticate.mockResolvedValue({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/face-sheets/fs-nonexistent', 'PATCH', { form_data: { primary_name: 'Updated Name' } });
    const response = await patchFaceSheet(request, createContext('id', 'fs-nonexistent'));
    expect(response.status).toBe(404);
  });

  test('updates face sheet successfully for admin', async () => {
    const user = createUser(ROLES.ADMIN, 'tenant-123', 'admin-123');
    authGuard.authenticate.mockReset(); authGuard.authenticate.mockResolvedValue({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'fs-123', resident_id: 'res-456', form_data: {} }] })
        .mockResolvedValueOnce({
          rows: [{ id: 'fs-123', resident_id: 'res-456', updated_at: '2024-05-20T09:15:00Z' }],
        });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/face-sheets/fs-123', 'PATCH', { form_data: { primary_name: 'Updated Name' } });
    const response = await patchFaceSheet(request, createContext('id', 'fs-123'));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.data.id).toBe('fs-123');
    expect(data.data).toHaveProperty('updated_at');
  });
});

describe('GET /api/v1/face-sheets/resident/[residentId] — Get face sheet by resident', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 401 when not authenticated', async () => {
    authGuard.authenticate.mockReset(); authGuard.authenticate.mockResolvedValue({ error: 'Unauthorized', status: 401 });
    const request = createRequest('/api/v1/face-sheets/resident/res-123');
    const response = await getFaceSheetByResidentId(request, createContext('residentId', 'res-123'));
    expect(response.status).toBe(401);
  });

  test('returns 403 when user lacks RESIDENTS_READ permission', async () => {
    const user = createUser(ROLES.RESIDENT_CARE_OF);
    authGuard.authenticate.mockReset(); authGuard.authenticate.mockResolvedValue({ user });
    authGuard.authorize.mockReturnValueOnce(false);

    const request = createRequest('/api/v1/face-sheets/resident/res-123');
    const response = await getFaceSheetByResidentId(request, createContext('residentId', 'res-123'));
    expect(response.status).toBe(403);
  });

  test('returns 404 when face sheet not found', async () => {
    const user = createUser(ROLES.STAFF);
    authGuard.authenticate.mockReset(); authGuard.authenticate.mockResolvedValue({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/face-sheets/resident/res-nonexistent');
    const response = await getFaceSheetByResidentId(request, createContext('residentId', 'res-nonexistent'));
    expect(response.status).toBe(404);
  });

  test('staff can view any resident face sheet by resident ID (facility-wide policy)', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-123', 'staff-123');
    authGuard.authenticate.mockReset(); authGuard.authenticate.mockResolvedValue({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'fs-123', resident_id: 'res-456' }] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/face-sheets/resident/res-456');
    const response = await getFaceSheetByResidentId(request, createContext('residentId', 'res-456'));
    expect(response.status).toBe(200);
  });

  test('retrieves face sheet by resident ID for authorized user', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-123', 'staff-123');
    authGuard.authenticate.mockReset(); authGuard.authenticate.mockResolvedValue({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'fs-123',
              resident_id: 'res-456',
              emergency_contact_name: 'Jane Doe',
              created_at: '2024-05-20T09:00:00Z',
            },
          ],
        });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/face-sheets/resident/res-456');
    const response = await getFaceSheetByResidentId(request, createContext('residentId', 'res-456'));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.data.resident_id).toBe('res-456');
  });

  test('admin can view any resident face sheet', async () => {
    const user = createUser(ROLES.ADMIN, 'tenant-123', 'admin-123');
    authGuard.authenticate.mockReset(); authGuard.authenticate.mockResolvedValue({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'fs-123',
              resident_id: 'res-999',
              emergency_contact_name: 'John Smith',
              created_at: '2024-05-20T09:00:00Z',
            },
          ],
        });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/face-sheets/resident/res-999');
    const response = await getFaceSheetByResidentId(request, createContext('residentId', 'res-999'));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.data.resident_id).toBe('res-999');
  });

  test('enforces tenant isolation', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-xyz', 'staff-123');
    authGuard.authenticate.mockReset(); authGuard.authenticate.mockResolvedValue({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      expect(tenantId).toBe('tenant-xyz');
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/face-sheets/resident/res-456');
    await getFaceSheetByResidentId(request, createContext('residentId', 'res-456'));

    expect(db.withTenantClient).toHaveBeenCalledWith('tenant-xyz', expect.any(String), expect.any(Function));
  });
});
