'use client';

import { useState, useCallback, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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

function Sel({ value, onChange, options }) {
  const inp = { width: "100%", padding: "9px 12px", border: `1px solid ${C.blueBorder}`, borderRadius: 7, fontSize: 13, background: C.white, color: C.text, outline: "none", boxSizing: "border-box", fontFamily: "inherit", appearance: "none" };
  return <select value={value ?? ""} onChange={e => onChange(e.target.value)} style={inp}><option value="">— Select —</option>{options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}</select>;
}

function CG({ label, options, selected = [], onChange }) {
  const toggle = v => onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]);
  return (
    <div>
      {label && <div style={{ fontSize: 11, fontWeight: 700, color: C.navy, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px" }}>
        {options.map(o => {
          const v = o.value ?? o, l = o.label ?? o, ch = selected.includes(v);
          return (
            <label key={v} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.text, cursor: "pointer" }}>
              <span onClick={() => toggle(v)} style={{ width: 16, height: 16, borderRadius: 3, border: `1.5px solid ${ch ? C.blue : C.blueBorder}`, background: ch ? C.blue : C.white, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                {ch && <span style={{ color: "#fff", fontSize: 10 }}>✓</span>}
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

function DrugDisposalForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialResidentId = searchParams.get('resident_id');
  const { auth } = useAuth();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [residents, setResidents] = useState([]);
  const [selectedResidentId, setSelectedResidentId] = useState(initialResidentId || '');
  const [drugs, setDrugs] = useState([{
    id: 1,
    date: '',
    drugName: '',
    drugStrength: '',
    quantity: '',
    quantityUnit: 'pills',
    reason: [],
    reasonOther: '',
    method: [],
    methodOther: '',
    staffName: '',
    witnessName: '',
    isControlled: false,
  }]);

  const [formData, setFormData] = useState({
    afhName: 'Dependable Care Wellness Centre',
  });

  // Fetch residents (staff: only assigned, admin: all)
  useEffect(() => {
    if (!auth) return;
    const fetchResidents = async () => {
      try {
        const isStaff = auth.user?.role === 'staff';
        // Facility-wide policy: staff may file for any resident, not just assigned ones.
        const endpoint = isStaff ? '/api/v1/residents?limit=200' : '/api/v1/admin/residents?limit=200';
        const res = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${auth.accessToken}` },
          credentials: 'same-origin',
        });
        if (res.ok) {
          const data = await res.json();
          const list = (data.data || data.residents || []).map(r => ({
            id: r.resident_id || r.id,
            first_name: r.first_name,
            last_name: r.last_name,
          }));
          setResidents(list);
        }
      } catch (err) {
      }
    };
    fetchResidents();
  }, [auth]);

  const updateDrug = (index, field, value) => {
    const newDrugs = [...drugs];
    newDrugs[index][field] = value;
    setDrugs(newDrugs);
  };

  const addDrug = () => {
    setDrugs([...drugs, {
      id: Math.max(...drugs.map(d => d.id)) + 1,
      date: '',
      drugName: '',
      drugStrength: '',
      quantity: '',
      quantityUnit: 'pills',
      reason: [],
      reasonOther: '',
      method: [],
      methodOther: '',
      staffName: '',
      witnessName: '',
      isControlled: false,
    }]);
  };

  const removeDrug = (index) => {
    if (drugs.length > 1) {
      setDrugs(drugs.filter((_, i) => i !== index));
    }
  };

  const isComplete = () => {
    if (!selectedResidentId) return false;
    return drugs.every(d =>
      d.date && d.drugName && d.quantity && d.reason.length > 0 && d.method.length > 0 && d.staffName
    );
  };

  const handleSave = useCallback(async () => {
    if (!isComplete()) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      let failed = 0;
      for (const drug of drugs) {
        const res = await fetch('/api/v1/drug-disposal', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${auth?.accessToken}`,
          },
          credentials: 'same-origin',
          body: JSON.stringify({
            resident_id: selectedResidentId,
            disposal_date: drug.date,
            drug_name: drug.drugName,
            drug_strength: drug.drugStrength,
            quantity_disposed: parseInt(drug.quantity, 10) || 0,
            quantity_unit: drug.quantityUnit,
            disposal_reason: drug.reason[0],
            disposal_reason_other: drug.reasonOther,
            disposal_method: drug.method[0],
            disposal_method_other: drug.methodOther,
            counting_staff_name: drug.staffName,
            witness_name: drug.witnessName,
            is_controlled_substance: drug.isControlled,
          }),
        });
        if (!res.ok) failed++;
      }
      if (failed > 0) {
        setError(`Failed to submit ${failed} of ${drugs.length} records.`);
      } else {
        setSuccess('Drug disposal record(s) submitted for review. Redirecting…');
        setTimeout(() => {
          const dest = ['admin', 'manager', 'superadmin'].includes(auth?.user?.role) ? '/admin' : '/staff';
          router.push(dest);
        }, 800);
      }
    } catch (err) {
      setError('An error occurred while submitting. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [drugs, selectedResidentId, router, auth]);

  return (
    <FormLayout formTitle="Drug Disposal Report">
      <div style={{ background: C.amberBg, border: `1px solid ${C.amber}`, borderRadius: '8px', padding: '12px 16px', marginBottom: '24px', fontSize: '13px', color: C.amber, lineHeight: '1.6' }}>
        Discontinued, expired or unused drugs (Rx or OTC) must be counted and disposed in accordance with OAR 411-050-0655. A witness is required for controlled substances.
      </div>

      <div style={{ background: C.white, borderRadius: '8px', padding: '20px', marginBottom: '24px', border: `1px solid ${C.border}` }}>
        <h2 style={{ fontSize: '13px', fontWeight: '700', color: C.navy, marginBottom: '16px', paddingBottom: '12px', borderBottom: `2px solid ${C.blueBorder}`, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Resident Information</h2>
        <Grid cols={2}>
          <F label="Resident">
            <Sel
              value={selectedResidentId}
              onChange={setSelectedResidentId}
              options={residents.map(r => ({
                value: r.id,
                label: `${r.first_name || ''} ${r.last_name || ''}`.trim() || 'Unknown',
              }))}
            />
          </F>
          <F label="AFH Name">
            <TI value={formData.afhName} readOnly />
          </F>
        </Grid>
      </div>

      <div style={{ background: C.white, borderRadius: '8px', padding: '20px', marginBottom: '24px', border: `1px solid ${C.border}` }}>
        <h2 style={{ fontSize: '13px', fontWeight: '700', color: C.navy, marginBottom: '16px', paddingBottom: '12px', borderBottom: `2px solid ${C.blueBorder}`, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Medications Disposed</h2>

        {drugs.map((drug, idx) => (
          <div key={drug.id} style={{ background: C.bluePale, border: `1px solid ${C.blueBorder}`, borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: C.navy }}>Medication {idx + 1}</span>
              {drugs.length > 1 && (
                <button onClick={() => removeDrug(idx)} style={{ background: C.redBg, border: `1px solid #fca5a5`, color: C.red, padding: '4px 12px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}>Remove</button>
              )}
            </div>

            <Grid cols={2}>
              <F label="Date">
                <TI type="date" value={drug.date} onChange={v => updateDrug(idx, 'date', v)} />
              </F>
              <F label="Drug Name">
                <TI value={drug.drugName} onChange={v => updateDrug(idx, 'drugName', v)} placeholder="Drug name" />
              </F>
              <F label="Drug Strength">
                <TI value={drug.drugStrength} onChange={v => updateDrug(idx, 'drugStrength', v)} placeholder="e.g., 500mg, 10mcg" />
              </F>
              <F label="Quantity Disposed">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '8px' }}>
                  <TI value={drug.quantity} onChange={v => updateDrug(idx, 'quantity', v)} placeholder="Amount" type="number" />
                  <Sel value={drug.quantityUnit} onChange={v => updateDrug(idx, 'quantityUnit', v)} options={[{value:'pills',label:'Pills'},{value:'patches',label:'Patches'},{value:'ml',label:'ml (liquid)'}]} />
                </div>
              </F>
            </Grid>

            <div style={{ marginTop: '16px' }}>
              <F label="Reason for Disposal">
                <CG
                  selected={drug.reason}
                  onChange={v => updateDrug(idx, 'reason', v)}
                  options={[
                    { value: 'discontinued', label: 'Discontinued' },
                    { value: 'expired', label: 'Expired' },
                    { value: 'unused', label: 'Unused' },
                    { value: 'other', label: 'Other' },
                  ]}
                />
              </F>
              {drug.reason.includes('other') && (
                <div style={{ marginTop: '12px' }}>
                  <F label="Other Reason">
                    <TI value={drug.reasonOther} onChange={v => updateDrug(idx, 'reasonOther', v)} placeholder="Describe..." />
                  </F>
                </div>
              )}
            </div>

            <div style={{ marginTop: '16px' }}>
              <F label="Method of Disposal">
                <CG
                  selected={drug.method}
                  onChange={v => updateDrug(idx, 'method', v)}
                  options={[
                    { value: 'flushed', label: 'Flushed' },
                    { value: 'coffee_grounds', label: 'Coffee grounds' },
                    { value: 'cat_litter', label: 'Cat litter' },
                    { value: 'pharmacy_take_back', label: 'Pharmacy drug take-back facility' },
                    { value: 'other', label: 'Other' },
                  ]}
                />
              </F>
              {drug.method.includes('other') && (
                <div style={{ marginTop: '12px' }}>
                  <F label="Other Method">
                    <TI value={drug.methodOther} onChange={v => updateDrug(idx, 'methodOther', v)} placeholder="Describe..." />
                  </F>
                </div>
              )}
            </div>

            <Grid cols={2} style={{ marginTop: '16px' }}>
              <F label="Staff Name (Counting & Disposing)">
                <TI value={drug.staffName} onChange={v => updateDrug(idx, 'staffName', v)} placeholder="Full name" />
              </F>
              <F label="Witness (If Controlled)">
                <TI value={drug.witnessName} onChange={v => updateDrug(idx, 'witnessName', v)} placeholder="Witness name" />
              </F>
              <F label="Controlled Substance?">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={drug.isControlled} onChange={e => updateDrug(idx, 'isControlled', e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                  <span>Yes, this is a controlled substance</span>
                </label>
              </F>
            </Grid>
          </div>
        ))}

        <button onClick={addDrug} style={{ width: '100%', padding: '12px', background: C.bluePale, border: `1px dashed ${C.blue}`, borderRadius: '8px', color: C.blue, fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>+ Add Another Medication</button>
      </div>

      {!isComplete() && !error && !success && (
        <div style={{ background: C.redBg, border: `1px solid #fca5a5`, borderRadius: '8px', padding: '12px 16px', marginBottom: '24px', fontSize: '13px', color: C.red }}>
          ⚠ Complete all required fields (resident, all drug details, reason, method, staff name) to submit
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
        <button onClick={handleSave} disabled={!isComplete() || saving} style={{ padding: '10px 24px', background: isComplete() ? C.blue : C.muted, border: 'none', borderRadius: '7px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: isComplete() && !saving ? 'pointer' : 'not-allowed', opacity: isComplete() ? 1 : 0.6 }}>{saving ? 'Saving...' : 'Submit Drug Disposal'}</button>
      </div>
    </FormLayout>
  );
}

export default function DrugDisposalPage() {
  return (
    <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>}>
      <DrugDisposalForm />
    </Suspense>
  );
}
