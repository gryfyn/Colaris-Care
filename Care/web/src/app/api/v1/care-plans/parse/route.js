import { requireUser, AuthError, authErrorResponse } from '@/lib/auth-guard.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { extractDocumentText, DocumentExtractError } from '@/lib/document-extract.js';
import { extractStructured } from '@/lib/ai-extract.js';
import { REVIEW_CYCLES, GOAL_PROGRESS } from '@/lib/care-plan-schema.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

// POST /api/v1/care-plans/parse  (multipart/form-data, field: file)
// Extracts a care plan from an uploaded PDF/Word document to pre-fill the new
// care-plan form. Gated on CARE_PLANS_CREATE; graceful fallback keeps manual entry.
export async function POST(request) {
  try {
    await requireUser(request, PERMISSIONS.CARE_PLANS_CREATE);
    const form = await request.formData().catch(() => null);
    const { text } = await extractDocumentText(form?.get('file'));

    const result = await extractStructured({
      text,
      system:
        'You extract a resident care plan from the document text. Only use values present in the text; ' +
        'leave fields empty if not stated. Dates must be YYYY-MM-DD. For goal progress and review cycle ' +
        'pick only from the allowed options.',
      buildSchema: (z) =>
        z.object({
          title: z.string().describe('Plan focus / title').nullish(),
          summary: z.string().describe('Short narrative of the plan focus').nullish(),
          owner: z.string().nullish(),
          reviewCycle: z.enum(REVIEW_CYCLES).nullish(),
          reviewedAt: z.string().describe('YYYY-MM-DD').nullish(),
          nextReviewAt: z.string().describe('YYYY-MM-DD').nullish(),
          goals: z.array(z.object({
            title: z.string(),
            progress: z.enum(GOAL_PROGRESS).nullish(),
          })).default([]),
          objectives: z.array(z.object({
            title: z.string(),
            goal: z.string().describe('Linked goal').nullish(),
            cadence: z.string().nullish(),
          })).default([]),
          interventions: z.array(z.object({
            title: z.string(),
            owner: z.string().nullish(),
            frequency: z.string().nullish(),
          })).default([]),
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
