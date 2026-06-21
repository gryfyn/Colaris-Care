/**
 * Probe every API endpoint with each role and collect non-2xx responses.
 * Writes a markdown report to ENDPOINT_PROBE_REPORT.md.
 */
import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config();
import pg from 'pg';
import fs from 'fs';

const BASE = process.env.PROBE_BASE_URL || 'http://localhost:3000';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const ACCOUNTS = [
  { label: 'admin',   email: 'admin@dependablecare.org',         password: 'Admin@DC2026!'      },
  { label: 'manager', email: 'michael@dcllc.com',                password: 'TempPassword123!'   },
  { label: 'staff',   email: 'jessica@dcllc.com',                password: 'TempPassword123!'   },
  { label: 'resident',email: 'robert.williams@dependablecare.org', password: 'Resident@DC2026!' },
];

async function login(acct) {
  const r = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: acct.email, password: acct.password }),
  });
  if (!r.ok) throw new Error(`Login failed for ${acct.label}: ${r.status}`);
  const d = await r.json();
  return { ...acct, token: d.accessToken, user: d.user };
}

async function probe(method, path, token, body) {
  const opts = { method, headers: { Authorization: `Bearer ${token}` } };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const t0 = Date.now();
  let status, text, errMsg = null;
  try {
    const r = await fetch(`${BASE}${path}`, opts);
    status = r.status;
    text = await r.text();
    if (!r.ok) {
      try { errMsg = JSON.parse(text).error || text.slice(0, 200); }
      catch { errMsg = text.slice(0, 200); }
    }
  } catch (e) {
    status = 0;
    errMsg = e.message;
  }
  return { method, path, status, ok: status >= 200 && status < 300, errMsg, ms: Date.now() - t0 };
}

// ── Discover IDs from DB ────────────────────────────────────────────────────
const ctx = {};
{
  const { rows: r0 } = await pool.query(`SELECT id, tenant_id FROM care.residents WHERE deleted_at IS NULL LIMIT 1`);
  ctx.residentId = r0[0].id;
  const { rows: r1 } = await pool.query(`SELECT id FROM care.care_plans WHERE deleted_at IS NULL LIMIT 1`);
  ctx.carePlanId = r1[0]?.id;
  const { rows: r2 } = await pool.query(`SELECT id FROM care.goals WHERE deleted_at IS NULL LIMIT 1`);
  ctx.goalId = r2[0]?.id;
  const { rows: r3 } = await pool.query(`SELECT id FROM care.objectives WHERE deleted_at IS NULL LIMIT 1`);
  ctx.objectiveId = r3[0]?.id;
  const { rows: r4 } = await pool.query(`SELECT id FROM care.medications LIMIT 1`);
  ctx.medicationId = r4[0]?.id;
  const { rows: r5 } = await pool.query(`SELECT id FROM care.appointments LIMIT 1`);
  ctx.appointmentId = r5[0]?.id;
  const { rows: r6 } = await pool.query(`SELECT id FROM care.announcements LIMIT 1`);
  ctx.announcementId = r6[0]?.id;
  const { rows: r7 } = await pool.query(`SELECT id FROM care.activities LIMIT 1`);
  ctx.activityId = r7[0]?.id;
  const { rows: r8 } = await pool.query(`SELECT id FROM care.notifications LIMIT 1`);
  ctx.notificationId = r8[0]?.id;
  const { rows: r9 } = await pool.query(`SELECT id FROM care.incident_reports LIMIT 1`);
  ctx.incidentId = r9[0]?.id;
  const { rows: rA } = await pool.query(`SELECT id FROM care.daily_progress_notes WHERE review_status = 'pending' LIMIT 1`);
  ctx.progressNoteId = rA[0]?.id;
  const { rows: rB } = await pool.query(`SELECT id FROM care.drug_disposal_records WHERE review_status = 'pending' LIMIT 1`);
  ctx.disposalId = rB[0]?.id;
  const { rows: rC } = await pool.query(`SELECT id FROM care.evacuation_drills WHERE review_status = 'pending' LIMIT 1`);
  ctx.drillId = rC[0]?.id;
  const { rows: rD } = await pool.query(`SELECT id FROM ref.staff LIMIT 1`);
  ctx.staffId = rD[0]?.id;
  const { rows: rE } = await pool.query(`SELECT id FROM care.resident_requests LIMIT 1`);
  ctx.requestId = rE[0]?.id;
  const { rows: rF } = await pool.query(`SELECT id FROM care.resident_face_sheets LIMIT 1`);
  ctx.faceSheetId = rF[0]?.id;
}
await pool.end();

// ── Define probes ───────────────────────────────────────────────────────────
const PROBES = [
  // Auth
  { m: 'GET',  p: '/api/v1/auth/me' },
  { m: 'GET',  p: '/api/v1/csrf' },
  { m: 'GET',  p: '/api/v1/health' },

  // Admin
  { m: 'GET',  p: '/api/v1/admin/overview' },
  { m: 'GET',  p: '/api/v1/admin/residents' },
  { m: 'GET',  p: '/api/v1/admin/staff' },
  { m: 'GET',  p: '/api/v1/admin/incidents' },
  { m: 'GET',  p: '/api/v1/admin/form-reviews' },
  { m: 'GET',  p: '/api/v1/admin/audit-log' },

  // Residents
  { m: 'GET',  p: '/api/v1/residents?limit=5' },
  { m: 'GET',  p: `/api/v1/residents/${ctx.residentId}` },
  { m: 'GET',  p: `/api/v1/residents/${ctx.residentId}/profile` },
  { m: 'GET',  p: `/api/v1/residents/${ctx.residentId}/care-plans` },
  { m: 'GET',  p: `/api/v1/residents/${ctx.residentId}/roi` },

  // Care plans
  { m: 'GET',  p: '/api/v1/care-plans?limit=5' },
  ctx.carePlanId && { m: 'GET', p: `/api/v1/care-plans/${ctx.carePlanId}` },
  ctx.carePlanId && { m: 'GET', p: `/api/v1/care-plans/${ctx.carePlanId}/goals` },
  ctx.carePlanId && { m: 'GET', p: `/api/v1/care-plans/${ctx.carePlanId}/safety-plan` },

  // Goals/objectives are accessed via nested /care-plans/[id]/goals routes
  // (Top-level /goals/[id] and /objectives/[id] routes were intentionally removed.)

  // Meds
  { m: 'GET',  p: '/api/v1/medications?limit=5' },
  ctx.medicationId && { m: 'GET', p: `/api/v1/medications/${ctx.medicationId}` },
  { m: 'GET',  p: '/api/v1/medication-administrations?limit=5' },
  { m: 'GET',  p: '/api/v1/staff/medications' },

  // Appointments
  { m: 'GET',  p: '/api/v1/appointments?limit=5' },
  ctx.appointmentId && { m: 'GET', p: `/api/v1/appointments/${ctx.appointmentId}` },

  // Announcements
  { m: 'GET',  p: '/api/v1/announcements?limit=5' },
  ctx.announcementId && { m: 'GET', p: `/api/v1/announcements/${ctx.announcementId}` },

  // Activities
  { m: 'GET',  p: '/api/v1/activities?limit=5' },
  ctx.activityId && { m: 'GET', p: `/api/v1/activities/${ctx.activityId}` },

  // Notifications
  { m: 'GET',  p: '/api/v1/notifications?limit=5' },

  // Incidents / drills / disposal / progress
  { m: 'GET',  p: '/api/v1/incidents?limit=5' },
  { m: 'GET',  p: '/api/v1/evacuation-drills?limit=5' },
  { m: 'GET',  p: '/api/v1/drug-disposal?limit=5' },
  { m: 'GET',  p: '/api/v1/daily-progress-notes?limit=5' },
  { m: 'GET',  p: '/api/v1/daily-progress-notes/pending' },

  // Face sheets
  { m: 'GET',  p: '/api/v1/face-sheets?limit=5' },
  ctx.faceSheetId && { m: 'GET', p: `/api/v1/face-sheets/${ctx.faceSheetId}` },
  { m: 'GET',  p: `/api/v1/face-sheets/resident/${ctx.residentId}` },

  // Resident requests
  { m: 'GET',  p: '/api/v1/resident-requests?limit=5' },
  ctx.requestId && { m: 'GET', p: `/api/v1/resident-requests/${ctx.requestId}` },

  // Staff
  { m: 'GET',  p: '/api/v1/staff?limit=5' },
  { m: 'GET',  p: '/api/v1/staff/assignments' },
  { m: 'GET',  p: '/api/v1/staff/certifications' },
  { m: 'GET',  p: '/api/v1/staff/dashboard' },
  { m: 'GET',  p: '/api/v1/staff/progress-notes' },

  // Dashboard
  { m: 'GET',  p: '/api/v1/dashboard' },
  { m: 'GET',  p: '/api/v1/dashboard/high-risk' },
  { m: 'GET',  p: '/api/v1/dashboard/roi-expiring' },

  // Admission
  { m: 'GET',  p: '/api/v1/admission/forms' },
  { m: 'GET',  p: '/api/v1/admission/pending' },
  { m: 'GET',  p: '/api/v1/admission/advance-directive' },
  { m: 'GET',  p: '/api/v1/admission/nursing-assessment' },
  { m: 'GET',  p: '/api/v1/admission/pre-screening' },

  // Other lists
  { m: 'GET',  p: '/api/v1/pre-admission-screenings' },
  { m: 'GET',  p: '/api/v1/nursing-admissions' },
  { m: 'GET',  p: '/api/v1/advance-directives' },
  { m: 'GET',  p: '/api/v1/audit/credential-history' },

  // POST/PATCH actions (admin-only)
  { m: 'POST',  p: '/api/v1/announcements', body: { title: 'Probe test', body: 'temp', audience: 'all', priority: 'normal' }, expectCleanup: true },
  { m: 'POST',  p: '/api/v1/activities',    body: { day_of_week: 'Monday', start_time: '08:00', name: 'Probe', category: 'Wellness', location: 'Common Room', duration_minutes: 30 }, expectCleanup: true },
  { m: 'POST',  p: '/api/v1/appointments',  body: { resident_id: ctx.residentId, appointment_type: 'medical', title: 'Probe Apt', scheduled_at: new Date(Date.now()+86400000).toISOString(), duration_minutes: 30 }, expectCleanup: true },
].filter(Boolean);

// ── Run probes ──────────────────────────────────────────────────────────────
console.log('Logging in 4 roles...');
const sessions = [];
for (const a of ACCOUNTS) {
  try { sessions.push(await login(a)); console.log(`  ✓ ${a.label} → ${a.email}`); }
  catch (e) { console.log(`  ✗ ${a.label}: ${e.message}`); }
}
console.log(`\nProbing ${PROBES.length} endpoints × ${sessions.length} roles = ${PROBES.length * sessions.length} calls...\n`);

const results = [];
let okCount = 0, failCount = 0;
for (const probeDef of PROBES) {
  for (const s of sessions) {
    const r = await probe(probeDef.m, probeDef.p, s.token, probeDef.body);
    r.role = s.label;
    results.push(r);
    if (r.ok) okCount++; else failCount++;
  }
}

// ── Group failures ──────────────────────────────────────────────────────────
const failures = results.filter(r => !r.ok);
const byEndpoint = {};
for (const f of failures) {
  const key = `${f.method} ${f.path}`;
  if (!byEndpoint[key]) byEndpoint[key] = [];
  byEndpoint[key].push(f);
}

// Categorize: 401/403 for roles without perms = expected; 405 on documented POST-only routes = expected.
// Paths that intentionally don't support GET (write-only by design).
const WRITE_ONLY_PATTERNS = [
  '/api/v1/admission/advance-directive',
  '/api/v1/admission/nursing-assessment',
  '/api/v1/admission/pre-screening',
  '/api/v1/pre-admission-screenings',
  '/api/v1/nursing-admissions',
  '/api/v1/advance-directives',
  '/api/v1/auth/refresh',
  '/api/v1/auth/logout',
  '/api/v1/admission/generate-pdf',
  '/api/v1/residents/create',
  '/api/v1/staff/create',
  '/api/v1/teams/dispatch',
  '/api/v1/goals/',          // /goals/[id] only has PATCH
  '/api/v1/objectives/',     // /objectives/[id] only has PATCH (but [id]/progress-notes has GET)
];
const expectedDenials = new Set();
const realErrors = [];
for (const f of failures) {
  const pathBase = f.path.replace(/\?.*$/, '');
  const isWriteOnly = WRITE_ONLY_PATTERNS.some(p => pathBase.startsWith(p)) && !pathBase.endsWith('/progress-notes');
  if (f.status === 405 && isWriteOnly) {
    expectedDenials.add(`${f.method} ${f.path} [${f.role}]`);
  } else if (f.status === 403 && f.role !== 'admin') {
    expectedDenials.add(`${f.method} ${f.path} [${f.role}]`);
  } else if ((f.status === 403 || f.status === 401) && f.role === 'resident') {
    expectedDenials.add(`${f.method} ${f.path} [${f.role}]`);
  } else {
    realErrors.push(f);
  }
}

// ── Write report ────────────────────────────────────────────────────────────
let md = `# Endpoint Probe Report\n\n`;
md += `Generated: ${new Date().toISOString()}\n`;
md += `Base URL: ${BASE}\n\n`;
md += `## Summary\n\n`;
md += `- Total calls: ${results.length}\n`;
md += `- Successful (2xx): ${okCount}\n`;
md += `- Failed (non-2xx): ${failCount}\n`;
md += `- Expected denials (auth boundaries): ${expectedDenials.size}\n`;
md += `- **Real errors:** ${realErrors.length}\n\n`;

if (realErrors.length) {
  md += `## Real errors (bugs)\n\n`;
  md += `| Method | Path | Role | Status | Error |\n|---|---|---|---|---|\n`;
  for (const f of realErrors) {
    md += `| ${f.method} | \`${f.path}\` | ${f.role} | ${f.status} | ${(f.errMsg || '').replace(/\|/g, '\\|').slice(0, 200)} |\n`;
  }
  md += `\n`;
}

md += `## All non-2xx by endpoint\n\n`;
for (const [key, list] of Object.entries(byEndpoint)) {
  md += `### ${key}\n\n`;
  md += `| Role | Status | Error |\n|---|---|---|\n`;
  for (const f of list) {
    md += `| ${f.role} | ${f.status} | ${(f.errMsg || '').replace(/\|/g, '\\|').slice(0, 200)} |\n`;
  }
  md += `\n`;
}

fs.writeFileSync('ENDPOINT_PROBE_REPORT.md', md);
console.log(`\nReport: ENDPOINT_PROBE_REPORT.md`);
console.log(`  Total: ${results.length}`);
console.log(`  OK:    ${okCount}`);
console.log(`  Fail:  ${failCount}`);
console.log(`  Real bugs: ${realErrors.length}`);
console.log(`  Expected auth denials: ${expectedDenials.size}`);

// Print real errors inline for quick scanning
if (realErrors.length) {
  console.log(`\nREAL ERRORS:`);
  for (const f of realErrors.slice(0, 30)) {
    console.log(`  ${String(f.status).padStart(3)} ${f.method.padEnd(5)} ${f.path.padEnd(60)} [${f.role}] ${(f.errMsg || '').slice(0, 80)}`);
  }
  if (realErrors.length > 30) console.log(`  ... and ${realErrors.length - 30} more (see report file)`);
}
