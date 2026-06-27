/**
 * @jest-environment node
 */
import { normalizePortalEmail, buildPortalCredentialNotice } from '@/lib/portal-credentials.js';

describe('normalizePortalEmail', () => {
  test('lowercases and trims valid emails', () => {
    expect(normalizePortalEmail('  Admin@Example.COM ')).toBe('admin@example.com');
  });
  test('rejects values without an @', () => {
    expect(normalizePortalEmail('not-an-email')).toBe('');
    expect(normalizePortalEmail('')).toBe('');
    expect(normalizePortalEmail(null)).toBe('');
  });
});

describe('buildPortalCredentialNotice', () => {
  test('returns null without a usable email', () => {
    expect(buildPortalCredentialNotice({ email: 'bad', name: 'X', portal: 'staff' })).toBeNull();
  });

  test('generates a notice with email, temp password, and portal label', () => {
    const n = buildPortalCredentialNotice({ email: 'amara.koch@x.com', name: 'Amara Koch', portal: 'staff' });
    expect(n.loginEmail).toBe('amara.koch@x.com');
    expect(n.portal).toBe('staff portal');
    expect(n.title).toContain('Amara Koch');
    // temp password is "<localpart up to 8 alnum>-<8 hex>"
    expect(n.temporaryPassword).toMatch(/^[a-z0-9]{1,8}-[a-f0-9]{8}$/);
    // and it is explicitly not persisted
    expect(n.body).toMatch(/not stored/i);
  });

  test('temp passwords are non-deterministic', () => {
    const a = buildPortalCredentialNotice({ email: 'a@x.com', name: 'A', portal: 'resident' });
    const b = buildPortalCredentialNotice({ email: 'a@x.com', name: 'A', portal: 'resident' });
    expect(a.temporaryPassword).not.toBe(b.temporaryPassword);
    expect(a.portal).toBe('resident portal');
  });
});
