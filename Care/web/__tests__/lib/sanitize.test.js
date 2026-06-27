import { sanitizeText, sanitizeNoteBody, sanitizeFields } from '@/lib/sanitize.js';

describe('sanitizeText', () => {
  test('strips all HTML tags', () => {
    const out = sanitizeText('<b>Hello</b> <i>world</i>');
    expect(out).not.toContain('<');
    expect(out).not.toContain('>');
    expect(out).toContain('Hello');
    expect(out).toContain('world');
  });

  test('removes a full malicious tag entirely', () => {
    expect(sanitizeText('<img src=x onerror=alert(1)>')).toBe('');
    expect(sanitizeText('<script>alert(1)</script>')).not.toContain('script');
  });

  test('strips dangerous URI schemes and event handlers', () => {
    expect(sanitizeText('javascript:alert(1)')).not.toMatch(/javascript:/i);
    expect(sanitizeText('data:text/html,evil')).not.toMatch(/data:/i);
    expect(sanitizeText('onerror=alert(1)')).not.toMatch(/onerror=/i);
  });

  test('decodes common HTML entities and handles nullish/non-strings', () => {
    expect(sanitizeText('a &amp; b &lt;tag&gt;')).toBe('a & b <tag>');
    expect(sanitizeText(null)).toBe('');
    expect(sanitizeText(undefined)).toBe('');
    expect(sanitizeText(12345)).toBe('12345');
  });
});

describe('sanitizeNoteBody', () => {
  test('sanitizes a string note and each string field of an object note', () => {
    expect(sanitizeNoteBody('<b>note</b>')).toBe('note');
    const obj = sanitizeNoteBody({ subjective: '<script>x</script>S', count: 3 });
    expect(obj.subjective).not.toContain('<');
    expect(obj.count).toBe(3); // non-strings preserved
  });
  test('passes through falsy values', () => {
    expect(sanitizeNoteBody(null)).toBeNull();
    expect(sanitizeNoteBody('')).toBe('');
  });
});

describe('sanitizeFields', () => {
  test('sanitizes only the named string fields, leaving others intact', () => {
    const out = sanitizeFields({ summary: '<b>hi</b>', room: 'A1', n: 5 }, ['summary', 'n']);
    expect(out.summary).toBe('hi');
    expect(out.room).toBe('A1');
    expect(out.n).toBe(5);
  });
  test('returns non-objects unchanged', () => {
    expect(sanitizeFields(null, ['x'])).toBeNull();
    expect(sanitizeFields('str', ['x'])).toBe('str');
  });
});
