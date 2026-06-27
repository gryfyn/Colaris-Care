import { PERMISSIONS } from '@/lib/roles.js';
import { withApiContext } from '@/lib/api-helpers.js';

// Returns the signed-in user's facility profile (name + onboarding settings), so
// forms like admission can pre-fill the facility instead of re-typing it.
export async function GET(request) {
  return withApiContext(request, PERMISSIONS.STAFF_READ, 'facility:read', async ({ client, user }) => {
    const { rows } = await client.query(
      `select id, name, code, timezone, settings
         from care.facilities
        where organization_id = $1 and id = $2
        limit 1`,
      [user.organizationId, user.facilityId]
    );
    const f = rows[0];
    if (!f) return { id: null, name: null };
    const settings = f.settings && typeof f.settings === 'object' ? f.settings : {};
    return { id: f.id, name: f.name, code: f.code, timezone: f.timezone, ...settings };
  });
}
