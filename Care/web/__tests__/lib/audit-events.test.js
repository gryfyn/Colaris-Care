import { sanitizeAuditMetadata } from '@/lib/audit-events.js';

// The audit log must never capture PHI/free-form data. sanitizeAuditMetadata
// enforces an allowlist of keys AND only scalar (or scalar-array) values.
describe('sanitizeAuditMetadata', () => {
  test('keeps allowlisted keys with scalar values', () => {
    const out = sanitizeAuditMetadata({ residentId: 'r1', status: 'active', count: 3, action: 'x' });
    expect(out).toEqual({ residentId: 'r1', status: 'active', count: 3, action: 'x' });
  });

  test('drops keys that are not on the allowlist (e.g. PHI-ish fields)', () => {
    const out = sanitizeAuditMetadata({ email: 'a@b.com', name: 'Jane Doe', ssn: '1234', notes: 'free text', residentId: 'r1' });
    expect(out).toEqual({ residentId: 'r1' });
    expect(out).not.toHaveProperty('email');
    expect(out).not.toHaveProperty('name');
    expect(out).not.toHaveProperty('ssn');
  });

  test('drops non-scalar values even for allowlisted keys', () => {
    const out = sanitizeAuditMetadata({ residentId: { nested: 'object' }, status: 'ok' });
    expect(out).toEqual({ status: 'ok' });
  });

  test('allows arrays of scalars but rejects arrays of objects', () => {
    const out = sanitizeAuditMetadata({ residentIds: ['a', 'b'], ids: [{ x: 1 }] });
    expect(out.residentIds).toEqual(['a', 'b']);
    expect(out).not.toHaveProperty('ids');
  });

  test('handles empty / nullish input', () => {
    expect(sanitizeAuditMetadata()).toEqual({});
    expect(sanitizeAuditMetadata(null)).toEqual({});
  });
});
