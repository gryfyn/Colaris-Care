import { requireUser, AuthError, authErrorResponse } from '@/lib/auth-guard.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { DocumentExtractError } from '@/lib/document-extract.js';
import { parseUpload } from '@/lib/ai-extract.js';
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
// call (incl. vision OCR of a scanned/handwritten packet) can take a while.
export const runtime = 'nodejs';
export const maxDuration = 60;

const MODEL = process.env.ADMISSION_PARSE_MODEL || process.env.FORM_PARSE_MODEL || 'anthropic/claude-sonnet-4.5';
// Below this many characters of extractable digital text we treat the upload as
// scanned/handwritten and send the bytes to a vision model instead.
const MIN_DIGITAL_TEXT = 200;

const SYSTEM =
  'You extract structured admission data for an assisted-living resident from an admission packet ' +
  '(assessment, intake, face sheet, physician orders). The document may be typed or handwritten — ' +
  'read handwriting carefully and transcribe it. Only use values actually present; leave fields ' +
  'empty/null if not stated. For enum and checkbox fields pick only from the allowed options. ' +
  'Dates must be YYYY-MM-DD.';

function buildAdmissionSchema(z) {
  const s = () => z.string().nullish();
  const date = () => z.string().describe('YYYY-MM-DD').nullish();
  return z.object({
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
}

// POST /api/v1/admissions/parse   (multipart/form-data, field: file)
//
// Reads an uploaded admission packet — a digital PDF/Word doc, OR a scanned /
// handwritten PDF or photo (PNG/JPG) — and extracts the wizard fields. Digital
// text is parsed directly; when there's little/no extractable text the document
// bytes are sent to a vision model that OCRs the pages and reads handwriting.
export async function POST(request) {
  try {
    await requireUser(request, PERMISSIONS.ADMISSION_FORMS_WRITE);

    const form = await request.formData().catch(() => null);

    const { upload, ...result } = await parseUpload({
      file: form?.get('file'),
      buildSchema: buildAdmissionSchema,
      system: SYSTEM,
      model: MODEL,
      minText: MIN_DIGITAL_TEXT,
      maxChars: 60000,
      visionPrompt: 'This is a resident admission packet, possibly scanned or handwritten. Read all printed and handwritten entries and extract the admission fields.',
    });

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
