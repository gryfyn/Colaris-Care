import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config(); // fallback to .env
import bcrypt from 'bcryptjs';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const TENANT = {
  name:        'Dependable Care Wellness Centre',
  oregon_npi:  '1234567890',
  oar_license: 'RTH-OR-001',
  timezone:    'America/Los_Angeles',
};

const ADMINS = [
  {
    first_name: 'System',
    last_name:  'Administrator',
    email:      'admin@dependablecare.org',
    password:   'Admin@DC2026!',
    role:       'admin',
  },
  {
    first_name: 'Program',
    last_name:  'Director',
    email:      'director@dependablecare.org',
    password:   'Director@DC2026!',
    role:       'admin',
  },
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Upsert tenant
    const { rows: tenants } = await client.query(
      `INSERT INTO ref.tenants (name, oregon_npi, oar_license, timezone)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [TENANT.name, TENANT.oregon_npi, TENANT.oar_license, TENANT.timezone]
    );

    let tenantId;
    if (tenants.length > 0) {
      tenantId = tenants[0].id;
      console.log(`Tenant created: ${tenantId}`);
    } else {
      const { rows } = await client.query(`SELECT id FROM ref.tenants WHERE name = $1`, [TENANT.name]);
      tenantId = rows[0].id;
      console.log(`Tenant already exists: ${tenantId}`);
    }

    for (const admin of ADMINS) {
      const hash = await bcrypt.hash(admin.password, 12);

      // Upsert staff record
      const { rows: staff } = await client.query(
        `INSERT INTO ref.staff (tenant_id, first_name, last_name, role, email)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (tenant_id, email) DO UPDATE SET role = EXCLUDED.role
         RETURNING id`,
        [tenantId, admin.first_name, admin.last_name, admin.role, admin.email]
      );
      const staffId = staff[0].id;

      // Upsert user account
      await client.query(
        `INSERT INTO care.user_accounts (tenant_id, staff_id, email, password_hash, role)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role`,
        [tenantId, staffId, admin.email, hash, admin.role]
      );

      console.log(`\nAdmin seeded:`);
      console.log(`  Name:     ${admin.first_name} ${admin.last_name}`);
      console.log(`  Email:    ${admin.email}`);
      console.log(`  Password: ${admin.password}`);
      console.log(`  Role:     ${admin.role}`);
    }

    await client.query('COMMIT');
    console.log('\nSeeding complete.\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
