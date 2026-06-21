/**
 * Helpers for round-tripping the multi-step nursing-assessment draft between the
 * client's per-step state shape and the flat JSONB payload stored on the server.
 *
 * The wizard keeps its state as per-step buckets:
 *   formData = { 1: {...step1}, 2: {...step2}, ... 8: {...step8} }
 *
 * For the API + typed-column mapping + record-copy PDF, the draft is POSTed as a
 * FLAT field map (Object.assign of every bucket). The flat shape is lossy for
 * rehydration: once flattened, there is no field->step map to rebuild the
 * buckets, so a reopened draft used to dump every field into step 1 and leave
 * steps 2-8 empty (admission looked incomplete and could not be finished).
 *
 * Fix: persist the exact buckets alongside the flat blob under `__steps`, and
 * rebuild from them on load. Legacy drafts (saved before `__steps` existed) fall
 * back to keeping the flat blob in the first step so no data is silently lost.
 */

export const STEP_BUCKETS_KEY = '__steps';

/**
 * Reconstruct per-step buckets from a stored nursing_assessment_data blob.
 * @param {object|null|undefined} blob   the flat blob returned by the draft GET
 * @param {number[]} stepIds             ordered step ids, e.g. [1,2,...,8]
 * @returns {Object<number, object>}     { 1:{...}, 2:{...}, ... }
 */
export function bucketsFromBlob(blob, stepIds) {
  const loaded = Object.fromEntries(stepIds.map((id) => [id, {}]));
  if (!blob || typeof blob !== 'object') return loaded;

  const steps = blob[STEP_BUCKETS_KEY];
  if (steps && typeof steps === 'object') {
    // Preferred path: exact buckets were persisted. JSON object keys are
    // strings; numeric stepId property access coerces to string automatically.
    for (const id of stepIds) {
      const bucket = steps[id];
      if (bucket && typeof bucket === 'object') loaded[id] = { ...bucket };
    }
    return loaded;
  }

  // Legacy flat draft: no bucket map available. Keep every field (in the first
  // step) rather than dropping it — the user can re-touch later steps.
  const flat = { ...blob };
  delete flat[STEP_BUCKETS_KEY];
  loaded[stepIds[0]] = flat;
  return loaded;
}
