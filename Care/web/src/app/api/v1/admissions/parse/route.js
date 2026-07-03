import { requireUser, AuthError, authErrorResponse } from '@/lib/auth-guard.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { extractDocumentText, DocumentExtractError } from '@/lib/document-extract.js';
import {
  CONDITION_OPTIONS,
  BEHAVIORAL_CONCERNS,
  ADL_ITEMS,
  ADL_LEVELS,
  GENDER_OPTIONS,
  MOBILITY_OPTIONS,
  COMMUNICATION_OPTIONS,
  OBSERVATION_LEVELS,
  REFERRAL_SOURCES,
  DNR_OPTIONS,
  YES_NO_UNKNOWN,
  DIRECTIVE_UPLOADED,
  ALLERGY_SEVERITY,
} from '@/lib/admission-schema.js';

// Node runtime: pdf-parse / mammoth need Node Buffers. Extraction + one model
// call over a full admission packet can take a while.
export const runtime = 'nodejs';
export const maxDuration = 60;

const DEFAULT_MODEL = process.env.ADMISSION_PARSE_MODEL || process.env.PROGRESS_NOTE_PARSE_MODEL || 'anthropic/claude-sonnet-4.5';

// POST /api/v1/admissions/parse   (multipart/form-data, field: file)
//
// Reads an uploaded admission packet (PDF/Word) and uses the Vercel AI Gateway
// to extract the wizard fields, so admission can be completed by upload instead
// of manual entry. The client merges the result over its state and the user
// reviews before submitting. On any model failure it returns parsed:false and
// the caller keeps manual entry.
export async function POST(request) {
  try {
    await requireUser(request, PERMISSIONS.ADMISSION_FORMS_WRITE);

    const form = await request.formData().catch(() => null);
    const { text } = await extractDocumentText(form?.get('file'));

    const result = await extractAdmission(text);
    return Response.json({ data: result });
  } catch (err) {
    if (err instanceof DocumentExtractError) {
      return Response.json({ error: err.message, code: 'PARSE_ERROR' }, { status: err.status });
    }
    if (err instanceof AuthError || err?.status === 401 || err?.status === 403) {
      return authErrorResponse(err);
    }
    return Response.json({ error: 'Failed to parse admission document', code: 'PARSE_ERROR' }, { status: 500 });
  }
}

async function extractAdmission(text) {
  const clipped = text.slice(0, 60000);
  try {
    const [{ generateObject }, { z }] = await Promise.all([import('ai'), import('zod')]);

    const s = () => z.string().nullish();
    const date = () => z.string().describe('YYYY-MM-DD').nullish();

    const schema = z.object({
      firstName: s(), middleName: s(), lastName: s(), preferredName: s(),
      dob: date(),
      gender: z.enum(GENDER_OPTIONS).nullish(),
      pronouns: s(), phone: s(), email: s(), currentAddress: s(),
      emergencyName: s(), emergencyRelationship: s(), emergencyPhone: s(), emergencyEmail: s(),
      admissionDate: date(), expectedDischarge: date(),
      facility: s(), roomAssignment: s(),
      referralSource: z.enum(REFERRAL_SOURCES).nullish(),
      caseManager: s(),
      primaryDiagnoses: z.array(z.string()).default([]),
      secondaryDiagnoses: z.array(z.string()).default([]),
      mentalHealthDiagnoses: z.array(z.string()).default([]),
      allergies: z.array(z.object({
        allergen: s(),
        reaction: s(),
        severity: z.enum(ALLERGY_SEVERITY).nullish(),
      })).default([]),
      medications: z.array(z.object({
        medication: s(), dose: s(), frequency: s(), route: s(), startDate: date(),
      })).default([]),
      conditions: z.array(z.enum(CONDITION_OPTIONS)).default([]),
      behavioralConcerns: z.array(z.enum(BEHAVIORAL_CONCERNS)).default([]),
      mobility: z.enum(MOBILITY_OPTIONS).nullish(),
      communication: z.enum(COMMUNICATION_OPTIONS).nullish(),
      observationLevel: z.enum(OBSERVATION_LEVELS).nullish(),
      adls: z.object(Object.fromEntries(ADL_ITEMS.map((item) => [item, z.enum(ADL_LEVELS).nullish()]))).nullish(),
      goals: z.array(z.string()).default([]),
      interventions: z.array(z.string()).default([]),
      restrictions: z.array(z.string()).default([]),
      advanceDirectiveExists: z.enum(YES_NO_UNKNOWN).nullish(),
      dnrStatus: z.enum(DNR_OPTIONS).nullish(),
      healthCareAgent: s(), healthCareAgentPhone: s(), preferredHospital: s(),
      advanceDirectiveUploaded: z.enum(DIRECTIVE_UPLOADED).nullish(),
    });

    const { object } = await generateObject({
      model: DEFAULT_MODEL,
      schema,
      system:
        'You extract structured admission data for an assisted-living resident from an admission packet ' +
        '(assessment, intake, face sheet, physician orders). Only use values actually present in the text; ' +
        'leave fields empty/null if not stated. For enum and checkbox fields pick only from the allowed options. ' +
        'Dates must be YYYY-MM-DD.',
      prompt: `Admission document text:\n\n${clipped}`,
    });

    return { parsed: true, fields: object };
  } catch (err) {
    return {
      parsed: false,
      fields: {},
      warning:
        'Automatic extraction is unavailable, so please complete the admission fields manually (the file is still attached as the Admission Assessment document). ' +
        (process.env.AI_GATEWAY_API_KEY ? '' : '(AI_GATEWAY_API_KEY is not configured.)'),
    };
  }
}
