/**
 * Unit tests for /api/v1/staff/medications endpoint
 * Tests authentication, authorization, validation, and tenant isolation
 */

import { GET as getMedications, POST as postMedication } from '@/app/api/v1/staff/medications/route.js';

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

function createUser(role = ROLES.STAFF, tenantId = 'tenant-123', staffId = 'staff-123') {
  return { id: 'user-123', staffId, tenantId, role, jti: 'jti-123' };
}

function createMockClient() {
  return { query: jest.fn(), release: jest.fn() };
}

describe('GET /api/v1/staff/medications — List medications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 401 when not authenticated', async () => {
    authGuard.authenticate.mockResolvedValueOnce({ error: 'Unauthorized', status: 401 });
    const request = createRequest('/api/v1/staff/medications');
    const response = await getMedications(request);
    expect(response.status).toBe(401);
  });

  test('returns 403 when user lacks RESIDENTS_READ permission', async () => {
    const user = createUser(ROLES.RESIDENT_CARE_OF);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(false);

    const request = createRequest('/api/v1/staff/medications');
    const response = await getMedications(request);
    expect(response.status).toBe(403);
    expect(authGuard.authorize).toHaveBeenCalledWith(ROLES.RESIDENT_CARE_OF, PERMISSIONS.RESIDENTS_READ);
  });

  test('returns paginated list of medications for authorized user', async () => {
    const user = createUser(ROLES.STAFF);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    const mockRows = [
      {
        id: 'med-1',
        resident_id: 'res-1',
        drug_name: 'Lisinopril',
        drug_strength: '10mg',
        dosage: '1 tablet',
        route: 'oral',
        frequency: 'once daily',
        is_active: true,
        is_controlled_substance: false,
        is_prn: false,
        start_date: '2024-01-01',
        end_date: null,
        created_by: 'staff-1',
        created_at: '2024-01-01',
        total_count: 2,
      },
      {
        id: 'med-2',
        resident_id: 'res-1',
        drug_name: 'Metformin',
        drug_strength: '500mg',
        dosage: '2 tablets',
        route: 'oral',
        frequency: 'twice daily',
        is_active: true,
        is_controlled_substance: false,
        is_prn: false,
        start_date: '2024-02-01',
        end_date: null,
        created_by: 'staff-1',
        created_at: '2024-02-01',
        total_count: 2,
      },
    ];

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: mockRows });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/staff/medications');
    const response = await getMedications(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(2);
    expect(data.pagination.total).toBe(2);
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

    const request = createRequest('/api/v1/staff/medications?resident_id=res-123');
    const response = await getMedications(request);
    expect(response.status).toBe(200);
  });

  test('enforces tenant isolation in medications query', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-xyz');
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      expect(tenantId).toBe('tenant-xyz');
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/staff/medications');
    await getMedications(request);

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

    const request = createRequest('/api/v1/staff/medications?limit=500&offset=0');
    const response = await getMedications(request);
    const data = await response.json();

    expect(data.pagination.limit).toBeLessThanOrEqual(200);
  });

  test('handles database errors gracefully', async () => {
    const user = createUser(ROLES.STAFF);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async () => {
      throw new Error('Database connection failed');
    });

    const request = createRequest('/api/v1/staff/medications');
    const response = await getMedications(request);
    expect(response.status).toBe(500);
  });
});

describe('POST /api/v1/staff/medications — Create medication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 401 when not authenticated', async () => {
    authGuard.authenticate.mockResolvedValueOnce({ error: 'Unauthorized', status: 401 });

    const request = createRequest('/api/v1/staff/medications', 'POST', {
      resident_id: 'res-123',
      drug_name: 'Lisinopril',
      dosage: '1 tablet',
      route: 'oral',
      frequency: 'once daily',
      prescriber: 'Dr. Smith',
      start_date: '2024-05-20',
    });
    const response = await postMedication(request);
    expect(response.status).toBe(401);
  });

  test('returns 403 when user lacks RESIDENTS_UPDATE permission', async () => {
    const user = createUser(ROLES.RESIDENT_CARE_OF);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(false);

    const request = createRequest('/api/v1/staff/medications', 'POST', {
      resident_id: 'res-123',
      drug_name: 'Lisinopril',
      dosage: '1 tablet',
      route: 'oral',
      frequency: 'once daily',
      prescriber: 'Dr. Smith',
      start_date: '2024-05-20',
    });
    const response = await postMedication(request);
    expect(response.status).toBe(403);
  });

  test('returns 422 when required fields are missing', async () => {
    const user = createUser(ROLES.STAFF);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    const testCases = [
      { data: { drug_name: 'Lisinopril', dosage: '1', route: 'oral', frequency: 'daily', prescriber: 'Dr. Smith', start_date: '2024-05-20' }, missing: 'resident_id' },
      { data: { resident_id: 'res-123', dosage: '1', route: 'oral', frequency: 'daily', prescriber: 'Dr. Smith', start_date: '2024-05-20' }, missing: 'drug_name' },
      { data: { resident_id: 'res-123', drug_name: 'Lisinopril', route: 'oral', frequency: 'daily', prescriber: 'Dr. Smith', start_date: '2024-05-20' }, missing: 'dosage' },
      { data: { resident_id: 'res-123', drug_name: 'Lisinopril', dosage: '1', frequency: 'daily', prescriber: 'Dr. Smith', start_date: '2024-05-20' }, missing: 'route' },
      { data: { resident_id: 'res-123', drug_name: 'Lisinopril', dosage: '1', route: 'oral', prescriber: 'Dr. Smith', start_date: '2024-05-20' }, missing: 'frequency' },
      { data: { resident_id: 'res-123', drug_name: 'Lisinopril', dosage: '1', route: 'oral', frequency: 'daily', start_date: '2024-05-20' }, missing: 'prescriber' },
      { data: { resident_id: 'res-123', drug_name: 'Lisinopril', dosage: '1', route: 'oral', frequency: 'daily', prescriber: 'Dr. Smith' }, missing: 'start_date' },
    ];

    for (const testCase of testCases) {
      jest.clearAllMocks();
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(true);

      const request = createRequest('/api/v1/staff/medications', 'POST', testCase.data);
      const response = await postMedication(request);
      expect(response.status).toBe(422);
    }
  });

  test('returns 400 when route is invalid', async () => {
    const user = createUser(ROLES.STAFF);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    const request = createRequest('/api/v1/staff/medications', 'POST', {
      resident_id: 'res-123',
      drug_name: 'Lisinopril',
      dosage: '1 tablet',
      route: 'invalid_route',
      frequency: 'once daily',
      prescriber: 'Dr. Smith',
      start_date: '2024-05-20',
    });
    const response = await postMedication(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/Invalid route/i);
  });

  test('accepts valid route values', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    const validRoutes = ['oral', 'sublingual', 'topical', 'injection', 'inhalation', 'transdermal', 'other'];
    const residentId = '550e8400-e29b-41d4-a716-446655440000';

    for (const route of validRoutes) {
      jest.clearAllMocks();
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(true);

      db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
        const mockClient = createMockClient();
        mockClient.query
          .mockResolvedValueOnce({ rows: [{ id: residentId }] }) // Resident found
          .mockResolvedValueOnce({
            rows: [
              {
                id: 'med-new',
                resident_id: residentId,
                drug_name: 'Lisinopril',
                dosage: '1',
                route,
                frequency: 'once daily',
                start_date: '2024-05-20',
                created_at: '2024-05-20',
              },
            ],
          }); // INSERT returns new medication
        return callback(mockClient);
      });

      const request = createRequest('/api/v1/staff/medications', 'POST', {
        resident_id: residentId,
        drug_name: 'Lisinopril',
        dosage: '1 tablet',
        route,
        frequency: 'once daily',
        prescriber: 'Dr. Smith',
        start_date: '2024-05-20',
      });
      const response = await postMedication(request);
      expect(response.status).toBe(201);
    }
  });

  test('returns 404 when resident not found', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // Resident not found
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/staff/medications', 'POST', {
      resident_id: 'res-nonexistent',
      drug_name: 'Lisinopril',
      dosage: '1 tablet',
      route: 'oral',
      frequency: 'once daily',
      prescriber: 'Dr. Smith',
      start_date: '2024-05-20',
    });
    const response = await postMedication(request);
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toMatch(/Resident not found/i);
  });

  test('creates medication successfully with valid data', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-123', 'staff-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    const residentId = '550e8400-e29b-41d4-a716-446655440000';

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: residentId }] }) // Resident found
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'med-new',
              resident_id: residentId,
              drug_name: 'Lisinopril',
              dosage: '1 tablet',
              route: 'oral',
              frequency: 'once daily',
              start_date: '2024-05-20',
              created_at: '2024-05-20T10:00:00Z',
            },
          ],
        }); // INSERT returns new medication
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/staff/medications', 'POST', {
      resident_id: residentId,
      drug_name: 'Lisinopril',
      drug_strength: '10mg',
      dosage: '1 tablet',
      route: 'oral',
      frequency: 'once daily',
      prescriber: 'Dr. Smith',
      start_date: '2024-05-20',
    });
    const response = await postMedication(request);
    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.data).toHaveProperty('id', 'med-new');
    expect(data.data).toHaveProperty('drug_name', 'Lisinopril');
    expect(data.data).toHaveProperty('route', 'oral');
  });

  test('includes optional fields when provided', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-123', 'staff-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    const residentId = '550e8400-e29b-41d4-a716-446655440000';

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: residentId }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'med-new',
              resident_id: residentId,
              drug_name: 'Oxycodone',
              dosage: '5mg',
              route: 'oral',
              frequency: 'every 6 hours as needed',
              start_date: '2024-05-20',
              created_at: '2024-05-20T10:00:00Z',
            },
          ],
        });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/staff/medications', 'POST', {
      resident_id: residentId,
      drug_name: 'Oxycodone',
      drug_strength: '5mg',
      dosage: '5mg',
      route: 'oral',
      frequency: 'every 6 hours as needed',
      prescriber: 'Dr. Jones',
      pharmacy: 'CVS Pharmacy',
      rx_number: 'RX123456',
      indication: 'Severe pain',
      start_date: '2024-05-20',
      is_controlled_substance: true,
      is_prn: true,
      prn_instructions: 'Take only as needed for pain',
      special_instructions: 'Do not exceed 4 tablets per day',
    });
    const response = await postMedication(request);
    expect(response.status).toBe(201);
  });

});
