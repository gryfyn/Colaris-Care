'use client';
import { useState, useCallback, useEffect } from "react";
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/lib/useIsMobile';

const LIFE_DOMAINS = [
  { id: 1, label: "Peer Support" },
  { id: 2, label: "Personal Goals" },
  { id: 3, label: "Mental Health" },
  { id: 4, label: "Safety" },
  { id: 5, label: "Medical" },
  { id: 6, label: "Living Situation" },
  { id: 7, label: "Healthy Living" },
  { id: 8, label: "Financial/Legal Status" },
  { id: 9, label: "Social, Cultural, Spiritual" },
  { id: 10, label: "Natural/Family Support" },
  { id: 11, label: "Community Participation" },
  { id: 12, label: "Employment/Education" },
];

const WIZARD_STEPS = [
  { id: 1, label: "Patient & Plan Info",    short: "Patient",      icon: "◉" },
  { id: 2, label: "Care Planning Team",     short: "Team",         icon: "◎" },
  { id: 3, label: "Core Assessment",        short: "Assessment",   icon: "▦" },
  { id: 4, label: "Recovery Goals",         short: "Goals",        icon: "◈" },
  { id: 5, label: "Safety & Risk Plan",     short: "Safety",       icon: "⚑" },
  { id: 6, label: "Community & Discharge",  short: "Discharge",    icon: "⬡" },
  { id: 7, label: "Legal & Signatures",     short: "Sign-off",     icon: "✓" },
];

const C = {
  navy:        "#0f2d5e",
  navyMid:     "#1a3a5c",
  blue:        "#1a56db",
  bluePale:    "#eef4ff",
  blueBorder:  "#bfdbfe",
  white:       "#ffffff",
  bg:          "#f4f8ff",
  text:        "#1e2d40",
  muted:       "#6b7c93",
  border:      "#dde6f0",
  green:       "#0a7c4e",
  greenBg:     "#e6f5ee",
  amber:       "#b45309",
  amberBg:     "#fffbeb",
  red:         "#dc2626",
  redBg:       "#fef2f2",
  teal:        "#0891b2",
  tealBg:      "#ecfeff",
  gold:        "#d97706",
};

const inp = { width: "100%", padding: "9px 12px", border: `1px solid ${C.blueBorder}`, borderRadius: 7, fontSize: 13, background: C.white, color: C.text, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
const lbl = { display: "block", fontSize: 11, fontWeight: 700, color: C.navy, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" };
const secHead = { fontSize: 12, fontWeight: 700, color: C.blue, textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: `2px solid ${C.blueBorder}`, paddingBottom: 7, marginBottom: 16, marginTop: 24 };

function F({ label, children, span = 1 }) {
  return <div style={{ gridColumn: `span ${span}` }}>{label && <label style={lbl}>{label}</label>}{children}</div>;
}
function TI({ value, onChange, placeholder, type = "text", readOnly = false }) {
  return <input readOnly={readOnly} type={type} value={value ?? ""} onChange={e => onChange && onChange(e.target.value)} placeholder={placeholder} style={{ ...inp, background: readOnly ? "#f0f5ff" : C.white, color: readOnly ? C.blue : C.text, fontWeight: readOnly ? 600 : 400 }} />;
}
function TA({ value, onChange, placeholder, rows = 3 }) {
  return <textarea value={value ?? ""} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{ ...inp, resize: "vertical", lineHeight: 1.5 }} />;
}
function Grid({ cols = 2, children }) { return <div className="app-grid-collapse" style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: "14px 18px" }}>{children}</div>; }
function SH({ children }) { return <div style={secHead}>{children}</div>; }
function AutoField({ label, value }) {
  return (
    <div>
      {label && <div style={{ ...lbl, marginBottom: 4 }}>{label}</div>}
      <div style={{ ...inp, background: "#e8f0fe", color: C.blue, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 10, background: C.blue, color: "#fff", padding: "1px 5px", borderRadius: 3, fontWeight: 700 }}>AUTO</span>
        {value || "—"}
      </div>
    </div>
  );
}
function CG({ label, options, selected = [], onChange }) {
  const toggle = v => onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]);
  return (
    <div>
      {label && <div style={{ ...lbl, marginBottom: 8 }}>{label}</div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px" }}>
        {options.map(o => {
          const v = o.id ?? o.value ?? o, l = o.label ?? o, ch = selected.includes(v);
          return (
            <label key={`domain-${v}`} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.text, cursor: "pointer" }}>
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

export default function CarePlanEditPage() {
  const router = useRouter();
  const params = useParams();
  const { auth, loading: authLoading } = useAuth();
  const planId = params.id;

  const isMobile = useIsMobile(768);
  const [stepNavOpen, setStepNavOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [patient, setPatient] = useState(null);
  const [formData, setFormData] = useState(Object.fromEntries(WIZARD_STEPS.map(s => [s.id, {}])));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [completedSteps, setCompletedSteps] = useState([]);

  useEffect(() => {
    if (!authLoading && !auth) {
      router.push('/');
    }
  }, [auth, authLoading, router]);

  useEffect(() => {
    if (!auth?.accessToken || !planId) return;

    const loadPlan = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/v1/care-plans/${planId}`, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${auth.accessToken}`
          },
          credentials: 'include'
        });

        if (!response.ok) {
          let errorMessage = `API Error ${response.status}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (e) {
          }
          throw new Error(errorMessage);
        }

        const { data: plan } = await response.json();
        if (!plan) throw new Error('Care plan not found');

        setPatient({
          id: plan.resident_id,
          first_name: plan.first_name,
          last_name: plan.last_name,
          primary_diagnosis: plan.primary_diagnosis
        });

        const convertKey = (snakeKey) => snakeKey.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        const newFormData = Object.fromEntries(WIZARD_STEPS.map(s => [s.id, {}]));

        Object.entries(plan).forEach(([dbKey, value]) => {
          if (value === null || value === undefined) return;
          // Handle arrays (like selected_domains) specially
          if (Array.isArray(value) && value.length === 0) return;
          // Skip complex objects except arrays
          if (typeof value === 'object' && !Array.isArray(value)) return;

          const camelKey = convertKey(dbKey);
          let targetStep = 1;
          if (dbKey.startsWith('cmhp_') || dbKey.startsWith('res_prov_') || dbKey.startsWith('family_') ||
              dbKey.startsWith('cco_') || dbKey.startsWith('encc_') || dbKey.startsWith('cmhp_svc_') ||
              dbKey.startsWith('prsb_') || dbKey === 'isp_team_members') targetStep = 2;
          else if (dbKey.startsWith('psychiatric_') || dbKey.startsWith('medical_') || dbKey.startsWith('substance_') ||
                   dbKey.startsWith('adl_') || dbKey.startsWith('social_') || dbKey.startsWith('vocational_') ||
                   dbKey.startsWith('legal_') || dbKey.startsWith('housing_') || dbKey.startsWith('cco_ohp_') ||
                   dbKey === 'selected_domains' || dbKey === 'tribal_affiliation' || dbKey === 'language_pref' ||
                   dbKey === 'spiritual' || dbKey === 'gender_identity' || dbKey === 'other_cultural') targetStep = 3;
          else if (dbKey.startsWith('goal') || dbKey === 'med_mgmt' || dbKey === 'phys_health' ||
                   dbKey === 'nutrition' || dbKey === 'sleep') targetStep = 4;
          else if (dbKey.startsWith('crisis_') || dbKey.startsWith('suicide_') || dbKey.startsWith('self_harm_') ||
                   dbKey.startsWith('aggression_') || dbKey === 'awol_prevention' || dbKey === 'contraband_policy' ||
                   dbKey === 'mandatory_reporting' || dbKey === 'additional_safety') targetStep = 5;
          else if (dbKey.startsWith('community_') || dbKey.startsWith('discharge_') || dbKey === 'ohp_coverage' ||
                   dbKey === 'peer_support' || dbKey === 'voc_rehab' || dbKey === 'housing_resources' ||
                   dbKey === 'other_resources') targetStep = 6;
          else if (dbKey.startsWith('guardianship') || dbKey.startsWith('advanced_') || dbKey.startsWith('rights_') ||
                   dbKey.startsWith('consent_') || dbKey.startsWith('grievance_') || dbKey.startsWith('client_') ||
                   dbKey.startsWith('guardian_') || dbKey.startsWith('director_') || dbKey === 'review_schedule_final') targetStep = 7;

          newFormData[targetStep] = { ...newFormData[targetStep], [camelKey]: value };
        });

        setFormData(newFormData);
        setCompletedSteps([1, 2, 3, 4, 5, 6, 7]);
      } catch (err) {
        setError(`Failed to load care plan: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    loadPlan();
  }, [auth?.accessToken, planId]);

  const set = useCallback((stepId) => (key, val) => {
    setFormData(prev => ({ ...prev, [stepId]: { ...prev[stepId], [key]: val } }));
    setSaved(false);
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const response = await fetch('/api/v1/care-plans-wizard', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.accessToken}`
        },
        credentials: 'include',
        body: JSON.stringify({
          care_plan_id: planId,
          step: step,
          data: formData[step],
          status: 'active'
        })
      });

      if (!response.ok) throw new Error('Failed to save');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Final step: save the changes, then return to the admin Care Plans section.
  const handleFinish = async () => {
    const ok = await handleSave();
    if (ok) router.push('/admin?view=care_plans');
  };

  if (authLoading || loading) {
    return (
      <div style={{ position: "fixed", inset: 0, background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 14, color: C.muted, marginBottom: 12 }}>Loading...</div>
          <div style={{ width: 40, height: 40, borderRadius: "50%", border: `3px solid ${C.bluePale}`, borderTop: `3px solid ${C.blue}`, animation: "spin 0.6s linear infinite", margin: "0 auto" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (!auth) return null;
  if (!patient) return null;

  const residentName = `${patient.first_name || ''} ${patient.last_name || ''}`.trim();

  return (
    <div style={{ display: "flex", minHeight: "calc(100vh - 52px)", background: C.bg, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      {/* Mobile backdrop for the step drawer */}
      {isMobile && stepNavOpen && (
        <div onClick={() => setStepNavOpen(false)} style={{ position: "fixed", inset: "52px 0 0 0", background: "rgba(8,16,30,0.5)", zIndex: 210 }} />
      )}
      {/* Sidebar — inline column on desktop, off-canvas drawer on mobile */}
      <div style={{
        width: 180, background: C.navy, color: "#fff", display: "flex", flexDirection: "column", flexShrink: 0,
        ...(isMobile ? {
          position: "fixed", top: 52, left: 0, bottom: 0, zIndex: 220,
          transform: stepNavOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.25s ease", boxShadow: "4px 0 28px rgba(0,0,0,0.3)",
        } : {}),
      }}>
        <div style={{ padding: "16px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Editing Care Plan</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#bfdbfe", lineHeight: 1.3 }}>{residentName}</div>
        </div>

        <div style={{ flex: 1, padding: "12px 8px", overflowY: "auto" }}>
          {WIZARD_STEPS.map(ws => {
            const done = completedSteps.includes(ws.id), active = ws.id === step;
            return (
              <button key={ws.id} onClick={() => { setStep(ws.id); setStepNavOpen(false); }} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 8,
                padding: "8px 10px", background: active ? "rgba(255,255,255,0.1)" : "transparent",
                border: "none", borderRadius: 6, cursor: "pointer", marginBottom: 2,
                borderLeft: active ? "3px solid #60a5fa" : "3px solid transparent",
                color: active ? "#bfdbfe" : done ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.3)",
              }}>
                <span style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, background: done ? C.green : active ? C.blue : "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: done ? 10 : 9, color: "#fff", fontWeight: 700 }}>
                  {done ? "✓" : ws.id}
                </span>
                <span style={{ fontSize: 11, fontWeight: active ? 700 : 400, textAlign: "left" }}>{ws.short}</span>
              </button>
            );
          })}
        </div>

        {saved && (
          <div style={{ margin: "0 8px 10px", background: "rgba(10,124,78,0.25)", border: "1px solid rgba(10,124,78,0.4)", borderRadius: 6, padding: "8px 10px" }}>
            <div style={{ fontSize: 10, color: "#6ee7b7", fontWeight: 600 }}>✓ Saved</div>
          </div>
        )}

        <div style={{ padding: "10px 8px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <button onClick={() => router.back()} style={{ width: "100%", padding: "7px 0", background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 5, color: "rgba(255,255,255,0.35)", fontSize: 11, cursor: "pointer" }}>← Back</button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: isMobile ? "12px 14px" : "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <button type="button" onClick={() => setStepNavOpen(true)} aria-label="Open steps" className="app-show-mobile" style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${C.border}`, background: C.white, color: C.navy, alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </button>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: C.navy }}>{WIZARD_STEPS[step - 1].label}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Step {step} of {WIZARD_STEPS.length} · Edit Care Plan · OAR 309-019</div>
            </div>
          </div>
          <div className="app-hide-mobile" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 180, height: 5, background: C.bluePale, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${(step / WIZARD_STEPS.length) * 100}%`, height: "100%", background: C.blue, borderRadius: 3, transition: "width 0.3s" }} />
            </div>
            <span style={{ fontSize: 12, color: C.muted, width: 36 }}>{Math.round((step / WIZARD_STEPS.length) * 100)}%</span>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "16px 14px" : "24px 32px" }}>
          {step === 1 && (
            <div>
              <SH>Patient Information (Read-Only)</SH>
              <Grid>
                <F label="First Name"><AutoField value={patient.first_name} /></F>
                <F label="Last Name"><AutoField value={patient.last_name} /></F>
                <F label="Primary Diagnosis"><AutoField value={patient.primary_diagnosis} /></F>
              </Grid>

              <SH>Care Plan Details</SH>
              <Grid>
                <F label="Plan Type"><TI value={formData[1].planType} onChange={v => set(1)('planType', v)} /></F>
                <F label="Effective Date"><TI type="date" value={formData[1].effectiveDate} onChange={v => set(1)('effectiveDate', v)} /></F>
                <F label="Review Schedule"><TI value={formData[1].reviewSchedule} onChange={v => set(1)('reviewSchedule', v)} /></F>
                <F label="Review Date"><TI type="date" value={formData[1].reviewDate} onChange={v => set(1)('reviewDate', v)} /></F>
              </Grid>

              <SH>Legal Representative Information</SH>
              <Grid>
                <F label="First Name"><TI value={formData[1].repFirstName} onChange={v => set(1)('repFirstName', v)} /></F>
                <F label="Last Name"><TI value={formData[1].repLastName} onChange={v => set(1)('repLastName', v)} /></F>
                <F label="Phone"><TI type="tel" value={formData[1].repPhone} onChange={v => set(1)('repPhone', v)} /></F>
                <F label="Relationship"><TI value={formData[1].repRelationship} onChange={v => set(1)('repRelationship', v)} /></F>
              </Grid>
              <Grid cols={1}>
                <F label="Address"><TI value={formData[1].repAddress} onChange={v => set(1)('repAddress', v)} /></F>
              </Grid>
            </div>
          )}

          {step === 2 && (
            <div>
              <SH>Primary Care Mental Health Provider (CMHP)</SH>
              <Grid>
                <F label="First Name"><TI value={formData[2].cmhpFirst} onChange={v => set(2)('cmhpFirst', v)} /></F>
                <F label="Last Name"><TI value={formData[2].cmhpLast} onChange={v => set(2)('cmhpLast', v)} /></F>
                <F label="Organization"><TI value={formData[2].cmhpOrg} onChange={v => set(2)('cmhpOrg', v)} /></F>
                <F label="Phone"><TI type="tel" value={formData[2].cmhpPhone} onChange={v => set(2)('cmhpPhone', v)} /></F>
              </Grid>
              <Grid cols={1}>
                <F label="NPI"><TI value={formData[2].cmhpNpi} onChange={v => set(2)('cmhpNpi', v)} /></F>
                <F label="Address"><TI value={formData[2].cmhpAddress} onChange={v => set(2)('cmhpAddress', v)} /></F>
              </Grid>

              <SH>Residential Provider</SH>
              <Grid>
                <F label="First Name"><TI value={formData[2].resProvFirst} onChange={v => set(2)('resProvFirst', v)} /></F>
                <F label="Last Name"><TI value={formData[2].resProvLast} onChange={v => set(2)('resProvLast', v)} /></F>
                <F label="Phone"><TI type="tel" value={formData[2].resProvPhone} onChange={v => set(2)('resProvPhone', v)} /></F>
                <F label="Email"><TI type="email" value={formData[2].resProvEmail} onChange={v => set(2)('resProvEmail', v)} /></F>
              </Grid>

              <SH>Family Member</SH>
              <Grid>
                <F label="First Name"><TI value={formData[2].familyFirst} onChange={v => set(2)('familyFirst', v)} /></F>
                <F label="Last Name"><TI value={formData[2].familyLast} onChange={v => set(2)('familyLast', v)} /></F>
                <F label="Relationship"><TI value={formData[2].familyRelation} onChange={v => set(2)('familyRelation', v)} /></F>
                <F label="Phone"><TI type="tel" value={formData[2].familyPhone} onChange={v => set(2)('familyPhone', v)} /></F>
              </Grid>
              <Grid cols={1}>
                <F label="Email"><TI type="email" value={formData[2].familyEmail} onChange={v => set(2)('familyEmail', v)} /></F>
              </Grid>

              <SH>Care Coordination Organization (CCO)</SH>
              <Grid>
                <F label="Organization"><TI value={formData[2].ccoOrg} onChange={v => set(2)('ccoOrg', v)} /></F>
                <F label="First Name"><TI value={formData[2].ccoFirst} onChange={v => set(2)('ccoFirst', v)} /></F>
                <F label="Last Name"><TI value={formData[2].ccoLast} onChange={v => set(2)('ccoLast', v)} /></F>
                <F label="Phone"><TI type="tel" value={formData[2].ccoPhone} onChange={v => set(2)('ccoPhone', v)} /></F>
              </Grid>
            </div>
          )}

          {step === 3 && (
            <div>
              <SH>Life Domains Assessment</SH>
              <CG label="Select Applicable Life Domains" options={LIFE_DOMAINS} selected={Array.isArray(formData[3].selectedDomains) ? formData[3].selectedDomains : []} onChange={v => set(3)('selectedDomains', v)} />

              <SH>Assessment Notes</SH>
              <Grid cols={1}>
                <F label="Psychiatric Strengths"><TA value={formData[3].psychiatricStrengths} onChange={v => set(3)('psychiatricStrengths', v)} /></F>
                <F label="Psychiatric Needs"><TA value={formData[3].psychiatricNeeds} onChange={v => set(3)('psychiatricNeeds', v)} /></F>
                <F label="Recovery Vision"><TA value={formData[3].recoveryVision} onChange={v => set(3)('recoveryVision', v)} /></F>
              </Grid>
            </div>
          )}

          {step === 4 && (
            <div>
              <SH>Recovery Goals</SH>
              {[1, 2, 3].map(n => (
                <div key={n} style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 12 }}>Goal {n}</div>
                  <Grid cols={1}>
                    <F label={`Goal ${n} Statement`}><TA value={formData[4][`goal${n}Statement`]} onChange={v => set(4)(`goal${n}Statement`, v)} /></F>
                    <F label={`Objective ${n}.1`}><TI value={formData[4][`goal${n}Obj1`]} onChange={v => set(4)(`goal${n}Obj1`, v)} /></F>
                    <F label={`Objective ${n}.2`}><TI value={formData[4][`goal${n}Obj2`]} onChange={v => set(4)(`goal${n}Obj2`, v)} /></F>
                    <F label={`Objective ${n}.3`}><TI value={formData[4][`goal${n}Obj3`]} onChange={v => set(4)(`goal${n}Obj3`, v)} /></F>
                  </Grid>
                </div>
              ))}
            </div>
          )}

          {step === 5 && (
            <div>
              <SH>Safety &amp; Risk Management</SH>
              <Grid cols={1}>
                <F label="Crisis Warning Signs"><TA value={formData[5].crisisWarningSigns} onChange={v => set(5)('crisisWarningSigns', v)} /></F>
                <F label="Crisis Coping Strategies"><TA value={formData[5].crisisCoping} onChange={v => set(5)('crisisCoping', v)} /></F>
                <F label="Crisis Contacts"><TA value={formData[5].crisisContacts} onChange={v => set(5)('crisisContacts', v)} /></F>
                <F label="Suicide Protocol"><TA value={formData[5].suicideProtocol} onChange={v => set(5)('suicideProtocol', v)} /></F>
              </Grid>
            </div>
          )}

          {step === 6 && (
            <div>
              <SH>Discharge Planning</SH>
              <Grid cols={1}>
                <F label="Discharge Housing"><TA value={formData[6].dischargeHousing} onChange={v => set(6)('dischargeHousing', v)} /></F>
                <F label="Discharge Target Date"><TI type="date" value={formData[6].dischargeTargetDate} onChange={v => set(6)('dischargeTargetDate', v)} /></F>
                <F label="Discharge Barriers"><TA value={formData[6].dischargeBarriers} onChange={v => set(6)('dischargeBarriers', v)} /></F>
              </Grid>

              <SH>Community Resources & Support</SH>
              <Grid cols={1}>
                <F label="Community Resources"><TA value={formData[6].communityResources} onChange={v => set(6)('communityResources', v)} /></F>
                <F label="Peer Support"><TA value={formData[6].peerSupport} onChange={v => set(6)('peerSupport', v)} /></F>
                <F label="Vocational Rehabilitation"><TA value={formData[6].vocRehab} onChange={v => set(6)('vocRehab', v)} /></F>
                <F label="Housing Resources"><TA value={formData[6].housingResources} onChange={v => set(6)('housingResources', v)} /></F>
                <F label="Other Resources"><TA value={formData[6].otherResources} onChange={v => set(6)('otherResources', v)} /></F>
              </Grid>

              <SH>OHP Coverage & Benefits</SH>
              <Grid cols={1}>
                <F label="OHP Coverage"><TI value={formData[6].ohpCoverage} onChange={v => set(6)('ohpCoverage', v)} /></F>
              </Grid>
            </div>
          )}

          {step === 7 && (
            <div>
              <SH>Legal &amp; Signatures</SH>
              <Grid cols={1}>
                <F label="Guardianship Status"><TI value={formData[7].guardianship} onChange={v => set(7)('guardianship', v)} /></F>
                <F label="Advanced Directive"><TA value={formData[7].advancedDirective} onChange={v => set(7)('advancedDirective', v)} /></F>
                <F label="Client Signature"><TI value={formData[7].clientSignature} onChange={v => set(7)('clientSignature', v)} /></F>
                <F label="Director Signature"><TI value={formData[7].directorSignature} onChange={v => set(7)('directorSignature', v)} /></F>
              </Grid>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ background: C.white, borderTop: `1px solid ${C.border}`, padding: isMobile ? "12px 14px" : "14px 28px", display: "flex", flexDirection: "column", gap: 12, flexShrink: 0 }}>
          {saved && (
            <div style={{ fontSize: 13, color: C.green, background: C.greenBg, border: `1px solid #86efac`, borderRadius: 6, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16 }}>✓</span>
              <div>Changes saved</div>
            </div>
          )}
          {error && (
            <div style={{ fontSize: 13, color: C.red, background: C.redBg, border: `1px solid #fca5a5`, borderRadius: 6, padding: "10px 12px" }}>
              ⚠ {error}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1} style={{ padding: "9px 22px", background: "transparent", border: `1px solid ${C.blueBorder}`, borderRadius: 7, fontSize: 13, fontWeight: 600, color: step === 1 ? C.muted : C.navy, cursor: step === 1 ? "not-allowed" : "pointer", opacity: step === 1 ? 0.4 : 1 }}>← Previous</button>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleSave} disabled={saving} style={{ padding: "9px 18px", background: C.bluePale, border: `1px solid ${C.blueBorder}`, borderRadius: 7, fontSize: 13, fontWeight: 600, color: C.blue, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>{saving ? "Saving..." : "Save Changes"}</button>
              {step < WIZARD_STEPS.length ? (
                <button onClick={() => { handleSave(); setStep(s => s + 1); }} disabled={saving} style={{ padding: "9px 24px", background: C.blue, border: "none", borderRadius: 7, fontSize: 13, fontWeight: 700, color: "#fff", cursor: saving ? "not-allowed" : "pointer" }}>{saving ? "Saving..." : "Save & Continue →"}</button>
              ) : (
                <button onClick={handleFinish} disabled={saving} style={{ padding: "9px 24px", background: C.green, border: "none", borderRadius: 7, fontSize: 13, fontWeight: 700, color: "#fff", cursor: saving ? "not-allowed" : "pointer" }}>{saving ? "Saving..." : "Finish & Save ✓"}</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
