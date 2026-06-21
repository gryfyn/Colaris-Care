# Medication Schedule Matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `MedicationScheduleMatrix` React component that renders a time-based grid where healthcare staff can assign medications to time slots, and wire it into Step 4 of the care plan wizard.

**Architecture:** A single new component file (`src/app/components/MedicationScheduleMatrix.jsx`) holds all matrix logic with no external dependencies. It receives controlled props (`medications`, `schedule`, `onMedicationsChange`, `onScheduleChange`) and manages its own add/remove row UI internally. Step 4 in `care-plan/page.js` is modified to render the matrix above the existing "Medication Management" freetext field, which becomes a supplementary notes field.

**Tech Stack:** React 18 (hooks), Next.js App Router (`'use client'` boundary), inline styles matching the existing `C` color palette in `care-plan/page.js`.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/app/components/MedicationScheduleMatrix.jsx` | Full matrix component — row management, checkbox grid, color-coded headers |
| Modify | `src/app/care-plan/page.js` lines 1–5 | Add import statement |
| Modify | `src/app/care-plan/page.js` lines 552–566 | Replace Medication Management row with matrix + supplementary notes |

---

## Task 1: Create `MedicationScheduleMatrix.jsx`

**Files:**
- Create: `src/app/components/MedicationScheduleMatrix.jsx`

- [ ] **Step 1.1: Write the component file**

Create `src/app/components/MedicationScheduleMatrix.jsx` with the following complete content:

```jsx
'use client';

import { useState } from 'react';

// ─── COLOUR TOKENS (matches care-plan/page.js C palette) ─────────────────────
const C = {
  navy:       "#0f2d5e",
  blue:       "#1a56db",
  bluePale:   "#eef4ff",
  blueBorder: "#bfdbfe",
  white:      "#ffffff",
  bg:         "#f4f8ff",
  text:       "#1e2d40",
  muted:      "#6b7c93",
  border:     "#dde6f0",
  red:        "#dc2626",
  redBg:      "#fef2f2",
};

// ─── TIME PERIODS ─────────────────────────────────────────────────────────────
const TIME_PERIODS = [
  { id: 'morning',   label: 'Morning',     color: '#1a56db', bg: '#eef4ff', icon: '☀' },
  { id: 'afternoon', label: 'Afternoon',   color: '#b45309', bg: '#fffbeb', icon: '⛅' },
  { id: 'evening',   label: 'Evening',     color: '#7c3aed', bg: '#f5f3ff', icon: '🌆' },
  { id: 'night',     label: 'Night',       color: '#0f2d5e', bg: '#e8edf5', icon: '🌙' },
  { id: 'asNeeded',  label: 'As Needed',   color: '#374151', bg: '#f3f4f6', icon: 'PRN' },
];

const UNITS = ['mg', 'mcg', 'g', 'mL', 'units', 'tablet(s)', 'capsule(s)', 'patch', 'drop(s)', 'other'];

function generateId() {
  return `med_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─── MATRIX CHECKBOX ──────────────────────────────────────────────────────────
function MatrixCell({ checked, onChange, color, bg }) {
  const [hovered, setHovered] = useState(false);

  return (
    <td
      style={{
        textAlign: 'center',
        padding: '10px 8px',
        borderBottom: `1px solid ${C.border}`,
        borderRight: `1px solid ${C.border}`,
        background: checked ? bg : hovered ? '#f8faff' : C.white,
        transition: 'background 0.12s',
        cursor: 'pointer',
      }}
      onClick={onChange}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 22,
          height: 22,
          borderRadius: 5,
          border: `2px solid ${checked ? color : C.blueBorder}`,
          background: checked ? color : C.white,
          transition: 'all 0.12s',
          flexShrink: 0,
        }}
      >
        {checked && (
          <span style={{ color: '#fff', fontSize: 13, lineHeight: 1, fontWeight: 700 }}>✓</span>
        )}
      </span>
    </td>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
/**
 * MedicationScheduleMatrix
 *
 * Props:
 *   medications       – array of { id, name, dosage, unit, notes }
 *   schedule          – object keyed by medication id: { morning, afternoon, evening, night, asNeeded }
 *   onMedicationsChange(newMedications)  – called when a medication row is added/edited/removed
 *   onScheduleChange(newSchedule)        – called when a checkbox is toggled
 */
export default function MedicationScheduleMatrix({
  medications = [],
  schedule = {},
  onMedicationsChange,
  onScheduleChange,
}) {
  // ── add-row local state ───────────────────────────────────────────────────
  const [newMed, setNewMed] = useState({ name: '', dosage: '', unit: 'mg', notes: '' });
  const [addError, setAddError] = useState('');

  // ── helpers ───────────────────────────────────────────────────────────────
  const getSlot = (medId, periodId) => !!(schedule[medId]?.[periodId]);

  const toggleSlot = (medId, periodId) => {
    const current = schedule[medId] ?? {};
    onScheduleChange({
      ...schedule,
      [medId]: { ...current, [periodId]: !current[periodId] },
    });
  };

  const handleAddMedication = () => {
    if (!newMed.name.trim()) {
      setAddError('Medication name is required.');
      return;
    }
    setAddError('');
    const entry = { ...newMed, id: generateId(), name: newMed.name.trim() };
    onMedicationsChange([...medications, entry]);
    // Initialise all slots to false for new entry
    onScheduleChange({
      ...schedule,
      [entry.id]: Object.fromEntries(TIME_PERIODS.map(p => [p.id, false])),
    });
    setNewMed({ name: '', dosage: '', unit: 'mg', notes: '' });
  };

  const handleRemoveMedication = (medId) => {
    onMedicationsChange(medications.filter(m => m.id !== medId));
    const { [medId]: _, ...rest } = schedule;
    onScheduleChange(rest);
  };

  const handleEditMedication = (medId, field, value) => {
    onMedicationsChange(
      medications.map(m => m.id === medId ? { ...m, [field]: value } : m)
    );
  };

  // ── input style helpers ───────────────────────────────────────────────────
  const inp = (extra = {}) => ({
    padding: '6px 9px',
    border: `1px solid ${C.blueBorder}`,
    borderRadius: 6,
    fontSize: 12,
    background: C.white,
    color: C.text,
    outline: 'none',
    fontFamily: 'inherit',
    ...extra,
  });

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ marginBottom: 4 }}>
      {/* Horizontal scroll wrapper for mobile */}
      <div style={{ overflowX: 'auto', borderRadius: 8, border: `1px solid ${C.border}` }}>
        <table
          style={{
            width: '100%',
            minWidth: 680,
            borderCollapse: 'collapse',
            fontSize: 13,
            background: C.white,
          }}
        >
          {/* ── HEADER ── */}
          <thead>
            <tr>
              {/* Medication name col */}
              <th
                style={{
                  textAlign: 'left',
                  padding: '10px 14px',
                  fontSize: 11,
                  fontWeight: 700,
                  color: C.navy,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  background: C.bg,
                  borderBottom: `2px solid ${C.blueBorder}`,
                  borderRight: `1px solid ${C.border}`,
                  minWidth: 180,
                }}
              >
                Medication
              </th>
              {/* Dosage col */}
              <th
                style={{
                  textAlign: 'left',
                  padding: '10px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  color: C.navy,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  background: C.bg,
                  borderBottom: `2px solid ${C.blueBorder}`,
                  borderRight: `1px solid ${C.border}`,
                  width: 110,
                }}
              >
                Dose
              </th>
              {/* Time period cols */}
              {TIME_PERIODS.map(p => (
                <th
                  key={p.id}
                  style={{
                    textAlign: 'center',
                    padding: '10px 8px',
                    fontSize: 11,
                    fontWeight: 700,
                    color: p.color,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    background: p.bg,
                    borderBottom: `2px solid ${p.color}`,
                    borderRight: `1px solid ${C.border}`,
                    width: 90,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ display: 'block', fontSize: 14, marginBottom: 2 }}>{p.icon}</span>
                  {p.label}
                </th>
              ))}
              {/* Remove col */}
              <th
                style={{
                  background: C.bg,
                  borderBottom: `2px solid ${C.blueBorder}`,
                  width: 36,
                }}
              />
            </tr>
          </thead>

          {/* ── BODY: existing medication rows ── */}
          <tbody>
            {medications.length === 0 && (
              <tr>
                <td
                  colSpan={TIME_PERIODS.length + 3}
                  style={{
                    padding: '20px 16px',
                    textAlign: 'center',
                    fontSize: 13,
                    color: C.muted,
                    fontStyle: 'italic',
                    borderBottom: `1px solid ${C.border}`,
                  }}
                >
                  No medications added yet. Use the row below to add the first one.
                </td>
              </tr>
            )}

            {medications.map((med, idx) => (
              <tr
                key={med.id}
                style={{ background: idx % 2 === 0 ? C.white : '#f9fbff' }}
              >
                {/* Name (editable) */}
                <td
                  style={{
                    padding: '8px 10px',
                    borderBottom: `1px solid ${C.border}`,
                    borderRight: `1px solid ${C.border}`,
                  }}
                >
                  <input
                    value={med.name}
                    onChange={e => handleEditMedication(med.id, 'name', e.target.value)}
                    style={inp({ width: '100%' })}
                    placeholder="Medication name"
                    aria-label="Medication name"
                  />
                  {med.notes && (
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 3, paddingLeft: 2 }}>
                      {med.notes}
                    </div>
                  )}
                </td>

                {/* Dosage (editable) */}
                <td
                  style={{
                    padding: '8px 10px',
                    borderBottom: `1px solid ${C.border}`,
                    borderRight: `1px solid ${C.border}`,
                  }}
                >
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <input
                      value={med.dosage}
                      onChange={e => handleEditMedication(med.id, 'dosage', e.target.value)}
                      style={inp({ width: 50 })}
                      placeholder="0"
                      aria-label="Dosage amount"
                    />
                    <select
                      value={med.unit}
                      onChange={e => handleEditMedication(med.id, 'unit', e.target.value)}
                      style={inp({ padding: '6px 4px', appearance: 'none', cursor: 'pointer' })}
                      aria-label="Unit"
                    >
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </td>

                {/* Time period checkboxes */}
                {TIME_PERIODS.map(p => (
                  <MatrixCell
                    key={p.id}
                    checked={getSlot(med.id, p.id)}
                    onChange={() => toggleSlot(med.id, p.id)}
                    color={p.color}
                    bg={p.bg}
                  />
                ))}

                {/* Remove button */}
                <td
                  style={{
                    padding: '8px 6px',
                    textAlign: 'center',
                    borderBottom: `1px solid ${C.border}`,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleRemoveMedication(med.id)}
                    title="Remove medication"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: C.muted,
                      fontSize: 16,
                      lineHeight: 1,
                      padding: '2px 4px',
                      borderRadius: 4,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = C.red; e.currentTarget.style.background = C.redBg; }}
                    onMouseLeave={e => { e.currentTarget.style.color = C.muted; e.currentTarget.style.background = 'none'; }}
                    aria-label={`Remove ${med.name}`}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}

            {/* ── ADD ROW ── */}
            <tr style={{ background: '#f4f8ff' }}>
              <td style={{ padding: '8px 10px', borderTop: `2px dashed ${C.blueBorder}` }}>
                <input
                  value={newMed.name}
                  onChange={e => { setNewMed(m => ({ ...m, name: e.target.value })); setAddError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleAddMedication()}
                  style={inp({ width: '100%', background: C.bluePale })}
                  placeholder="+ Medication name"
                  aria-label="New medication name"
                />
              </td>
              <td style={{ padding: '8px 10px', borderTop: `2px dashed ${C.blueBorder}` }}>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input
                    value={newMed.dosage}
                    onChange={e => setNewMed(m => ({ ...m, dosage: e.target.value }))}
                    style={inp({ width: 50, background: C.bluePale })}
                    placeholder="0"
                    aria-label="New medication dosage"
                  />
                  <select
                    value={newMed.unit}
                    onChange={e => setNewMed(m => ({ ...m, unit: e.target.value }))}
                    style={inp({ padding: '6px 4px', appearance: 'none', cursor: 'pointer', background: C.bluePale })}
                    aria-label="New medication unit"
                  >
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </td>
              {/* Filler cells in add row */}
              {TIME_PERIODS.map(p => (
                <td
                  key={p.id}
                  style={{ borderTop: `2px dashed ${C.blueBorder}`, background: p.bg, opacity: 0.35 }}
                />
              ))}
              <td style={{ padding: '8px 6px', textAlign: 'center', borderTop: `2px dashed ${C.blueBorder}` }}>
                <button
                  type="button"
                  onClick={handleAddMedication}
                  title="Add medication"
                  style={{
                    background: C.blue,
                    border: 'none',
                    cursor: 'pointer',
                    color: '#fff',
                    fontSize: 18,
                    lineHeight: 1,
                    width: 26,
                    height: 26,
                    borderRadius: 6,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                  }}
                  aria-label="Add medication"
                >
                  +
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Validation error */}
      {addError && (
        <div style={{ marginTop: 6, fontSize: 12, color: C.red, paddingLeft: 4 }}>
          {addError}
        </div>
      )}

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px 14px',
          marginTop: 10,
          fontSize: 11,
          color: C.muted,
        }}
      >
        {TIME_PERIODS.map(p => (
          <span
            key={p.id}
            style={{ display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <span
              style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                borderRadius: 2,
                background: p.color,
              }}
            />
            {p.icon !== p.label ? `${p.icon} ` : ''}{p.label}
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 1.2: Verify the file was created**

```bash
ls src/app/components/MedicationScheduleMatrix.jsx
```

Expected output: the file path printed, no error.

- [ ] **Step 1.3: Commit**

```bash
git add src/app/components/MedicationScheduleMatrix.jsx
git commit -m "feat(care-plan): add MedicationScheduleMatrix component"
```

---

## Task 2: Wire the component into `care-plan/page.js`

**Files:**
- Modify: `src/app/care-plan/page.js` line 3 (import)
- Modify: `src/app/care-plan/page.js` lines 541–568 (Step4 function body)

### 2.1 — Add the import

- [ ] **Step 2.1.1: Insert the import line**

Open `src/app/care-plan/page.js`. Find the existing import block at the top of the file (lines 1–5):

```js
'use client';

import { useState, useCallback, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
```

Add the new import as the last line of that block, so it becomes:

```js
'use client';

import { useState, useCallback, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import MedicationScheduleMatrix from '@/app/components/MedicationScheduleMatrix';
```

### 2.2 — Update `Step4` to use the matrix

- [ ] **Step 2.2.1: Replace the Medication Management row inside `Step4`**

Locate the `Step4` function (starts at approximately line 541). Find this exact block inside the "Day-to-Day Care Needs" section:

```jsx
      <SH>Day-to-Day Care Needs</SH>
      <div style={{ display: "grid", gap: 10 }}>
        {[
          ["Medication Management", "medMgmt", "Administration times, storage, refill process", "Medication Staff"],
          ["Physical Health", "physHealth", "PCP/Dental appointment details", "Case Manager"],
          ["Nutrition", "nutrition", "Dietary restrictions and preferences", "Program Staff"],
          ["Sleep Hygiene", "sleep", "Bedtime routine and sleep supports", "Night Staff"],
        ].map(([need, key, placeholder, resp]) => (
          <div key={key} style={{ display: "grid", gridTemplateColumns: "160px 1fr 160px", gap: 10, background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px", alignItems: "start" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>{need}</div>
            <TA value={data[key]} onChange={v => set(key, v)} placeholder={placeholder} rows={2} />
            <div style={{ fontSize: 12, color: C.muted, paddingTop: 4 }}>{resp}</div>
          </div>
        ))}
      </div>
```

Replace it with:

```jsx
      <SH>Medication Schedule</SH>
      <MedicationScheduleMatrix
        medications={data.medications ?? []}
        schedule={data.medicationSchedule ?? {}}
        onMedicationsChange={v => set("medications", v)}
        onScheduleChange={v => set("medicationSchedule", v)}
      />

      <SH>Day-to-Day Care Needs</SH>
      <div style={{ display: "grid", gap: 10 }}>
        {[
          ["Medication — Storage & Refill Notes", "medMgmt", "Storage location, refill process, prescriber contact", "Medication Staff"],
          ["Physical Health", "physHealth", "PCP/Dental appointment details", "Case Manager"],
          ["Nutrition", "nutrition", "Dietary restrictions and preferences", "Program Staff"],
          ["Sleep Hygiene", "sleep", "Bedtime routine and sleep supports", "Night Staff"],
        ].map(([need, key, placeholder, resp]) => (
          <div key={key} style={{ display: "grid", gridTemplateColumns: "160px 1fr 160px", gap: 10, background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px", alignItems: "start" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>{need}</div>
            <TA value={data[key]} onChange={v => set(key, v)} placeholder={placeholder} rows={2} />
            <div style={{ fontSize: 12, color: C.muted, paddingTop: 4 }}>{resp}</div>
          </div>
        ))}
      </div>
```

- [ ] **Step 2.2.2: Commit**

```bash
git add src/app/care-plan/page.js
git commit -m "feat(care-plan): integrate MedicationScheduleMatrix into Step 4"
```

---

## Task 3: Manual verification in the dev server

**Files:** none (read-only verification)

- [ ] **Step 3.1: Start the dev server**

```bash
npm run dev
```

Expected: Next.js starts on `http://localhost:3000`, no compilation errors in the terminal output.

- [ ] **Step 3.2: Navigate to the care plan wizard**

Open `http://localhost:3000/care-plan` in a browser. Log in if prompted.

- [ ] **Step 3.3: Reach Step 4 (Recovery Goals)**

Select any resident from the search in Step 1, fill the minimum required fields in Steps 1–3 to unlock Step 4, then click through to Step 4.

- [ ] **Step 3.4: Verify the matrix renders**

Checklist:
- "Medication Schedule" section heading appears above the time matrix table
- Table shows five color-coded column headers: Morning (blue), Afternoon (orange/amber), Evening (purple), Night (dark navy), As Needed (gray)
- Empty state row reads "No medications added yet. Use the row below to add the first one."
- A dashed add-row is visible at the bottom of the table with name input, dosage input, unit select, and a blue "+" button

- [ ] **Step 3.5: Add a medication and verify checkboxes**

1. Type "Risperidone" into the name field, "2" into dosage, leave unit as "mg", press the "+" button (or Enter).
2. Verify: a new row appears with "Risperidone" | "2 mg" and five unchecked checkbox cells.
3. Click the Morning cell checkbox — it should fill with blue and show a white checkmark.
4. Click the Evening cell checkbox — it should fill with purple.
5. Click the Morning cell again — it should uncheck (return to white/empty).

- [ ] **Step 3.6: Verify remove works**

Click the "✕" button on the Risperidone row. The row should disappear and the empty-state message should return.

- [ ] **Step 3.7: Verify "Storage & Refill Notes" still appears**

Scroll below the matrix table. The "Day-to-Day Care Needs" grid should still show the four rows, with "Medication — Storage & Refill Notes" as the first entry (previously "Medication Management"), Physical Health, Nutrition, and Sleep Hygiene.

- [ ] **Step 3.8: Verify mobile layout (narrow viewport)**

Resize the browser to ~375px wide. The matrix table should scroll horizontally inside its container — the table must not overflow the page or cause a layout break.

- [ ] **Step 3.9: Verify data persists across step navigation**

Add two medications with time slots checked. Navigate to Step 5 and back to Step 4. The medications and their checkbox states should still be present (React state is preserved by the wizard's `formData` object for the duration of the session).

---

## Self-Review

**Spec coverage check:**

| Requirement | Covered by |
|-------------|-----------|
| Rows: medications with name, dosage, unit | Task 1 — `medications` array with name/dosage/unit fields; editable inline |
| Columns: Morning, Afternoon, Evening, Night, As Needed | Task 1 — `TIME_PERIODS` array with 5 entries |
| Cells: checkboxes | Task 1 — `MatrixCell` component + `toggleSlot` handler |
| Input: array of medications | Task 2 — `medications` prop |
| Output: schedule object `{ medId: { morning: bool, ... } }` | Task 1 — `schedule` prop shape; `toggleSlot` handler; `onScheduleChange` emits full object |
| Color-code time periods | Task 1 — `TIME_PERIODS[*].color/bg` + column header `background` |
| Hover states | Task 1 — `MatrixCell` hover state; remove button hover state |
| Responsive: scroll on mobile | Task 1 — `overflowX: 'auto'` wrapper + `minWidth: 680` on table |
| Clean, scannable for healthcare staff | Task 1 — empty state, legend, alternating row backgrounds, editable inline fields |
| Integration into care-plan page | Task 2 |
| Verify in dev server | Task 3 |

**Placeholder scan:** No TBDs, no "similar to Task N" references, no missing code blocks found.

**Type consistency check:**
- `medications` prop: `Array<{ id: string, name: string, dosage: string, unit: string, notes: string }>` — consistent across Task 1 and Task 2 usage.
- `schedule` prop: `Record<string, Record<'morning'|'afternoon'|'evening'|'night'|'asNeeded', boolean>>` — `TIME_PERIODS[*].id` values match the keys used in `getSlot`, `toggleSlot`, and the `onScheduleChange` callback in Task 2.
- `generateId()` called in `handleAddMedication` — defined at top of file in Task 1.
- `handleRemoveMedication` uses object destructuring to strip the removed id from schedule — correct for the `Record<string, ...>` shape.
