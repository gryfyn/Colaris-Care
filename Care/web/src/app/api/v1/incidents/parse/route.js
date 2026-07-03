import { requireUser, AuthError, authErrorResponse } from '@/lib/auth-guard.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { extractDocumentText, DocumentExtractError } from '@/lib/document-extract.js';
import { extractStructured } from '@/lib/ai-extract.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

// POST /api/v1/incidents/parse  (multipart/form-data, field: file)
// Extracts an incident report from an uploaded PDF/Word document to pre-fill the
// incident form. Gated on SAFETY_WRITE; graceful fallback keeps manual entry.
export async function POST(request) {
  try {
    await requireUser(request, PERMISSIONS.SAFETY_WRITE);
    const form = await request.formData().catch(() => null);
    const { text } = await extractDocumentText(form?.get('file'));

    const result = await extractStructured({
      text,
      system:
        'You extract an incident report for an assisted-living resident from the document text. ' +
        'Only use values present in the text; leave fields empty if not stated. ' +
        'occurredAt must be ISO 8601 (YYYY-MM-DDTHH:mm) if a time is given, otherwise YYYY-MM-DD. ' +
        'followUpDueAt must be YYYY-MM-DD.',
      buildSchema: (z) =>
        z.object({
          incidentType: z.string().describe('Short incident type, e.g. Fall, Behavioral episode').nullish(),
          severity: z.enum(['low', 'moderate', 'high', 'critical']).nullish(),
          status: z.enum(['open', 'under_review', 'closed']).nullish(),
          summary: z.string().describe('What happened and immediate actions taken').nullish(),
          occurredAt: z.string().nullish(),
          followUpDueAt: z.string().nullish(),
          residentName: z.string().nullish(),
        }),
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
