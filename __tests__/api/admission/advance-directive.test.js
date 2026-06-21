// File: __tests__/api/admission/advance-directive.test.js

import { POST } from '@/app/api/v1/admission/advance-directive/route';

const mockRequest = (body) => ({
  json: jest.fn().mockResolvedValue(body),
  headers: new Map({
    authorization: 'Bearer test-token',
  }),
});

const mockDbClient = {
  query: jest.fn(),
};

jest.mock('@/lib/auth-guard.js', () => ({
  authenticate: jest.fn((req) => ({
    error: null,
    user: {
      id: 'user123',
      tenantId: 'tenant123',
      staffId: 'staff123',
      role: 'admin',
    },
  })),
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

describe('POST /api/v1/admission/advance-directive', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Validation', () => {
    test('returns 400 when required fields missing', async () => {
      mockDbClient.query.mockResolvedValue({ rows: [] });

      const req = mockRequest({
        admission_id: 'admission123',
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('required');
    });

    test('returns 404 when admission not found', async () => {
      mockDbClient.query.mockResolvedValueOnce({ rows: [] });

      const req = mockRequest({
        admission_id: 'nonexistent',
        resident_name: 'John Doe',
        healthcare_agent_name: 'Jane Doe',
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(404);
    });
  });

  describe('Advance Directive Creation', () => {
    test('creates advance directive with witness signatures', async () => {
      mockDbClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'admission123' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'ad123' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'ad123' }] });

      const req = mockRequest({
        admission_id: 'admission123',
        resident_name: 'John Doe',
        healthcare_agent_name: 'Jane Doe',
        healthcare_agent_phone: '(555) 123-4567',
        resident_signature: 'John Doe',
        resident_signature_date: '2024-05-16',
        witness1_name: 'Mary Smith',
        witness1_signature: 'Mary Smith',
        witness1_date: '2024-05-16',
        witness2_name: 'Bob Johnson',
        witness2_signature: 'Bob Johnson',
        witness2_date: '2024-05-16',
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.id).toBe('ad123');
      expect(data.admission_id).toBe('admission123');
    });

    test('accepts optional second witness signature', async () => {
      mockDbClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'admission123' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'ad789' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'ad789' }] });

      const req = mockRequest({
        admission_id: 'admission123',
        resident_name: 'John Doe',
        healthcare_agent_name: 'Jane Doe',
        resident_signature: 'John Doe',
        resident_signature_date: '2024-05-16',
        witness1_name: 'Mary Smith',
        witness1_signature: 'Mary Smith',
        witness1_date: '2024-05-16',
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(201);
    });

    test('accepts all directive preference fields', async () => {
      mockDbClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'admission123' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'ad456' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'ad456' }] });

      const req = mockRequest({
        admission_id: 'admission123',
        resident_name: 'John Doe',
        healthcare_agent_name: 'Jane Doe',
        healthcare_agent_phone: '(555) 123-4567',
        alternate_agent_name: 'Bob Smith',
        alternate_agent_phone: '(555) 987-6543',
        mental_health_preferences: 'Prefer non-medication approaches',
        psychiatric_med_preferences: 'Avoid Haloperidol',
        hospitalization_preference: 'Only if necessary',
        emergency_interventions: 'Seclusion only as last resort',
        specific_treatment_preferences: 'Individual therapy preferred',
        personal_values: 'Maintain dignity and autonomy',
        religious_cultural_preferences: 'Catholic faith important',
        end_of_life_wishes: 'Comfort care focus',
        resident_signature: 'John Doe',
        resident_signature_date: '2024-05-16',
        witness1_name: 'Mary Smith',
        witness1_signature: 'Mary Smith',
        witness1_date: '2024-05-16',
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(201);
    });

    test('updates admission with advance_directive_id', async () => {
      mockDbClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'admission123' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'ad123' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'ad123' }] });

      const req = mockRequest({
        admission_id: 'admission123',
        resident_name: 'John Doe',
        healthcare_agent_name: 'Jane Doe',
      });

      await POST(req);

      const updateCall = mockDbClient.query.mock.calls.find(call =>
        call[0].includes('UPDATE admission.admissions')
      );
      expect(updateCall).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('returns 404 for non-existent admission', async () => {
      mockDbClient.query.mockResolvedValueOnce({ rows: [] });

      const req = mockRequest({
        admission_id: 'doesnotexist',
        resident_name: 'John Doe',
        healthcare_agent_name: 'Jane Doe',
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('Admission not found');
    });

    test('returns 500 on database error', async () => {
      mockDbClient.query.mockRejectedValueOnce(new Error('Database error'));

      const req = mockRequest({
        admission_id: 'admission123',
        resident_name: 'John Doe',
        healthcare_agent_name: 'Jane Doe',
      });

      const response = await POST(req);

      expect(response.status).toBe(500);
    });
  });

  describe('Audit Logging', () => {
    test('logs insert event', async () => {
      const { AuditLogger } = require('@/lib/audit-logger.js');
      const mockAudit = { logInsert: jest.fn().mockResolvedValue(undefined) };
      AuditLogger.mockImplementationOnce(() => mockAudit);

      mockDbClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'admission123' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'ad123' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'ad123' }] });

      const req = mockRequest({
        admission_id: 'admission123',
        resident_name: 'John Doe',
        healthcare_agent_name: 'Jane Doe',
      });

      const response = await POST(req);

      expect(response.status).toBe(201);
    });
  });
});
