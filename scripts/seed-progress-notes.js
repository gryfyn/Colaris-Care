import dotenv from 'dotenv';
import { resolve } from 'path';
import { v4 as uuidv4 } from 'uuid';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config();
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function seedProgressNotes() {
  const client = await pool.connect();
  try {
    console.log('🌱 Starting progress notes seeding...\n');

    // Step 1: Get first tenant
    const tenantResult = await client.query(`SELECT id FROM ref.tenants LIMIT 1`);
    if (tenantResult.rows.length === 0) {
      throw new Error('No tenants found. Run seed-db.js first.');
    }
    const tenantId = tenantResult.rows[0].id;
    console.log(`Using tenant: ${tenantId}`);

    // Step 2: Get first staff with role 'staff' or 'clinical'
    const staffResult = await client.query(
      `SELECT id, first_name, last_name, role FROM ref.staff
       WHERE tenant_id = $1 AND role IN ('staff', 'clinical') AND is_active = TRUE
       ORDER BY created_at ASC LIMIT 1`,
      [tenantId]
    );
    if (staffResult.rows.length === 0) {
      throw new Error('No active staff with role "staff" or "clinical" found.');
    }
    const assignedStaff = staffResult.rows[0];
    console.log(`Assigning residents to staff: ${assignedStaff.first_name} ${assignedStaff.last_name} (${assignedStaff.role})`);

    // Step 3: Get all active residents
    const residentsResult = await client.query(
      `SELECT id, first_name, last_name FROM care.residents
       WHERE tenant_id = $1 AND status = 'active' AND deleted_at IS NULL
       ORDER BY created_at ASC`,
      [tenantId]
    );
    if (residentsResult.rows.length === 0) {
      throw new Error('No active residents found. Run seed-db.js first.');
    }
    const residents = residentsResult.rows;
    console.log(`Found ${residents.length} active residents\n`);

    // Step 4: Get first staff with role 'admin'
    const adminResult = await client.query(
      `SELECT id, first_name, last_name FROM ref.staff
       WHERE tenant_id = $1 AND role = 'admin' AND is_active = TRUE
       ORDER BY created_at ASC LIMIT 1`,
      [tenantId]
    );
    if (adminResult.rows.length === 0) {
      throw new Error('No active admin staff found.');
    }
    const adminStaff = adminResult.rows[0];
    console.log(`Using admin as progress note author: ${adminStaff.first_name} ${adminStaff.last_name}\n`);

    // Step 5: Insert staff assignments (first 5 residents)
    let assignmentCount = 0;
    const residentLimit = Math.min(5, residents.length);

    console.log('Creating staff assignments...');
    for (let i = 0; i < residentLimit; i++) {
      const resident = residents[i];
      const assignmentId = uuidv4();
      try {
        await client.query(
          `INSERT INTO care.staff_assignments
           (id, tenant_id, staff_id, resident_id, assignment_date, is_active)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (tenant_id, staff_id, resident_id) DO NOTHING`,
          [assignmentId, tenantId, assignedStaff.id, resident.id, new Date().toISOString().split('T')[0], true]
        );
        assignmentCount++;
      } catch (e) {
        console.error(`Failed to assign resident ${resident.first_name}: ${e.message}`);
      }
    }
    console.log(`✅ Created/found ${assignmentCount} staff assignments\n`);

    // Step 6: Calculate YESTERDAY's date
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDate = yesterday.toISOString().split('T')[0];
    console.log(`Creating progress notes for: ${yesterdayDate}\n`);

    // Step 7: Insert progress notes for YESTERDAY with all 3 shifts
    const shifts = ['morning', 'afternoon', 'night'];
    const stubNoteBody = {
      progressNotes: 'Seeded entry',
      moodBehavior: [],
      physicalHealth: [],
      medicationsAdministered: [],
      mealsBreakfast: '50',
      mealsLunch: '75',
      mealsDinner: '80',
      activitiesParticipated: [],
      incidents: ''
    };

    let noteCount = 0;
    console.log('Creating progress notes...');

    for (let i = 0; i < residentLimit; i++) {
      const resident = residents[i];

      for (const shift of shifts) {
        const noteId = uuidv4();
        try {
          await client.query(
            `INSERT INTO care.daily_progress_notes
             (id, tenant_id, resident_id, staff_id, note_date, shift,
              note_body, review_status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT DO NOTHING`,
            [
              noteId,
              tenantId,
              resident.id,
              adminStaff.id,
              yesterdayDate,
              shift,
              JSON.stringify(stubNoteBody),
              'pending',
              new Date().toISOString(),
              new Date().toISOString()
            ]
          );
          noteCount++;
        } catch (e) {
          console.error(`Failed to create note for ${resident.first_name} (${shift}): ${e.message}`);
        }
      }
    }
    console.log(`✅ Created ${noteCount} progress notes (${residentLimit} residents × 3 shifts)\n`);

    console.log('✨ Progress notes seeding completed successfully!');
    console.log(`
Summary:
  • ${assignmentCount} staff assignments created
  • ${noteCount} progress notes created
  • ${residentLimit} residents assigned
  • 3 shifts (morning, afternoon, night)
  • Note date: ${yesterdayDate}
    `);
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedProgressNotes().catch((err) => {
  console.error(err);
  process.exit(1);
});
