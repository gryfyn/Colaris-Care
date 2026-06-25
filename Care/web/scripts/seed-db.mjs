import crypto from 'node:crypto';
import { buildClient } from './database-connection.mjs';
import { getTenantKey } from '../src/lib/tenant-key.js';

const client = buildClient({ preferMigration: true });

const PHI_CIPHER_VERSION = 1;
const SSN_FIELD = 'ssn_last4';

function hashDevPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Inline mirrors of src/lib/encryption.js (buildAAD / encryptPHI / lookupHashPHI).
// Reimplemented here because encryption.js imports the '@/lib/...' alias, which a
// plain `node scripts/seed-db.mjs` run cannot resolve. The wire format MUST stay
// byte-compatible so the API routes can decrypt what the seed writes.
function buildAad(organizationId, facilityId, rowId, field) {
  return Buffer.from(
    [organizationId, facilityId, 'residents', rowId, field]
      .map((part) => (part == null ? '' : String(part)))
      .join('|'),
    'utf8'
  );
}

function encryptPhi(plaintext, keyHex, aad) {
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aad);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
}

function lookupHashPhi(value, keyHex, field) {
  return crypto
    .createHmac('sha256', Buffer.from(keyHex, 'hex'))
    .update(`${field}|${value}`, 'utf8')
    .digest('hex');
}

await client.connect();

try {
  await client.query('begin');

  const org = await client.query(
    `
      insert into care.organizations(name, slug, status)
      values ('Maple Health Partners', 'maple-health-partners', 'active')
      on conflict (slug) do update set name = excluded.name
      returning id
    `
  );
  const organizationId = org.rows[0].id;

  const facility = await client.query(
    `
      insert into care.facilities(organization_id, name, code, timezone, status)
      values ($1, 'Maple Grove Care', 'MGC', 'America/New_York', 'active')
      on conflict (organization_id, code) do update set name = excluded.name
      returning id
    `,
    [organizationId]
  );
  const facilityId = facility.rows[0].id;

  const adminUser = await client.query(
    `
      insert into care.users(email, display_name, password_hash, status)
      values ('admin@maplegrove.example', 'Admin User', $1, 'active')
      on conflict (email) do update set display_name = excluded.display_name
      returning id
    `,
    [hashDevPassword('ChangeMeAdmin123!')]
  );

  const staffUser = await client.query(
    `
      insert into care.users(email, display_name, password_hash, status)
      values ('amara.koch@maplegrove.example', 'Amara Koch', $1, 'active')
      on conflict (email) do update set display_name = excluded.display_name
      returning id
    `,
    [hashDevPassword('ChangeMeStaff123!')]
  );

  await client.query(
    `
      insert into care.facility_memberships(organization_id, facility_id, user_id, role, status)
      values
        ($1, $2, $3, 'admin', 'active'),
        ($1, $2, $4, 'staff', 'active')
      on conflict (organization_id, facility_id, user_id) do update
        set role = excluded.role, status = excluded.status
    `,
    [organizationId, facilityId, adminUser.rows[0].id, staffUser.rows[0].id]
  );

  const staffProfile = await client.query(
    `
      insert into care.staff_profiles(organization_id, facility_id, user_id, employee_number, first_name, last_name, role_title, status)
      values ($1, $2, $3, 'MGC-STAFF-001', 'Amara', 'Koch', 'Care Coordinator', 'active')
      on conflict (organization_id, facility_id, employee_number) do update
        set user_id = excluded.user_id, first_name = excluded.first_name, last_name = excluded.last_name
      returning id
    `,
    [organizationId, facilityId, staffUser.rows[0].id]
  );

  // Synthetic (non-real) last-4 digits, written through the encrypted path.
  const residents = [
    ['Eleanor', 'Whitfield', 'W-104', 'assisted_living', '1942-11-14', '4821'],
    ['Marcus', 'Bell', 'M-210', 'memory_care', '1938-02-03', '7390'],
    ['Grace', 'Tan', 'W-106', 'assisted_living', '1944-05-17', '1256'],
  ];

  const tenantKey = await getTenantKey(organizationId, facilityId);

  for (const [firstName, lastName, room, careLevel, dob, ssnLast4] of residents) {
    const resident = await client.query(
      `
        insert into care.residents(organization_id, facility_id, first_name, last_name, date_of_birth, room, care_level, status)
        values ($1, $2, $3, $4, $5, $6, $7, 'active')
        on conflict (organization_id, facility_id, first_name, last_name, date_of_birth) do update
          set room = excluded.room, care_level = excluded.care_level, status = excluded.status
        returning id
      `,
      [organizationId, facilityId, firstName, lastName, dob, room, careLevel]
    );

    const residentId = resident.rows[0].id;

    // Encrypt ssn_last4 with AAD bound to the final row id (upsert may keep an
    // existing id), then write the envelope columns in a second statement.
    const ssnAad = buildAad(organizationId, facilityId, residentId, SSN_FIELD);
    await client.query(
      `
        update care.residents
           set ssn_last4_ciphertext = $2,
               ssn_last4_key_version = $3,
               ssn_last4_lookup_hash = $4
         where id = $1
      `,
      [
        residentId,
        encryptPhi(ssnLast4, tenantKey, ssnAad),
        PHI_CIPHER_VERSION,
        lookupHashPhi(ssnLast4, tenantKey, SSN_FIELD),
      ]
    );
    await client.query(
      `
        insert into care.staff_assignments(organization_id, facility_id, staff_profile_id, resident_id, status)
        values ($1, $2, $3, $4, 'active')
        on conflict (organization_id, facility_id, staff_profile_id, resident_id) do update set status = 'active'
      `,
      [organizationId, facilityId, staffProfile.rows[0].id, residentId]
    );

    await client.query(
      `
        insert into care.care_plans(organization_id, facility_id, resident_id, title, status, summary)
        values ($1, $2, $3, 'Current care plan', 'active', 'Seeded plan for local demo review.')
        on conflict do nothing
      `,
      [organizationId, facilityId, residentId]
    );
  }

  await client.query('commit');
  console.log('Seeded Maple Health Partners / Maple Grove Care.');
  console.log('Admin: admin@maplegrove.example / ChangeMeAdmin123!');
  console.log('Staff: amara.koch@maplegrove.example / ChangeMeStaff123!');
} catch (err) {
  await client.query('rollback');
  throw err;
} finally {
  await client.end();
}
