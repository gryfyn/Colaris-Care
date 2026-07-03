// Shared option lists + parsed-payload merge for the care-plan form.
// Framework-agnostic (no React/zod); imported by the new-care-plan form and the
// care-plan upload parser.

export const REVIEW_CYCLES = ['Weekly', 'Monthly', 'Quarterly', 'Biannual', 'Annual', 'As needed'];
export const GOAL_PROGRESS = ['On track', 'In progress', 'At risk', 'Met'];

const str = (val) => (typeof val === 'string' ? val.trim() : val == null ? '' : String(val).trim());
const isDate = (val) => /^\d{4}-\d{2}-\d{2}$/.test(str(val));

// Merge an AI-parsed care plan over the current form state. Only overwrites a
// field when the parser supplied a usable value; the user reviews before saving.
export function mergeParsedCarePlan(current, fields) {
  if (!fields || typeof fields !== 'object') return current;
  const out = { ...current };

  const setStr = (key, val) => { const s = str(val); if (s) out[key] = s; };
  const setEnum = (key, val, allowed) => { const s = str(val); if (s && allowed.includes(s)) out[key] = s; };
  const setDate = (key, val) => { if (isDate(val)) out[key] = str(val); };

  setStr('title', fields.title);
  setStr('summary', fields.summary);
  setStr('owner', fields.owner);
  setEnum('reviewCycle', fields.reviewCycle, REVIEW_CYCLES);
  setDate('reviewedAt', fields.reviewedAt);
  setDate('nextReviewAt', fields.nextReviewAt);

  if (Array.isArray(fields.goals)) {
    const rows = fields.goals
      .map((g) => ({
        title: str(g?.title),
        progress: GOAL_PROGRESS.includes(str(g?.progress)) ? str(g?.progress) : 'On track',
      }))
      .filter((g) => g.title);
    if (rows.length) out.goals = rows;
  }
  if (Array.isArray(fields.objectives)) {
    const rows = fields.objectives
      .map((o) => ({ title: str(o?.title), goal: str(o?.goal), cadence: str(o?.cadence) }))
      .filter((o) => o.title);
    if (rows.length) out.objectives = rows;
  }
  if (Array.isArray(fields.interventions)) {
    const rows = fields.interventions
      .map((i) => ({ title: str(i?.title), owner: str(i?.owner), frequency: str(i?.frequency) }))
      .filter((i) => i.title);
    if (rows.length) out.interventions = rows;
  }

  return out;
}
