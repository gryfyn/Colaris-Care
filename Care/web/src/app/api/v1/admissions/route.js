import crypto from 'crypto';
import { PERMISSIONS } from '@/lib/roles.js';
import { readJson, withApiContext } from '@/lib/api-helpers.js';
import { recordAuditEvent } from '@/lib/audit-events.js';
import { buildPortalCredentialNotice } from '@/lib/portal-credentials.js';
import { mapAdmission } from '@/lib/admissions.js';

function mapResident(row) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    name: `${row.first_name} ${row.last_name}`,
    dateOfBirth: row.date_of_birth,
    room: row.room,
    careLevel: row.care_level,
    status: row.status,
    admittedAt: row.admitted_at,
    dischargedAt: row.discharged_at,
    version: row.version,
  };
}

function toDate(value) {
  return value ? new Date(value) : null;
}

function buildAdmissionAnswers(body) {
  return {
    firstName: body.firstName || '',
    middleName: body.middleName || '',
    lastName: body.lastName || '',
    preferredName: body.preferredName || '',
    dob: body.dob || body.dateOfBirth || '',
    gender: body.gender || '',
    pronouns: body.pronouns || '',
    phone: body.phone || '',
    email: body.email || '',
    currentAddress: body.currentAddress || '',
    emergencyName: body.emergencyName || '',
    emergencyRelationship: body.emergencyRelationship || '',
    emergencyPhone: body.emergencyPhone || '',
    emergencyEmail: body.emergencyEmail || '',
    admissionDate: body.admissionDate || body.admittedAt || '',
    expectedDischarge: body.expectedDischarge || '',
    facility: body.facility || '',
    roomAssignment: body.roomAssignment || body.room || '',
    referralSource: body.referralSource || '',
    caseManager: body.caseManager || '',
    primaryDiagnoses: body.primaryDiagnoses || [],
    secondaryDiagnoses: body.secondaryDiagnoses || [],
    allergies: body.allergies || [],
    conditions: body.conditions || [],
    medications: body.medications || [],
    mobility: body.mobility || '',
    adls: body.adls || {},
    communication: body.communication || '',
    mentalHealthDiagnoses: body.mentalHealthDiagnoses || [],
    behavioralConcerns: body.behavioralConcerns || [],
    observationLevel: body.observationLevel || '',
    goals: body.goals || [],
    interventions: body.interventions || [],
    restrictions: body.restrictions || [],
    advanceDirectiveExists: body.advanceDirectiveExists || '',
    healthCareAgent: body.healthCareAgent || '',
    healthCareAgentPhone: body.healthCareAgentPhone || '',
    dnrStatus: body.dnrStatus || '',
    preferredHospital: body.preferredHospital || '',
    advanceDirectiveUploaded: body.advanceDirectiveUploaded || '',
    documentCount: body.documentCount || 0,
    documentNames: body.documentNames || {},
  };
}

export async function GET(request) {
  return withApiContext(request, PERMISSIONS.ADMISSION_FORMS_READ, 'admissions:read', async ({ client }) => {
    const { searchParams } = new URL(request.url);
    const residentId = searchParams.get('residentId');
    const params = [residentId || null];
    const { rows } = await client.query(
      `
        select a.id, a.resident_id, a.admission_case_id, a.status, a.candidate_first_name,
               a.candidate_last_name, a.email, a.room, a.care_level, a.admitted_at,
               a.submitted_at, a.updated_at, a.answers,
               r.first_name, r.last_name
          from care.admissions a
          join care.residents r
            on r.organization_id = a.organization_id
           and r.facility_id = a.facility_id
           and r.id = a.resident_id
         where ($1::uuid is null or a.resident_id = $1::uuid)
         order by a.submitted_at desc, a.updated_at desc
         limit 200
      `,
      params
    );
    return rows.map((row) => ({
      ...mapAdmission(row),
      residentName: `${row.first_name} ${row.last_name}`,
    }));
  });
}

export async function POST(request) {
  return withApiContext(request, PERMISSIONS.ADMISSION_FORMS_WRITE, 'admissions:create', async ({ client, user }) => {
    const body = await readJson(request);
    const residentId = crypto.randomUUID();
    const candidateFirstName = String(body.firstName || '').trim();
    const candidateLastName = String(body.lastName || '').trim();
    if (!candidateFirstName || !candidateLastName) {
      const err = new Error('firstName and lastName are required');
      err.status = 422;
      throw err;
    }

    const residentRows = await client.query(
      `
        insert into care.residents(
          id, organization_id, facility_id, first_name, last_name, date_of_birth,
          room, care_level, status, admitted_at, created_by, updated_by
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, coalesce($9, 'active'), $10, $11, $11)
        returning id, first_name, last_name, date_of_birth, room, care_level, status, admitted_at, discharged_at, version
      `,
      [
        residentId,
        user.organizationId,
        user.facilityId,
        candidateFirstName,
        candidateLastName,
        toDate(body.dateOfBirth || body.dob),
        body.roomAssignment || body.room || null,
        body.observationLevel || body.careLevel || null,
        body.status || 'active',
        toDate(body.admissionDate || body.admittedAt),
        user.id,
      ]
    );

    const admissionRows = await client.query(
      `
        insert into care.admissions(
          organization_id, facility_id, resident_id, status, candidate_first_name,
          candidate_last_name, email, room, care_level, admitted_at, answers,
          created_by, updated_by
        )
        values (
          $1, $2, $3, 'submitted', $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $11
        )
        returning id, resident_id, admission_case_id, status, candidate_first_name,
                  candidate_last_name, email, room, care_level, admitted_at,
                  submitted_at, updated_at, answers
      `,
      [
        user.organizationId,
        user.facilityId,
        residentId,
        candidateFirstName,
        candidateLastName,
        body.email || null,
        body.roomAssignment || body.room || null,
        body.observationLevel || body.careLevel || null,
        toDate(body.admissionDate || body.admittedAt),
        JSON.stringify(buildAdmissionAnswers(body)),
        user.id,
      ]
    );

    const resident = mapResident(residentRows.rows[0]);
    const admission = mapAdmission(admissionRows.rows[0]);
    const adminNotification = buildPortalCredentialNotice({
      email: body.email,
      name: resident.name,
      portal: 'resident',
    });

    await recordAuditEvent(
      client,
      user,
      'admissions:create',
      { type: 'admission', id: admission.id },
      { residentId: resident.id, status: admission.status }
    );

    return adminNotification ? { resident, admission, adminNotification } : { resident, admission };
  });
}
