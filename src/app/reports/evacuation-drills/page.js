'use client';
import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import FormLayout from '@/app/components/FormLayout';

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

function F({ label, children, span = 1 }) {
  return (
    <div style={{ gridColumn: `span ${span}` }}>
      {label && <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.navy, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</label>}
      {children}
    </div>
  );
}

function TI({ value, onChange, placeholder, type = "text", readOnly = false }) {
  const inp = { width: "100%", padding: "9px 12px", border: `1px solid ${C.blueBorder}`, borderRadius: 7, fontSize: 13, background: readOnly ? "#f0f5ff" : C.white, color: readOnly ? C.blue : C.text, outline: "none", boxSizing: "border-box", fontFamily: "inherit", fontWeight: readOnly ? 600 : 400 };
  return <input readOnly={readOnly} type={type} value={value ?? ""} onChange={e => onChange && onChange(e.target.value)} placeholder={placeholder} style={inp} />;
}

function TA({ value, onChange, placeholder, rows = 3 }) {
  const inp = { width: "100%", padding: "9px 12px", border: `1px solid ${C.blueBorder}`, borderRadius: 7, fontSize: 13, background: C.white, color: C.text, outline: "none", boxSizing: "border-box", fontFamily: "inherit", resize: "vertical", lineHeight: 1.5 };
  return <textarea value={value ?? ""} onChange={e => onChange && onChange(e.target.value)} placeholder={placeholder} rows={rows} style={inp} />;
}

function Sel({ value, onChange, options }) {
  const inp = { width: "100%", padding: "9px 12px", border: `1px solid ${C.blueBorder}`, borderRadius: 7, fontSize: 13, background: C.white, color: C.text, outline: "none", boxSizing: "border-box", fontFamily: "inherit", appearance: "none" };
  return <select value={value ?? ""} onChange={e => onChange(e.target.value)} style={inp}><option value="">— Select —</option>{options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}</select>;
}

function RG({ label, options, value, onChange }) {
  return (
    <div>
      {label && <div style={{ fontSize: 11, fontWeight: 700, color: C.navy, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px" }}>
        {options.map(o => {
          const v = o.value ?? o, l = o.label ?? o, ch = value === v;
          return (
            <label key={String(v)} onClick={() => onChange(v)} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.text, cursor: "pointer" }}>
              <span style={{ width: 16, height: 16, borderRadius: "50%", border: `1.5px solid ${ch ? C.blue : C.blueBorder}`, background: ch ? C.blue : C.white, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                {ch && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff", display: "block" }} />}
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

export default function EvacuationDrillsForm() {
  const router = useRouter();
  const { auth } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    drillType: '',
    drillDate: '',
    drillTime: '',
    duration: '',
    locationEvacuated: '',
    residentsEvacuated: '',
    staffInvolved: '',
    allResidentsAccountedFor: '',
    issuesEncountered: '',
    drillsCompletedOnSchedule: '',
    followUpActions: '',
    signature: '',
  });

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isComplete = () => {
    return (
      formData.drillType &&
      formData.drillDate &&
      formData.drillTime &&
      formData.duration &&
      formData.locationEvacuated &&
      formData.residentsEvacuated &&
      formData.allResidentsAccountedFor
    );
  };

  const handleSave = useCallback(async () => {
    if (!isComplete()) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      // Build residents_present from a count (best effort — UI tracks count, API stores array)
      const count = parseInt(formData.residentsEvacuated, 10) || 0;
      const residentsArr = Array.from({ length: count }, (_, i) => ({ index: i + 1 }));

      const res = await fetch('/api/v1/evacuation-drills', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth?.accessToken}`,
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          drill_date: formData.drillDate,
          drill_time: formData.drillTime,
          drill_type: formData.drillType,
          location_evacuated_to: formData.locationEvacuated,
          residents_present: residentsArr,
          evacuation_time_seconds: parseInt(formData.duration, 10) * 60,
          all_residents_accounted: formData.allResidentsAccountedFor === 'yes',
          issues_noted: formData.issuesEncountered + (formData.followUpActions ? `\n\nFollow-up: ${formData.followUpActions}` : ''),
          conducted_by_signature: formData.signature,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save');
        return;
      }
      setSuccess('Evacuation drill submitted for review. Redirecting…');
      setTimeout(() => {
        const dest = ['admin', 'manager', 'superadmin'].includes(auth?.user?.role) ? '/admin' : '/staff';
        router.push(dest);
      }, 800);
    } catch (err) {
      setError('An error occurred while submitting. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [formData, router, auth]);

  return (
    <FormLayout formTitle="Evacuation Drill Record">
      <div style={{ background: C.amberBg, border: `1px solid ${C.amber}`, borderRadius: '8px', padding: '12px 16px', marginBottom: '24px', fontSize: '13px', color: C.amber, lineHeight: '1.6' }}>
        Evacuation drills are required per OAR 411-050-0725(3). Complete all required fields below.
      </div>

      <div style={{ background: C.white, borderRadius: '8px', padding: '20px', marginBottom: '24px', border: `1px solid ${C.border}` }}>
        <h2 style={{ fontSize: '13px', fontWeight: '700', color: C.navy, marginBottom: '16px', paddingBottom: '12px', borderBottom: `2px solid ${C.blueBorder}`, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Drill Information</h2>
        <Grid cols={2}>
          <F label="Drill Type">
            <Sel value={formData.drillType} onChange={v => updateField('drillType', v)} options={[
              { value: 'fire', label: 'Fire' },
              { value: 'weather', label: 'Weather' },
              { value: 'medical', label: 'Medical Emergency' },
              { value: 'other', label: 'Other' }
            ]} />
          </F>
          <F label="Drill Date">
            <TI type="date" value={formData.drillDate} onChange={v => updateField('drillDate', v)} />
          </F>
        </Grid>

        <Grid cols={2} style={{ marginTop: '16px' }}>
          <F label="Drill Time">
            <TI type="time" value={formData.drillTime} onChange={v => updateField('drillTime', v)} />
          </F>
          <F label="Duration (minutes)">
            <TI type="number" value={formData.duration} onChange={v => updateField('duration', v)} placeholder="e.g., 15" />
          </F>
        </Grid>
      </div>

      <div style={{ background: C.white, borderRadius: '8px', padding: '20px', marginBottom: '24px', border: `1px solid ${C.border}` }}>
        <h2 style={{ fontSize: '13px', fontWeight: '700', color: C.navy, marginBottom: '16px', paddingBottom: '12px', borderBottom: `2px solid ${C.blueBorder}`, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Evacuation Details</h2>
        <Grid cols={2}>
          <F label="Location Evacuated">
            <Sel value={formData.locationEvacuated} onChange={v => updateField('locationEvacuated', v)} options={[
              { value: 'building', label: 'Building' },
              { value: 'unit', label: 'Unit' },
              { value: 'outdoor', label: 'Outdoor Area' },
              { value: 'other', label: 'Other' }
            ]} />
          </F>
          <F label="Residents Evacuated">
            <TI type="number" value={formData.residentsEvacuated} onChange={v => updateField('residentsEvacuated', v)} placeholder="0" />
          </F>
        </Grid>

        <Grid cols={2} style={{ marginTop: '16px' }}>
          <F label="Staff Involved">
            <TI type="number" value={formData.staffInvolved} onChange={v => updateField('staffInvolved', v)} placeholder="0" />
          </F>
          <F label="All Residents Accounted For?">
            <RG options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} value={formData.allResidentsAccountedFor} onChange={v => updateField('allResidentsAccountedFor', v)} />
          </F>
        </Grid>
      </div>

      <div style={{ background: C.white, borderRadius: '8px', padding: '20px', marginBottom: '24px', border: `1px solid ${C.border}` }}>
        <h2 style={{ fontSize: '13px', fontWeight: '700', color: C.navy, marginBottom: '16px', paddingBottom: '12px', borderBottom: `2px solid ${C.blueBorder}`, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Observations & Follow-up</h2>
        <Grid cols={1}>
          <F label="Issues Encountered">
            <TA value={formData.issuesEncountered} onChange={v => updateField('issuesEncountered', v)} placeholder="Describe any issues, challenges, or delays encountered during the drill..." rows={3} />
          </F>
        </Grid>

        <div style={{ marginTop: '16px' }}>
          <F label="Drills Completed on Schedule?">
            <RG options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} value={formData.drillsCompletedOnSchedule} onChange={v => updateField('drillsCompletedOnSchedule', v)} />
          </F>
        </div>

        <Grid cols={1} style={{ marginTop: '16px' }}>
          <F label="Follow-up Actions (Optional)">
            <TA value={formData.followUpActions} onChange={v => updateField('followUpActions', v)} placeholder="Describe any corrective actions or improvements needed..." rows={3} />
          </F>
        </Grid>
      </div>

      <div style={{ background: C.white, borderRadius: '8px', padding: '20px', marginBottom: '24px', border: `1px solid ${C.border}` }}>
        <h2 style={{ fontSize: '13px', fontWeight: '700', color: C.navy, marginBottom: '16px', paddingBottom: '12px', borderBottom: `2px solid ${C.blueBorder}`, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sign-off</h2>
        <Grid cols={1}>
          <F label="Signature (type your full name)">
            <TI value={formData.signature} onChange={v => updateField('signature', v)} placeholder="Type your full name to sign" />
          </F>
        </Grid>
      </div>

      {!isComplete() && !error && !success && (
        <div style={{ background: C.redBg, border: `1px solid #fca5a5`, borderRadius: '8px', padding: '12px 16px', marginBottom: '24px', fontSize: '13px', color: C.red }}>
          ⚠ Complete all required fields to submit
        </div>
      )}

      {error && (
        <div style={{ background: C.redBg, border: `1px solid #fca5a5`, borderRadius: '8px', padding: '12px 16px', marginBottom: '24px', fontSize: '13px', color: C.red }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: 8, padding: '12px 16px', marginBottom: 24, fontSize: 13, color: '#047857' }}>
          {success}
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
        <button onClick={() => router.back()} style={{ padding: '10px 20px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '7px', color: C.navy, fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>← Back</button>
        <button onClick={handleSave} disabled={!isComplete() || saving} style={{ padding: '10px 24px', background: isComplete() ? C.blue : C.muted, border: 'none', borderRadius: '7px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: isComplete() && !saving ? 'pointer' : 'not-allowed', opacity: isComplete() ? 1 : 0.6 }}>{saving ? 'Saving...' : 'Submit Evacuation Drill'}</button>
      </div>
    </FormLayout>
  );
}
