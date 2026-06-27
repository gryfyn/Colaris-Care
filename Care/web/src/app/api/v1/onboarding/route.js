import { query } from '@/lib/db.js';
import logger from '@/lib/logger.js';

// Completes onboarding for a verified signup: provisions a new organization +
// facility + admin user from the facility profile. Public (token-gated) because
// the user has no tenant/session yet.
export async function POST(request) {
  const b = await request.json().catch(() => ({}));
  const token = String(b.token || '');
  if (!token) return Response.json({ error: 'Missing signup token.' }, { status: 400 });

  const status = await query('select * from app.signup_status($1)', [token]);
  const s = status.rows[0];
  if (!s) return Response.json({ error: 'Unknown signup.' }, { status: 404 });
  if (!s.verified) return Response.json({ error: 'Please verify your email before finishing setup.' }, { status: 400 });
  if (s.completed) return Response.json({ error: 'This account is already set up — please sign in.' }, { status: 409 });

  const facilityName = String(b.facilityName || '').trim();
  if (!facilityName) return Response.json({ error: 'Facility name is required.' }, { status: 400 });

  const capacity = b.licensedCapacity != null && b.licensedCapacity !== ''
    ? Number.parseInt(b.licensedCapacity, 10) : null;

  try {
    const { rows } = await query(
      'select * from app.provision_tenant($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
      [
        token,
        String(b.legalName || facilityName).trim(),
        facilityName,
        b.legalName ? String(b.legalName).trim() : null,
        b.address ? String(b.address).trim() : null,
        b.phone ? String(b.phone).trim() : null,
        b.email ? String(b.email).trim() : null,
        b.timezone ? String(b.timezone).trim() : null,
        Number.isFinite(capacity) ? capacity : null,
        b.theme ? String(b.theme) : null,
        b.layout ? String(b.layout) : null,
      ]
    );
    return Response.json({ ok: true, email: s.email, organizationId: rows[0].out_organization_id, facilityId: rows[0].out_facility_id });
  } catch (err) {
    logger.error({ err }, '[onboarding] provisioning failed');
    return Response.json({ error: 'Could not finish setup. Please try again.' }, { status: 500 });
  }
}
