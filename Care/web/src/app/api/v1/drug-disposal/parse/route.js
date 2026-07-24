import { requireUser, AuthError, authErrorResponse } from '@/lib/auth-guard.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { DocumentExtractError } from '@/lib/document-extract.js';
import { parseUpload } from '@/lib/ai-extract.js';
import { DISPOSAL_STATUS } from '@/lib/drug-disposal-schema.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SYSTEM =
  'You extract fields from a medication disposal / destruction log; the document may be typed or handwritten -- read handwriting; only use values actually present, leave others null.';

const visionPrompt =
  'This is a medication disposal / destruction log, possibly scanned or handwritten. Read all printed and handwritten entries and extract only the disposal fields that are present.';

const buildSchema = (z) =>
  z.object({
    medicationName: z.string().nullish(),
    quantity: z.string().nullish(),
    reason: z.string().nullish(),
    status: z.enum(DISPOSAL_STATUS).nullish(),
    witnessName: z.string().nullish(),
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
