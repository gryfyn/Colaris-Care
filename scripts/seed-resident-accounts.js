import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config();
import bcrypt from 'bcryptjs';
import pg from 'pg';
import crypto from 'crypto';

const DEFAULT_PASSWORD = 'Resident@DC2026!';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LEN = 16;
const RESIDENT_ENCRYPTED_FIELDS = ['first_name', 'last_name', 'preferred_name', 'medicaid_id', 'phone', 'email', 'address_line1', 'address_line2', 'ssn_last4'];

function getTenantKey() {
  return (Buffer.from(process.env.DEV_TENANT_ENCRYPTION_KEY || 'dev-only-32-char-key-change-me!!').toString('hex').slice(0, 64)).padEnd(64, '0');
}

function decryptPHI(b64, keyHex) {
  if (!b64) return null;
  const key = Buffer.from(keyHex, 'hex');
  const buf = Buffer.from(b64, 'base64');
  const iv  = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LEN);
  const ct  = buf.subarray(IV_LENGTH + AUTH_TAG_LEN);
  const d   = crypto.createDecipheriv(ALGORITHM, key, iv);
  d.setAuthTag(tag);
  return d.update(ct) + d.final('utf8');
}

function decryptFields(obj, fields, keyHex) {
  const out = { ...obj };
  for (const f of fields) {
    if (out[f] != null) {
      try { out[f] = decryptPHI(out[f], keyHex); } catch { out[f] = '[DECRYPT_ERROR]'; }
    }
  }
  return out;
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
const tenantKey = getTenantKey();

try {
  await client.query('BEGIN');

  const { rows: residents } = await client.query(
    `SELECT id, tenant_id, first_name, last_name FROM care.residents WHERE deleted_at IS NULL`
  );

  console.log(`Found ${residents.length} residents.`);
  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  const created = [];

  for (const r of residents) {
    const dec = decryptFields(r, RESIDENT_ENCRYPTED_FIELDS, tenantKey);
    const fname = (dec.first_name || 'resident').toLowerCase().replace(/[^a-z]/g, '');
    const lname = (dec.last_name  || '').toLowerCase().replace(/[^a-z]/g, '');
    const email = `${fname}.${lname}@dependablecare.org`.replace(/\.@/, '@').replace(/\.$/, '');

    await client.query(
      `INSERT INTO care.user_accounts (tenant_id, resident_id, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, 'resident_care_of', true)
       ON CONFLICT (email) DO UPDATE
         SET resident_id   = EXCLUDED.resident_id,
             password_hash = EXCLUDED.password_hash,
             role          = EXCLUDED.role,
             is_active     = TRUE,
             failed_attempts = 0,
             locked_until    = NULL`,
      [r.tenant_id, r.id, email, hash]
    );

    created.push({ name: `${dec.first_name} ${dec.last_name}`, email });
  }

  await client.query('COMMIT');

  console.log('\nResident portal accounts ready:');
  console.log(`  Password (all):  ${DEFAULT_PASSWORD}\n`);
  for (const c of created) {
    console.log(`  ${c.name.padEnd(28)}  ${c.email}`);
  }
  console.log('');
} catch (err) {
  await client.query('ROLLBACK');
  console.error('Seed failed:', err);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
