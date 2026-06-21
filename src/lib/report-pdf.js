import { jsPDF } from 'jspdf';

/**
 * Shared, professional PDF generator for the Reports Hub.
 *
 * Produces a clean document with:
 *   - Company header (DEPENDABLE CARE WELLNESS CENTRE) + form title
 *   - A demographics / meta block (resident, date, author, status)
 *   - Organized sections derived from the form record (nested JSON is
 *     expanded into its own titled section)
 *   - The same footer used on the Daily Progress Note
 *     ("Generated: ..." + "Confidential - Staff Use Only") on every page
 *
 * Runs server-side (jsPDF works in Node) and returns a Buffer.
 */

const C = {
  navy:   [15, 45, 94],
  text:   [30, 45, 64],
  muted:  [107, 124, 147],
  soft:   [100, 116, 139],
  border: [191, 219, 254],
};

const COMPANY = 'DEPENDABLE CARE WELLNESS CENTRE';

function humanize(key) {
  return String(key)
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function isIsoDate(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}|$)/.test(v);
}

function formatValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (isIsoDate(value)) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      const hasTime = /[T ]\d{2}:\d{2}/.test(value);
      return hasTime
        ? d.toLocaleString('en-US')
        : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }
  }
  return String(value);
}

function isEmpty(value) {
  if (value === null || value === undefined || value === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) return true;
  return false;
}

/**
 * Turn a flat/nested record into an ordered list of sections.
 * Scalar fields collapse into a single "Record Details" section; nested
 * objects and arrays of objects each become their own section.
 */
function buildSections(data, excludeKeys) {
  const exclude = new Set(excludeKeys);
  const scalarEntries = [];
  const nestedSections = [];

  for (const [key, value] of Object.entries(data)) {
    if (exclude.has(key)) continue;
    if (isEmpty(value)) continue;

    if (Array.isArray(value)) {
      const allScalar = value.every((v) => v === null || typeof v !== 'object');
      if (allScalar) {
        scalarEntries.push({ label: humanize(key), value: value.map(formatValue).filter(Boolean).join(', ') });
      } else {
        const entries = [];
        value.forEach((item, i) => {
          entries.push({ subheading: `${humanize(key)} #${i + 1}` });
          if (item && typeof item === 'object') {
            Object.entries(item).forEach(([k, v]) => {
              if (isEmpty(v)) return;
              entries.push({ label: humanize(k), value: typeof v === 'object' ? JSON.stringify(v) : formatValue(v) });
            });
          } else {
            entries.push({ label: 'Value', value: formatValue(item) });
          }
        });
        nestedSections.push({ title: humanize(key), entries });
      }
    } else if (typeof value === 'object') {
      const entries = [];
      Object.entries(value).forEach(([k, v]) => {
        if (isEmpty(v)) return;
        if (Array.isArray(v)) {
          const allScalar = v.every((x) => x === null || typeof x !== 'object');
          entries.push({ label: humanize(k), value: allScalar ? v.map(formatValue).filter(Boolean).join(', ') : JSON.stringify(v) });
        } else if (typeof v === 'object') {
          entries.push({ label: humanize(k), value: JSON.stringify(v) });
        } else {
          entries.push({ label: humanize(k), value: formatValue(v) });
        }
      });
      if (entries.length) nestedSections.push({ title: humanize(key), entries });
    } else {
      scalarEntries.push({ label: humanize(key), value: formatValue(value) });
    }
  }

  const sections = [];
  if (scalarEntries.length) sections.push({ title: 'Record Details', entries: scalarEntries });
  return sections.concat(nestedSections);
}

export function generateReportPDF({
  formTitle = 'Form Record',
  residentName = 'Unknown',
  showResident = true,
  author = 'Unknown',
  status = 'N/A',
  dateCreated,
  data = {},
  excludeKeys = [],
}) {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const leftMargin = 15;
  const rightMargin = 15;
  const contentWidth = pageWidth - leftMargin - rightMargin;
  const labelWidth = 50;
  let y = 14;

  const checkNewPage = (needed = 8) => {
    if (y + needed > pageHeight - 20) {
      pdf.addPage();
      y = 18;
    }
  };

  // ── HEADER ──────────────────────────────────────────────────
  pdf.setTextColor(...C.navy);
  pdf.setFont('Helvetica', 'bold');
  pdf.setFontSize(15);
  pdf.text(COMPANY, leftMargin, y);
  y += 7;

  pdf.setFontSize(12);
  pdf.text(String(formTitle).toUpperCase(), leftMargin, y);
  y += 6;

  pdf.setDrawColor(...C.border);
  pdf.setLineWidth(0.5);
  pdf.line(leftMargin, y, pageWidth - rightMargin, y);
  y += 7;

  // ── META BLOCK ──────────────────────────────────────────────
  const col2 = pageWidth / 2 + 5;
  const meta = (label, value, x) => {
    pdf.setFont('Helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(...C.navy);
    pdf.text(label, x, y);
    pdf.setFont('Helvetica', 'normal');
    pdf.setTextColor(...C.text);
    pdf.text(String(value || '—'), x + 28, y);
  };

  const dateStr = dateCreated
    ? new Date(dateCreated).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

  if (showResident) {
    meta('Resident:', residentName, leftMargin);
    meta('Date:', dateStr, col2);
  } else {
    meta('Scope:', 'Facility-wide', leftMargin);
    meta('Date:', dateStr, col2);
  }
  y += 6;
  meta('Prepared By:', author, leftMargin);
  meta('Status:', humanize(status), col2);
  y += 9;

  // ── SECTIONS ────────────────────────────────────────────────
  const sections = buildSections(data, excludeKeys);

  if (sections.length === 0) {
    pdf.setFont('Helvetica', 'italic');
    pdf.setFontSize(10);
    pdf.setTextColor(...C.muted);
    pdf.text('No additional details recorded for this form.', leftMargin, y);
    y += 6;
  }

  const drawSectionHeader = (title) => {
    checkNewPage(14);
    y += 2;
    pdf.setFont('Helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(...C.navy);
    pdf.text(String(title).toUpperCase(), leftMargin, y);
    y += 2;
    pdf.setDrawColor(...C.border);
    pdf.setLineWidth(0.3);
    pdf.line(leftMargin, y, pageWidth - rightMargin, y);
    y += 5;
  };

  const drawSubheading = (text) => {
    checkNewPage(8);
    y += 1;
    pdf.setFont('Helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(...C.soft);
    pdf.text(text, leftMargin, y);
    y += 5;
  };

  const drawEntry = (label, value) => {
    pdf.setFont('Helvetica', 'bold');
    pdf.setFontSize(9);
    const labelLines = pdf.splitTextToSize(`${label}:`, labelWidth - 2);
    pdf.setFont('Helvetica', 'normal');
    const valueLines = pdf.splitTextToSize(value || '—', contentWidth - labelWidth);
    const rows = Math.max(labelLines.length, valueLines.length);
    checkNewPage(rows * 4.6 + 2);

    pdf.setFont('Helvetica', 'bold');
    pdf.setTextColor(...C.text);
    pdf.text(labelLines, leftMargin, y);
    pdf.setFont('Helvetica', 'normal');
    pdf.setTextColor(...C.text);
    pdf.text(valueLines, leftMargin + labelWidth, y);
    y += rows * 4.6 + 2;
  };

  for (const section of sections) {
    drawSectionHeader(section.title);
    for (const entry of section.entries) {
      if (entry.subheading) drawSubheading(entry.subheading);
      else drawEntry(entry.label, entry.value);
    }
    y += 3;
  }

  // ── FOOTER (every page) ─────────────────────────────────────
  const generatedAt = new Date().toLocaleString();
  const pageCount = pdf.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFont('Helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...C.muted);
    pdf.text(`Generated: ${generatedAt}`, pageWidth / 2, pageHeight - 12, { align: 'center' });
    pdf.text('Confidential - Staff Use Only', pageWidth / 2, pageHeight - 9, { align: 'center' });
    pdf.text(`Page ${i} of ${pageCount}`, pageWidth - rightMargin, pageHeight - 9, { align: 'right' });
  }

  return Buffer.from(pdf.output('arraybuffer'));
}
