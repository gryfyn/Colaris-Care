import { requireUser, AuthError, authErrorResponse } from '@/lib/auth-guard.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { DocumentExtractError } from '@/lib/document-extract.js';
import { parseUpload } from '@/lib/ai-extract.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SYSTEM =
  'You extract a single medication order for an assisted-living resident from the document, which may be typed ' +
  'or handwritten. Read handwriting carefully. If several medications are listed, extract the first/primary one. ' +
  'Only use values present; leave fields empty if not stated.';

const buildSchema = (z) =>
  z.object({
    name: z.string().describe('Drug name').nullish(),
    dosage: z.string().describe('e.g. 50 mg').nullish(),
    route: z.string().describe('e.g. Oral').nullish(),
    frequency: z.string().describe('e.g. Daily, BID').nullish(),
    prescriber: z.string().describe('Prescribing clinician name').nullish(),
  });

// POST /api/v1/medications/parse  (multipart/form-data, field: file)
// Extracts a single medication order from an uploaded PDF/Word/image (e.g. a
// physician order or medication list) to pre-fill the prescribe-medication form.
// Gated on SAFETY_WRITE; graceful fallback keeps manual entry.
export async function POST(request) {
  try {
    await requireUser(request, PERMISSIONS.SAFETY_WRITE);
    const form = await request.formData().catch(() => null);

    const { upload, ...result } = await parseUpload({
      file: form?.get('file'),
      buildSchema,
      system: SYSTEM,
      visionPrompt: 'This is a resident medication order or medication list, possibly scanned or handwritten. Read all printed and handwritten entries and extract the medication order fields.',
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
