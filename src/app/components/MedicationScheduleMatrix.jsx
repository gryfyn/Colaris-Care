'use client';

/**
 * MedicationScheduleMatrix
 *
 * Displays a grid of medications (rows) x time periods (columns) with checkboxes.
 * Healthcare staff can mark which time slots each medication is administered.
 *
 * Props:
 *   medications  - Array of { id, drug_name, dosage, route, frequency, is_prn }
 *   schedule     - Object: { [medicationId]: { morning, afternoon, evening, night, as_needed } }
 *   onScheduleChange - (newSchedule) => void  — called on every checkbox toggle
 *   readOnly     - boolean, renders checkboxes as disabled display when true
 */

const TIME_PERIODS = [
  { key: 'morning',   label: 'Morning',   abbr: 'AM',  color: '#d97706' },
  { key: 'afternoon', label: 'Afternoon', abbr: 'Noon', color: '#0891b2' },
  { key: 'evening',   label: 'Evening',   abbr: 'PM',  color: '#1a56db' },
  { key: 'night',     label: 'Night',     abbr: 'HS',  color: '#0f2d5e' },
  { key: 'as_needed', label: 'As Needed', abbr: 'PRN', color: '#7c3aed' },
];

const C = {
  navy:       '#0f2d5e',
  blue:       '#1a56db',
  bluePale:   '#eef4ff',
  blueBorder: '#bfdbfe',
  white:      '#ffffff',
  bg:         '#f4f8ff',
  text:       '#1e2d40',
  muted:      '#6b7c93',
  border:     '#dde6f0',
};

function MatrixCheckbox({ checked, onChange, disabled, color }) {
  return (
    <span
      onClick={disabled ? undefined : onChange}
      role="checkbox"
      aria-checked={checked}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={e => { if (!disabled && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); onChange(); } }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 22,
        height: 22,
        borderRadius: 4,
        border: `1.5px solid ${checked ? color : C.blueBorder}`,
        background: checked ? color : C.white,
        cursor: disabled ? 'default' : 'pointer',
        flexShrink: 0,
        transition: 'background 0.12s, border-color 0.12s',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {checked && (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}

export default function MedicationScheduleMatrix({ medications = [], schedule = {}, onScheduleChange, readOnly = false }) {
  if (!medications.length) {
    return (
      <div style={{
        background: C.bg,
        border: `1px dashed ${C.blueBorder}`,
        borderRadius: 8,
        padding: '18px 20px',
        fontSize: 13,
        color: C.muted,
        textAlign: 'center',
      }}>
        No medications on file for this resident. Add medications first via the Medications section.
      </div>
    );
  }

  const toggle = (medicationId, periodKey) => {
    if (readOnly) return;
    const current = schedule[medicationId] ?? {};
    const updated = { ...schedule, [medicationId]: { ...current, [periodKey]: !current[periodKey] } };
    onScheduleChange?.(updated);
  };

  const headerCellStyle = {
    padding: '8px 6px',
    fontSize: 11,
    fontWeight: 700,
    color: C.navy,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    borderBottom: `2px solid ${C.blueBorder}`,
    whiteSpace: 'nowrap',
  };

  const rowStyle = (idx) => ({
    background: idx % 2 === 0 ? C.white : C.bg,
    borderBottom: `1px solid ${C.border}`,
  });

  const medCellStyle = {
    padding: '10px 12px',
    verticalAlign: 'middle',
  };

  const checkCellStyle = {
    padding: '10px 6px',
    textAlign: 'center',
    verticalAlign: 'middle',
  };

  return (
    <div style={{ overflowX: 'auto', borderRadius: 8, border: `1px solid ${C.blueBorder}`, background: C.white }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560, tableLayout: 'auto' }}>
        <thead>
          <tr>
            <th style={{ ...headerCellStyle, textAlign: 'left', padding: '8px 12px', minWidth: 200 }}>
              Medication
            </th>
            {TIME_PERIODS.map(p => (
              <th key={p.key} style={headerCellStyle}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: p.color,
                    background: p.color + '18',
                    borderRadius: 4,
                    padding: '2px 6px',
                    letterSpacing: '0.06em',
                  }}>
                    {p.abbr}
                  </span>
                  <span style={{ fontSize: 10, color: C.muted, fontWeight: 500 }}>{p.label}</span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {medications.map((med, idx) => {
            const medSchedule = schedule[med.id] ?? {};
            return (
              <tr key={med.id} style={rowStyle(idx)}>
                <td style={medCellStyle}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.3 }}>
                    {med.drug_name}
                    {med.drug_strength && (
                      <span style={{ fontSize: 11, fontWeight: 400, color: C.muted, marginLeft: 5 }}>
                        {med.drug_strength}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {med.dosage && <span>{med.dosage}</span>}
                    {med.route && <span style={{ textTransform: 'capitalize' }}>{med.route}</span>}
                    {med.frequency && <span style={{ color: C.blue, fontWeight: 600 }}>{med.frequency}</span>}
                    {med.is_prn && (
                      <span style={{
                        fontSize: 10,
                        background: '#f5f3ff',
                        color: '#7c3aed',
                        border: '1px solid #c4b5fd',
                        borderRadius: 3,
                        padding: '1px 5px',
                        fontWeight: 700,
                      }}>
                        PRN
                      </span>
                    )}
                  </div>
                </td>
                {TIME_PERIODS.map(p => (
                  <td key={p.key} style={checkCellStyle}>
                    <MatrixCheckbox
                      checked={!!medSchedule[p.key]}
                      onChange={() => toggle(med.id, p.key)}
                      disabled={readOnly}
                      color={p.color}
                    />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>

      {!readOnly && (
        <div style={{
          padding: '8px 12px',
          background: C.bg,
          borderTop: `1px solid ${C.border}`,
          fontSize: 11,
          color: C.muted,
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
        }}>
          {TIME_PERIODS.map(p => (
            <span key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: p.color,
                display: 'inline-block',
                flexShrink: 0,
              }} />
              {p.abbr} = {p.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
