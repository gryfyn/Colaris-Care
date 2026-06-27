import { mapAdmission, mapAdmissions } from '@/lib/admissions.js';

describe('mapAdmission', () => {
  const row = {
    id: 'a1', resident_id: 'r1', admission_case_id: null, status: 'submitted',
    candidate_first_name: 'Eve', candidate_last_name: 'Stone', email: 'eve@x.com',
    room: 'Room 1', care_level: 'Routine', admitted_at: '2026-06-01',
    submitted_at: '2026-06-01T10:00:00Z', updated_at: '2026-06-01T10:00:00Z',
    answers: { firstName: 'Eve', conditions: ['Diabetes'] },
  };

  test('maps snake_case row to the API shape', () => {
    const m = mapAdmission(row);
    expect(m.id).toBe('a1');
    expect(m.residentId).toBe('r1');
    expect(m.status).toBe('submitted');
    expect(m.email).toBe('eve@x.com');
    expect(m.room).toBe('Room 1');
    expect(m.careLevel).toBe('Routine');
    expect(m.answers).toEqual({ firstName: 'Eve', conditions: ['Diabetes'] });
  });

  test('composes name, preferring resident first/last when present', () => {
    expect(mapAdmission(row).name).toBe('Eve Stone');
    expect(mapAdmission({ ...row, first_name: 'Real', last_name: 'Name' }).name).toBe('Real Name');
  });

  test('defaults answers to an empty object and returns null for no row', () => {
    expect(mapAdmission({ ...row, answers: null }).answers).toEqual({});
    expect(mapAdmission(null)).toBeNull();
    expect(mapAdmission(undefined)).toBeNull();
  });
});

describe('mapAdmissions', () => {
  test('maps an array and tolerates non-arrays', () => {
    expect(mapAdmissions([{ id: 'a1', candidate_first_name: 'A', candidate_last_name: 'B' }])).toHaveLength(1);
    expect(mapAdmissions(null)).toEqual([]);
    expect(mapAdmissions(undefined)).toEqual([]);
  });
});
