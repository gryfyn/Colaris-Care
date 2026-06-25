import { PERMISSIONS } from '@/lib/roles.js';
import { readJson, withApiContext } from '@/lib/api-helpers.js';
import { recordAuditEvent } from '@/lib/audit-events.js';

function mapCase(row) {
  return {
    id: row.id,
    caseNumber: row.case_number,
    candidateFirstName: row.candidate_first_name,
    candidateLastName: row.candidate_last_name,
    status: row.status,
    currentStep: row.current_step,
    answers: row.answers,
    updatedAt: row.updated_at,
  };
}

export async function GET(request) {
  return withApiContext(request, PERMISSIONS.ADMISSION_FORMS_READ, 'admission:forms_read', async ({ client }) => {
    const { rows } = await client.query(
      `
        select id, case_number, candidate_first_name, candidate_last_name,
               status, current_step, answers, updated_at
          from care.admission_cases
         order by updated_at desc
         limit 200
      `
    );
    return rows.map(mapCase);
  });
}

export async function POST(request) {
  return withApiContext(request, PERMISSIONS.ADMISSION_FORMS_WRITE, 'admission:forms_write', async ({ client, user }) => {
    const body = await readJson(request);
    const { rows } = await client.query(
      `
        insert into care.admission_cases(
          organization_id, facility_id, case_number, candidate_first_name,
          candidate_last_name, status, current_step, answers, created_by, updated_by
        )
        values ($1, $2, $3, $4, $5, coalesce($6, 'draft'), $7, coalesce($8, '{}'::jsonb), $9, $9)
        returning id, case_number, candidate_first_name, candidate_last_name, status, current_step, answers, updated_at
      `,
      [
        user.organizationId,
        user.facilityId,
        body.caseNumber,
        body.candidateFirstName,
        body.candidateLastName,
        body.status || 'draft',
        body.currentStep || null,
        JSON.stringify(body.answers || {}),
        user.id,
      ]
    );
    await recordAuditEvent(client, user, 'admission_case.create', { type: 'admission_case', id: rows[0].id });
    return mapCase(rows[0]);
  });
}
