import dotenv from 'dotenv';
import { resolve } from 'path';
import { v4 as uuidv4 } from 'uuid';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config();
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🌱 Database Seeding - Complete Tables\n');
    
    const tenantRes = await client.query(`SELECT id FROM ref.tenants LIMIT 1`);
    const tenantId = tenantRes.rows[0].id;

    const staffRes = await client.query(`SELECT id FROM ref.staff WHERE tenant_id = $1 LIMIT 10`, [tenantId]);
    const resRes = await client.query(`SELECT id FROM care.residents WHERE tenant_id = $1`, [tenantId]);
    const staffIds = staffRes.rows.map(s => s.id);
    const residentIds = resRes.rows.map(r => r.id);

    console.log(`Tenant: ${tenantId}`);
    console.log(`Staff: ${staffIds.length} | Residents: ${residentIds.length}\n`);

    let c = {};

    // Daily Progress Notes
    console.log('📝 Progress Notes...');
    c.notes = 0;
    for (const resId of residentIds) {
      for (const shift of ['day', 'evening']) {
        try {
          await client.query(
            `INSERT INTO care.daily_progress_notes (id, tenant_id, resident_id, staff_id, note_date, shift, note_body)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [uuidv4(), tenantId, resId, staffIds[0], new Date().toISOString().split('T')[0], shift, 'Good progress noted.']
          );
          c.notes++;
        } catch (e) {}
      }
    }
    console.log(`✅ ${c.notes}`);

    // Care Plans
    console.log('📋 Care Plans...');
    c.plans = 0;
    for (const resId of residentIds) {
      try {
        await client.query(
          `INSERT INTO care.care_plans (id, tenant_id, resident_id, status, effective_date)
           VALUES ($1, $2, $3, $4, $5)`,
          [uuidv4(), tenantId, resId, 'active', new Date().toISOString().split('T')[0]]
        );
        c.plans++;
      } catch (e) {}
    }
    console.log(`✅ ${c.plans}`);

    // Medications
    console.log('💊 Medications...');
    c.meds = 0;
    for (const resId of residentIds) {
      const meds = ['Sertraline', 'Lisinopril'];
      for (let i = 0; i < 2; i++) {
        try {
          await client.query(
            `INSERT INTO care.medications (id, tenant_id, resident_id, drug_name, dosage, frequency, start_date, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [uuidv4(), tenantId, resId, meds[i], '50mg', 'once daily', new Date().toISOString().split('T')[0], true]
          );
          c.meds++;
        } catch (e) {}
      }
    }
    console.log(`✅ ${c.meds}`);

    // Incident Reports
    console.log('⚠️  Incidents...');
    c.incidents = 0;
    for (const resId of residentIds.slice(0, 3)) {
      try {
        await client.query(
          `INSERT INTO care.incident_reports (id, tenant_id, resident_id, incident_date, incident_type, incident_details, completed_by_staff_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [uuidv4(), tenantId, resId, new Date().toISOString().split('T')[0], 'minor', 'Minor incident during activity', staffIds[0]]
        );
        c.incidents++;
      } catch (e) {}
    }
    console.log(`✅ ${c.incidents}`);

    // Notifications
    console.log('📬 Notifications...');
    c.notifs = 0;
    for (const staffId of staffIds.slice(0, 3)) {
      try {
        await client.query(
          `INSERT INTO care.notifications (id, tenant_id, user_id, type, title, body, is_read)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [uuidv4(), tenantId, staffId, 'alert', 'New Alert', 'You have new notifications', false]
        );
        c.notifs++;
      } catch (e) {}
    }
    console.log(`✅ ${c.notifs}`);

    // Evacuation Drills
    console.log('🚪 Drills...');
    try {
      await client.query(
        `INSERT INTO care.evacuation_drills (id, tenant_id, drill_date, location)
         VALUES ($1, $2, $3, $4)`,
        [uuidv4(), tenantId, new Date().toISOString().split('T')[0], 'Main Building']
      );
      console.log(`✅ 1`);
    } catch (e) {}

    // Drug Disposal
    console.log('🗑️  Disposal...');
    c.disposal = 0;
    for (const resId of residentIds.slice(0, 3)) {
      try {
        await client.query(
          `INSERT INTO care.drug_disposal_records (id, tenant_id, resident_id, disposal_date, drug_name, quantity, disposal_method, disposed_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [uuidv4(), tenantId, resId, new Date().toISOString().split('T')[0], 'Expired', '5', 'incineration', staffIds[0]]
        );
        c.disposal++;
      } catch (e) {}
    }
    console.log(`✅ ${c.disposal}`);

    // Safety Plans
    console.log('🛡️  Safety Plans...');
    c.safety = 0;
    for (const resId of residentIds) {
      try {
        await client.query(
          `INSERT INTO care.safety_plans (id, tenant_id, resident_id, plan_date, warning_signs, coping_strategies, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [uuidv4(), tenantId, resId, new Date().toISOString().split('T')[0], 'Increased anxiety', 'Talk to staff', staffIds[0]]
        );
        c.safety++;
      } catch (e) {}
    }
    console.log(`✅ ${c.safety}`);

    console.log('\n✨ Seeding Complete!\n');
    Object.entries(c).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
