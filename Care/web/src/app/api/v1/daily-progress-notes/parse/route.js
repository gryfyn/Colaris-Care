import { requireUser, AuthError, authErrorResponse } from '@/lib/auth-guard.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { DocumentExtractError } from '@/lib/document-extract.js';
import { parseUpload } from '@/lib/ai-extract.js';
import {
  normalizeNoteBody,
  MOOD_BEHAVIOR_OPTIONS,
  PHYSICAL_HEALTH_OPTIONS,
  MEDICATIONS_OPTIONS,
  ACTIVITIES_OPTIONS,
  SHIFT_VALUES,
} from '@/lib/progress-notes-schema.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MODEL = process.env.PROGRESS_NOTE_PARSE_MODEL || process.env.FORM_PARSE_MODEL || 'anthropic/claude-haiku-4.5';

const SYSTEM =
  'You extract structured daily progress note data for an assisted-living resident from a scanned, typed, or ' +
  'handwritten note — read handwriting carefully. Only use values actually present; leave fields empty if not ' +
  'stated. For checkbox fields pick only from the allowed options.';

const buildSchema = (z) =>
  z.object({
    progressNotes: z.string().describe('Main narrative progress note text').default(''),
    moodBehavior: z.array(z.enum(MOOD_BEHAVIOR_OPTIONS)).default([]),
    physicalHealth: z.array(z.enum(PHYSICAL_HEALTH_OPTIONS)).default([]),
    medicationsAdministered: z.array(z.enum(MEDICATIONS_OPTIONS)).default([]),
    mealsBreakfast: z.string().describe('Breakfast intake percentage, digits only').default(''),
    mealsBreakfastNotes: z.string().default(''),
    mealsLunch: z.string().describe('Lunch intake percentage, digits only').default(''),
    mealsLunchNotes: z.string().default(''),
    mealsDinner: z.string().describe('Dinner intake percentage, digits only').default(''),
    mealsDinnerNotes: z.string().default(''),
    activitiesParticipated: z.array(z.enum(ACTIVITIES_OPTIONS)).default([]),
    incidents: z.string().default(''),
    shift: z.enum(SHIFT_VALUES).nullish(),
    noteDate: z.string().describe('Note date as YYYY-MM-DD if present').nullish(),
    residentName: z.string().nullish(),
  });

// POST /api/v1/daily-progress-notes/parse   (multipart/form-data, field: file)
//
// Extracts a daily progress note from an uploaded PDF/Word/image (incl. scanned
// or handwritten) to pre-fill the form. Never destructive: on failure it returns
// any extracted text in progressNotes so the user can finish manually.
export async function POST(request) {
  try {
    await requireUser(request, PERMISSIONS.PROGRESS_NOTES_WRITE);
    const form = await request.formData().catch(() => null);

    const { upload, ...result } = await parseUpload({
      file: form?.get('file'),
      buildSchema,
      system: SYSTEM,
      model: MODEL,
      visionPrompt: 'This is a resident daily progress note, possibly scanned or handwritten. Read all printed and handwritten entries and extract the fields.',
    });

    if (result.parsed) {
      const { shift, noteDate, residentName, ...body } = result.fields;
      return Response.json({
        data: {
          parsed: true,
          noteBody: normalizeNoteBody(body),
          shift: SHIFT_VALUES.includes(shift) ? shift : null,
          noteDate: /^\d{4}-\d{2}-\d{2}$/.test(noteDate || '') ? noteDate : null,
          residentName: residentName || null,
        },
      });
    }

    const fallbackText = upload?.text ? upload.text.slice(0, 20000) : '';
    return Response.json({
      data: {
        parsed: false,
        warning: result.warning,
        noteBody: normalizeNoteBody(fallbackText ? { progressNotes: fallbackText } : {}),
        shift: null,
        noteDate: null,
        residentName: null,
      },
    });
  } catch (err) {
    if (err instanceof DocumentExtractError) {
      return Response.json({ error: err.message, code: 'PARSE_ERROR' }, { status: err.status });
    }
    if (err instanceof AuthError || err?.status === 401 || err?.status === 403) {
      return authErrorResponse(err);
    }
    return Response.json({ error: 'Failed to parse document', code: 'PARSE_ERROR' }, { status: 500 });
  }
}
