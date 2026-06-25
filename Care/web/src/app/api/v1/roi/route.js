import { PERMISSIONS } from '@/lib/roles.js';
import { readJson, withApiContext } from '@/lib/api-helpers.js';
import { recordAuditEvent } from '@/lib/audit-events.js';

function mapRoi(row) {
  return {
    id: row.id,
    residentId: row.resident_id,
    residentName: row.resident_name,
    recipient: row.recipient,
    purpose: row.purpose,
    status: row.status,
    effectiveAt: row.effective_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  };
}

export async function GET(request) {
  return withApiContext(request, PERMISSIONS.ROI_READ, 'roi:read', async ({ client }) => {
    const { rows } = await client.query(
      `
        select roi.id, roi.resident_id, r.first_name || ' ' || r.last_name as resident_name,
               roi.recipient, roi.purpose, roi.status, roi.effective_at, roi.expires_at, roi.revoked_at
          from care.roi_records roi
          join care.residents r
            on r.organization_id = roi.organization_id
           and r.facility_id = roi.facility_id
           and r.id = roi.resident_id
         order by roi.created_at desc
         limit 200
      `
    );
    return rows.map(mapRoi);
  });
}

export async function POST(request) {
  return withApiContext(request, PERMISSIONS.ROI_WRITE, 'roi:write', async ({ client, user }) => {
    const body = await readJson(request);
    const { rows } = await client.query(
      `
        insert into care.roi_records(
          organization_id, facility_id, resident_id, recipient, purpose,
          status, effective_at, expires_at, created_by
        )
        values ($1, $2, $3, $4, $5, coalesce($6, 'active'), $7, $8, $9)
        returning id, resident_id, recipient, purpose, status, effective_at, expires_at, revoked_at
      `,
      [
        user.organizationId,
        user.facilityId,
        body.residentId,
        body.recipient,
        body.purpose,
        body.status || 'active',
        body.effectiveAt || null,
        body.expiresAt || null,
        user.id,
      ]
    );
    await recordAuditEvent(client, user, 'roi.create', { type: 'roi_record', id: rows[0].id });
    return { ...mapRoi(rows[0]), residentName: null };
  });
}
