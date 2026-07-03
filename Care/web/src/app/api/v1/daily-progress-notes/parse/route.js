import { requireUser, AuthError, authErrorResponse } from '@/lib/auth-guard.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { extractDocumentText, DocumentExtractError } from '@/lib/document-extract.js';
import {
  normalizeNoteBody,
  MOOD_BEHAVIOR_OPTIONS,
  PHYSICAL_HEALTH_OPTIONS,
  MEDICATIONS_OPTIONS,
  ACTIVITIES_OPTIONS,
  SHIFT_VALUES,
} from '@/lib/progress-notes-schema.js';

// Node runtime: pdf-parse / mammoth need Node Buffers and file-system-free
// Node APIs. Allow up to a minute for extraction + the model call.
export const runtime = 'nodejs';
export const maxDuration = 60;

const DEFAULT_MODEL = process.env.PROGRESS_NOTE_PARSE_MODEL || 'anthropic/claude-haiku-4.5';

// POST /api/v1/daily-progress-notes/parse   (multipart/form-data, field: file)
//
// Extracts text from an uploaded PDF or Word doc and uses the Vercel AI Gateway
// to map it into the daily-progress-note fields, returning JSON that pre-fills
// the form. Never destructive: on any model/parse error it still returns the raw
// text in `progressNotes` so the user can finish manually.
export async function POST(request) {
  try {
    await requireUser(request, PERMISSIONS.PROGRESS_NOTES_WRITE);

    const form = await request.formData().catch(() => null);
    const { text } = await extractDocumentText(form?.get('file'));

    const result = await extractFields(text);
    return Response.json({ data: result });
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

// Uses the AI Gateway to structure the text. On any failure (missing key, bad
// model slug, timeout) it falls back to dumping the raw text into progressNotes.
async function extractFields(text) {
  const clipped = text.slice(0, 20000);
  try {
    const [{ generateObject }, { z }] = await Promise.all([import('ai'), import('zod')]);

    const schema = z.object({
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

    const { object } = await generateObject({
      model: DEFAULT_MODEL,
      schema,
      system:
        'You extract structured daily progress note data for an assisted-living resident from a scanned or typed note. ' +
        'Only use values that are actually present in the text. Leave fields empty if not stated. ' +
        'For checkbox fields pick only from the allowed options.',
      prompt: `Daily progress note document text:\n\n${clipped}`,
    });

    const { shift, noteDate, residentName, ...body } = object;
    return {
      parsed: true,
      noteBody: normalizeNoteBody(body),
      shift: SHIFT_VALUES.includes(shift) ? shift : null,
      noteDate: /^\d{4}-\d{2}-\d{2}$/.test(noteDate || '') ? noteDate : null,
      residentName: residentName || null,
    };
  } catch (err) {
    return {
      parsed: false,
      warning:
        'Automatic field extraction is unavailable, so the document text was placed in Progress Notes for you to review. ' +
        (process.env.AI_GATEWAY_API_KEY ? '' : '(AI_GATEWAY_API_KEY is not configured.)'),
      noteBody: normalizeNoteBody({ progressNotes: clipped }),
      shift: null,
      noteDate: null,
      residentName: null,
    };
  }
}
