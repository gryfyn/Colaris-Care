'use client';
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const C = {
  navy: '#0f2d5e',
  blue: '#1a56db',
  bluePale: '#eef4ff',
  white: '#ffffff',
  border: '#dde6f0',
  text: '#1e2d40',
  muted: '#6b7c93',
  green: '#059669',
  red: '#dc2626',
};

/**
 * Expandable row for daily progress notes showing all details
 */
export function ProgressNoteRow({ note, isMobile, onDownload }) {
  const [expanded, setExpanded] = useState(false);

  const formatShiftType = (shift) => {
    const lower = (shift || '').toLowerCase();
    if (lower === 'morning' || lower === 'afternoon') return 'DAY';
    if (lower === 'night') return 'NIGHT';
    return shift || '—';
  };

  const statusColor = {
    'approved': C.green,
    'pending': '#f59e0b',
    'rejected': C.red,
  };

  const statusBg = {
    'approved': '#ecfdf5',
    'pending': '#fffbeb',
    'rejected': '#fef2f2',
  };

  const noteBody = normalizeProgressNoteBody(note.note_body);

  return (
    <div
      style={{
        borderBottom: `1px solid ${C.border}`,
        background: C.white,
      }}
    >
      {/* Summary Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.5fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) auto',
          gap: isMobile ? 12 : 0,
          padding: isMobile ? 16 : '12px 16px',
          alignItems: 'center',
          fontSize: isMobile ? 13 : 14,
        }}
      >
        {isMobile && (
          <div style={{ gridColumn: '1 / -1', fontWeight: 600, color: C.text, marginBottom: 8 }}>
            {note.first_name} {note.last_name}
          </div>
        )}

        {!isMobile && (
          <div style={{ color: C.text, fontWeight: 500 }}>
            {note.first_name} {note.last_name}
          </div>
        )}

        <div style={{ color: C.muted }}>
          {note.note_date}
        </div>

        <div style={{ color: C.muted }}>
          {note.staff_first_name} {note.staff_last_name}
        </div>

        <div>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              background: statusBg[note.review_status] || statusBg['pending'],
              color: statusColor[note.review_status] || '#666',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            {note.review_status === 'approved' ? '✓' : note.review_status === 'rejected' ? '✗' : '⏳'} {' '}
            {note.review_status === 'pending' ? 'Pending' : note.review_status === 'approved' ? 'Approved' : 'Rejected'}
          </span>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 8,
            color: C.blue,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div
          style={{
            padding: isMobile ? 16 : 24,
            background: C.bluePale,
            borderTop: `1px solid ${C.border}`,
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 24 }}>
            {PROGRESS_NOTE_FIELD_SECTIONS.map((section) => (
              <DetailSection key={section.title} title={section.title}>
                {section.fields.map((field) => (
                  <FieldValue key={field.key} field={field} value={noteBody[field.key]} />
                ))}
              </DetailSection>
            ))}
          </div>

          {/* Review Notes */}
          {note.review_notes && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 8 }}>
                REVIEW NOTES
              </div>
              <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>{note.review_notes}</div>
            </div>
          )}

          {/* Download Button */}
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
            <button
              onClick={() => onDownload(note.id)}
              style={{
                padding: '10px 16px',
                background: C.blue,
                color: C.white,
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#1a3a7a';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = C.blue;
              }}
            >
              Download PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const PROGRESS_NOTE_FIELD_SECTIONS = [
  { title: 'Progress Notes', fields: [{ key: 'progressNotes', label: 'Progress Notes', type: 'long' }] },
  { title: 'Mood & Behavior', fields: [{ key: 'moodBehavior', label: 'Observed Mood/Behavior', type: 'list' }] },
  { title: 'Physical Health', fields: [{ key: 'physicalHealth', label: 'Health Status', type: 'list' }] },
  { title: 'Medications Administered', fields: [{ key: 'medicationsAdministered', label: 'Medications Given', type: 'list' }] },
  {
    title: 'Meal Intake',
    fields: [
      { key: 'mealsBreakfast', label: 'Breakfast %', suffix: '%' },
      { key: 'mealsBreakfastNotes', label: 'Breakfast Notes', type: 'long' },
      { key: 'mealsLunch', label: 'Lunch %', suffix: '%' },
      { key: 'mealsLunchNotes', label: 'Lunch Notes', type: 'long' },
      { key: 'mealsDinner', label: 'Dinner %', suffix: '%' },
      { key: 'mealsDinnerNotes', label: 'Dinner Notes', type: 'long' },
    ],
  },
  { title: 'Activities', fields: [{ key: 'activitiesParticipated', label: 'Activities Participated', type: 'list' }] },
  { title: 'Incidents & Concerns', fields: [{ key: 'incidents', label: 'Incidents or Concerns', type: 'long' }] },
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

function DetailSection({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.navy, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {title}
      </div>
      <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
        {children}
      </div>
    </div>
  );
}

function FieldValue({ field, value }) {
  const submittedValue = formatSubmittedValue(value, field);
  return (
    <div style={{ marginBottom: 10, fontSize: 13, color: C.text, whiteSpace: field.type === 'long' ? 'pre-wrap' : 'normal' }}>
      <span style={{ fontWeight: 600 }}>{field.label}:</span> {submittedValue}
    </div>
  );
}
