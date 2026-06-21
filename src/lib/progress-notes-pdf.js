import { jsPDF } from 'jspdf';

const C = {
  navy: "#0f2d5e",
  navyMid: "#1a3a5c",
  blue: "#1a56db",
  bluePale: "#eef4ff",
  blueBorder: "#bfdbfe",
  white: "#ffffff",
  bg: "#f4f8ff",
  text: "#1e2d40",
  muted: "#6b7c93",
  border: "#dde6f0",
};

const PROGRESS_NOTE_FIELD_SECTIONS = [
  {
    title: 'PROGRESS NOTES',
    fields: [
      { key: 'progressNotes', label: 'Progress Notes', type: 'long' },
    ],
  },
  {
    title: 'MOOD & BEHAVIOR',
    fields: [
      { key: 'moodBehavior', label: 'Observed Mood/Behavior', type: 'list' },
    ],
  },
  {
    title: 'PHYSICAL HEALTH',
    fields: [
      { key: 'physicalHealth', label: 'Health Status', type: 'list' },
    ],
  },
  {
    title: 'MEDICATIONS ADMINISTERED',
    fields: [
      { key: 'medicationsAdministered', label: 'Medications Given', type: 'list' },
    ],
  },
  {
    title: 'MEAL INTAKE',
    fields: [
      { key: 'mealsBreakfast', label: 'Breakfast %', suffix: '%' },
      { key: 'mealsBreakfastNotes', label: 'Breakfast Notes' },
      { key: 'mealsLunch', label: 'Lunch %', suffix: '%' },
      { key: 'mealsLunchNotes', label: 'Lunch Notes' },
      { key: 'mealsDinner', label: 'Dinner %', suffix: '%' },
      { key: 'mealsDinnerNotes', label: 'Dinner Notes' },
    ],
  },
  {
    title: 'ACTIVITIES',
    fields: [
      { key: 'activitiesParticipated', label: 'Activities Participated', type: 'list' },
    ],
  },
  {
    title: 'INCIDENTS & CONCERNS',
    fields: [
      { key: 'incidents', label: 'Incidents or Concerns', type: 'long' },
    ],
  },
];

function normalizeProgressNoteBody(noteBody) {
  if (!noteBody) return {};
  if (typeof noteBody === 'string') {
    try {
      const parsed = JSON.parse(noteBody);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return { progressNotes: noteBody };
    }
  }
  return typeof noteBody === 'object' && !Array.isArray(noteBody) ? noteBody : {};
}

function formatSubmittedValue(value, { suffix } = {}) {
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  const text = String(value);
  return suffix && text !== '—' ? `${text}${suffix}` : text;
}

/**
 * Generate progress notes PDF matching Daily Progress Note.docx format
 * @param {object} note - Progress note data from API
 * @returns {Promise<Blob>} PDF blob
 */
export async function generateProgressNotesPDF(note) {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  let yPosition = 12;
  const leftMargin = 15;
  const rightMargin = 15;
  const contentWidth = pageWidth - leftMargin - rightMargin;
  const noteBody = normalizeProgressNoteBody(note.note_body);

  // HEADER SECTION
  // Facility name and logo placeholder
  pdf.setTextColor(15, 45, 94);
  pdf.setFont('Helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text('DEPENDABLE CARE RESIDENTIAL CENTER', leftMargin, yPosition);
  yPosition += 7;

  // Form title
  pdf.setFontSize(12);
  pdf.setFont('Helvetica', 'bold');
  pdf.text('DAILY PROGRESS NOTE', leftMargin, yPosition);
  yPosition += 10;

  // Separator line
  pdf.setDrawColor(191, 219, 254);
  pdf.line(leftMargin, yPosition, pageWidth - rightMargin, yPosition);
  yPosition += 5;

  // DEMOGRAPHICS SECTION
  pdf.setFontSize(10);
  pdf.setFont('Helvetica', 'bold');
  pdf.setTextColor(15, 45, 94);

  // Row 1: Resident Name and Date
  pdf.text('Resident Name:', leftMargin, yPosition);
  pdf.setFont('Helvetica', 'normal');
  const residentName = `${note.first_name || ''} ${note.last_name || ''}`.trim() || 'Not specified';
  pdf.text(residentName, leftMargin + 35, yPosition);

  pdf.setFont('Helvetica', 'bold');
  pdf.text('Date:', pageWidth / 2 + 5, yPosition);
  pdf.setFont('Helvetica', 'normal');
  const noteDate = note.note_date ? new Date(note.note_date).toLocaleDateString() : 'Not specified';
  pdf.text(noteDate, pageWidth / 2 + 20, yPosition);
  yPosition += 7;

  // Row 2: Staff on Shift
  pdf.setFont('Helvetica', 'bold');
  pdf.text('Staff on Shift:', leftMargin, yPosition);
  pdf.setFont('Helvetica', 'normal');
  const staffName = `${note.staff_first_name || ''} ${note.staff_last_name || ''}`.trim() || 'Not specified';
  pdf.text(staffName, leftMargin + 35, yPosition);

  pdf.setFont('Helvetica', 'bold');
  pdf.text('Shift:', pageWidth / 2 + 5, yPosition);
  pdf.setFont('Helvetica', 'normal');
  const shiftText = formatShiftType(note.shift);
  pdf.text(shiftText, pageWidth / 2 + 20, yPosition);
  yPosition += 10;

  const checkNewPage = (needed = 8) => {
    if (yPosition + needed > pageHeight - 18) {
      pdf.addPage();
      yPosition = 15;
    }
  };

  for (const section of PROGRESS_NOTE_FIELD_SECTIONS) {
    checkNewPage(12);
    pdf.setFont('Helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(15, 45, 94);
    pdf.text(`${section.title}:`, leftMargin, yPosition);
    yPosition += 5;

    for (const field of section.fields) {
      const value = formatSubmittedValue(noteBody[field.key], field);
      const text = `${field.label}: ${value}`;
      pdf.setFont('Helvetica', field.type === 'long' ? 'normal' : 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(30, 45, 64);
      const lines = pdf.splitTextToSize(text, contentWidth - 5);
      checkNewPage(lines.length * 4 + 4);
      pdf.text(lines, leftMargin + 2, yPosition);
      yPosition += lines.length * 4 + 3;
    }

    yPosition += 2;
  }

  // FOOTER
  yPosition = pageHeight - 12;
  pdf.setFontSize(8);
  pdf.setTextColor(107, 124, 147);
  pdf.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, yPosition, { align: 'center' });
  pdf.setFontSize(8);
  pdf.text('Confidential - Staff Use Only', pageWidth / 2, yPosition + 3, { align: 'center' });

  return pdf.output('blob');
}

/**
 * Format shift display
 */
function formatShift(shift) {
  const map = { morning: 'Morning (6am - 2pm)', afternoon: 'Afternoon (2pm - 10pm)', night: 'Night (10pm - 6am)' };
  return map[(shift || '').toLowerCase()] || (shift || '—');
}

/**
 * Format shift type for document (DAY/NIGHT)
 */
function formatShiftType(shift) {
  const lower = (shift || '').toLowerCase();
  if (lower === 'morning' || lower === 'afternoon') return 'DAY';
  if (lower === 'night') return 'NIGHT';
  return shift || '—';
}

/**
 * Format status display
 */
function formatStatus(status) {
  const lower = (status || '').toLowerCase();
  if (lower === 'pending') return 'Pending Review';
  if (lower === 'approved' || lower === 'reviewed') return 'Approved';
  if (lower === 'rejected') return 'Rejected';
  return status || '—';
}

/**
 * Download progress notes PDF
 * @param {object} note - Progress note data
 */
export async function downloadProgressNotesPDF(note) {
  try {
    const blob = await generateProgressNotesPDF(note);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const residentName = `${note.first_name || ''} ${note.last_name || ''}`.trim().replace(/\s+/g, '_').toLowerCase();
    const dateStr = note.note_date || new Date().toISOString().split('T')[0];
    const filename = `progress_note_${residentName}_${dateStr}.pdf`;

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);

    return { success: true, filename };
  } catch (error) {
    console.error('PDF download failed:', error);
    throw new Error(`Failed to download PDF: ${error.message}`);
  }
}
