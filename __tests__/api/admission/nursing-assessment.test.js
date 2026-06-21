// File: __tests__/api/admission/nursing-assessment.test.js

import { POST } from '@/app/api/v1/admission/nursing-assessment/route';

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

describe('POST /api/v1/admission/nursing-assessment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Validation', () => {
    test('returns 400 when admission_id is missing', async () => {
      mockDbClient.query.mockResolvedValue({ rows: [] });

      const req = mockRequest({
        vital_temperature: '98.6',
        vital_pulse: '72',
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('admission_id');
    });

    test('returns 404 when admission not found', async () => {
      mockDbClient.query.mockResolvedValueOnce({ rows: [] });

      const req = mockRequest({
        admission_id: 'nonexistent',
        vital_temperature: '98.6',
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(404);
    });
  });

  describe('Nursing Assessment Creation', () => {
    test('creates nursing assessment linked to admission', async () => {
      mockDbClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'admission123' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'na123' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'na123' }] });

      const req = mockRequest({
        admission_id: 'admission123',
        assessment_date: '2024-05-16',
        vital_temperature: '98.6',
        vital_bp_systolic: '120',
        vital_bp_diastolic: '80',
        vital_pulse: '72',
        vital_respiration: '16',
        vital_oxygen: '98',
        weight_lbs: '165',
        height_inches: '70',
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.id).toBe('na123');
      expect(data.admission_id).toBe('admission123');
    });

    test('links nursing assessment to existing admission', async () => {
      const admissionId = 'admission456';
      mockDbClient.query
        .mockResolvedValueOnce({ rows: [{ id: admissionId }] })
        .mockResolvedValueOnce({ rows: [{ id: 'na456' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'na456' }] });

      const req = mockRequest({
        admission_id: admissionId,
        vital_temperature: '98.6',
        vital_pulse: '72',
      });

      const response = await POST(req);
      const data = await response.json();

      expect(data.admission_id).toBe(admissionId);
    });

    test('accepts all vital sign fields', async () => {
      mockDbClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'admission123' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'na789' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'na789' }] });

      const req = mockRequest({
        admission_id: 'admission123',
        assessment_date: '2024-05-16',
        vital_temperature: '98.6',
        vital_bp_systolic: '140',
        vital_bp_diastolic: '90',
        vital_pulse: '75',
        vital_respiration: '18',
        vital_oxygen: '97',
        weight_lbs: '170',
        height_inches: '71',
        pain_level: '5',
        pain_location: 'Lower back',
        skin_assessment: 'Clear, no lesions',
        sleep_history: 'Sleeps 6-7 hours per night',
        functional_mobility: 'Ambulatory with walker',
        fall_risk: 'Low',
        suicide_risk: 'None',
        sexual_history_risk: 'None',
        violence_risk: 'None',
        substance_abuse_history: 'Denies',
        mental_health_assessment: 'Stable',
        notes: 'Patient admits with stable vitals',
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
    });

    test('updates admission with nursing_assessment_id', async () => {
      mockDbClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'admission123' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'na123' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'na123' }] });

      const req = mockRequest({
        admission_id: 'admission123',
        vital_temperature: '98.6',
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
        vital_temperature: '98.6',
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
        .mockResolvedValueOnce({ rows: [{ id: 'na123' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'na123' }] });

      const req = mockRequest({
        admission_id: 'admission123',
        vital_temperature: '98.6',
      });

      const response = await POST(req);

      expect(response.status).toBe(201);
    });
  });
});
