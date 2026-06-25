import { PERMISSIONS } from '@/lib/roles.js';
import { readJson, withApiContext } from '@/lib/api-helpers.js';
import { recordAuditEvent } from '@/lib/audit-events.js';

function mapDisposal(row) {
  return {
    id: row.id,
    residentId: row.resident_id,
    residentName: row.resident_name,
    medicationName: row.medication_name,
    quantity: row.quantity,
    reason: row.reason,
    status: row.status,
    disposedAt: row.disposed_at,
    witnessName: row.witness_name,
  };
}

export async function GET(request) {
  return withApiContext(request, PERMISSIONS.SAFETY_READ, 'safety:read', async ({ client }) => {
    const { rows } = await client.query(
      `
        select d.id, d.resident_id, r.first_name || ' ' || r.last_name as resident_name,
               d.medication_name, d.quantity, d.reason, d.status, d.disposed_at, d.witness_name
          from care.drug_disposals d
          left join care.residents r
            on r.organization_id = d.organization_id
           and r.facility_id = d.facility_id
           and r.id = d.resident_id
         order by d.disposed_at desc
         limit 200
      `
    );
    return rows.map(mapDisposal);
  });
}

export async function POST(request) {
  return withApiContext(request, PERMISSIONS.SAFETY_WRITE, 'safety:write', async ({ client, user }) => {
    const body = await readJson(request);
    const { rows } = await client.query(
      `
        insert into care.drug_disposals(
          organization_id, facility_id, resident_id, medication_name, quantity,
          reason, status, disposed_at, witness_name, created_by
        )
        values ($1, $2, $3, $4, $5, $6, coalesce($7, 'recorded'), coalesce($8, now()), $9, $10)
        returning id, resident_id, medication_name, quantity, reason, status, disposed_at, witness_name
      `,
      [
        user.organizationId,
        user.facilityId,
        body.residentId || null,
        body.medicationName,
        body.quantity,
        body.reason,
        body.status || 'recorded',
        body.disposedAt || null,
        body.witnessName || null,
        user.id,
      ]
    );
    await recordAuditEvent(client, user, 'drug_disposal.create', { type: 'drug_disposal', id: rows[0].id });
    return { ...mapDisposal(rows[0]), residentName: null };
  });
}
