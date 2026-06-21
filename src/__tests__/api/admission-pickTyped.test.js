import { pickTyped } from '@/app/api/v1/admission/forms/route';

/**
 * Regression guard for the "Step 2 submission failed" bug.
 *
 * The nursing-assessment form sends BOTH the raw free-text field (e.g.
 * height = "5'8\"") AND the client-coerced typed column (height_inches = 68).
 * pickTyped must let the typed column win, otherwise the raw string is written
 * into the NUMERIC(5,2) height_inches column and Postgres rejects it with
 * `invalid input syntax for type numeric`.
 */
describe('pickTyped — typed columns win over raw field aliases', () => {
  test('parsed height_inches is not clobbered by raw height string', () => {
    const out = pickTyped(
      { height: `5'8"`, height_inches: 68, height_raw: `5'8"` },
      'nursing-assessment'
    );
    expect(out.height_inches).toBe(68);
    expect(typeof out.height_inches).toBe('number');
  });

  test('numeric vitals come through as numbers, not raw strings', () => {
    const out = pickTyped(
      {
        temperature: '98.6', vital_temperature: 98.6,
        pulse: '72', vital_pulse: 72,
        o2Sat: '98', vital_oxygen: 98,
      },
      'nursing-assessment'
    );
    expect(out.vital_temperature).toBe(98.6);
    expect(out.vital_pulse).toBe(72);
    expect(out.vital_oxygen).toBe(98);
  });

  test('painPresent ("Yes"/"No") never lands in the INT pain_level column', () => {
    const out = pickTyped(
      { painPresent: 'Yes', pain_level: 0 },
      'nursing-assessment'
    );
    expect(out.pain_level).toBe(0);
    expect(out.pain_level).not.toBe('Yes');
  });

  test('raw aliases still fill columns the client did not provide typed', () => {
    // No full_name typed column supplied → the name alias should populate it.
    const out = pickTyped({ name: 'Doe, Jane' }, 'nursing-assessment');
    expect(out.full_name).toBe('Doe, Jane');
  });

  test('null typed value is preserved (not overwritten by raw alias)', () => {
    const out = pickTyped(
      { height: 'unparseable', height_inches: null },
      'nursing-assessment'
    );
    expect(out.height_inches).toBeNull();
  });
});
