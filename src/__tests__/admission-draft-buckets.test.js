import { bucketsFromBlob, STEP_BUCKETS_KEY } from '@/lib/admission-draft';

/**
 * Regression guard for the "resumed nursing draft loses steps 2-8" bug.
 *
 * The wizard saves a FLAT blob (every step's fields merged) for typed-column
 * mapping. Before the fix, reopening that draft dumped the whole flat blob into
 * step 1 and left steps 2-8 empty, so the admission looked incomplete and could
 * not be finished. The fix persists the per-step buckets under `__steps`; this
 * test pins the round-trip so a future flatten-only regression fails loudly.
 */
const STEP_IDS = [1, 2, 3, 4, 5, 6, 7, 8];

describe('bucketsFromBlob — nursing draft round-trip', () => {
  test('rebuilds every step bucket from the persisted __steps map', () => {
    const original = {
      1: { name: 'VerifyTest, Margaret', age: '71', gender: 'Female' },
      2: { temperature: '98.6', height: `5'8"`, weightActual: '145', noKnownAllergies: true },
      3: { fluVaxConsent: 'N/A (May–Sept)' },
      4: { painPresent: 'No', sleepHours: '7', sleepMedication: 'No' },
      5: {}, 6: {}, 7: {}, 8: {},
    };

    // Mimic what handleSaveDraft persists: flat fields + typed cols + __steps.
    const flat = Object.assign({}, ...Object.values(original));
    const blob = { ...flat, vital_temperature: 98.6, [STEP_BUCKETS_KEY]: original };

    const rebuilt = bucketsFromBlob(blob, STEP_IDS);

    // Step 2 (the field that used to vanish) survives intact.
    expect(rebuilt[2]).toEqual(original[2]);
    expect(rebuilt[2].height).toBe(`5'8"`);
    // Every bucket round-trips.
    expect(rebuilt).toEqual(original);
    // The bookkeeping key never leaks into a bucket.
    expect(rebuilt[1][STEP_BUCKETS_KEY]).toBeUndefined();
  });

  test('legacy flat blob (no __steps) keeps all fields instead of dropping them', () => {
    const legacy = { name: 'Old Draft', temperature: '99.1', sleepHours: '6' };
    const rebuilt = bucketsFromBlob(legacy, STEP_IDS);

    // Nothing is lost; flat fields land in step 1 as best-effort.
    expect(rebuilt[1]).toEqual(legacy);
    expect(rebuilt[2]).toEqual({});
  });

  test('null / non-object blob yields empty buckets for every step', () => {
    expect(bucketsFromBlob(null, STEP_IDS)).toEqual(
      Object.fromEntries(STEP_IDS.map((id) => [id, {}]))
    );
    expect(bucketsFromBlob(undefined, [1, 2])).toEqual({ 1: {}, 2: {} });
  });
});
