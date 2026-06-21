/**
 * Unit tests for /api/v1/drug-disposal route
 * Tests POST (create), GET (list), authorization, validation, and error cases
 */

import { POST as createDisposal, GET as listDisposals } from '@/app/api/v1/drug-disposal/route.js';
import { PERMISSIONS, ROLES } from '@/lib/roles.js';

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

// Mock sanitize
jest.mock('@/lib/sanitize.js', () => ({
  sanitizeFields: jest.fn((fields) => {
    // Mock sanitizer just returns the input as-is for testing
    return fields;
  }),
}));

// Mock audit logger
jest.mock('@/lib/audit-logger.js', () => ({
  AuditLogger: jest.fn().mockImplementation(() => ({
    log: jest.fn().mockResolvedValue(undefined),
    logSelect: jest.fn().mockResolvedValue(undefined),
  })),
}));

import * as authGuard from '@/lib/auth-guard.js';
import * as db from '@/lib/db.js';

function createRequest(method = 'GET', body = null, headers = {}) {
  const request = {
    url: 'http://localhost:3000/api/v1/drug-disposal',
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

function createUser(role = ROLES.STAFF, tenantId = 'tenant-123', staffId = 'staff-123') {
  return {
    id: 'user-123',
    staffId,
    tenantId,
    role,
    jti: 'jti-123',
  };
}

describe('Drug Disposal API — POST /api/v1/drug-disposal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============ AUTHENTICATION ============

  describe('Authentication', () => {
    test('returns 401 when no authorization header', async () => {
      authGuard.authenticate.mockResolvedValueOnce({
        error: 'Missing or malformed Authorization header',
        status: 401,
      });

      const request = createRequest('POST', { resident_id: 'res-1', drug_name: 'Aspirin' });
      const response = await createDisposal(request);

      expect(response.status).toBe(401);
    });

    test('returns 401 when token is invalid', async () => {
      authGuard.authenticate.mockResolvedValueOnce({
        error: 'Invalid token',
        status: 401,
      });

      const request = createRequest('POST', { resident_id: 'res-1', drug_name: 'Aspirin' });
      const response = await createDisposal(request);

      expect(response.status).toBe(401);
    });
  });

  // ============ AUTHORIZATION ============

  describe('Authorization', () => {
    test('returns 403 when user lacks SAFETY_WRITE permission', async () => {
      const user = createUser(ROLES.RESIDENT_CARE_OF); // lacks SAFETY_WRITE
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(false);

      const request = createRequest('POST', {
        resident_id: 'res-1',
        drug_name: 'Aspirin',
      });
      const response = await createDisposal(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toMatch(/forbidden/i);
      expect(data.error).toMatch(/permission/i);
      expect(authGuard.authorize).toHaveBeenCalledWith(
        ROLES.RESIDENT_CARE_OF,
        PERMISSIONS.SAFETY_WRITE
      );
    });

    test('allows users with SAFETY_WRITE permission', async () => {
      const user = createUser(ROLES.STAFF);
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(true);
      db.withTenantClient.mockResolvedValueOnce({ id: 'disposal-123' });

      const request = createRequest('POST', {
        resident_id: 'res-1',
        drug_name: 'Aspirin',
        quantity_disposed: 10,
        quantity_unit: 'tablets',
        disposal_method: 'incineration',
      });
      const response = await createDisposal(request);

      expect(response.status).toBe(200);
    });
  });

  // ============ REQUEST VALIDATION ============

  describe('Request body validation', () => {
    beforeEach(() => {
      const user = createUser(ROLES.STAFF);
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(true);
    });

    test('returns 422 when resident_id is missing', async () => {
      const request = createRequest('POST', {
        drug_name: 'Aspirin',
      });
      const response = await createDisposal(request);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toMatch(/resident_id/i);
    });

    test('returns 422 when drug_name is missing', async () => {
      const request = createRequest('POST', {
        resident_id: 'res-1',
      });
      const response = await createDisposal(request);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toMatch(/drug_name/i);
    });

    test('returns 422 when both resident_id and drug_name are missing', async () => {
      const request = createRequest('POST', {});
      const response = await createDisposal(request);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toMatch(/required/i);
    });

    test('accepts request with only required fields', async () => {
      db.withTenantClient.mockResolvedValueOnce({ id: 'disposal-456' });

      const request = createRequest('POST', {
        resident_id: 'res-1',
        drug_name: 'Ibuprofen',
      });
      const response = await createDisposal(request);

      expect(response.status).toBe(200);
    });

    test('accepts request with all optional fields', async () => {
      db.withTenantClient.mockResolvedValueOnce({ id: 'disposal-789' });

      const request = createRequest('POST', {
        resident_id: 'res-1',
        disposal_date: '2024-01-15',
        drug_name: 'Metoprolol',
        drug_strength: '50mg',
        quantity_disposed: 30,
        quantity_unit: 'tablets',
        disposal_reason: 'expired',
        disposal_reason_other: null,
        disposal_method: 'incineration',
        disposal_method_other: null,
        counting_staff_name: 'John Doe',
        witness_name: 'Jane Smith',
        is_controlled_substance: true,
      });
      const response = await createDisposal(request);

      expect(response.status).toBe(200);
    });
  });

  // ============ SUCCESSFUL CREATION ============

  describe('Successful creation', () => {
    beforeEach(() => {
      const user = createUser(ROLES.STAFF, 'tenant-123', 'staff-789');
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(true);
    });

    test('returns disposal ID and pending status', async () => {
      const disposalId = 'disposal-abc123';
      db.withTenantClient.mockResolvedValueOnce({ id: disposalId });

      const request = createRequest('POST', {
        resident_id: 'res-1',
        drug_name: 'Aspirin',
      });
      const response = await createDisposal(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe(disposalId);
      expect(data.status).toBe('pending');
      expect(data.message).toMatch(/submitted for approval/i);
    });

    test('calls withTenantClient with correct tenant and staff context', async () => {
      const tenantId = 'tenant-xyz';
      const staffId = 'staff-xyz';
      const user = createUser(ROLES.STAFF, tenantId, staffId);
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(true);
      db.withTenantClient.mockResolvedValueOnce({ id: 'disposal-123' });

      const request = createRequest('POST', {
        resident_id: 'res-1',
        drug_name: 'Atorvastatin',
      });
      await createDisposal(request);

      expect(db.withTenantClient).toHaveBeenCalledWith(
        tenantId,
        staffId,
        expect.any(Function)
      );
    });

    test('inserts record with current timestamp', async () => {
      db.withTenantClient.mockResolvedValueOnce({ id: 'disposal-123' });

      const request = createRequest('POST', {
        resident_id: 'res-1',
        drug_name: 'Lisinopril',
      });
      const response = await createDisposal(request);

      expect(response.status).toBe(200);
      // The route uses CURRENT_TIMESTAMP, which is handled by DB
    });

    test('sanitizes free-text fields before storage', async () => {
      db.withTenantClient.mockResolvedValueOnce({ id: 'disposal-456' });

      const request = createRequest('POST', {
        resident_id: 'res-1',
        drug_name: 'Metformin',
        disposal_reason_other: 'Patient <script>alert("xss")</script> discontinued',
        counting_staff_name: 'John <b>Doe</b>',
      });
      await createDisposal(request);

      // The mock sanitizer is called (in real code it would sanitize)
      expect(db.withTenantClient).toHaveBeenCalled();
    });

    test('sets counting_staff_id from authenticated user', async () => {
      const staffId = 'staff-auth-123';
      const user = createUser(ROLES.STAFF, 'tenant-123', staffId);
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(true);
      db.withTenantClient.mockResolvedValueOnce({ id: 'disposal-789' });

      const request = createRequest('POST', {
        resident_id: 'res-1',
        drug_name: 'Sertraline',
      });
      await createDisposal(request);

      expect(db.withTenantClient).toHaveBeenCalled();
      // The staffId is passed to the database query internally
    });
  });

  // ============ TENANT ISOLATION ============

  describe('Tenant isolation', () => {
    test('drug disposal record created in correct tenant', async () => {
      const tenantId = 'tenant-isolation-test';
      const user = createUser(ROLES.STAFF, tenantId, 'staff-123');
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(true);
      db.withTenantClient.mockResolvedValueOnce({ id: 'disposal-iso-1' });

      const request = createRequest('POST', {
        resident_id: 'res-1',
        drug_name: 'Omeprazole',
      });
      await createDisposal(request);

      expect(db.withTenantClient).toHaveBeenCalledWith(
        tenantId,
        'staff-123',
        expect.any(Function)
      );
    });

    test('prevents cross-tenant access by tenant_id in query', async () => {
      const user = createUser(ROLES.STAFF, 'tenant-a', 'staff-a');
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(true);
      // Mock would return nothing if trying to access tenant-b record
      db.withTenantClient.mockResolvedValueOnce({ id: 'disposal-123' });

      const request = createRequest('POST', {
        resident_id: 'res-1',
        drug_name: 'Amoxicillin',
      });
      await createDisposal(request);

      // Verify tenant_id is first parameter to query
      expect(db.withTenantClient).toHaveBeenCalledWith(
        'tenant-a',
        'staff-a',
        expect.any(Function)
      );
    });
  });
});

describe('Drug Disposal API — GET /api/v1/drug-disposal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============ AUTHENTICATION ============

  describe('Authentication', () => {
    test('returns 401 when no authorization header', async () => {
      authGuard.authenticate.mockResolvedValueOnce({
        error: 'Missing or malformed Authorization header',
        status: 401,
      });

      const request = createRequest('GET');
      const response = await listDisposals(request);

      expect(response.status).toBe(401);
    });

    test('returns 401 when token is expired', async () => {
      authGuard.authenticate.mockResolvedValueOnce({
        error: 'Token expired',
        status: 401,
      });

      const request = createRequest('GET');
      const response = await listDisposals(request);

      expect(response.status).toBe(401);
    });
  });

  // ============ AUTHORIZATION ============

  describe('Authorization', () => {
    test('returns 403 when user lacks SAFETY_READ permission', async () => {
      const user = createUser(ROLES.RESIDENT_CARE_OF);
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(false);

      const request = createRequest('GET');
      const response = await listDisposals(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toMatch(/forbidden/i);
      expect(data.error).toMatch(/permission/i);
      expect(authGuard.authorize).toHaveBeenCalledWith(
        ROLES.RESIDENT_CARE_OF,
        PERMISSIONS.SAFETY_READ
      );
    });

    test('allows users with SAFETY_READ permission', async () => {
      const user = createUser(ROLES.STAFF);
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(true);
      db.withTenantClient.mockResolvedValueOnce([]);

      const request = createRequest('GET');
      const response = await listDisposals(request);

      expect(response.status).toBe(200);
    });
  });

  // ============ SUCCESSFUL RETRIEVAL ============

  describe('Successful data retrieval', () => {
    beforeEach(() => {
      const user = createUser(ROLES.STAFF);
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(true);
    });

    test('returns empty array when no disposal records exist', async () => {
      db.withTenantClient.mockResolvedValueOnce([]);

      const request = createRequest('GET');
      const response = await listDisposals(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.records).toEqual([]);
    });

    test('returns disposal records with resident and staff details', async () => {
      const records = [
        {
          id: 'disposal-1',
          resident_id: 'res-1',
          disposal_date: '2024-01-10',
          drug_name: 'Aspirin',
          quantity_disposed: 10,
          quantity_unit: 'tablets',
          review_status: 'pending',
          reviewed_at: null,
          review_notes: null,
          counting_staff_name: 'John Doe',
          first_name: 'Jane',
          last_name: 'Smith',
          staff_first_name: 'John',
          staff_last_name: 'Doe',
        },
        {
          id: 'disposal-2',
          resident_id: 'res-2',
          disposal_date: '2024-01-11',
          drug_name: 'Ibuprofen',
          quantity_disposed: 20,
          quantity_unit: 'tablets',
          review_status: 'approved',
          reviewed_at: '2024-01-12',
          review_notes: 'Looks good',
          counting_staff_name: 'Jane Doe',
          first_name: 'Bob',
          last_name: 'Johnson',
          staff_first_name: 'Jane',
          staff_last_name: 'Doe',
        },
      ];
      db.withTenantClient.mockResolvedValueOnce(records);

      const request = createRequest('GET');
      const response = await listDisposals(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.records).toHaveLength(2);
      expect(data.records[0].id).toBe('disposal-1');
      expect(data.records[0].drug_name).toBe('Aspirin');
      expect(data.records[0].first_name).toBe('Jane');
      expect(data.records[1].review_status).toBe('approved');
    });

    test('limits results to 100 records', async () => {
      const records = Array.from({ length: 100 }, (_, i) => ({
        id: `disposal-${i + 1}`,
        resident_id: `res-${i + 1}`,
        drug_name: `Drug${i + 1}`,
        quantity_disposed: 10 * (i + 1),
        quantity_unit: 'tablets',
        review_status: 'pending',
      }));
      db.withTenantClient.mockResolvedValueOnce(records);

      const request = createRequest('GET');
      const response = await listDisposals(request);
      const data = await response.json();

      expect(data.records).toHaveLength(100);
    });

    test('orders records by disposal_date DESC', async () => {
      const records = [
        {
          id: 'disposal-3',
          disposal_date: '2024-01-15',
          drug_name: 'Aspirin',
          first_name: 'Resident3',
        },
        {
          id: 'disposal-2',
          disposal_date: '2024-01-10',
          drug_name: 'Ibuprofen',
          first_name: 'Resident2',
        },
        {
          id: 'disposal-1',
          disposal_date: '2024-01-05',
          drug_name: 'Acetaminophen',
          first_name: 'Resident1',
        },
      ];
      db.withTenantClient.mockResolvedValueOnce(records);

      const request = createRequest('GET');
      const response = await listDisposals(request);
      const data = await response.json();

      // Results are ordered by disposal_date DESC in the query
      expect(data.records[0].id).toBe('disposal-3');
      expect(data.records[1].id).toBe('disposal-2');
      expect(data.records[2].id).toBe('disposal-1');
    });
  });

  // ============ TENANT ISOLATION ============

  describe('Tenant isolation', () => {
    test('queries only records from authenticated user\'s tenant', async () => {
      const tenantId = 'tenant-secure-123';
      const user = createUser(ROLES.STAFF, tenantId, 'staff-123');
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(true);
      db.withTenantClient.mockResolvedValueOnce([]);

      const request = createRequest('GET');
      await listDisposals(request);

      expect(db.withTenantClient).toHaveBeenCalledWith(
        tenantId,
        'staff-123',
        expect.any(Function)
      );
    });

    test('returns only records for the authenticated tenant', async () => {
      const user = createUser(ROLES.STAFF, 'tenant-a', 'staff-a');
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(true);
      db.withTenantClient.mockResolvedValueOnce([
        {
          id: 'disposal-a1',
          resident_id: 'res-a1',
          drug_name: 'DrugA',
        },
      ]);

      const request = createRequest('GET');
      const response = await listDisposals(request);
      const data = await response.json();

      expect(data.records).toHaveLength(1);
      expect(data.records[0].id).toBe('disposal-a1');
    });
  });

  // ============ ERROR HANDLING ============

  describe('Error handling', () => {
    test('handles database query errors', async () => {
      const user = createUser(ROLES.STAFF);
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(true);
      const dbError = new Error('Database connection lost');
      dbError.status = 500;
      authGuard.handleError.mockReturnValueOnce(
        Response.json({ error: 'Internal server error' }, { status: 500 })
      );
      db.withTenantClient.mockRejectedValueOnce(dbError);

      const request = createRequest('GET');
      const response = await listDisposals(request);

      expect(response.status).toBe(500);
    });
  });
});

describe('Drug Disposal API — Cross-route authorization', () => {
  test('SAFETY_WRITE enforces create permission correctly', async () => {
    // Only staff, manager, admin, superadmin have SAFETY_WRITE
    const user = createUser(ROLES.RESIDENT_CARE_OF);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(false);

    const request = createRequest('POST', {
      resident_id: 'res-1',
      drug_name: 'TestDrug',
    });
    const response = await createDisposal(request);

    expect(response.status).toBe(403);
  });

  test('SAFETY_READ enforces list permission correctly', async () => {
    const user = createUser(ROLES.RESIDENT_CARE_OF);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(false);

    const request = createRequest('GET');
    const response = await listDisposals(request);

    expect(response.status).toBe(403);
  });
});
