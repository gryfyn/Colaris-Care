import { statusTone, displayDate } from '@/lib/client-api';

describe('statusTone', () => {
  test('maps known statuses to semantic tones', () => {
    expect(statusTone('active')).toBe('green');
    expect(statusTone('completed')).toBe('green');
    expect(statusTone('pending')).toBe('amber');
    expect(statusTone('due')).toBe('amber');
    expect(statusTone('draft')).toBe('gray');
    expect(statusTone('discharged')).toBe('gray');
    expect(statusTone('critical')).toBe('red');
    expect(statusTone('refused')).toBe('red');
  });
  test('is case-insensitive and defaults to blue', () => {
    expect(statusTone('ACTIVE')).toBe('green');
    expect(statusTone('something-unknown')).toBe('blue');
    expect(statusTone(null)).toBe('blue');
  });
});

describe('displayDate', () => {
  test('formats a date value', () => {
    expect(displayDate('2026-06-15')).toMatch(/2026/);
  });
  test('returns the fallback for empty values', () => {
    expect(displayDate(null)).toBe('Not recorded');
    expect(displayDate('', 'Pending')).toBe('Pending');
    expect(displayDate(undefined, 'N/A')).toBe('N/A');
  });
});
