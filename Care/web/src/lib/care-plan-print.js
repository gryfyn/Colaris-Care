// Printable care plan document — opens in a new window for print / "Save as PDF".
// Mirrors lib/admission-print.js. All dynamic values are HTML-escaped.

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

function list(items, render) {
  if (!Array.isArray(items) || !items.length) return '<p class="muted">None recorded</p>';
  return `<ul>${items.map((item) => `<li>${render(item)}</li>`).join("")}</ul>`;
}

function section(title, body) {
  return `<section class="sec"><h2>${esc(title)}</h2>${body}</section>`;
}

export function buildCarePlanHtml(plan) {
  const c = plan?.content || {};
  const name = plan?.residentName || "Resident";

  const body = [
    `<header class="head">
       <div>
         <div class="eyebrow">Colaris Care · Resident Care Plan</div>
         <h1>${esc(name)}</h1>
         <div class="sub">${esc(plan?.title || "Care plan")} · Room ${esc(plan?.room)} · Status ${esc(plan?.status)}</div>
       </div>
       <div class="generated">Generated ${fmtDate(new Date())}</div>
     </header>`,

    section("Plan overview", `
      ${row("Focus / title", esc(plan?.title))}
      ${row("Summary", esc(plan?.summary))}
      ${row("Plan owner", esc(c.owner))}
      ${row("Status", esc(plan?.status))}
      ${row("Effective date", fmtDate(c.effectiveDate || plan?.createdAt))}
      ${row("Last reviewed", fmtDate(plan?.reviewedAt))}
      ${row("Next review", fmtDate(plan?.nextReviewAt))}
      ${row("Review cycle", esc(c.reviewCycle))}
      ${row("Clinician signed", plan?.signedAt ? fmtDate(plan.signedAt) : "Pending")}
      ${row("Administrator approved", plan?.approvedAt ? fmtDate(plan.approvedAt) : "Pending")}
    `),

    section("Goals", list(c.goals, (g) => `${esc(g.title)}${g.progress ? ` <span class="tag">${esc(g.progress)}</span>` : ""}`)),

    section("Objectives", list(c.objectives, (o) =>
      `${esc(o.title)}${(o.goal || o.cadence) ? ` <span class="muted">(${[o.goal, o.cadence].filter(Boolean).map(esc).join(" · ")})</span>` : ""}`)),

    section("Interventions", list(c.interventions, (i) =>
      `${esc(i.title)}${(i.owner || i.frequency) ? ` <span class="muted">(${[i.owner, i.frequency].filter(Boolean).map(esc).join(" · ")})</span>` : ""}`)),

    section("Review history", list(c.reviews, (rv) =>
      `${esc(rv.title || "Review")}${rv.meta ? ` <span class="muted">— ${esc(rv.meta)}</span>` : ""}${rv.note ? `<div class="note">${esc(rv.note)}</div>` : ""}`)),
  ].join("");

  return `<!doctype html><html><head><meta charset="utf-8"><title>Care Plan — ${esc(name)}</title>
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
    .row { display: flex; gap: 12px; padding: 3px 0; border-bottom: 1px dotted #eef3f1; }
    .lbl { flex: 0 0 190px; color: #5b6b66; }
    .val { flex: 1; font-weight: 600; }
    ul { margin: 4px 0 6px; padding-left: 18px; }
    li { margin: 3px 0; }
    .muted { color: #8a9b95; font-weight: 400; }
    .note { font-size: 12px; color: #5b6b66; margin-top: 2px; }
    .tag { background: #eaf5f1; color: #0E7C66; border-radius: 999px; padding: 1px 8px; font-size: 11px; font-weight: 600; }
    @media print { body { padding: 0; } @page { margin: 14mm; } }
  </style></head><body>${body}</body></html>`;
}

export function openCarePlanPrint(plan) {
  const html = buildCarePlanHtml(plan);
  const win = window.open("", "_blank", "width=920,height=1000");
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { try { win.print(); } catch { /* user can print manually */ } }, 250);
  return true;
}
