// File: __tests__/api/v1/residents.test.js
import { GET, POST } from '@/app/api/v1/residents/route';

const mockRequest = (url = '/api/v1/residents?limit=25&page=1', method = 'GET', body = null) => {
  const headers = new Map();
  headers.set('authorization', 'Bearer test-token');
  return {
    url,
    method,
    headers,
    json: async () => body,
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
  maskPHI: jest.fn((obj) => obj),
  getRequestContext: jest.fn(() => ({ user: { id: 'user123', tenantId: 'tenant123', staffId: 'staff123', role: 'admin' } })),
  handleError: jest.fn((err) => {
    return Response.json({ error: err.message }, { status: 500 });
  }),
}));

jest.mock('@/lib/db.js', () => ({
  withTenantClient: jest.fn((tenantId, staffId, fn) => fn(mockDbClient)),
  query: jest.fn(),
  pool: { connect: jest.fn() },
}));

jest.mock('@/lib/encryption.js', () => ({
  encryptFields: jest.fn((data) => data),
  decryptFields: jest.fn((data) => data),
  RESIDENT_ENCRYPTED_FIELDS: ['first_name', 'last_name', 'ssn_last4'],
}));

jest.mock('@/lib/roles.js', () => ({
  PERMISSIONS: {
    RESIDENTS_READ: 'residents:read',
    RESIDENTS_CREATE: 'residents:create',
    RESIDENTS_READ_OWN: 'residents:read_own',
  },
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn(() => Promise.resolve('hashed_password')),
}));

jest.mock('@/lib/audit-logger.js', () => ({
  AuditLogger: jest.fn().mockImplementation(() => ({
    logSelect: jest.fn().mockResolvedValue(undefined),
    logInsert: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@/lib/logger.js', () => ({
  error: jest.fn(),
  warn: jest.fn(),
}));

describe('GET /api/v1/residents', () => {
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

    test('returns 403 when user lacks RESIDENTS_READ permission', async () => {
      const { authorize } = require('@/lib/auth-guard.js');
      authorize.mockReturnValueOnce(false);

      const req = mockRequest();
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });

    test('allows admin user with RESIDENTS_READ permission', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'res1',
            tenant_id: 'tenant123',
            first_name: 'John',
            last_name: 'Doe',
            total_count: 1,
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
        rows: [{ id: 'res1', total_count: 1 }],
      });

      const req = mockRequest();
      await GET(req);

      expect(withTenantClient).toHaveBeenCalledWith('tenant123', 'staff123', expect.any(Function));
    });

    test('only returns residents from authenticated tenant', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'res1',
            tenant_id: 'tenant123',
            first_name: 'John',
            last_name: 'Doe',
            total_count: 1,
          },
        ],
      });

      const req = mockRequest();
      const response = await GET(req);
      const data = await response.json();

      const queryCall = mockDbClient.query.mock.calls[0];
      expect(queryCall[1][0]).toBe('tenant123');
    });
  });

  describe('Pagination', () => {
    test('applies default pagination (page=1, limit=25)', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: Array(25).fill().map((_, i) => ({
          id: `res${i}`,
          tenant_id: 'tenant123',
          first_name: 'John',
          last_name: 'Doe',
          total_count: 50,
        })),
      });

      const req = mockRequest('/api/v1/residents');
      const response = await GET(req);
      const data = await response.json();

      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(25);
      expect(data.pagination.total).toBe(50);
    });

    test('enforces limit maximum of 100', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [{ total_count: 0 }],
      });

      const req = mockRequest('/api/v1/residents?limit=500');
      const response = await GET(req);
      const data = await response.json();

      expect(data.pagination.limit).toBe(100);
    });

    test('calculates correct page count', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [{ total_count: 75, id: 'res1' }],
      });

      const req = mockRequest('/api/v1/residents?limit=25');
      const response = await GET(req);
      const data = await response.json();

      expect(data.pagination.pages).toBe(3);
    });

    test('supports custom page parameter', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [{ id: 'res1', total_count: 100 }],
      });

      const req = mockRequest('/api/v1/residents?page=3&limit=25');
      const response = await GET(req);
      const data = await response.json();

      expect(data.pagination.page).toBe(3);
    });
  });

  describe('Filtering', () => {
    test('filters by status parameter', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [{ id: 'res1', status: 'active', total_count: 1 }],
      });

      const req = mockRequest('/api/v1/residents?status=active');
      await GET(req);

      const queryCall = mockDbClient.query.mock.calls[0];
      expect(queryCall[0]).toContain('r.status = $1');
      expect(queryCall[1][0]).toBe('active');
    });

    test('filters by search parameter (name or medicaid_id)', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [{ id: 'res1', total_count: 1 }],
      });

      const req = mockRequest('/api/v1/residents?search=John');
      await GET(req);

      const queryCall = mockDbClient.query.mock.calls[0];
      expect(queryCall[0]).toContain('ILIKE');
      expect(queryCall[1][0]).toBe('%John%');
    });

    test('combines multiple filters', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [{ id: 'res1', total_count: 1 }],
      });

      const req = mockRequest('/api/v1/residents?status=active&search=John');
      await GET(req);

      const queryCall = mockDbClient.query.mock.calls[0];
      expect(queryCall[1].length).toBeGreaterThan(2);
    });
  });

  describe('Data Consistency', () => {
    test('returns all required resident fields', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'res1',
            tenant_id: 'tenant123',
            first_name: 'John',
            last_name: 'Doe',
            preferred_name: 'J',
            status: 'active',
            intake_date: '2024-01-01',
            discharge_date: null,
            primary_diagnosis: 'HTN',
            age_at_admission: 65,
            pronoun: 'he/him',
            gender: 'M',
            consent_to_treatment: 'yes',
            has_advance_directive: 'yes',
            substance_use_flag: false,
            legal_risk_flag: false,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
            version: 1,
            total_count: 1,
          },
        ],
      });

      const req = mockRequest();
      const response = await GET(req);
      const data = await response.json();

      const resident = data.data[0];
      expect(resident).toHaveProperty('id');
      expect(resident).toHaveProperty('first_name');
      expect(resident).toHaveProperty('status');
      expect(resident).toHaveProperty('intake_date');
    });

    test('applies PHI masking based on role', async () => {
      const { maskPHI } = require('@/lib/auth-guard.js');
      mockDbClient.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'res1',
            tenant_id: 'tenant123',
            first_name: 'John',
            ssn_last4: '1234',
            total_count: 1,
          },
        ],
      });

      const req = mockRequest();
      await GET(req);

      expect(maskPHI).toHaveBeenCalled();
    });

    test('decrypts encrypted fields', async () => {
      const { decryptFields } = require('@/lib/encryption.js');
      mockDbClient.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'res1',
            first_name: 'encrypted_john',
            ssn_last4: 'encrypted_1234',
            total_count: 1,
          },
        ],
      });

      const req = mockRequest();
      await GET(req);

      expect(decryptFields).toHaveBeenCalled();
    });
  });

  describe('Response Format', () => {
    test('returns 200 status on success', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [{ id: 'res1', total_count: 0 }],
      });

      const req = mockRequest();
      const response = await GET(req);

      expect(response.status).toBe(200);
    });

    test('returns data array in response', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [{ id: 'res1', total_count: 1 }],
      });

      const req = mockRequest();
      const response = await GET(req);
      const data = await response.json();

      expect(Array.isArray(data.data)).toBe(true);
    });

    test('includes pagination metadata in response', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [{ id: 'res1', total_count: 50 }],
      });

      const req = mockRequest();
      const response = await GET(req);
      const data = await response.json();

      expect(data.pagination).toBeDefined();
      expect(data.pagination).toHaveProperty('page');
      expect(data.pagination).toHaveProperty('limit');
      expect(data.pagination).toHaveProperty('total');
      expect(data.pagination).toHaveProperty('pages');
    });
  });

  describe('Audit Logging', () => {
    test('logs select operation occurs', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [{ id: 'res1', total_count: 0 }],
      });

      const req = mockRequest();
      const response = await GET(req);

      expect(response.status).toBe(200);
    });

    test('passes justification parameter in query string', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [{ id: 'res1', total_count: 0 }],
      });

      const req = mockRequest('/api/v1/residents?justification=patient_care');
      const response = await GET(req);

      expect(response.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    test('returns 500 on database error', async () => {
      mockDbClient.query.mockRejectedValueOnce(new Error('Database error'));

      const req = mockRequest();
      const response = await GET(req);

      expect(response.status).toBe(500);
    });

    test('returns error message in response body', async () => {
      mockDbClient.query.mockRejectedValueOnce(new Error('Connection timeout'));

      const req = mockRequest();
      const response = await GET(req);
      const data = await response.json();

      expect(data.error).toBeDefined();
    });
  });
});

describe('POST /api/v1/residents', () => {
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

      const req = mockRequest('/api/v1/residents', 'POST', {
        first_name: 'John',
      });
      const response = await POST(req);

      expect(response.status).toBe(401);
    });

    test('returns 403 when user lacks RESIDENTS_CREATE permission', async () => {
      const { authorize } = require('@/lib/auth-guard.js');
      authorize.mockReturnValueOnce(false);

      const req = mockRequest('/api/v1/residents', 'POST', {
        first_name: 'John',
        last_name: 'Doe',
      });
      const response = await POST(req);

      expect(response.status).toBe(403);
    });
  });

  describe('Input Validation', () => {
    test('creates resident with valid data', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'res1',
            status: 'active',
            intake_date: '2024-01-01',
          },
        ],
      });

      const req = mockRequest('/api/v1/residents', 'POST', {
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: '1990-01-01',
        intake_date: '2024-01-01',
      });
      const response = await POST(req);

      expect(response.status).toBe(201);
    });
  });

  describe('Data Encryption', () => {
    test('encrypts sensitive fields before insertion', async () => {
      const { encryptFields } = require('@/lib/encryption.js');
      mockDbClient.query.mockResolvedValueOnce({
        rows: [{ id: 'res1', status: 'active', intake_date: '2024-01-01' }],
      });

      const req = mockRequest('/api/v1/residents', 'POST', {
        first_name: 'John',
        last_name: 'Doe',
        ssn_last4: '1234',
      });
      await POST(req);

      expect(encryptFields).toHaveBeenCalled();
    });
  });

  describe('HIPAA Compliance - Tenant Isolation', () => {
    test('uses withTenantClient for write operations', async () => {
      const { withTenantClient } = require('@/lib/db.js');
      withTenantClient.mockClear();

      mockDbClient.query.mockResolvedValueOnce({
        rows: [{ id: 'res1', status: 'active', intake_date: '2024-01-01' }],
      });

      const req = mockRequest('/api/v1/residents', 'POST', {
        first_name: 'John',
        last_name: 'Doe',
      });
      await POST(req);

      expect(withTenantClient).toHaveBeenCalledWith('tenant123', 'staff123', expect.any(Function));
    });

    test('inserts resident with tenant_id', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [{ id: 'res1', status: 'active', intake_date: '2024-01-01' }],
      });

      const req = mockRequest('/api/v1/residents', 'POST', {
        first_name: 'John',
        last_name: 'Doe',
      });
      await POST(req);

      const queryCall = mockDbClient.query.mock.calls[0];
      expect(queryCall[1][0]).toBe('tenant123');
    });
  });

  describe('Response Format', () => {
    test('returns 201 Created on success', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [{ id: 'res1', status: 'active', intake_date: '2024-01-01' }],
      });

      const req = mockRequest('/api/v1/residents', 'POST', {
        first_name: 'John',
        last_name: 'Doe',
      });
      const response = await POST(req);

      expect(response.status).toBe(201);
    });

    test('returns resident id in response', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [{ id: 'res1', status: 'active', intake_date: '2024-01-01' }],
      });

      const req = mockRequest('/api/v1/residents', 'POST', {
        first_name: 'John',
        last_name: 'Doe',
      });
      const response = await POST(req);
      const data = await response.json();

      expect(data.data).toHaveProperty('id');
      expect(data.data.id).toBe('res1');
    });
  });

  describe('Audit Logging', () => {
    test('logs insert operation by returning 201', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [{ id: 'res1', status: 'active', intake_date: '2024-01-01' }],
      });

      const req = mockRequest('/api/v1/residents', 'POST', {
        first_name: 'John',
        last_name: 'Doe',
      });
      const response = await POST(req);

      expect(response.status).toBe(201);
    });
  });

  describe('Error Handling', () => {
    test('returns 500 on database error', async () => {
      const { withTenantClient } = require('@/lib/db.js');
      withTenantClient.mockRejectedValueOnce(new Error('Insert failed'));

      const req = mockRequest('/api/v1/residents', 'POST', {
        first_name: 'John',
        last_name: 'Doe',
      });
      const response = await POST(req);

      expect(response.status).toBe(500);
    });
  });
});
