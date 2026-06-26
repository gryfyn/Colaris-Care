jest.mock('@/lib/auth-guard.js', () => ({
  AuthError: class AuthError extends Error {},
  authErrorResponse: jest.fn((err) => Response.json({ error: err.message }, { status: err.status || 500 })),
  requireUser: jest.fn(),
}));

jest.mock('@/lib/db.js', () => ({
  withRequestContext: jest.fn(),
}));

jest.mock('@/lib/audit-events.js', () => ({
  recordAuditEvent: jest.fn(),
}));

import { requireUser } from '@/lib/auth-guard.js';
import { withRequestContext } from '@/lib/db.js';
import { POST } from '@/app/api/v1/admissions/route.js';

function request(body) {
  return new Request('http://localhost/api/v1/admissions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/v1/admissions', () => {
  beforeEach(() => jest.clearAllMocks());

  test('creates resident and admission records and returns credential notice', async () => {
    requireUser.mockResolvedValue({
      id: 'user-1',
      organizationId: 'org-1',
      facilityId: 'fac-1',
      role: 'admin',
    });

    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({
          rows: [{
            id: 'resident-1',
            first_name: 'Mila',
            last_name: 'Jones',
            date_of_birth: '1948-02-14',
            room: '204B',
            care_level: 'Assisted living',
            status: 'active',
            admitted_at: '2026-06-26',
            discharged_at: null,
            version: 1,
          }],
        })
        .mockResolvedValueOnce({
          rows: [{
            id: 'admission-1',
            resident_id: 'resident-1',
            admission_case_id: null,
            status: 'submitted',
            candidate_first_name: 'Mila',
            candidate_last_name: 'Jones',
            email: 'mila@example.com',
            room: '204B',
            care_level: 'Assisted living',
            admitted_at: '2026-06-26',
            submitted_at: '2026-06-26T10:00:00Z',
            updated_at: '2026-06-26T10:00:00Z',
            answers: { roomAssignment: '204B' },
          }],
        })
        .mockResolvedValueOnce({ rows: [] }),
    };

    withRequestContext.mockImplementation(async (_user, _action, fn) => fn(client));

    const response = await POST(request({
      firstName: 'Mila',
      lastName: 'Jones',
      dateOfBirth: '1948-02-14',
      admissionDate: '2026-06-26',
      roomAssignment: '204B',
      careLevel: 'Assisted living',
      email: 'mila@example.com',
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.resident.name).toBe('Mila Jones');
    expect(payload.data.admission.status).toBe('submitted');
    expect(payload.data.adminNotification.loginEmail).toBe('mila@example.com');
  });
});
