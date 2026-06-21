// File: __tests__/api/v1/staff.test.js
import { GET, POST } from '@/app/api/v1/staff/route';

const mockRequest = (url = '/api/v1/staff', method = 'GET', body = null) => {
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

const mockPool = {
  connect: jest.fn(),
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
  getRequestContext: jest.fn(() => ({ user: { id: 'user123', tenantId: 'tenant123', staffId: 'staff123', role: 'admin' } })),
  handleError: jest.fn((err) => Response.json({ error: err.message }, { status: 500 })),
}));

jest.mock('@/lib/db.js', () => ({
  query: jest.fn(),
  pool: mockPool,
}));

jest.mock('@/lib/roles.js', () => ({
  PERMISSIONS: {
    STAFF_READ: 'staff:read',
    STAFF_WRITE: 'staff:write',
  },
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn(() => Promise.resolve('$2a$12$hashed_password')),
}));

jest.mock('@/lib/audit-logger.js', () => ({
  AuditLogger: jest.fn().mockImplementation(() => ({
    log: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@/lib/logger.js', () => ({
  error: jest.fn(),
  warn: jest.fn(),
}));

describe('GET /api/v1/staff', () => {
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

    test('returns 403 when user lacks STAFF_READ permission', async () => {
      const { authorize } = require('@/lib/auth-guard.js');
      authorize.mockReturnValueOnce(false);

      const req = mockRequest();
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });

    test('allows admin user with STAFF_READ permission', async () => {
      const { query } = require('@/lib/db.js');
      query.mockResolvedValueOnce({
        rows: [
          {
            id: 'staff1',
            first_name: 'Jane',
            last_name: 'Smith',
            role: 'nurse',
          },
        ],
      });

      const req = mockRequest();
      const response = await GET(req);

      expect(response.status).toBe(200);
    });
  });

  describe('HIPAA Compliance - Tenant Isolation', () => {
    test('filters staff by tenant_id', async () => {
      const { query } = require('@/lib/db.js');
      query.mockResolvedValueOnce({
        rows: [
          {
            id: 'staff1',
            first_name: 'Jane',
            tenant_id: 'tenant123',
            role: 'nurse',
          },
        ],
      });

      const req = mockRequest();
      await GET(req);

      const queryCall = query.mock.calls[0];
      expect(queryCall[0]).toContain('tenant_id = $1');
      expect(queryCall[1][0]).toBe('tenant123');
    });

    test('only returns staff from authenticated tenant', async () => {
      const { query } = require('@/lib/db.js');
      query.mockResolvedValueOnce({
        rows: [
          {
            id: 'staff1',
            tenant_id: 'tenant123',
            first_name: 'Jane',
            last_name: 'Smith',
            role: 'nurse',
          },
        ],
      });

      const req = mockRequest();
      const response = await GET(req);
      const data = await response.json();

      expect(data.data[0].tenant_id).toBe('tenant123');
    });
  });

  describe('Data Consistency', () => {
    test('returns all required staff fields', async () => {
      const { query } = require('@/lib/db.js');
      query.mockResolvedValueOnce({
        rows: [
          {
            id: 'staff1',
            first_name: 'Jane',
            last_name: 'Smith',
            role: 'nurse',
            preferred_name: 'J',
            pronouns: 'she/her',
            email: 'jane@example.com',
            phone: '555-1234',
            shift: 'day',
            hire_date: '2024-01-01',
            employee_id: 'EMP001',
            emergency_contact_name: 'John Doe',
            emergency_contact_phone: '555-5678',
            emergency_contact_relation: 'spouse',
            notes: 'Senior nurse',
            is_active: true,
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
      });

      const req = mockRequest();
      const response = await GET(req);
      const data = await response.json();

      const staff = data.data[0];
      expect(staff).toHaveProperty('id');
      expect(staff).toHaveProperty('first_name');
      expect(staff).toHaveProperty('last_name');
      expect(staff).toHaveProperty('role');
      expect(staff).toHaveProperty('email');
    });

    test('sorts staff by last_name and first_name', async () => {
      const { query } = require('@/lib/db.js');
      query.mockResolvedValueOnce({
        rows: [
          {
            id: 'staff1',
            first_name: 'Alice',
            last_name: 'Anderson',
            role: 'nurse',
          },
          {
            id: 'staff2',
            first_name: 'Bob',
            last_name: 'Smith',
            role: 'doctor',
          },
        ],
      });

      const req = mockRequest();
      await GET(req);

      const queryCall = query.mock.calls[0];
      expect(queryCall[0]).toContain('ORDER BY last_name, first_name');
    });
  });

  describe('Response Format', () => {
    test('returns 200 status on success', async () => {
      const { query } = require('@/lib/db.js');
      query.mockResolvedValueOnce({
        rows: [],
      });

      const req = mockRequest();
      const response = await GET(req);

      expect(response.status).toBe(200);
    });

    test('returns data array in response', async () => {
      const { query } = require('@/lib/db.js');
      query.mockResolvedValueOnce({
        rows: [{ id: 'staff1', first_name: 'Jane', role: 'nurse' }],
      });

      const req = mockRequest();
      const response = await GET(req);
      const data = await response.json();

      expect(Array.isArray(data.data)).toBe(true);
    });

    test('returns empty array when no staff found', async () => {
      const { query } = require('@/lib/db.js');
      query.mockResolvedValueOnce({
        rows: [],
      });

      const req = mockRequest();
      const response = await GET(req);
      const data = await response.json();

      expect(data.data).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    test('returns 500 on database error', async () => {
      const { query } = require('@/lib/db.js');
      query.mockRejectedValueOnce(new Error('Database error'));

      const req = mockRequest();
      const response = await GET(req);

      expect(response.status).toBe(500);
    });
  });
});

describe('POST /api/v1/staff', () => {
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

      const req = mockRequest('/api/v1/staff', 'POST', {
        first_name: 'Jane',
        last_name: 'Doe',
        role: 'nurse',
        email: 'jane@example.com',
        password: 'SecurePass123!',
      });
      const response = await POST(req);

      expect(response.status).toBe(401);
    });

    test('returns 403 when user lacks STAFF_WRITE permission', async () => {
      const { authorize } = require('@/lib/auth-guard.js');
      authorize.mockReturnValueOnce(false);

      const req = mockRequest('/api/v1/staff', 'POST', {
        first_name: 'Jane',
        last_name: 'Doe',
        role: 'nurse',
        email: 'jane@example.com',
        password: 'SecurePass123!',
      });
      const response = await POST(req);

      expect(response.status).toBe(403);
    });
  });

  describe('Input Validation', () => {
    test('returns 422 when required fields are missing', async () => {
      const req = mockRequest('/api/v1/staff', 'POST', {
        first_name: 'Jane',
        // missing last_name, role, email, password
      });
      const response = await POST(req);

      expect(response.status).toBe(422);
    });

    test('requires first_name', async () => {
      const req = mockRequest('/api/v1/staff', 'POST', {
        last_name: 'Doe',
        role: 'nurse',
        email: 'jane@example.com',
        password: 'SecurePass123!',
      });
      const response = await POST(req);

      expect(response.status).toBe(422);
    });

    test('requires last_name', async () => {
      const req = mockRequest('/api/v1/staff', 'POST', {
        first_name: 'Jane',
        role: 'nurse',
        email: 'jane@example.com',
        password: 'SecurePass123!',
      });
      const response = await POST(req);

      expect(response.status).toBe(422);
    });

    test('requires role', async () => {
      const req = mockRequest('/api/v1/staff', 'POST', {
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane@example.com',
        password: 'SecurePass123!',
      });
      const response = await POST(req);

      expect(response.status).toBe(422);
    });

    test('requires email', async () => {
      const req = mockRequest('/api/v1/staff', 'POST', {
        first_name: 'Jane',
        last_name: 'Doe',
        role: 'nurse',
        password: 'SecurePass123!',
      });
      const response = await POST(req);

      expect(response.status).toBe(422);
    });

    test('requires password', async () => {
      const req = mockRequest('/api/v1/staff', 'POST', {
        first_name: 'Jane',
        last_name: 'Doe',
        role: 'nurse',
        email: 'jane@example.com',
      });
      const response = await POST(req);

      expect(response.status).toBe(422);
    });
  });

  describe('HIPAA Compliance - Tenant Isolation', () => {
    test('inserts staff with tenant_id', async () => {
      const poolConnect = jest.fn();
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [{ id: 'staff1', email: 'jane@example.com' }] }) // INSERT staff
          .mockResolvedValueOnce({ rows: [] }) // INSERT user_account
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn(),
      };
      poolConnect.mockResolvedValueOnce(mockClient);
      mockPool.connect = poolConnect;

      const req = mockRequest('/api/v1/staff', 'POST', {
        first_name: 'Jane',
        last_name: 'Doe',
        role: 'nurse',
        email: 'jane@example.com',
        password: 'SecurePass123!',
      });
      await POST(req);

      const staffInsertCall = mockClient.query.mock.calls[1];
      expect(staffInsertCall[1][0]).toBe('tenant123');
    });
  });

  describe('Password Hashing', () => {
    test('hashes password before storing', async () => {
      const bcrypt = require('bcryptjs');
      const poolConnect = jest.fn();
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [{ id: 'staff1', email: 'jane@example.com' }] }) // INSERT staff
          .mockResolvedValueOnce({ rows: [] }) // INSERT user_account
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn(),
      };
      poolConnect.mockResolvedValueOnce(mockClient);
      mockPool.connect = poolConnect;

      const req = mockRequest('/api/v1/staff', 'POST', {
        first_name: 'Jane',
        last_name: 'Doe',
        role: 'nurse',
        email: 'jane@example.com',
        password: 'SecurePass123!',
      });
      await POST(req);

      expect(bcrypt.hash).toHaveBeenCalledWith('SecurePass123!', 12);
    });
  });

  describe('Database Transaction', () => {
    test('begins transaction for staff creation', async () => {
      const poolConnect = jest.fn();
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [{ id: 'staff1', email: 'jane@example.com' }] }) // INSERT staff
          .mockResolvedValueOnce({ rows: [] }) // INSERT user_account
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn(),
      };
      poolConnect.mockResolvedValueOnce(mockClient);
      mockPool.connect = poolConnect;

      const req = mockRequest('/api/v1/staff', 'POST', {
        first_name: 'Jane',
        last_name: 'Doe',
        role: 'nurse',
        email: 'jane@example.com',
        password: 'SecurePass123!',
      });
      await POST(req);

      const beginCall = mockClient.query.mock.calls[0];
      expect(beginCall[0]).toBe('BEGIN');
    });

    test('commits transaction on success', async () => {
      const poolConnect = jest.fn();
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [{ id: 'staff1', email: 'jane@example.com' }] }) // INSERT staff
          .mockResolvedValueOnce({ rows: [] }) // INSERT user_account
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn(),
      };
      poolConnect.mockResolvedValueOnce(mockClient);
      mockPool.connect = poolConnect;

      const req = mockRequest('/api/v1/staff', 'POST', {
        first_name: 'Jane',
        last_name: 'Doe',
        role: 'nurse',
        email: 'jane@example.com',
        password: 'SecurePass123!',
      });
      await POST(req);

      const commitCall = mockClient.query.mock.calls[3];
      expect(commitCall[0]).toBe('COMMIT');
    });

    test('rolls back transaction on error', async () => {
      const poolConnect = jest.fn();
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockRejectedValueOnce(new Error('Insert failed')), // INSERT staff fails
        release: jest.fn(),
      };
      poolConnect.mockResolvedValueOnce(mockClient);
      mockPool.connect = poolConnect;

      const req = mockRequest('/api/v1/staff', 'POST', {
        first_name: 'Jane',
        last_name: 'Doe',
        role: 'nurse',
        email: 'jane@example.com',
        password: 'SecurePass123!',
      });
      const response = await POST(req);

      expect(response.status).toBe(500);
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('Response Format', () => {
    test('returns 201 Created on success', async () => {
      const poolConnect = jest.fn();
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [{ id: 'staff1', email: 'jane@example.com' }] }) // INSERT staff
          .mockResolvedValueOnce({ rows: [] }) // INSERT user_account
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn(),
      };
      poolConnect.mockResolvedValueOnce(mockClient);
      mockPool.connect = poolConnect;

      const req = mockRequest('/api/v1/staff', 'POST', {
        first_name: 'Jane',
        last_name: 'Doe',
        role: 'nurse',
        email: 'jane@example.com',
        password: 'SecurePass123!',
      });
      const response = await POST(req);

      expect(response.status).toBe(201);
    });

    test('returns staff id, email, and role in response', async () => {
      const poolConnect = jest.fn();
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [{ id: 'staff1', email: 'jane@example.com' }] }) // INSERT staff
          .mockResolvedValueOnce({ rows: [] }) // INSERT user_account
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn(),
      };
      poolConnect.mockResolvedValueOnce(mockClient);
      mockPool.connect = poolConnect;

      const req = mockRequest('/api/v1/staff', 'POST', {
        first_name: 'Jane',
        last_name: 'Doe',
        role: 'nurse',
        email: 'jane@example.com',
        password: 'SecurePass123!',
      });
      const response = await POST(req);
      const data = await response.json();

      expect(data.data).toHaveProperty('id');
      expect(data.data).toHaveProperty('email');
      expect(data.data).toHaveProperty('role');
      expect(data.data.email).toBe('jane@example.com');
      expect(data.data.role).toBe('nurse');
    });
  });

  describe('Audit Logging', () => {
    test('logs staff creation', async () => {
      const { AuditLogger } = require('@/lib/audit-logger.js');
      const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };
      AuditLogger.mockImplementationOnce(() => mockAudit);

      const poolConnect = jest.fn();
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [{ id: 'staff1', email: 'jane@example.com' }] }) // INSERT staff
          .mockResolvedValueOnce({ rows: [] }) // INSERT user_account
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn(),
      };
      poolConnect.mockResolvedValueOnce(mockClient);
      mockPool.connect = poolConnect;

      const req = mockRequest('/api/v1/staff', 'POST', {
        first_name: 'Jane',
        last_name: 'Doe',
        role: 'nurse',
        email: 'jane@example.com',
        password: 'SecurePass123!',
      });
      await POST(req);

      expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({
        eventType: 'STAFF_CREATE',
        tableName: 'ref.staff',
        recordId: 'staff1',
      }));
    });
  });

  describe('Error Handling', () => {
    test('returns 500 on database error', async () => {
      const poolConnect = jest.fn();
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockRejectedValueOnce(new Error('Insert failed')),
        release: jest.fn(),
      };
      poolConnect.mockResolvedValueOnce(mockClient);
      mockPool.connect = poolConnect;

      const req = mockRequest('/api/v1/staff', 'POST', {
        first_name: 'Jane',
        last_name: 'Doe',
        role: 'nurse',
        email: 'jane@example.com',
        password: 'SecurePass123!',
      });
      const response = await POST(req);

      expect(response.status).toBe(500);
    });
  });
});
