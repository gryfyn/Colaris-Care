/**
 * Server-side PDF generation for admission forms using jsPDF (headless / Node).
 *
 * The three admission forms (nursing assessment, pre-screening, advance
 * directive) all submit a flat camelCase formData object. Rather than maintain
 * three brittle hand-laid templates, we render a clean, paginated "record copy"
 * PDF: a HIPAA header, the form title, then every populated field as a
 * humanized Label / Value row. Empty values and internal keys are skipped.
 *
 * Each generator returns a Node Buffer (application/pdf) ready to stream back
 * from the route handler.
 */
import { jsPDF } from 'jspdf';

const FACILITY = 'Dependable Care Residential Center';

const FORM_TITLES = {
  'nursing-assessment': 'Nursing Admission Assessment',
  'pre-screening': 'Pre-Admission Screening',
  'advance-directive': 'Advance Directive',
};

// Keys we never want to print (UI/bookkeeping noise or typed-column duplicates
// of a camelCase field the form already shows).
const SKIP_KEYS = new Set([
  'rnSignature', 'assessmentDate',
  '__steps', // client-only per-step bucket map persisted for draft rehydration
]);
const SKIP_PREFIXES = ['vital_', 'height_inches', 'weight_lbs', 'pain_level', 'pain_location',
  'skin_assessment', 'sleep_history', 'functional_mobility', 'fall_risk', 'suicide_risk',
  'sexual_history_risk', 'violence_risk', 'substance_abuse_history', 'mental_health_assessment',
  'nursing_assessment_notes', 'full_name'];

// Turn a camelCase / snake_case key into a human label: "emergencyName" -> "Emergency Name".
function humanize(key) {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bO2\b/i, 'O₂')
    .trim();
}

function formatValue(val) {
  if (val === null || val === undefined) return '';
  if (Array.isArray(val)) return val.join(', ');
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  return String(val);
}

function isEmpty(val) {
  if (val === null || val === undefined || val === '') return true;
  if (Array.isArray(val) && val.length === 0) return true;
  return false;
}

function shouldSkip(key) {
  if (SKIP_KEYS.has(key)) return true;
  return SKIP_PREFIXES.some((p) => key === p || key.startsWith(p));
}

/**
 * Render a form's data into a PDF Buffer.
 * @param {string} formType
 * @param {object} formData flat field map
 * @returns {Buffer}
 */
export function generateFormPDF(formType, formData = {}) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const labelX = margin;
  const valueX = margin + 200;
  const valueWidth = pageWidth - valueX - margin;
  let y = margin;

  const title = FORM_TITLES[formType] || 'Admission Form';
  const generatedAt = new Date().toLocaleString();

  // ── Header ────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(FACILITY, margin, y);
  y += 20;
  doc.setFontSize(13);
  doc.text(title, margin, y);
  y += 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generated: ${generatedAt}`, margin, y);
  doc.text('CONFIDENTIAL — Protected Health Information (HIPAA)', pageWidth - margin, y, { align: 'right' });
  y += 10;
  doc.setDrawColor(180);
  doc.line(margin, y, pageWidth - margin, y);
  y += 18;
  doc.setTextColor(20);

  const ensureSpace = (needed) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const rows = Object.entries(formData)
    .filter(([k, v]) => !shouldSkip(k) && !isEmpty(v));

  if (rows.length === 0) {
    doc.setFontSize(11);
    doc.text('No data captured for this form.', margin, y);
  }

  doc.setFontSize(10);
  for (const [key, val] of rows) {
    const label = humanize(key);
    const value = formatValue(val);
    const valueLines = doc.splitTextToSize(value, valueWidth);
    const rowHeight = Math.max(16, valueLines.length * 13 + 4);
    ensureSpace(rowHeight);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(70);
    doc.text(humanize(label), labelX, y, { maxWidth: 185 });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(20);
    doc.text(valueLines, valueX, y);
    y += rowHeight;
  }

  // Footer page numbers
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 24, { align: 'right' });
    doc.text(FACILITY, margin, pageHeight - 24);
  }

  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}

export const generateNursingAssessmentPDF = (formData) => generateFormPDF('nursing-assessment', formData);
export const generatePreScreeningPDF = (formData) => generateFormPDF('pre-screening', formData);
export const generateAdvanceDirectivePDF = (formData) => generateFormPDF('advance-directive', formData);
