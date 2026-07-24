import { requireUser, AuthError, authErrorResponse } from '@/lib/auth-guard.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { DocumentExtractError } from '@/lib/document-extract.js';
import { parseUpload } from '@/lib/ai-extract.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SYSTEM =
  'You extract an incident report for an assisted-living resident from the document, which may be typed ' +
  'or handwritten — read handwriting carefully. Only use values present; leave fields empty if not stated. ' +
  'occurredAt must be ISO 8601 (YYYY-MM-DDTHH:mm) if a time is given, otherwise YYYY-MM-DD. ' +
  'followUpDueAt must be YYYY-MM-DD.';

const buildSchema = (z) =>
  z.object({
    incidentType: z.string().describe('Short incident type, e.g. Fall, Behavioral episode').nullish(),
    severity: z.enum(['low', 'moderate', 'high', 'critical']).nullish(),
    status: z.enum(['open', 'under_review', 'closed']).nullish(),
    summary: z.string().describe('What happened and immediate actions taken').nullish(),
    occurredAt: z.string().nullish(),
    followUpDueAt: z.string().nullish(),
  });

// POST /api/v1/incidents/parse  (multipart/form-data, field: file)
// Extracts an incident report from an uploaded PDF/Word/image (incl. scanned or
// handwritten) to pre-fill the incident form. Gated on SAFETY_WRITE.
export async function POST(request) {
  try {
    await requireUser(request, PERMISSIONS.SAFETY_WRITE);
    const form = await request.formData().catch(() => null);

    const { upload, ...result } = await parseUpload({
      file: form?.get('file'),
      buildSchema,
      system: SYSTEM,
      visionPrompt: 'This is a resident incident report, possibly scanned or handwritten. Read all printed and handwritten entries and extract the incident fields.',
    });

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
