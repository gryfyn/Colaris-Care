'use client';

import { useState, useCallback, useMemo, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import FormLayout from '@/app/components/FormLayout';
import { ValidationRules, validateField } from '@/lib/form-validation';

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
  red: "#dc2626",
  redBg: "#fef2f2",
  amber: "#b45309",
  amberBg: "#fffbeb",
};

const inp = { width: "100%", padding: "9px 12px", border: `1px solid ${C.blueBorder}`, borderRadius: 7, fontSize: 13, background: C.white, color: C.text, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
const lbl = { display: "block", fontSize: 11, fontWeight: 700, color: C.navy, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" };
const secHead = { fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 16, paddingBottom: 12, borderBottom: `2px solid ${C.blueBorder}`, textTransform: "uppercase", letterSpacing: "0.06em" };

function F({ label, children, span = 1 }) {
  return (
    <div style={{ gridColumn: `span ${span}` }}>
      {label && <label style={lbl}>{label}</label>}
      {children}
    </div>
  );
}

function TI({ value, onChange, placeholder, type = "text", readOnly = false }) {
  return <input readOnly={readOnly} type={type} value={value ?? ""} onChange={e => onChange?.(e.target.value)} placeholder={placeholder} style={{ ...inp, background: readOnly ? "#f0f5ff" : C.white, color: readOnly ? C.blue : C.text, fontWeight: readOnly ? 600 : 400 }} />;
}

function TA({ value, onChange, placeholder, rows = 4 }) {
  return <textarea value={value ?? ""} onChange={e => onChange?.(e.target.value)} placeholder={placeholder} rows={rows} style={{ ...inp, resize: "vertical", lineHeight: 1.6 }} />;
}

function Sel({ value, onChange, options }) {
  return <select value={value ?? ""} onChange={e => onChange?.(e.target.value)} style={{ ...inp, appearance: "none" }}><option value="">— Select —</option>{options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}</select>;
}

function CG({ label, options, selected = [], onChange }) {
  const toggle = v => onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]);
  return (
    <div>
      {label && <div style={{ ...lbl, marginBottom: 8 }}>{label}</div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px" }}>
        {options.map(o => {
          const v = o.value ?? o, l = o.label ?? o, ch = selected.includes(v);
          return (
            <label key={v} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.text, cursor: "pointer" }}>
              <span onClick={() => toggle(v)} style={{ width: 16, height: 16, borderRadius: 3, border: `1.5px solid ${ch ? C.blue : C.blueBorder}`, background: ch ? C.blue : C.white, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                {ch && <span style={{ color: C.white, fontSize: 10 }}>✓</span>}
              </span>{l}
            </label>
          );
        })}
      </div>
    </div>
  );
}

function Grid({ cols = 2, children }) {
  return <div className="app-grid-collapse" style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: "14px 18px" }}>{children}</div>;
}

function DailyProgressNotesForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialResidentId = searchParams.get('resident_id');
  const initialDate = searchParams.get('date') || new Date().toISOString().split('T')[0];
  const { auth } = useAuth();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [residents, setResidents] = useState([]);
  const [loadingResidents, setLoadingResidents] = useState(true);
  const [residentSearch, setResidentSearch] = useState('');
  const [showingFiltered, setShowingFiltered] = useState(false);
  const [form, setForm] = useState({
    residentId: initialResidentId || '',
    date: initialDate,
    shift: '',
    progressNotes: '',
    moodBehavior: [],
    physicalHealth: [],
    medicationsAdministered: [],
    mealsBreakfast: '',
    mealsBreakfastNotes: '',
    mealsLunch: '',
    mealsLunchNotes: '',
    mealsDinner: '',
    mealsDinnerNotes: '',
    activitiesParticipated: [],
    incidents: '',
  });

  // Fetch residents: for staff, show residents still needing a note for the
  // selected date first, then fall back to the full roster. For admins/managers,
  // fetch all residents (so they can file or edit notes for anyone).
  useEffect(() => {
    if (!auth) return;
    const fetchResidents = async () => {
      setLoadingResidents(true);
      try {
        const isStaff = auth.user?.role === 'staff';

        if (isStaff) {
          // For staff: try residents-needing-a-note first, fallback to full roster
          const pendingRes = await fetch(`/api/v1/daily-progress-notes/pending?date=${form.date}`, {
            headers: { Authorization: `Bearer ${auth.accessToken}` },
            credentials: 'same-origin',
          }).catch(() => null);

          let residentList = [];
          if (pendingRes?.ok) {
            const pendingData = await pendingRes.json();
            residentList = (pendingData.data || []).map(r => ({
              id: r.resident_id,
              first_name: r.first_name,
              last_name: r.last_name,
            }));
            setShowingFiltered(true);
          }

          // If no residents are pending, fetch the full roster
          if (residentList.length === 0) {
            const assignedRes = await fetch('/api/v1/residents?limit=200', {
              headers: { Authorization: `Bearer ${auth.accessToken}` },
              credentials: 'same-origin',
            }).catch(() => null);

            if (assignedRes?.ok) {
              const assignedData = await assignedRes.json();
              residentList = (assignedData.data || []).map(r => ({
                id: r.id,
                first_name: r.first_name,
                last_name: r.last_name,
              }));
              setShowingFiltered(false);
            }
          }
          setResidents(residentList);
        } else {
          // For admin: fetch all residents
          const res = await fetch('/api/v1/admin/residents?limit=200', {
            headers: { Authorization: `Bearer ${auth.accessToken}` },
            credentials: 'same-origin',
          });

          if (res.ok) {
            const data = await res.json();
            const residentList = (data.data || data.residents || []).map(r => ({
              id: r.id,
              first_name: r.first_name,
              last_name: r.last_name,
            }));
            setResidents(residentList);
            setShowingFiltered(false);
          }
        }
      } catch (err) {
        setResidents([]);
      } finally {
        setLoadingResidents(false);
      }
    };
    fetchResidents();
  }, [auth, form.date]);

  // Apply name search to the resident list
  const filteredResidents = useMemo(() => {
    const q = residentSearch.trim().toLowerCase();
    if (!q) return residents;
    return residents.filter(r => {
      const full = `${r.first_name || ''} ${r.last_name || ''}`.toLowerCase();
      return full.includes(q);
    });
  }, [residents, residentSearch]);

  const RESIDENTS = useMemo(() => [
    { value: '', label: filteredResidents.length === 0 ? 'No residents available' : 'Select a resident...' },
    ...filteredResidents.map(r => ({
      value: String(r.id),
      label: `${r.first_name || ''} ${r.last_name || ''}`.trim() || 'Unknown Resident'
    }))
  ], [filteredResidents]);

  const MOOD_BEHAVIOR_OPTIONS = ['Alert', 'Withdrawn', 'Agitated', 'Cooperative', 'Other'];
  const PHYSICAL_HEALTH_OPTIONS = ['Stable', 'Improved', 'Declined'];
  const MEDICATIONS_OPTIONS = ['Morning', 'Noon', 'Evening', 'Bedtime', 'PRN'];
  const ACTIVITIES_OPTIONS = ['Physical', 'Recreational', 'Social', 'Cognitive', 'Therapeutic'];
  const SHIFT_OPTIONS = [
    { value: 'morning', label: 'Morning (6am - 2pm)' },
    { value: 'afternoon', label: 'Afternoon (2pm - 10pm)' },
    { value: 'night', label: 'Night (10pm - 6am)' },
  ];

  const isComplete = useCallback(() => {
    return form.residentId.trim() && form.date && form.shift && form.progressNotes.trim();
  }, [form]);

  const handleSave = useCallback(async () => {
    if (!isComplete()) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/v1/daily-progress-notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth?.accessToken}`,
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          resident_id: form.residentId,
          note_date: form.date,
          shift: form.shift,
          note_body: {
            progressNotes: form.progressNotes,
            moodBehavior: form.moodBehavior,
            physicalHealth: form.physicalHealth,
            medicationsAdministered: form.medicationsAdministered,
            mealsBreakfast: form.mealsBreakfast,
            mealsBreakfastNotes: form.mealsBreakfastNotes,
            mealsLunch: form.mealsLunch,
            mealsLunchNotes: form.mealsLunchNotes,
            mealsDinner: form.mealsDinner,
            mealsDinnerNotes: form.mealsDinnerNotes,
            activitiesParticipated: form.activitiesParticipated,
            incidents: form.incidents,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Failed to submit progress notes');
        return;
      }
      setSuccess('Progress note submitted for review. Redirecting…');
      setTimeout(() => {
        const dest = ['admin', 'manager', 'superadmin'].includes(auth?.user?.role) ? '/admin' : '/staff';
        router.push(dest);
      }, 800);
    } catch (err) {
      setError('An error occurred while saving. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [form, isComplete, router, auth]);

  const mealSection = (label, stateKey, notesKey) => (
    <F label={`${label} % (optional)`}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: '0 0 80px' }}>
          <input type="number" value={form[stateKey] || ''} onChange={e => setForm(prev => ({ ...prev, [stateKey]: e.target.value }))} placeholder="0" min="0" max="100" style={{ ...inp, width: '100%' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: C.muted, flexShrink: 0 }}>%</span>
        </div>
      </div>
      <TI value={form[notesKey]} onChange={v => setForm(prev => ({ ...prev, [notesKey]: v }))} placeholder="Notes (optional)" />
    </F>
  );

  const boxStyle = { background: C.white, borderRadius: 8, padding: 20, marginBottom: 24, border: `1px solid ${C.border}` };

  return (
    <FormLayout formTitle="Daily Progress Notes">
      <div style={{ background: C.amberBg, border: `1px solid ${C.amber}`, borderRadius: 8, padding: '12px 16px', marginBottom: 24, fontSize: 13, color: C.amber, lineHeight: 1.6 }}>
        Document daily observations including resident mood, behavior, health status, meal intake, medications administered, and activities to support comprehensive care.
      </div>

      <div style={boxStyle}>
        <h2 style={secHead}>Note Information</h2>
        {showingFiltered && (
          <div style={{ background: C.amberBg, border: `1px solid ${C.amber}`, borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: C.amber, lineHeight: 1.6 }}>
            Showing residents with no note for {form.date}. Change the date to file a note for another day.
          </div>
        )}
        {loadingResidents ? (
          <div style={{ padding: 12, fontSize: 13, color: C.muted }}>Loading residents…</div>
        ) : null}
        <Grid cols={2}>
          <F label="Search Resident by Name">
            <TI value={residentSearch} onChange={setResidentSearch} placeholder="Type to filter the dropdown below…" />
          </F>
          <F label="Resident">
            <Sel value={form.residentId} onChange={v => setForm(prev => ({ ...prev, residentId: v }))} options={RESIDENTS} />
          </F>
        </Grid>
        <div style={{ height: 14 }} />
        <Grid cols={2}>
          <F label="Date">
            <TI type="date" value={form.date} onChange={v => setForm(prev => ({ ...prev, date: v, residentId: '' }))} />
          </F>
          <F label="Shift">
            <Sel value={form.shift} onChange={v => setForm(prev => ({ ...prev, shift: v }))} options={SHIFT_OPTIONS} />
          </F>
        </Grid>
      </div>

      <div style={boxStyle}>
        <h2 style={secHead}>Progress Notes</h2>
        <F label="Progress Notes">
          <TA value={form.progressNotes} onChange={v => setForm(prev => ({ ...prev, progressNotes: v }))} placeholder="Document detailed observations, changes in condition, significant events, and care provided during this shift..." rows={6} />
        </F>
      </div>

      <div style={boxStyle}>
        <h2 style={secHead}>Mood & Behavior</h2>
        <CG label="Observed Mood/Behavior" selected={form.moodBehavior} onChange={v => setForm(prev => ({ ...prev, moodBehavior: v }))} options={MOOD_BEHAVIOR_OPTIONS} />
      </div>

      <div style={boxStyle}>
        <h2 style={secHead}>Physical Health</h2>
        <CG label="Health Status" selected={form.physicalHealth} onChange={v => setForm(prev => ({ ...prev, physicalHealth: v }))} options={PHYSICAL_HEALTH_OPTIONS} />
      </div>

      <div style={boxStyle}>
        <h2 style={secHead}>Medications Administered</h2>
        <CG label="Medications Given" selected={form.medicationsAdministered} onChange={v => setForm(prev => ({ ...prev, medicationsAdministered: v }))} options={MEDICATIONS_OPTIONS} />
      </div>

      <div style={boxStyle}>
        <h2 style={secHead}>Meal Intake</h2>
        <Grid cols={3}>
          {mealSection('Breakfast', 'mealsBreakfast', 'mealsBreakfastNotes')}
          {mealSection('Lunch', 'mealsLunch', 'mealsLunchNotes')}
          {mealSection('Dinner', 'mealsDinner', 'mealsDinnerNotes')}
        </Grid>
      </div>

      <div style={boxStyle}>
        <h2 style={secHead}>Activities</h2>
        <CG label="Activities Participated" selected={form.activitiesParticipated} onChange={v => setForm(prev => ({ ...prev, activitiesParticipated: v }))} options={ACTIVITIES_OPTIONS} />
      </div>

      <div style={boxStyle}>
        <h2 style={secHead}>Incidents & Concerns</h2>
        <F label="Incidents or Concerns (Optional)">
          <TA value={form.incidents} onChange={v => setForm(prev => ({ ...prev, incidents: v }))} placeholder="Document any incidents, safety concerns, behavioral issues, or other matters requiring attention..." rows={4} />
        </F>
      </div>

      {!isComplete() && (
        <div style={{ background: C.redBg, border: `1px solid #fca5a5`, borderRadius: 8, padding: '12px 16px', marginBottom: 24, fontSize: 13, color: C.red }}>
          Complete all required fields (resident, date, shift, progress notes) to submit
        </div>
      )}

      {error && (
        <div style={{ background: C.redBg, border: `1px solid #fca5a5`, borderRadius: 8, padding: '12px 16px', marginBottom: 24, fontSize: 13, color: C.red }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: 8, padding: '12px 16px', marginBottom: 24, fontSize: 13, color: '#047857' }}>
          {success}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button onClick={() => router.back()} style={{ padding: '10px 20px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 7, color: C.navy, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>← Back</button>
        <button onClick={handleSave} disabled={!isComplete() || saving} style={{ padding: '10px 24px', background: isComplete() ? C.blue : C.muted, border: 'none', borderRadius: 7, color: C.white, fontSize: 13, fontWeight: 600, cursor: isComplete() && !saving ? 'pointer' : 'not-allowed', opacity: isComplete() ? 1 : 0.6 }}>{saving ? 'Saving...' : 'Submit Progress Notes'}</button>
      </div>
    </FormLayout>
  );
}

export default function DailyProgressNotesPage() {
  return (
    <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>}>
      <DailyProgressNotesForm />
    </Suspense>
  );
}