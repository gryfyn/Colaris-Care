// Staff-context CRUD audit. Verifies staff endpoints interact with the DB.
// A staff role legitimately gets 403 on admin-only writes — those are NOT bugs.
// Only 5xx responses indicate a real DB/SQL fault.
const BASE = 'https://colaris-care.vercel.app';
const ADMIN = { email: 'admin@maplegrove.example', password: 'ChangeMeAdmin123!' };
const STAFF = { email: 'amara.koch@maplegrove.example', password: 'ChangeMeStaff123!' };
const results = [];

async function login(creds) {
  const r = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(creds) });
  const j = await r.json();
  if (!j.accessToken) throw new Error('login failed for ' + creds.email + ': ' + JSON.stringify(j));
  return j;
}

async function call(token, label, method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let payload = {}; try { payload = JSON.parse(text); } catch { payload = { raw: text.slice(0, 120) }; }
  const serverErr = res.status >= 500;
  results.push({ label, method, status: res.status, serverErr, denied: res.status === 401 || res.status === 403, error: payload.error || payload.raw || '', code: payload.code || '' });
  return { status: res.status, data: payload.data, payload };
}

(async () => {
  const nowIso = new Date().toISOString();
  const today = nowIso.slice(0, 10);

  // As ADMIN: create a fresh resident and assign the staff member to it (so staff-scoped writes are allowed).
  const adminAuth = await login(ADMIN);
  const aTok = adminAuth.accessToken;
  const staffLogin = await login(STAFF);
  const sTok = staffLogin.accessToken;
  const staffProfileId = staffLogin.user?.staffId;

  const admRes = await fetch(`${BASE}/api/v1/admissions`, { method: 'POST', headers: { Authorization: `Bearer ${aTok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ firstName: 'StaffAudit', lastName: 'Resident', email: `staffaudit${Date.now()}@example.com`, dob: '1948-02-02', admissionDate: today, roomAssignment: 'Room S1', facility: 'Maple Grove Care', observationLevel: 'Routine' }) });
  const residentId = (await admRes.json()).data?.resident?.id;

  if (staffProfileId && residentId) {
    await fetch(`${BASE}/api/v1/staff/assignments`, { method: 'POST', headers: { Authorization: `Bearer ${aTok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffProfileId, residentId }) });
  }

  // ---- STAFF READS
  await call(sTok, 'staff: residents (list)', 'GET', '/api/v1/residents');
  if (residentId) await call(sTok, 'staff: residents/[id]', 'GET', `/api/v1/residents/${residentId}`);
  await call(sTok, 'staff: care-plans (list)', 'GET', '/api/v1/care-plans');
  await call(sTok, 'staff: progress-notes (list)', 'GET', '/api/v1/progress-notes');
  await call(sTok, 'staff: medications (list)', 'GET', '/api/v1/medications');
  await call(sTok, 'staff: medication-administrations', 'GET', '/api/v1/medication-administrations?outcome=due');
  await call(sTok, 'staff: incidents (list)', 'GET', '/api/v1/incidents');
  await call(sTok, 'staff: appointments (list)', 'GET', '/api/v1/appointments');
  await call(sTok, 'staff: announcements (list)', 'GET', '/api/v1/announcements');
  await call(sTok, 'staff: notifications (list)', 'GET', '/api/v1/notifications');
  await call(sTok, 'staff: drug-disposal (list)', 'GET', '/api/v1/drug-disposal');
  await call(sTok, 'staff: evacuation-drills (list)', 'GET', '/api/v1/evacuation-drills');
  await call(sTok, 'staff: roi (list)', 'GET', '/api/v1/roi');
  await call(sTok, 'staff: resident-requests (list)', 'GET', '/api/v1/resident-requests');
  await call(sTok, 'staff: staff/assignments (list)', 'GET', '/api/v1/staff/assignments');
  await call(sTok, 'staff: me/profile', 'GET', '/api/v1/me/profile');
  await call(sTok, 'staff: auth/me', 'GET', '/api/auth/me');

  // ---- STAFF WRITES (allowed for assigned resident)
  if (residentId) {
    const note = await call(sTok, 'staff: progress-notes (create)', 'POST', '/api/v1/progress-notes', { residentId, body: 'Staff audit note' });
    if (note.data?.id) await call(sTok, 'staff: progress-notes/[id]/sign', 'POST', `/api/v1/progress-notes/${note.data.id}/sign`, {});
    const cp = await call(sTok, 'staff: care-plans (create)', 'POST', '/api/v1/care-plans', { residentId, title: 'Staff audit plan', status: 'draft', goals: { goals: [], objectives: [], interventions: [], reviews: [] } });
    if (cp.data?.id) {
      await call(sTok, 'staff: care-plans/[id] (GET)', 'GET', `/api/v1/care-plans/${cp.data.id}`);
      await call(sTok, 'staff: care-plans/[id]/sign', 'POST', `/api/v1/care-plans/${cp.data.id}/sign`, {});
    }
    await call(sTok, 'staff: resident-requests (create)', 'POST', '/api/v1/resident-requests', { residentId, requestType: 'Comfort', detail: 'Staff audit request' });
    await call(sTok, 'staff: incidents (create)', 'POST', '/api/v1/incidents', { residentId, incidentType: 'Near miss', summary: 'Staff audit', occurredAt: nowIso });
  }
  // staff hitting an admin-only write (expected 403, must NOT be 500)
  await call(sTok, 'staff: announcements (create) [expect 403]', 'POST', '/api/v1/announcements', { title: 'x', body: 'y' });

  // ---- REPORT
  console.log('\n================ STAFF CRUD AUDIT ================');
  for (const r of results) {
    const tag = r.serverErr ? 'FAIL' : r.denied ? 'DENY' : 'PASS';
    console.log(`${tag}  ${String(r.status).padEnd(3)} ${r.method.padEnd(6)} ${r.label}${r.serverErr ? `  -> ${r.code} ${r.error}` : ''}`);
  }
  const fails = results.filter((r) => r.serverErr);
  console.log('\n--------------------------------------------------');
  console.log(`TOTAL: ${results.length}  OK(2xx/4xx): ${results.length - fails.length}  SERVER-ERROR(5xx): ${fails.length}`);
  console.log('STAFF_TEST_RESIDENT_ID=' + (residentId || 'NONE'));
})().catch((e) => { console.error('STAFF AUDIT ERROR', e); process.exit(1); });
