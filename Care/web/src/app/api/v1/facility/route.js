import { PERMISSIONS } from '@/lib/roles.js';
import { readJson, withApiContext } from '@/lib/api-helpers.js';
import { normalizeTheme } from '@/lib/themes.js';

// Keys stored inside care.facilities.settings (JSONB). Everything the signup
// onboarding captured (theme, layout, address, ...) lives here, plus later
// Settings-page edits (notifications, preferences, onboarded marker).
const SETTING_KEYS = [
  'legalName', 'address', 'phone', 'email', 'licensedCapacity',
  'theme', 'layout', 'onboarded', 'notifications', 'preferences',
];

function shape(f) {
  if (!f) return { id: null, name: null };
  const settings = f.settings && typeof f.settings === 'object' ? f.settings : {};
  const theme = normalizeTheme(settings.theme);
  // A facility provisioned by signup always has a theme, so treat that (or an
  // explicit marker) as "already onboarded" — the setup modal must not reappear.
  const onboarded = Boolean(settings.onboarded ?? theme);
  return { id: f.id, name: f.name, code: f.code, timezone: f.timezone, ...settings, theme, onboarded };
}

// Returns the signed-in user's facility profile (name + onboarding settings), so
// the Settings page and forms like admission can show/pre-fill real data instead
// of re-typing it.
export async function GET(request) {
  return withApiContext(request, PERMISSIONS.STAFF_READ, 'facility:read', async ({ client, user }) => {
    const { rows } = await client.query(
      `select id, name, code, timezone, settings
         from care.facilities
        where organization_id = $1 and id = $2
        limit 1`,
      [user.organizationId, user.facilityId]
    );
    return shape(rows[0]);
  });
}

// Updates the facility profile + settings. Admin only (ACCOUNTS_MANAGE). Merges
// the provided setting keys over the existing settings JSONB so partial saves
// (e.g. just a theme change) never drop other fields.
export async function PATCH(request) {
  return withApiContext(request, PERMISSIONS.ACCOUNTS_MANAGE, 'facility:update', async ({ client, user }) => {
    const body = await readJson(request);
    if (body.theme !== undefined && !normalizeTheme(body.theme)) {
      const err = new Error('Unknown theme');
      err.status = 422;
      throw err;
    }

    const { rows: current } = await client.query(
      `select settings from care.facilities where organization_id = $1 and id = $2 limit 1`,
      [user.organizationId, user.facilityId]
    );
    if (!current.length) {
      const err = new Error('Facility not found');
      err.status = 404;
      throw err;
    }
    const existing = current[0].settings && typeof current[0].settings === 'object' ? current[0].settings : {};
    const nextSettings = { ...existing };
    for (const key of SETTING_KEYS) {
      if (body[key] !== undefined) nextSettings[key] = body[key];
    }

    const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : null;
    const timezone = typeof body.timezone === 'string' && body.timezone.trim() ? body.timezone.trim() : null;

    const { rows } = await client.query(
      `update care.facilities
          set name = coalesce($3, name),
              timezone = coalesce($4, timezone),
              settings = $5::jsonb,
              updated_at = now()
        where organization_id = $1 and id = $2
        returning id, name, code, timezone, settings`,
      [user.organizationId, user.facilityId, name, timezone, JSON.stringify(nextSettings)]
    );
    return shape(rows[0]);
  });
}
