// File: __tests__/api/admission/pre-screening.test.js

import { POST } from '@/app/api/v1/admission/pre-screening/route';

const mockRequest = (body, headers = {}) => ({
  json: jest.fn().mockResolvedValue(body),
  headers: new Map(Object.entries({
    authorization: 'Bearer test-token',
    ...headers,
  })),
});

const mockDbClient = {
  query: jest.fn(),
};

jest.mock('@/lib/auth-guard.js', () => ({
  authenticate: jest.fn((req) => {
    const token = req.headers?.get?.('authorization');
    if (!token) {
      return { error: 'Unauthorized', code: 'NO_AUTH', status: 401 };
    }
    return {
      error: null,
      user: {
        id: 'user123',
        tenantId: 'tenant123',
        staffId: 'staff123',
        role: 'admin',
      },
    };
  }),
  handleError: jest.fn((err) => {
    return Response.json({ error: err.message }, { status: 500 });
  }),
  getRequestContext: jest.fn(() => ({})),
}));

jest.mock('@/lib/db.js', () => ({
  withTenantClient: jest.fn((tenantId, staffId, fn) => fn(mockDbClient)),
}));

jest.mock('@/lib/audit-logger.js', () => ({
  AuditLogger: jest.fn().mockImplementation(() => ({
    logInsert: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('POST /api/v1/admission/pre-screening', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication', () => {
    test('returns 401 when unauthenticated', async () => {
      const req = {
        json: jest.fn().mockResolvedValue({
          full_name: 'John Doe',
          date_of_birth: '1990-01-01',
        }),
        headers: new Map(),
      };

      const { authenticate } = require('@/lib/auth-guard.js');
      authenticate.mockReturnValueOnce({
        error: 'Unauthorized',
        code: 'NO_AUTH',
        status: 401,
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('Validation', () => {
    test('returns 400 when full_name is missing', async () => {
      mockDbClient.query.mockResolvedValue({ rows: [] });

      const req = mockRequest({
        date_of_birth: '1990-01-01',
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('full_name');
    });

    test('returns 400 when date_of_birth is missing', async () => {
      mockDbClient.query.mockResolvedValue({ rows: [] });

      const req = mockRequest({
        full_name: 'John Doe',
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('date_of_birth');
    });
  });

  describe('Pre-Screening Creation', () => {
    test('creates new admission record if not exists', async () => {
      mockDbClient.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'admission123' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'ps123' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'ps123' }] });

      const req = mockRequest({
        full_name: 'John Doe',
        date_of_birth: '1990-01-01',
        contact_phone: '(555) 123-4567',
        emergency_contact: 'Jane Doe',
        primary_physician: 'Dr. Smith',
        allergies: 'Penicillin',
        current_medications: 'Lisinopril',
        medical_conditions: 'Hypertension',
        vision_hearing: 'Corrected vision',
        mobility_aids: 'Walker',
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.id).toBeDefined();
      expect(data.admission_id).toBeDefined();
    });

    test('links pre-screening to existing pending admission', async () => {
      const existingAdmissionId = 'admission123';
      mockDbClient.query
        .mockResolvedValueOnce({ rows: [{ id: existingAdmissionId }] })
        .mockResolvedValueOnce({ rows: [{ id: 'ps123' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'ps123' }] });

      const req = mockRequest({
        full_name: 'John Doe',
        date_of_birth: '1990-01-01',
        contact_phone: '(555) 123-4567',
        emergency_contact: 'Jane Doe',
        primary_physician: 'Dr. Smith',
        allergies: 'Penicillin',
        current_medications: 'Lisinopril',
        medical_conditions: 'Hypertension',
        vision_hearing: 'Corrected vision',
        mobility_aids: 'Walker',
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.admission_id).toBe(existingAdmissionId);
    });

    test('returns admission id and pre-screening id on success', async () => {
      mockDbClient.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'admission456' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'ps789' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'ps789' }] });

      const req = mockRequest({
        full_name: 'John Doe',
        date_of_birth: '1990-01-01',
        contact_phone: '(555) 123-4567',
        emergency_contact: 'Jane Doe',
        primary_physician: 'Dr. Smith',
        allergies: 'Penicillin',
        current_medications: 'Lisinopril',
        medical_conditions: 'Hypertension',
        vision_hearing: 'Corrected vision',
        mobility_aids: 'Walker',
      });

      const response = await POST(req);
      const data = await response.json();

      expect(data.id).toBe('ps789');
      expect(data.admission_id).toBe('admission456');
    });
  });

  describe('Error Handling', () => {
    test('returns 500 on database error', async () => {
      mockDbClient.query.mockRejectedValueOnce(new Error('DB Connection failed'));

      const req = mockRequest({
        full_name: 'John Doe',
        date_of_birth: '1990-01-01',
      });

      const response = await POST(req);

      expect(response.status).toBe(500);
    });
  });

  describe('Audit Logging', () => {
    test('logs insert to audit trail', async () => {
      const { AuditLogger } = require('@/lib/audit-logger.js');
      const mockAudit = { logInsert: jest.fn().mockResolvedValue(undefined) };
      AuditLogger.mockImplementationOnce(() => mockAudit);

      mockDbClient.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'admission123' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'ps123' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'ps123' }] });

      const req = mockRequest({
        full_name: 'John Doe',
        date_of_birth: '1990-01-01',
        contact_phone: '(555) 123-4567',
        emergency_contact: 'Jane Doe',
        primary_physician: 'Dr. Smith',
        allergies: 'Penicillin',
        current_medications: 'Lisinopril',
        medical_conditions: 'Hypertension',
        vision_hearing: 'Corrected vision',
        mobility_aids: 'Walker',
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(201);
    });
  });
});
