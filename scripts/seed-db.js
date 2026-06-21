import dotenv from 'dotenv';
import { resolve } from 'path';
import { v4 as uuidv4 } from 'uuid';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config();
import pg from 'pg';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Map staff job roles to user_accounts authorization roles
// Valid user_accounts roles: resident_care_of, staff, manager, admin, superadmin
// resident_care_of is for residents themselves (or their families) — read-only access to their own data
// Clinical staff need the 'staff' role to have progress note write permissions
const roleMapping = {
  'clinical': 'staff',
  'staff': 'staff',
  'manager': 'manager',
  'admin': 'admin',
  'superadmin': 'superadmin'
};

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LEN = 16;

function encryptPHI(plaintext, keyHex) {
  if (!plaintext) return null;
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64');
}

function getTenantKey() {
  const keyStr = process.env.DEV_TENANT_ENCRYPTION_KEY || 'dev-only-32-char-key-change-me!!';
  return Buffer.from(keyStr).toString('hex').slice(0, 64).padEnd(64, '0');
}

// Get or create default tenant
async function getOrCreateTenant(client) {
  let result = await client.query(`SELECT id FROM ref.tenants LIMIT 1`);
  if (result.rows.length > 0) {
    return result.rows[0].id;
  }
  const tenantId = uuidv4();
  await client.query(
    `INSERT INTO ref.tenants (id, name, timezone, is_active) VALUES ($1, $2, $3, $4)`,
    [tenantId, 'Default Facility', 'America/Chicago', true]
  );
  return tenantId;
}

async function seedDatabase() {
  const client = await pool.connect();
  try {
    console.log('🌱 Starting database seed...');
    
    const tenantId = await getOrCreateTenant(client);
    console.log(`Using tenant: ${tenantId}`);

    // Insert staff
    console.log('Creating staff members...');
    const staffData = [
      { first_name: 'Sarah', last_name: 'Johnson', email: 'sarah@dcllc.com', phone: '(555) 123-4567', role: 'admin', hire_date: '2023-01-15', employee_id: 'EMP001', license_no: 'RN-001' },
      { first_name: 'Michael', last_name: 'Chen', email: 'michael@dcllc.com', phone: '(555) 123-4568', role: 'manager', hire_date: '2023-02-20', employee_id: 'EMP002', license_no: 'LCSW-001' },
      { first_name: 'Emily', last_name: 'Rodriguez', email: 'emily@dcllc.com', phone: '(555) 123-4569', role: 'clinical', hire_date: '2023-03-10', employee_id: 'EMP003', license_no: 'RN-002' },
      { first_name: 'David', last_name: 'Kim', email: 'david@dcllc.com', phone: '(555) 123-4570', role: 'clinical', hire_date: '2023-04-05', employee_id: 'EMP004', license_no: 'CNA-001' },
      { first_name: 'Jessica', last_name: 'Thompson', email: 'jessica@dcllc.com', phone: '(555) 123-4571', role: 'staff', hire_date: '2023-05-12', employee_id: 'EMP005', license_no: null },
    ];

    const staffIds = [];
    for (const staff of staffData) {
      const staffId = uuidv4();
      try {
        await client.query(
          `INSERT INTO ref.staff (id, tenant_id, first_name, last_name, email, phone, role, hire_date, license_no, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [staffId, tenantId, staff.first_name, staff.last_name, staff.email, staff.phone, staff.role, staff.hire_date, staff.license_no, true]
        );
        staffIds.push(staffId);
      } catch (e) {
        if (e.code === '23505') {
          // Staff already exists, get their ID
          const result = await client.query(
            `SELECT id FROM ref.staff WHERE tenant_id = $1 AND email = $2`,
            [tenantId, staff.email]
          );
          if (result.rows.length > 0) staffIds.push(result.rows[0].id);
        } else {
          throw e;
        }
      }
    }
    console.log(`✅ Created/found ${staffIds.length} staff members`);

    // Clear existing residents for re-seeding (and cascade delete related records)
    console.log('Clearing old residents...');
    const existingRes = await client.query('SELECT id FROM care.residents WHERE tenant_id = $1', [tenantId]);
    const existingIds = existingRes.rows.map(r => r.id);
    if (existingIds.length > 0) {
      const placeholders = existingIds.map((_, i) => `$${i + 1}`).join(',');
      await client.query(`DELETE FROM care.staff_assignments WHERE resident_id IN (${placeholders})`, existingIds);
      await client.query(`DELETE FROM care.daily_progress_notes WHERE resident_id IN (${placeholders})`, existingIds);
      await client.query(`DELETE FROM care.medications WHERE resident_id IN (${placeholders})`, existingIds);
      await client.query(`DELETE FROM care.care_plans WHERE resident_id IN (${placeholders})`, existingIds);
      await client.query(`DELETE FROM care.residents WHERE id IN (${placeholders})`, existingIds);
    }

    // Insert residents
    console.log('Creating residents...');
    const residentData = [
      { first_name: 'Robert', last_name: 'Williams', date_of_birth: '1945-03-15', gender: 'Male', medicaid_id: 'MCD-12345678', phone: '(555) 234-5670', email: 'robert@email.com', address_line1: '123 Oak Street', city: 'Springfield', state: 'IL', postal_code: '62701', primary_diagnosis: 'Major Depressive Disorder' },
      { first_name: 'Patricia', last_name: 'Anderson', date_of_birth: '1950-07-22', gender: 'Female', medicaid_id: 'MCD-87654321', phone: '(555) 234-5671', email: 'patricia@email.com', address_line1: '456 Elm Avenue', city: 'Springfield', state: 'IL', postal_code: '62702', primary_diagnosis: 'Bipolar Disorder II' },
      { first_name: 'James', last_name: 'Martinez', date_of_birth: '1965-11-08', gender: 'Male', medicaid_id: 'MCD-11223344', phone: '(555) 234-5672', email: 'james@email.com', address_line1: '789 Maple Drive', city: 'Springfield', state: 'IL', postal_code: '62703', primary_diagnosis: 'Substance Use Disorder' },
      { first_name: 'Linda', last_name: 'Davis', date_of_birth: '1955-05-30', gender: 'Female', medicaid_id: 'MCD-55667788', phone: '(555) 234-5673', email: 'linda@email.com', address_line1: '321 Pine Road', city: 'Springfield', state: 'IL', postal_code: '62704', primary_diagnosis: 'Anxiety Disorder' },
      { first_name: 'Christopher', last_name: 'Wilson', date_of_birth: '1970-09-14', gender: 'Male', medicaid_id: 'MCD-99887766', phone: '(555) 234-5674', email: 'chris@email.com', address_line1: '654 Cedar Lane', city: 'Springfield', state: 'IL', postal_code: '62705', primary_diagnosis: 'Schizophrenia' },
    ];

    const tenantKey = getTenantKey();
    const residentIds = [];
    for (const resident of residentData) {
      const residentId = uuidv4();
      const encryptedFirstName = encryptPHI(resident.first_name, tenantKey);
      const encryptedLastName = encryptPHI(resident.last_name, tenantKey);
      const encryptedMedicaidId = encryptPHI(resident.medicaid_id, tenantKey);
      const encryptedPhone = encryptPHI(resident.phone, tenantKey);
      const encryptedEmail = encryptPHI(resident.email, tenantKey);
      const encryptedAddressLine1 = encryptPHI(resident.address_line1, tenantKey);

      await client.query(
        `INSERT INTO care.residents (id, tenant_id, first_name, last_name, date_of_birth, gender, medicaid_id, phone, email, address_line1, city, state, postal_code, primary_diagnosis, intake_date, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
        [residentId, tenantId, encryptedFirstName, encryptedLastName, resident.date_of_birth, resident.gender, encryptedMedicaidId, encryptedPhone, encryptedEmail, encryptedAddressLine1, resident.city, resident.state, resident.postal_code, resident.primary_diagnosis, new Date().toISOString().split('T')[0], 'active', staffIds[0]]
      );
      residentIds.push(residentId);
    }
    console.log(`✅ Created ${residentIds.length} residents`);

    // Create user accounts for staff
    console.log('Creating user accounts...');
    for (let i = 0; i < staffIds.length; i++) {
      const username = `staff${i + 1}`;
      const hash = await bcrypt.hash('TempPassword123!', 10);
      const accountId = uuidv4();
      const staffRole = staffData[i].role;
      const userRole = roleMapping[staffRole] || staffRole; // Map staff role to valid user_accounts role
      try {
        await client.query(
          `INSERT INTO care.user_accounts (id, tenant_id, staff_id, email, password_hash, role, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [accountId, tenantId, staffIds[i], staffData[i].email, hash, userRole, true]
        );
      } catch (e) {
        // User account might already exist
        console.log(`  Note: ${username} account may already exist`);
      }
    }
    console.log(`✅ Created ${staffIds.length} user accounts`);

    console.log('\n✨ Database seeding completed successfully!');
    console.log(`
Created:
  • ${staffIds.length} staff members
  • ${residentIds.length} residents
  • ${staffIds.length} user accounts

Sample Login:
  • Email: sarah@dcllc.com (admin)
  • Password: TempPassword123!

Tenant ID: ${tenantId}
    `);
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedDatabase().catch((err) => {
  console.error(err);
  process.exit(1);
});
