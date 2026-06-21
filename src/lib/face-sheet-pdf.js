import { jsPDF } from 'jspdf';
import { FACE_SHEET_SECTIONS, computeAge } from '@/app/components/faceSheetConfig';

// Client-side professional PDF export of a resident face sheet, mirroring the
// "Dependable Care Resident Face Sheet" document: branded header with the
// company logo, all sections rendered as a two-column form, and a HIPAA
// confidentiality footer with page numbers on every page.

const C = {
  navy: [15, 45, 94],
  text: [30, 45, 64],
  muted: [107, 124, 147],
  border: [199, 215, 245],
};

const COMPANY = 'Dependable Care Residential Services';
const TITLE = 'Resident Face Sheet';
const FOOTER =
  'Dependable Care Residential Services   |   Resident Face Sheet   |   This document contains confidential health information protected by HIPAA.';

async function loadLogo() {
  try {
    const res = await fetch('/logo.png');
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function loadRemoteImage(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function formatValue(field, value) {
  if (value == null || value === '') return '';
  if (field.type === 'date') {
    const d = new Date(String(value).length <= 10 ? `${value}T12:00:00` : value);
    return isNaN(d) ? String(value) : d.toLocaleDateString('en-US');
  }
  return String(value);
}

export async function downloadFaceSheetPDF({ residentName = 'Resident', values = {}, generatedBy = '', photoUrl = null }) {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const left = 15;
  const right = 15;
  const contentW = pageW - left - right;
  const colGap = 8;
  const colW = (contentW - colGap) / 2;
  let y = 14;

  // ── HEADER: logo + company + title ──────────────────────────────
  const logo = await loadLogo();
  const residentPhoto = await loadRemoteImage(photoUrl);
  let textX = left;
  if (logo) {
    try {
      const props = pdf.getImageProperties(logo);
      const h = 16;
      const w = props.width && props.height ? (h * props.width) / props.height : 16;
      pdf.addImage(logo, 'PNG', left, y - 1, w, h);
      textX = left + w + 5;
    } catch {
      textX = left;
    }
  }
  pdf.setTextColor(...C.navy);
  pdf.setFont('Helvetica', 'bold');
  pdf.setFontSize(15);
  pdf.text(COMPANY, textX, y + 4);
  pdf.setFontSize(11);
  pdf.text(TITLE.toUpperCase(), textX, y + 10);
  pdf.setFont('Helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(...C.muted);
  pdf.text('Confidential — For Authorized Personnel Only', textX, y + 14.5);
  y += 19;

  pdf.setDrawColor(...C.navy);
  pdf.setLineWidth(0.6);
  pdf.line(left, y, pageW - right, y);
  y += 7;

  // ── RESIDENT + META LINE ────────────────────────────────────────
  pdf.setFont('Helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.setTextColor(...C.navy);
  pdf.text(residentName || 'Resident', left, y);
  pdf.setFont('Helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(...C.muted);
  const meta = `Generated ${new Date().toLocaleDateString('en-US')}${generatedBy ? `  ·  by ${generatedBy}` : ''}`;
  pdf.text(meta, pageW - right, y, { align: 'right' });
  y += 8;

  if (residentPhoto) {
    try {
      const size = 24;
      const x = pageW - right - size;
      pdf.setDrawColor(...C.border);
      pdf.roundedRect(x, y - 6, size, size, 2, 2);
      pdf.addImage(residentPhoto, undefined, x, y - 6, size, size);
    } catch {
      /* resident photo is optional */
    }
  }

  const checkPage = (need = 8) => {
    if (y + need > pageH - 18) {
      pdf.addPage();
      y = 18;
    }
  };

  const drawSectionHeader = (t) => {
    checkPage(16);
    y += 2;
    pdf.setFont('Helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(...C.navy);
    pdf.text(String(t).toUpperCase(), left, y);
    y += 1.6;
    pdf.setDrawColor(...C.border);
    pdf.setLineWidth(0.3);
    pdf.line(left, y, pageW - right, y);
    y += 5;
  };

  const displayFor = (field) => {
    if (field.computed === 'age') return computeAge(values.date_of_birth);
    return formatValue(field, values[field.key]);
  };

  const cellHeight = (field, w) => {
    const lines = pdf.splitTextToSize(displayFor(field) || '—', w);
    return 4 + lines.length * 4.3 + 3;
  };

  const drawCellAt = (field, x, yy, w) => {
    pdf.setFont('Helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...C.muted);
    pdf.text(String(field.label).toUpperCase(), x, yy);
    pdf.setFont('Helvetica', 'normal');
    pdf.setFontSize(9.5);
    pdf.setTextColor(...C.text);
    const lines = pdf.splitTextToSize(displayFor(field) || '—', w);
    pdf.text(lines, x, yy + 4);
  };

  for (const section of FACE_SHEET_SECTIONS) {
    drawSectionHeader(section.title);
    const fields = section.fields;
    let i = 0;
    while (i < fields.length) {
      const f = fields[i];
      if (f.type === 'textarea') {
        const h = cellHeight(f, contentW);
        checkPage(h);
        drawCellAt(f, left, y, contentW);
        y += h;
        i += 1;
      } else {
        const f2 = i + 1 < fields.length && fields[i + 1].type !== 'textarea' ? fields[i + 1] : null;
        const h = Math.max(cellHeight(f, colW), f2 ? cellHeight(f2, colW) : 0);
        checkPage(h);
        drawCellAt(f, left, y, colW);
        if (f2) drawCellAt(f2, left + colW + colGap, y, colW);
        y += h;
        i += f2 ? 2 : 1;
      }
    }
    y += 3;
  }

  // ── FAINT CENTERED WATERMARK + FOOTER (every page) ──────────────
  const pageCount = pdf.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    pdf.setPage(p);

    // Branded watermark — drawn at ~5% opacity so body text stays legible.
    if (logo && pdf.GState) {
      try {
        const props = pdf.getImageProperties(logo);
        const ww = 90;
        const wh = props.width && props.height ? (ww * props.height) / props.width : 90;
        pdf.setGState(new pdf.GState({ opacity: 0.05 }));
        pdf.addImage(logo, 'PNG', (pageW - ww) / 2, (pageH - wh) / 2, ww, wh);
        pdf.setGState(new pdf.GState({ opacity: 1 }));
      } catch {
        /* watermark is optional */
      }
    }

    pdf.setDrawColor(...C.border);
    pdf.setLineWidth(0.3);
    pdf.line(left, pageH - 14, pageW - right, pageH - 14);
    pdf.setFont('Helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(...C.muted);
    pdf.text(FOOTER, pageW / 2, pageH - 10, { align: 'center', maxWidth: contentW });
    pdf.text(`Page ${p} of ${pageCount}`, pageW - right, pageH - 6, { align: 'right' });
  }

  const safeName = String(residentName || 'resident').replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '');
  pdf.save(`FaceSheet_${safeName || 'resident'}.pdf`);
}
