import { PERMISSIONS } from '@/lib/roles.js';
import { readJson, withApiContext } from '@/lib/api-helpers.js';
import { recordAuditEvent } from '@/lib/audit-events.js';

export async function POST(request, { params }) {
  const { id } = await params;
  return withApiContext(request, PERMISSIONS.RESIDENTS_DISCHARGE, 'residents:discharge', async ({ client, user }) => {
    const body = await readJson(request);
    const dischargeDate = body.dischargeDate || new Date().toISOString().slice(0, 10);

    const { rows } = await client.query(
      `
        update care.residents
           set status = 'discharged',
               discharged_at = $2,
               version = version + 1,
               updated_at = now(),
               updated_by = $3
         where id = $1
        returning id, status, discharged_at
      `,
      [id, dischargeDate, user.id]
    );
    if (!rows.length) {
      const err = new Error('Resident not found');
      err.status = 404;
      throw err;
    }

    await client.query(
      `
        insert into care.discharge_records(
          organization_id, facility_id, resident_id, status,
          discharge_date, destination, summary, created_by, updated_by
        )
        values ($1, $2, $3, 'completed', $4, $5, $6, $7, $7)
        on conflict do nothing
      `,
      [
        user.organizationId,
        user.facilityId,
        id,
        dischargeDate,
        body.destination || null,
        body.summary || null,
        user.id,
      ]
    );

    await recordAuditEvent(client, user, 'residents:discharge', { type: 'resident', id: id });
    return rows[0];
  });
}
