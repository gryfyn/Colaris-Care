// Live CRUD audit of every admin/staff API endpoint against production.
// Logs in as admin, exercises read+create+update/action on each resource,
// records HTTP status + error, then the companion cleanup removes test rows.
const BASE = 'https://colaris-care.vercel.app';
const ADMIN = { email: 'admin@maplegrove.example', password: 'ChangeMeAdmin123!' };
const results = [];
const created = { ids: {} };
let TOKEN = '';

async function login() {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ADMIN),
  });
  const j = await r.json();
  TOKEN = j.accessToken;
  if (!TOKEN) throw new Error('login failed: ' + JSON.stringify(j));
}

async function call(label, method, path, body) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    let payload = {};
    try { payload = JSON.parse(text); } catch { payload = { raw: text.slice(0, 120) }; }
    const ok = res.status >= 200 && res.status < 300;
    results.push({ label, method, path, status: res.status, ok, error: ok ? '' : (payload.error || payload.raw || ''), code: payload.code || '' });
    return { ok, status: res.status, data: payload.data, payload };
  } catch (e) {
    results.push({ label, method, path, status: 0, ok: false, error: e.message, code: 'FETCH' });
    return { ok: false, status: 0 };
  }
}

(async () => {
  await login();
  const today = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();

  // ---- Seed a throwaway resident via the admissions endpoint (CREATE residents+admissions)
  const adm = await call('admissions', 'POST', '/api/v1/admissions', {
    firstName: 'CrudAudit', lastName: 'Resident', email: `crud${Date.now()}@example.com`,
    dob: '1950-01-01', admissionDate: today, roomAssignment: 'Room A1', facility: 'Maple Grove Care', observationLevel: 'Routine',
  });
  const residentId = adm.data?.resident?.id;
  created.ids.residentId = residentId;

  // ---- staff profile id (for assignments)
  const staffList = await call('staff (list)', 'GET', '/api/v1/staff');
  const staffProfileId = Array.isArray(staffList.data) && staffList.data[0]?.id;

  // ---- READS
  await call('residents (list)', 'GET', '/api/v1/residents');
  if (residentId) await call('residents/[id]', 'GET', `/api/v1/residents/${residentId}`);
  if (staffProfileId) await call('staff/[id]', 'GET', `/api/v1/staff/${staffProfileId}`);
  await call('staff/assignments (list)', 'GET', '/api/v1/staff/assignments');
  await call('care-plans (list)', 'GET', '/api/v1/care-plans');
  await call('medications (list)', 'GET', '/api/v1/medications');
  await call('medication-administrations (list)', 'GET', '/api/v1/medication-administrations?outcome=due');
  await call('progress-notes (list)', 'GET', '/api/v1/progress-notes');
  await call('incidents (list)', 'GET', '/api/v1/incidents');
  await call('appointments (list)', 'GET', '/api/v1/appointments');
  await call('announcements (list)', 'GET', '/api/v1/announcements');
  await call('notifications (list)', 'GET', '/api/v1/notifications');
  await call('documents (list)', 'GET', '/api/v1/documents');
  await call('drug-disposal (list)', 'GET', '/api/v1/drug-disposal');
  await call('evacuation-drills (list)', 'GET', '/api/v1/evacuation-drills');
  await call('roi (list)', 'GET', '/api/v1/roi');
  await call('discharge-records (list)', 'GET', '/api/v1/discharge-records');
  await call('resident-requests (list)', 'GET', '/api/v1/resident-requests');
  await call('admission-cases (list)', 'GET', '/api/v1/admission-cases');
  await call('admissions (list)', 'GET', '/api/v1/admissions');
  await call('audit-events (list)', 'GET', '/api/v1/audit-events');
  await call('compliance (list)', 'GET', '/api/v1/compliance');
  await call('me/profile', 'GET', '/api/v1/me/profile');
  await call('auth/me', 'GET', '/api/auth/me');

  // ---- CREATES
  await call('announcements (create)', 'POST', '/api/v1/announcements', { title: 'Audit notice', body: 'Audit body' });
  await call('notifications (create)', 'POST', '/api/v1/notifications', { title: 'Audit notif', body: 'Audit body' });
  await call('evacuation-drills (create)', 'POST', '/api/v1/evacuation-drills', { drillType: 'Fire', occurredAt: nowIso, summary: 'Audit drill' });
  await call('admission-cases (create)', 'POST', '/api/v1/admission-cases', { caseNumber: `AC-${Date.now()}`, candidateFirstName: 'Aud', candidateLastName: 'Case' });

  if (residentId) {
    await call('appointments (create)', 'POST', '/api/v1/appointments', { residentId, title: 'Audit appt', startsAt: nowIso });
    await call('incidents (create)', 'POST', '/api/v1/incidents', { residentId, incidentType: 'Fall', summary: 'Audit incident', occurredAt: nowIso });
    const med = await call('medications (create)', 'POST', '/api/v1/medications', { residentId, name: 'AuditMed', dosage: '10mg' });
    const medId = med.data?.id;
    if (medId) await call('medication-administrations (create)', 'POST', '/api/v1/medication-administrations', { residentId, medicationId: medId, scheduledFor: nowIso, outcome: 'administered' });
    await call('drug-disposal (create)', 'POST', '/api/v1/drug-disposal', { residentId, medicationName: 'AuditMed', quantity: '1 tab', reason: 'Audit' });
    await call('documents (create)', 'POST', '/api/v1/documents', { residentId, documentType: 'Audit', title: 'Audit doc', objectKey: 'audit/key.pdf' });
    await call('roi (create)', 'POST', '/api/v1/roi', { residentId, recipient: 'Audit Clinic', purpose: 'Audit' });
    if (staffProfileId) await call('staff/assignments (create)', 'POST', '/api/v1/staff/assignments', { staffProfileId, residentId });

    const note = await call('progress-notes (create)', 'POST', '/api/v1/progress-notes', { residentId, body: 'Audit note' });
    const noteId = note.data?.id;
    const cp = await call('care-plans (create)', 'POST', '/api/v1/care-plans', { residentId, title: 'Audit plan', status: 'draft', goals: { goals: [], objectives: [], interventions: [], reviews: [] } });
    const cpId = cp.data?.id;
    const req = await call('resident-requests (create)', 'POST', '/api/v1/resident-requests', { residentId, requestType: 'Maintenance', detail: 'Audit request' });
    const reqId = req.data?.id;

    // ---- UPDATES / ACTIONS
    await call('residents/[id] (PATCH)', 'PATCH', `/api/v1/residents/${residentId}`, { room: 'Room A2' });
    if (cpId) {
      await call('care-plans/[id] (GET)', 'GET', `/api/v1/care-plans/${cpId}`);
      await call('care-plans/[id]/sign', 'POST', `/api/v1/care-plans/${cpId}/sign`, {});
      await call('care-plans/[id]/approve', 'POST', `/api/v1/care-plans/${cpId}/approve`, {});
    }
    if (noteId) await call('progress-notes/[id]/sign', 'POST', `/api/v1/progress-notes/${noteId}/sign`, {});
    if (reqId) await call('resident-requests/[id] (PATCH)', 'PATCH', `/api/v1/resident-requests/${reqId}`, { status: 'in_progress' });
    const roiList = await call('roi (relist)', 'GET', '/api/v1/roi');
    const roiId = Array.isArray(roiList.data) && roiList.data.find((x) => x.recipient === 'Audit Clinic')?.id;
    if (roiId) await call('roi/[id]/revoke', 'POST', `/api/v1/roi/${roiId}/revoke`, { reason: 'Audit' });
    const notifList = await call('notifications (relist)', 'GET', '/api/v1/notifications');
    const notifId = Array.isArray(notifList.data) && notifList.data.find((x) => x.title === 'Audit notif')?.id;
    if (notifId) await call('notifications/[id]/read', 'POST', `/api/v1/notifications/${notifId}/read`, {});
    // discharge last (sets resident to discharged)
    await call('residents/[id]/discharge', 'POST', `/api/v1/residents/${residentId}/discharge`, { dischargeDate: today, destination: 'Home', summary: 'Audit discharge' });
    await call('discharge-records (create)', 'POST', '/api/v1/discharge-records', { residentId, status: 'draft', summary: 'Audit discharge record' });
  }

  // ---- REPORT
  const fails = results.filter((r) => !r.ok);
  console.log('\n================ CRUD AUDIT RESULTS ================');
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${String(r.status).padEnd(3)} ${r.method.padEnd(6)} ${r.label}${r.ok ? '' : `  -> ${r.code} ${r.error}`}`);
  }
  console.log('\n----------------------------------------------------');
  console.log(`TOTAL: ${results.length}  PASS: ${results.length - fails.length}  FAIL: ${fails.length}`);
  if (fails.length) {
    console.log('\nFAILURES:');
    for (const f of fails) console.log(`  [${f.status} ${f.code}] ${f.method} ${f.path} :: ${f.error}`);
  }
  console.log('\nTEST_RESIDENT_ID=' + (residentId || 'NONE'));
})().catch((e) => { console.error('AUDIT ERROR', e); process.exit(1); });
