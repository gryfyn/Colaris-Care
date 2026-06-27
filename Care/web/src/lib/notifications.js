// Helpers for task-linked notifications.
//
// A notification can reference the entity that produced it (source_type +
// source_id). When that task is completed, resolveNotifications() marks the
// matching notifications as 'resolved'. The runtime DB role has no DELETE on
// care tables, so "delete on completion" is modelled as a status the
// notifications API excludes — the notification disappears from the user's inbox.

export async function createNotification(client, { organizationId, facilityId, userId, title, body, sourceType = null, sourceId = null }) {
  await client.query(
    `
      insert into care.notifications(organization_id, facility_id, user_id, title, body, status, source_type, source_id)
      values ($1, $2, $3, $4, $5, 'unread', $6, $7)
    `,
    [organizationId, facilityId, userId || null, title, body, sourceType, sourceId]
  );
}

// Archive every notification for a completed task (the API hides archived
// entries, so the notification "gets deleted" from the recipient's inbox).
export async function resolveNotifications(client, { organizationId, facilityId, sourceType, sourceId }) {
  if (!sourceType || !sourceId) return;
  await client.query(
    `
      update care.notifications
         set status = 'archived', read_at = coalesce(read_at, now())
       where organization_id = $1 and facility_id = $2
         and source_type = $3 and source_id = $4
         and status <> 'archived'
    `,
    [organizationId, facilityId, sourceType, sourceId]
  );
}

// Resolve the user_id for a staff_profile so a notification can target that
// person's inbox. Returns null when the staff profile has no linked login.
export async function userIdForStaffProfile(client, organizationId, facilityId, staffProfileId) {
  if (!staffProfileId) return null;
  const { rows } = await client.query(
    `select user_id from care.staff_profiles where organization_id = $1 and facility_id = $2 and id = $3 limit 1`,
    [organizationId, facilityId, staffProfileId]
  );
  return rows[0]?.user_id || null;
}
