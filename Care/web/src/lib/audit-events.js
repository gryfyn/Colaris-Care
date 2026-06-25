const SAFE_METADATA_KEYS = new Set([
  'id',
  'ids',
  'targetId',
  'targetType',
  'residentId',
  'residentIds',
  'staffId',
  'staffIds',
  'carePlanId',
  'progressNoteId',
  'roiId',
  'dischargeRecordId',
  'admissionCaseId',
  'documentId',
  'incidentId',
  'appointmentId',
  'notificationId',
  'assignmentId',
  'organizationId',
  'facilityId',
  'status',
  'action',
  'outcome',
  'count',
  'counts',
  'total',
]);

function isSafeMetadataValue(value) {
  if (value === null) return true;
  if (['string', 'number', 'boolean'].includes(typeof value)) return true;
  if (Array.isArray(value)) {
    return value.every((item) => item === null || ['string', 'number', 'boolean'].includes(typeof item));
  }
  return false;
}

export function sanitizeAuditMetadata(metadata = {}) {
  return Object.fromEntries(
    Object.entries(metadata || {}).filter(([key, value]) => (
      SAFE_METADATA_KEYS.has(key) && isSafeMetadataValue(value)
    ))
  );
}

export async function recordAuditEvent(client, user, action, target = {}, metadata = {}) {
  const safeMetadata = sanitizeAuditMetadata(metadata);
  await client.query(
    `
      insert into audit_log.audit_events(
        organization_id, facility_id, actor_user_id, actor_staff_id,
        action, target_type, target_id, outcome, metadata
      )
      values ($1, $2, $3, $4, $5, $6, $7, coalesce($8, 'success'), $9)
    `,
    [
      user?.organizationId || user?.tenantId || null,
      user?.facilityId || null,
      user?.id || null,
      user?.staffId || null,
      action,
      target.type || null,
      target.id || null,
      target.outcome || 'success',
      JSON.stringify(safeMetadata),
    ]
  );
}
