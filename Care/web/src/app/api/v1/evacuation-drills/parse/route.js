import { requireUser, AuthError, authErrorResponse } from '@/lib/auth-guard.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { DocumentExtractError } from '@/lib/document-extract.js';
import { parseUpload } from '@/lib/ai-extract.js';
import { DRILL_STATUS } from '@/lib/evacuation-drill-schema.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SYSTEM =
  'You extract fields from an emergency evacuation / fire drill log; the document may be typed or handwritten -- read handwriting; only use values actually present, leave others null.';

const visionPrompt =
  'This is an emergency evacuation / fire drill log, possibly scanned or handwritten. Read all printed and handwritten entries and extract only the drill fields that are present.';

const buildSchema = (z) =>
  z.object({
    drillType: z.string().nullish(),
    occurredAt: z.string().describe('ISO 8601 datetime').nullish(),
    durationMinutes: z.number().nullish(),
    status: z.enum(DRILL_STATUS).nullish(),
    summary: z.string().nullish(),
  });

export async function POST(request) {
  try {
    await requireUser(request, PERMISSIONS.SAFETY_WRITE);
    const form = await request.formData().catch(() => null);

    const { upload, ...result } = await parseUpload({
      file: form?.get('file'),
      buildSchema,
      system: SYSTEM,
      model: process.env.FORM_PARSE_MODEL || 'anthropic/claude-sonnet-4.5',
      visionPrompt,
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
