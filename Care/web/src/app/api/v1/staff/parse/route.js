import { requireUser, AuthError, authErrorResponse } from '@/lib/auth-guard.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { DocumentExtractError } from '@/lib/document-extract.js';
import { parseUpload } from '@/lib/ai-extract.js';
import {
  STAFF_ROLES,
  PRONOUN_OPTIONS,
  STAFF_STATUS_OPTIONS,
  EMPLOYMENT_TYPES,
  STAFF_SHIFTS,
  RELATION_OPTIONS,
  CREDENTIAL_STATUS,
} from '@/lib/staff-schema.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SYSTEM =
  'You extract a staff member profile for a care facility from the document — a resume/CV, employment ' +
  'application, onboarding form, or credential paperwork, which may be typed or handwritten. Read handwriting ' +
  'carefully. Only use values actually present; leave fields empty if not stated. For enum fields pick only ' +
  'from the allowed options. Dates must be YYYY-MM-DD.';

const buildSchema = (z) => {
  const s = () => z.string().nullish();
  const date = () => z.string().describe('YYYY-MM-DD').nullish();
  return z.object({
    firstName: s(), lastName: s(), preferredName: s(),
    pronouns: z.enum(PRONOUN_OPTIONS).nullish(),
    role: z.enum(STAFF_ROLES).describe('Best-fit job role').nullish(),
    employeeId: s(),
    status: z.enum(STAFF_STATUS_OPTIONS).nullish(),
    organizationName: s(), organizationId: s(), facilityName: s(), facilityId: s(),
    primaryArea: s(), reportsTo: s(),
    email: s(), phone: s(),
    employmentType: z.enum(EMPLOYMENT_TYPES).nullish(),
    shift: z.enum(STAFF_SHIFTS).nullish(),
    startDate: date(),
    emergencyContactName: s(), emergencyContactPhone: s(),
    emergencyContactRelation: z.enum(RELATION_OPTIONS).nullish(),
    notes: s(),
    credentials: z.array(z.object({
      label: z.string().describe('Credential or training name'),
      detail: s(),
      expiresOn: date(),
      status: z.enum(CREDENTIAL_STATUS).nullish(),
    })).default([]),
  });
};

// POST /api/v1/staff/parse   (multipart/form-data, field: file)
// Extracts a staff profile from an uploaded resume/application/credential doc
// (PDF/Word/image, incl. scanned or handwritten) to pre-fill the add-staff form.
// Gated on STAFF_WRITE.
export async function POST(request) {
  try {
    await requireUser(request, PERMISSIONS.STAFF_WRITE);
    const form = await request.formData().catch(() => null);

    const { upload, ...result } = await parseUpload({
      file: form?.get('file'),
      buildSchema,
      system: SYSTEM,
      visionPrompt: 'This is a staff resume, application, or onboarding document, possibly scanned or handwritten. Read all printed and handwritten entries and extract the staff profile fields and any credentials.',
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
