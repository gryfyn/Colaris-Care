// Builds a clean, self-contained printable HTML document for a resident's
// admission packet and opens it in a new window for print / "Save as PDF".
// Self-contained (inline styles, own window) so it does not interfere with the
// app's own print CSS — mirrors the window.print() pattern used by face sheets.

function esc(value) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return esc(value);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function row(label, value) {
  return `<div class="row"><span class="lbl">${esc(label)}</span><span class="val">${value === undefined ? "—" : value}</span></div>`;
}

function chips(list) {
  if (!Array.isArray(list) || !list.length) return "—";
  return list.map((item) => `<span class="chip">${esc(item)}</span>`).join(" ");
}

function diagnoses(list) {
  const items = (list || []).map((d) => (typeof d === "string" ? d : d?.text)).filter(Boolean);
  return items.length ? items.map((t) => `<li>${esc(t)}</li>`).join("") : '<li class="muted">None recorded</li>';
}

function table(headers, rows) {
  if (!rows.length) return '<p class="muted">None recorded</p>';
  return `<table class="tbl"><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>` +
    `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function section(title, body) {
  return `<section class="sec"><h2>${esc(title)}</h2>${body}</section>`;
}

export function buildAdmissionFormHtml(resident, admission) {
  const a = admission?.answers || {};
  const name = resident?.name || [a.firstName, a.middleName, a.lastName].filter(Boolean).join(" ") || "Resident";

  const allergies = (a.allergies || []).filter((x) => x && (x.allergen || x.reaction || x.severity))
    .map((x) => [x.allergen, x.reaction, x.severity]);
  const meds = (a.medications || []).filter((x) => x && x.medication)
    .map((x) => [x.medication, x.dose, x.frequency, x.route, fmtDate(x.startDate)]);
  const adls = a.adls && typeof a.adls === "object"
    ? Object.entries(a.adls).filter(([, v]) => v).map(([k, v]) => [k, v]) : [];
  const documents = a.documentNames && typeof a.documentNames === "object"
    ? Object.entries(a.documentNames).filter(([, v]) => v).map(([k, v]) => [k, v]) : [];

  const body = [
    `<header class="head">
       <div>
         <div class="eyebrow">Colaris Care · Resident Admission Form</div>
         <h1>${esc(name)}</h1>
         <div class="sub">Room ${esc(a.roomAssignment || resident?.room)} · Admitted ${fmtDate(a.admissionDate || resident?.admittedAt)} · Status ${esc(admission?.status || resident?.status)}</div>
       </div>
       <div class="generated">Generated ${fmtDate(new Date())}</div>
     </header>`,

    section("1 · Basic Information", `
      <div class="subhead">Personal</div>
      ${row("First name", esc(a.firstName))}
      ${row("Middle name", esc(a.middleName))}
      ${row("Last name", esc(a.lastName))}
      ${row("Preferred name", esc(a.preferredName))}
      ${row("Date of birth", fmtDate(a.dob))}
      ${row("Gender", esc(a.gender))}
      ${row("Pronouns", esc(a.pronouns))}
      <div class="subhead">Contact</div>
      ${row("Phone", esc(a.phone))}
      ${row("Email", esc(a.email))}
      ${row("Current address", esc(a.currentAddress))}
      <div class="subhead">Emergency contact</div>
      ${row("Name", esc(a.emergencyName))}
      ${row("Relationship", esc(a.emergencyRelationship))}
      ${row("Phone", esc(a.emergencyPhone))}
      ${row("Email", esc(a.emergencyEmail))}
      <div class="subhead">Admission</div>
      ${row("Admission date", fmtDate(a.admissionDate))}
      ${row("Expected discharge", fmtDate(a.expectedDischarge))}
      ${row("Facility", esc(a.facility))}
      ${row("Room assignment", esc(a.roomAssignment))}
      ${row("Referral source", esc(a.referralSource))}
      ${row("Case manager", esc(a.caseManager))}
    `),

    section("2 · Clinical Overview", `
      <div class="subhead">Primary diagnoses</div><ul>${diagnoses(a.primaryDiagnoses)}</ul>
      <div class="subhead">Secondary diagnoses</div><ul>${diagnoses(a.secondaryDiagnoses)}</ul>
      <div class="subhead">Current conditions</div><div class="chips">${chips(a.conditions)}</div>
      <div class="subhead">Allergies</div>${table(["Allergen", "Reaction", "Severity"], allergies)}
      <div class="subhead">Current medications</div>${table(["Medication", "Dose", "Frequency", "Route", "Start"], meds)}
    `),

    section("3 · Functional Assessment", `
      ${row("Mobility", esc(a.mobility))}
      ${row("Communication", esc(a.communication))}
      <div class="subhead">Activities of daily living</div>${table(["Activity", "Level"], adls)}
    `),

    section("4 · Behavioral & Mental Health", `
      <div class="subhead">Mental health diagnoses</div><ul>${diagnoses(a.mentalHealthDiagnoses)}</ul>
      <div class="subhead">Behavioral concerns</div><div class="chips">${chips(a.behavioralConcerns)}</div>
      ${row("Observation level", esc(a.observationLevel))}
    `),

    section("5 · Care Plan", `
      <div class="subhead">Goals</div><ul>${diagnoses(a.goals)}</ul>
      <div class="subhead">Interventions</div><ul>${diagnoses(a.interventions)}</ul>
      <div class="subhead">Restrictions</div><ul>${diagnoses(a.restrictions)}</ul>
    `),

    section("6 · Advance Directives", `
      ${row("Advance directive exists", esc(a.advanceDirectiveExists))}
      ${row("DNR status", esc(a.dnrStatus))}
      ${row("Health care agent", esc(a.healthCareAgent))}
      ${row("Health care agent phone", esc(a.healthCareAgentPhone))}
      ${row("Preferred hospital", esc(a.preferredHospital))}
      ${row("Advance directive uploaded", esc(a.advanceDirectiveUploaded))}
    `),

    section("7 · Documents", `${table(["Document", "File"], documents)}`),
  ].join("");

  return `<!doctype html><html><head><meta charset="utf-8"><title>Admission Form — ${esc(name)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font: 13px/1.5 -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #14201c; margin: 0; padding: 32px 36px; background: #fff; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0E7C66; padding-bottom: 14px; margin-bottom: 8px; }
    .eyebrow { font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; color: #0E7C66; font-weight: 700; }
    h1 { font-size: 22px; margin: 4px 0 2px; }
    .sub { font-size: 12px; color: #5b6b66; }
    .generated { font-size: 10.5px; color: #8a9b95; }
    .sec { margin-top: 18px; break-inside: avoid; }
    .sec h2 { font-size: 13.5px; color: #0E7C66; border-bottom: 1px solid #e2ece8; padding-bottom: 5px; margin: 0 0 8px; }
    .subhead { font-size: 10.5px; letter-spacing: .06em; text-transform: uppercase; color: #8a9b95; font-weight: 700; margin: 10px 0 4px; }
    .row { display: flex; gap: 12px; padding: 3px 0; border-bottom: 1px dotted #eef3f1; }
    .lbl { flex: 0 0 190px; color: #5b6b66; }
    .val { flex: 1; font-weight: 600; }
    ul { margin: 2px 0 6px; padding-left: 18px; }
    li { margin: 1px 0; }
    .muted { color: #8a9b95; }
    .chips { display: flex; flex-wrap: wrap; gap: 5px; }
    .chip { background: #eaf5f1; color: #0E7C66; border-radius: 999px; padding: 2px 9px; font-size: 11.5px; font-weight: 600; }
    .tbl { width: 100%; border-collapse: collapse; margin: 4px 0 6px; }
    .tbl th { text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: .04em; color: #8a9b95; border-bottom: 1px solid #e2ece8; padding: 4px 8px; }
    .tbl td { padding: 4px 8px; border-bottom: 1px solid #f1f6f4; }
    @media print { body { padding: 0; } @page { margin: 14mm; } }
  </style></head><body>${body}</body></html>`;
}

export function openAdmissionFormPrint(resident, admission) {
  const html = buildAdmissionFormHtml(resident, admission);
  const win = window.open("", "_blank", "width=920,height=1000");
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  // Content is written synchronously above; give the new document a tick to
  // lay out before invoking the print dialog (user can Save as PDF).
  setTimeout(() => { try { win.print(); } catch { /* user can print manually */ } }, 250);
  return true;
}
