import { buildFaceSheetFromResident } from '@/lib/face-sheet-client.js';
import { MASKED } from '@/app/admin/face-sheets/data';

describe('buildFaceSheetFromResident', () => {
  const resident = { id: 'r1', name: 'Eleanor Whitfield', room: 'W-104', careLevel: 'assisted_living', status: 'active', admittedAt: '2026-01-10', updatedAt: '2026-06-01' };

  test('composes identity and maps status', () => {
    const fs = buildFaceSheetFromResident(resident, []);
    expect(fs.id).toBe('r1');
    expect(fs.name).toBe('Eleanor Whitfield');
    expect(fs.room).toBe('W-104');
    expect(fs.status).toBe('Current'); // active -> Current
  });

  test('masks sensitive demographics and identifiers', () => {
    const fs = buildFaceSheetFromResident(resident, []);
    expect(fs.faceSheet.date_of_birth).toBe(MASKED);
    expect(fs.faceSheet.ssn).toBe(MASKED);
    expect(fs.faceSheet.primary_phone_cell).toBe(MASKED);
    expect(fs.primaryContact.phone).toBe(MASKED);
    expect(fs.emergencyContact.phone).toBe(MASKED);
  });

  test('falls back gracefully for sparse residents', () => {
    const fs = buildFaceSheetFromResident({ id: 'r2', firstName: 'Jane', lastName: 'Doe' }, []);
    expect(fs.name).toBe('Jane Doe');
    expect(fs.room).toBe('Unassigned');
  });
});
