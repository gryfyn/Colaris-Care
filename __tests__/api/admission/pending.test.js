// File: __tests__/api/admission/pending.test.js

import { GET } from '@/app/api/v1/admission/pending/route';

const mockRequest = (url = '/api/v1/admission/pending?limit=25&page=1') => ({
  url,
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
  authorize: jest.fn((role, permission) => role === 'admin'),
  handleError: jest.fn((err) => {
    return Response.json({ error: err.message }, { status: 500 });
  }),
  getRequestContext: jest.fn(() => ({})),
}));

jest.mock('@/lib/db.js', () => ({
  withTenantClient: jest.fn((tenantId, staffId, fn) => fn(mockDbClient)),
}));

jest.mock('@/lib/roles.js', () => ({
  PERMISSIONS: {
    ADMIN_READ: 'admin_read',
  },
}));

jest.mock('@/lib/audit-logger.js', () => ({
  AuditLogger: jest.fn().mockImplementation(() => ({
    logSelect: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('GET /api/v1/admission/pending', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication & Authorization', () => {
    test('returns 401 when unauthenticated', async () => {
      const { authenticate } = require('@/lib/auth-guard.js');
      authenticate.mockReturnValueOnce({
        error: 'Unauthorized',
        code: 'NO_AUTH',
        status: 401,
      });

      const req = mockRequest();
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    test('returns 403 when non-admin user views pending admissions', async () => {
      const { authorize } = require('@/lib/auth-guard.js');
      authorize.mockReturnValueOnce(false);

      const req = mockRequest();
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });
  });

  describe('Pagination', () => {
    test('returns array of pending admissions', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'adm1',
            resident_id: 'res1',
            status: 'pending',
            submitted_at: '2024-05-16T10:00:00',
            created_at: '2024-05-16T09:00:00',
            total_count: 1,
            pre_screening_id: 'ps1',
            full_name: 'John Doe',
            date_of_birth: '1990-01-01',
            nursing_assessment_id: null,
            advance_directive_id: null,
          },
        ],
      });

      const req = mockRequest();
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data.admissions)).toBe(true);
      expect(data.admissions.length).toBe(1);
    });

    test('supports limit parameter', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'adm1',
            total_count: 50,
            status: 'pending',
            pre_screening_id: null,
            nursing_assessment_id: null,
            advance_directive_id: null,
          },
        ],
      });

      const req = mockRequest('/api/v1/admission/pending?limit=10&page=1');
      const response = await GET(req);
      const data = await response.json();

      expect(data.pagination.limit).toBe(10);
    });

    test('enforces limit maximum of 100', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [],
      });

      const req = mockRequest('/api/v1/admission/pending?limit=500&page=1');
      const response = await GET(req);
      const data = await response.json();

      expect(data.pagination.limit).toBe(100);
    });

    test('supports page parameter', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'adm1',
            total_count: 100,
            status: 'pending',
            pre_screening_id: null,
            nursing_assessment_id: null,
            advance_directive_id: null,
          },
        ],
      });

      const req = mockRequest('/api/v1/admission/pending?limit=25&page=2');
      const response = await GET(req);
      const data = await response.json();

      expect(data.pagination.page).toBe(2);
      expect(data.pagination.total).toBe(100);
      expect(data.pagination.pages).toBe(4);
    });

    test('returns pagination metadata', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'adm1',
            total_count: 75,
            status: 'pending',
            pre_screening_id: null,
            nursing_assessment_id: null,
            advance_directive_id: null,
          },
        ],
      });

      const req = mockRequest('/api/v1/admission/pending?limit=25');
      const response = await GET(req);
      const data = await response.json();

      expect(data.pagination).toEqual({
        page: 1,
        limit: 25,
        total: 75,
        pages: 3,
      });
    });
  });

  describe('Admission Data Joining', () => {
    test('returns admission with all joined form data', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'adm1',
            resident_id: 'res1',
            status: 'pending',
            submitted_at: '2024-05-16',
            created_at: '2024-05-16',
            total_count: 1,
            pre_screening_id: 'ps1',
            full_name: 'John Doe',
            date_of_birth: '1990-01-01',
            contact_phone: '(555) 123-4567',
            emergency_contact: 'Jane Doe',
            primary_physician: 'Dr. Smith',
            allergies: 'Penicillin',
            current_medications: 'Lisinopril',
            medical_conditions: 'Hypertension',
            vision_hearing: 'Corrected',
            mobility_aids: 'Walker',
            nursing_assessment_id: 'na1',
            assessment_date: '2024-05-16',
            vital_temperature: '98.6',
            vital_bp_systolic: '120',
            vital_bp_diastolic: '80',
            vital_pulse: '72',
            vital_respiration: '16',
            vital_oxygen: '98',
            weight_lbs: '165',
            height_inches: '70',
            skin_assessment: 'Clear',
            sleep_history: '7 hours',
            pain_level: '0',
            pain_location: null,
            functional_mobility: 'Ambulatory',
            fall_risk: 'Low',
            suicide_risk: 'None',
            sexual_history_risk: 'None',
            violence_risk: 'None',
            substance_abuse_history: 'Denies',
            mental_health_assessment: 'Stable',
            opioid_sedation_scale: null,
            nursing_notes: 'Patient stable',
            advance_directive_id: 'ad1',
            resident_name: 'John Doe',
            healthcare_agent_name: 'Jane Doe',
            healthcare_agent_phone: '(555) 123-4567',
            alternate_agent_name: null,
            alternate_agent_phone: null,
            resident_signature: 'John Doe',
            resident_signature_date: '2024-05-16',
            witness1_name: 'Mary Smith',
            witness1_date: '2024-05-16',
            witness2_name: null,
            witness2_date: null,
          },
        ],
      });

      const req = mockRequest();
      const response = await GET(req);
      const data = await response.json();

      const admission = data.admissions[0];
      expect(admission.pre_screening).toBeDefined();
      expect(admission.pre_screening.full_name).toBe('John Doe');
      expect(admission.nursing_assessment).toBeDefined();
      expect(admission.nursing_assessment.vital_pulse).toBe('72');
      expect(admission.advance_directive).toBeDefined();
      expect(admission.advance_directive.healthcare_agent_name).toBe('Jane Doe');
    });

    test('handles null joined data gracefully', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'adm1',
            resident_id: 'res1',
            status: 'pending',
            total_count: 1,
            pre_screening_id: null,
            nursing_assessment_id: null,
            advance_directive_id: null,
          },
        ],
      });

      const req = mockRequest();
      const response = await GET(req);
      const data = await response.json();

      const admission = data.admissions[0];
      expect(admission.pre_screening).toBeNull();
      expect(admission.nursing_assessment).toBeNull();
      expect(admission.advance_directive).toBeNull();
    });

    test('joins forms even when some are missing', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'adm1',
            resident_id: 'res1',
            status: 'pending',
            submitted_at: '2024-05-16',
            created_at: '2024-05-16',
            total_count: 1,
            pre_screening_id: 'ps1',
            full_name: 'John Doe',
            date_of_birth: '1990-01-01',
            nursing_assessment_id: null,
            advance_directive_id: 'ad1',
            resident_name: 'John Doe',
            healthcare_agent_name: 'Jane Doe',
          },
        ],
      });

      const req = mockRequest();
      const response = await GET(req);
      const data = await response.json();

      const admission = data.admissions[0];
      expect(admission.pre_screening).toBeDefined();
      expect(admission.nursing_assessment).toBeNull();
      expect(admission.advance_directive).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('returns 500 on database error', async () => {
      mockDbClient.query.mockRejectedValueOnce(new Error('Database error'));

      const req = mockRequest();
      const response = await GET(req);

      expect(response.status).toBe(500);
    });
  });

  describe('Audit Logging', () => {
    test('logs select operation', async () => {
      const { AuditLogger } = require('@/lib/audit-logger.js');
      const mockAudit = { logSelect: jest.fn().mockResolvedValue(undefined) };
      AuditLogger.mockImplementationOnce(() => mockAudit);

      mockDbClient.query.mockResolvedValueOnce({
        rows: [],
      });

      const req = mockRequest();
      const response = await GET(req);

      expect(response.status).toBe(200);
    });
  });
});
