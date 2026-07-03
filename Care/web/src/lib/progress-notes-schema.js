// Single source of truth for the Daily Progress Notes field set.
//
// Copied field-for-field from the DCLLC daily progress notes form so the Colaris
// form, the admin detail view, the PDF export, and the AI upload parser all stay
// in lockstep. Framework-agnostic (no React / no zod) so it is safe to import in
// both client components and server routes.

export const SHIFTS = [
  { value: 'morning', label: 'Morning (6am - 2pm)' },
  { value: 'afternoon', label: 'Afternoon (2pm - 10pm)' },
  { value: 'night', label: 'Night (10pm - 6am)' },
];

export const SHIFT_VALUES = SHIFTS.map((s) => s.value);

export const MOOD_BEHAVIOR_OPTIONS = ['Alert', 'Withdrawn', 'Agitated', 'Cooperative', 'Other'];
export const PHYSICAL_HEALTH_OPTIONS = ['Stable', 'Improved', 'Declined'];
export const MEDICATIONS_OPTIONS = ['Morning', 'Noon', 'Evening', 'Bedtime', 'PRN'];
export const ACTIVITIES_OPTIONS = ['Physical', 'Recreational', 'Social', 'Cognitive', 'Therapeutic'];

// Ordered sections used to render the form, the admin detail view and the PDF.
// `kind`: long | checks | percent | text ; `options` for checks fields.
export const NOTE_SECTIONS = [
  {
    title: 'Progress Notes',
    fields: [{ key: 'progressNotes', label: 'Progress Notes', kind: 'long', required: true }],
  },
  {
    title: 'Mood & Behavior',
    fields: [{ key: 'moodBehavior', label: 'Observed Mood/Behavior', kind: 'checks', options: MOOD_BEHAVIOR_OPTIONS }],
  },
  {
    title: 'Physical Health',
    fields: [{ key: 'physicalHealth', label: 'Health Status', kind: 'checks', options: PHYSICAL_HEALTH_OPTIONS }],
  },
  {
    title: 'Medications Administered',
    fields: [{ key: 'medicationsAdministered', label: 'Medications Given', kind: 'checks', options: MEDICATIONS_OPTIONS }],
  },
  {
    title: 'Meal Intake',
    fields: [
      { key: 'mealsBreakfast', label: 'Breakfast %', kind: 'percent', suffix: '%' },
      { key: 'mealsBreakfastNotes', label: 'Breakfast Notes', kind: 'text' },
      { key: 'mealsLunch', label: 'Lunch %', kind: 'percent', suffix: '%' },
      { key: 'mealsLunchNotes', label: 'Lunch Notes', kind: 'text' },
      { key: 'mealsDinner', label: 'Dinner %', kind: 'percent', suffix: '%' },
      { key: 'mealsDinnerNotes', label: 'Dinner Notes', kind: 'text' },
    ],
  },
  {
    title: 'Activities',
    fields: [{ key: 'activitiesParticipated', label: 'Activities Participated', kind: 'checks', options: ACTIVITIES_OPTIONS }],
  },
  {
    title: 'Incidents & Concerns',
    fields: [{ key: 'incidents', label: 'Incidents or Concerns', kind: 'long' }],
  },
];

// Flat list of every body field, in section order.
export const NOTE_FIELDS = NOTE_SECTIONS.flatMap((s) => s.fields);

const CHECK_KEYS = NOTE_FIELDS.filter((f) => f.kind === 'checks').map((f) => f.key);

export function emptyNoteBody() {
  const body = {};
  for (const field of NOTE_FIELDS) {
    body[field.key] = field.kind === 'checks' ? [] : '';
  }
  return body;
}

// Coerce arbitrary stored / parsed input into the canonical shape: check fields
// are always arrays of known option values, everything else a string.
export function normalizeNoteBody(input) {
  let raw = input;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = { progressNotes: input };
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) raw = {};

  const body = emptyNoteBody();
  for (const field of NOTE_FIELDS) {
    const value = raw[field.key];
    if (field.kind === 'checks') {
      const list = Array.isArray(value) ? value : value ? [value] : [];
      const allowed = new Set(field.options);
      body[field.key] = list.map((v) => String(v).trim()).filter((v) => allowed.has(v));
    } else if (value !== undefined && value !== null) {
      body[field.key] = String(value);
    }
  }
  return body;
}

export function shiftLabel(value) {
  return SHIFTS.find((s) => s.value === value)?.label || value || '—';
}

// Human-readable value for a single field (used by admin detail + PDF).
export function formatFieldValue(field, value) {
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  if (value === null || value === undefined || value === '') return '—';
  const text = String(value);
  return field?.suffix && text !== '—' ? `${text}${field.suffix}` : text;
}

export { CHECK_KEYS };
