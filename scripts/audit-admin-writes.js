/**
 * Audit every admin DB-write endpoint on prod: POST a valid payload, classify
 * the response (2xx works / 4xx healthy-validation / 5xx STRUCTURAL BUG), then
 * GET the list to confirm the row is persisted & returned.
 *
 * Usage: ADMIN_PASSWORD=... node scripts/audit-admin-writes.js
 */
const BASE = process.env.BASE_URL || 'https://dcllc.vercel.app';
const EMAIL = process.env.ADMIN_EMAIL || 'admin@dependablecare.org';
const PASSWORD = process.env.ADMIN_PASSWORD;
if (!PASSWORD) { console.error('Set ADMIN_PASSWORD env var.'); process.exit(1); }
const RID = process.env.RESIDENT_ID || '0553f3f0-4307-4031-a9bb-8805ebe5f26d';
const tag = 'QA' + Date.now().toString().slice(-6);

const tests = [
  { name: 'face-sheets',          post: '/api/v1/face-sheets',          list: '/api/v1/face-sheets',          body: { resident_id: RID, form_data: { fullName: 'Playwright Tester123207', dob: '1980-01-15', note: tag } } },
  { name: 'appointments',         post: '/api/v1/appointments',         list: '/api/v1/appointments',         body: { resident_id: RID, appointment_type: 'medical', title: 'QA Visit ' + tag, scheduled_at: '2026-07-01T15:00:00.000Z' } },
  { name: 'medications',          post: '/api/v1/medications',          list: '/api/v1/medications?resident_id=' + RID, body: { resident_id: RID, drug_name: 'Sertraline ' + tag, dosage: '50mg', route: 'oral', frequency: 'once daily', prescriber: 'Dr. QA', start_date: '2026-06-04' } },
  { name: 'daily-progress-notes', post: '/api/v1/daily-progress-notes', list: '/api/v1/daily-progress-notes', body: { resident_id: RID, note_date: '2026-06-04', shift: 'morning', note_body: { summary: 'QA note ' + tag, mood: 'stable' } } },
  { name: 'incidents',            post: '/api/v1/incidents',            list: '/api/v1/incidents',            body: { resident_id: RID, incident_date: '2026-06-04', incident_time: '14:30', incident_type: 'fall', description: 'QA incident ' + tag, severity: 'low' } },
  { name: 'drug-disposal',        post: '/api/v1/drug-disposal',        list: '/api/v1/drug-disposal',        body: { resident_id: RID, disposal_date: '2026-06-04', drug_name: 'Lorazepam ' + tag, quantity: '5', reason: 'expired', witness: 'Nurse QA' } },
  { name: 'evacuation-drills',    post: '/api/v1/evacuation-drills',    list: '/api/v1/evacuation-drills',    body: { drill_date: '2026-06-04', drill_time: '10:00', drill_type: 'fire', duration_minutes: 5, participants: 12, notes: 'QA drill ' + tag } },
  { name: 'resident-requests',    post: '/api/v1/resident-requests',    list: '/api/v1/resident-requests',    body: { resident_id: RID, request_type: 'maintenance', details: 'QA request ' + tag } },
  { name: 'activities',           post: '/api/v1/activities',           list: '/api/v1/activities',           body: { day_of_week: 'Monday', start_time: '09:00', name: 'QA Yoga ' + tag, location: 'Activity Hall', category: 'wellness', description: 'QA' } },
  { name: 'announcements',        post: '/api/v1/announcements',        list: '/api/v1/announcements',        body: { title: 'QA Announcement ' + tag, body: 'QA announcement body ' + tag, audience: 'all' } },
  { name: 'notifications',        post: '/api/v1/notifications',        list: '/api/v1/notifications',        body: { type: 'general', title: 'QA Notif ' + tag, body: 'QA', resident_id: RID } },
];

async function main() {
  const lr = await fetch(`${BASE}/api/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
  const TOK = (await lr.json()).accessToken;
  // get a csrf token in case any route enforces it
  let CSRF = '';
  try { CSRF = (await (await fetch(`${BASE}/api/v1/csrf`, { headers: { Authorization: 'Bearer ' + TOK } })).json()).csrfToken || ''; } catch {}
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOK, 'X-CSRF-Token': CSRF };

  const summary = [];
  for (const t of tests) {
    let postStatus = '?', postBody = '', listStatus = '?', listCount = '?', found = '?';
    try {
      const r = await fetch(BASE + t.post, { method: 'POST', headers: H, body: JSON.stringify(t.body) });
      postStatus = r.status; postBody = (await r.text()).slice(0, 180);
    } catch (e) { postStatus = 'ERR'; postBody = e.message; }
    try {
      const g = await fetch(BASE + t.list, { headers: H });
      listStatus = g.status;
      const j = await g.json();
      const arr = j.data || j[t.name.replace(/-/g, '_')] || j.items || [];
      listCount = Array.isArray(arr) ? arr.length : '?';
      found = Array.isArray(arr) ? arr.some((x) => JSON.stringify(x).includes(tag)) : '?';
    } catch (e) { listStatus = 'ERR'; }
    const verdict = postStatus >= 500 ? '🔴 STRUCTURAL BUG' : postStatus >= 400 ? '🟡 4xx (validation)' : '🟢 OK';
    summary.push({ name: t.name, postStatus, listStatus, listCount, found, verdict });
    console.log(`\n[${t.name}]  POST ${postStatus}  ${verdict}`);
    console.log(`   list GET ${listStatus} count=${listCount} foundOurRow=${found}`);
    if (postStatus >= 400) console.log(`   resp: ${postBody}`);
  }

  console.log('\n\n================ SUMMARY ================');
  summary.forEach((s) => console.log(`${s.verdict.padEnd(20)} ${s.name.padEnd(22)} POST=${s.postStatus} list=${s.listStatus}(${s.listCount}) found=${s.found}`));
  const bugs = summary.filter((s) => s.postStatus >= 500);
  console.log(`\nStructural bugs (500): ${bugs.length ? bugs.map((b) => b.name).join(', ') : 'NONE 🎉'}`);
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
