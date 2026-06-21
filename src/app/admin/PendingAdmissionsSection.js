// File: src/app/admin/PendingAdmissionsSection.js
'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth, authHeaders } from '@/contexts/AuthContext';
import {
  ADMISSION_REVIEW_CONFIG,
  getFormFlatData,
  getUnmappedEntries,
  formatReviewValue,
  isReviewValueEmpty,
  humanizeKey,
} from '@/lib/admission-review-config';
import { generateAndDownloadPdf } from '@/lib/pdf-downloader';

// Theme (must match admin page)
const C = {
  navy: "#0f2d5e", navyMid: "#1a3a5c", blue: "#1a56db", bluePale: "#eef4ff", blueBorder: "#bfdbfe",
  white: "#ffffff", bg: "#f4f8ff", text: "#1e2d40", muted: "#6b7c93", border: "#dde6f0",
  green: "#0a7c4e", greenBg: "#e6f5ee", amber: "#b45309", amberBg: "#fffbeb", red: "#dc2626",
  redBg: "#fef2f2", teal: "#0891b2", tealBg: "#ecfeff", gold: "#d97706", purple: "#7c3aed", purpleBg: "#f5f3ff",
};

// Shared styles
const inp = { width: "100%", padding: "9px 12px", border: `1px solid ${C.blueBorder}`, borderRadius: 7, fontSize: 13, background: C.white, color: C.text, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
const lbl = { display: "block", fontSize: 11, fontWeight: 700, color: C.navy, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" };
const secHead = { fontSize: 12, fontWeight: 700, color: C.blue, textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: `2px solid ${C.blueBorder}`, paddingBottom: 7, marginBottom: 16, marginTop: 24 };

// Component Functions
function F({ label, children, span = 1 }) {
  return <div style={{ gridColumn: `span ${span}` }}>{label && <label style={lbl}>{label}</label>}{children}</div>;
}
function TI({ value, onChange, placeholder, type = "text", readOnly = false }) {
  return <input readOnly={readOnly} type={type} value={value ?? ""} onChange={e => onChange && onChange(e.target.value)} placeholder={placeholder} style={{ ...inp, background: readOnly ? "#f0f5ff" : C.white, color: readOnly ? C.blue : C.text, fontWeight: readOnly ? 600 : 400 }} />;
}
function TA({ value, onChange, placeholder, rows = 3 }) {
  return <textarea value={value ?? ""} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{ ...inp, resize: "vertical", lineHeight: 1.5 }} />;
}
function Grid({ cols = 2, children }) { return <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: "14px 18px" }}>{children}</div>; }
function SH({ children }) { return <div style={secHead}>{children}</div>; }

function Badge({ status }) {
  const map = {
    "pending": { bg: C.amberBg, color: C.amber },
    "approved": { bg: C.greenBg, color: C.green },
    "rejected": { bg: C.redBg, color: C.red },
  };
  const s = map[status] || { bg: "#f3f4f6", color: "#6b7280" };
  return <span style={{ background: s.bg, color: s.color, padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{String(status ?? "—").replace(/_/g, " ")}</span>;
}

function Table({ cols, rows, onRow }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: C.bluePale }}>
            {cols.map(c => <th key={c} style={{ padding: "9px 12px", textAlign: "left", color: C.navy, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${C.blueBorder}`, whiteSpace: "nowrap" }}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} onClick={() => onRow && onRow(row)} style={{ borderBottom: `1px solid ${C.border}`, cursor: onRow ? "pointer" : "default" }} onMouseEnter={e => onRow && (e.currentTarget.style.background = C.bluePale)} onMouseLeave={e => onRow && (e.currentTarget.style.background = "transparent")}>
              {row.map((cell, j) => <td key={j} style={{ padding: "10px 12px", color: C.text, verticalAlign: "middle" }}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const FORM_TABS = [
  { key: 'pre_screening', dataKey: 'pre_screening_data', completeKey: 'pre_screening_complete' },
  { key: 'nursing_assessment', dataKey: 'nursing_assessment_data', completeKey: 'nursing_assessment_complete' },
  { key: 'advance_directive', dataKey: 'advance_directive_data', completeKey: 'advance_directive_complete' },
];

// Render a medication array (psychMeds / nonPsychMeds) as readable rows
function MedList({ meds }) {
  const filled = Array.isArray(meds) ? meds.filter(m => m && (m.name || m.dosageValue)) : [];
  if (filled.length === 0) return <div style={{ ...inp, background: '#f0f5ff', color: C.muted }}>—</div>;
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {filled.map((m, i) => {
        const dose = [m.dosageValue, m.dosageUnit].filter(Boolean).join(' ');
        const extra = m.prescriber || m.indication;
        return (
          <div key={i} style={{ fontSize: 13, color: C.text, background: '#f0f5ff', border: `1px solid ${C.blueBorder}`, borderRadius: 6, padding: '7px 10px' }}>
            <strong style={{ color: C.navy }}>{m.name || '—'}</strong>
            {dose ? <span> · {dose}</span> : null}
            {extra ? <span style={{ color: C.muted }}> · {extra}</span> : null}
          </div>
        );
      })}
    </div>
  );
}

// One read-only field (label + value box)
function ReviewField({ field, value }) {
  if (field.type === 'meds') {
    return <div style={{ gridColumn: 'span 2' }}><label style={lbl}>{field.label}</label><MedList meds={value} /></div>;
  }
  const display = formatReviewValue(field, value);
  const isLong = field.type === 'textarea' || (typeof display === 'string' && display.length > 70);
  return (
    <div style={{ gridColumn: isLong ? 'span 2' : 'span 1' }}>
      <label style={lbl}>{field.label}</label>
      <div style={{ ...inp, background: '#f0f5ff', color: C.blue, fontWeight: 600, height: 'auto', minHeight: 38, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {display}
      </div>
    </div>
  );
}

// Render a whole form (config-driven, complete) from its flat data
function FormReview({ formKey, flat, showEmpty }) {
  const cfg = ADMISSION_REVIEW_CONFIG[formKey];
  if (!cfg) return null;

  const hasValue = (field) => !isReviewValueEmpty(flat[field.key]);
  const unmapped = getUnmappedEntries(formKey, flat);

  const sections = cfg.steps.flatMap((step, si) =>
    step.sections.map((sec) => {
      const fields = showEmpty ? sec.fields : sec.fields.filter(hasValue);
      return { stepTitle: step.title, stepId: si + 1, title: sec.title, fields };
    })
  ).filter(sec => sec.fields.length > 0);

  if (sections.length === 0 && unmapped.length === 0) {
    return <div style={{ color: C.muted, fontSize: 13, padding: '8px 0' }}>No entries were recorded in this form.</div>;
  }

  return (
    <div>
      {sections.map((sec, idx) => {
        const showStep = idx === 0 || sec.stepTitle !== sections[idx - 1].stepTitle;
        return (
          <div key={idx}>
            {showStep && (
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '18px 0 2px' }}>
                Step {sec.stepId} · {sec.stepTitle}
              </div>
            )}
            <SH>{sec.title}</SH>
            <div style={{ background: C.white, border: `1px solid ${C.blueBorder}`, borderRadius: 8, padding: 16, marginBottom: 8 }}>
              <Grid cols={2}>
                {sec.fields.map(field => <ReviewField key={field.key} field={field} value={flat[field.key]} />)}
              </Grid>
            </div>
          </div>
        );
      })}

      {unmapped.length > 0 && (
        <div>
          <SH>Other Entered Fields</SH>
          <div style={{ background: C.white, border: `1px solid ${C.blueBorder}`, borderRadius: 8, padding: 16, marginBottom: 8 }}>
            <Grid cols={2}>
              {unmapped.map(([key, value]) => (
                <ReviewField key={key} field={{ key, label: humanizeKey(key), type: Array.isArray(value) ? 'list' : 'text' }} value={value} />
              ))}
            </Grid>
          </div>
        </div>
      )}
    </div>
  );
}

function AdmissionReviewModal({ admission, accessToken, onClose, onReviewSubmit, error = '' }) {
  const [activeTab, setActiveTab] = useState('pre_screening');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showEmpty, setShowEmpty] = useState(false);
  const [fullData, setFullData] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState('');
  // PDF download state
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfError, setPdfError] = useState('');
  // Decline validation
  const [declineError, setDeclineError] = useState('');
  // Post-approve success message
  const [approveSuccess, setApproveSuccess] = useState(false);

  // Fetch the complete submission (all three JSONB blobs) on open
  useEffect(() => {
    let cancelled = false;
    if (!admission?.id) return;
    (async () => {
      setLoadingData(true);
      setLoadError('');
      try {
        const res = await fetch(`/api/v1/admission/forms/${admission.id}`, {
          headers: { ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
          credentials: 'same-origin',
        });
        if (!res.ok) throw new Error('Failed to load full submission data');
        const json = await res.json();
        if (!cancelled) setFullData(json.data || null);
      } catch (err) {
        if (!cancelled) setLoadError(err.message);
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    })();
    return () => { cancelled = true; };
  }, [admission?.id, accessToken]);

  if (!admission) return null;

  const residentName = fullData?.full_name || admission.pre_screening?.full_name || '—';

  const handleApprove = async () => {
    setDeclineError('');
    setSubmitting(true);
    try {
      await onReviewSubmit(admission.id, 'approved', notes);
      setApproveSuccess(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = async () => {
    setDeclineError('');
    if (!notes || !notes.trim()) {
      setDeclineError('A reason is required to decline an admission. Please enter a reason in the Review Notes field.');
      return;
    }
    setSubmitting(true);
    try { await onReviewSubmit(admission.id, 'rejected', notes); } finally { setSubmitting(false); }
  };

  const handleDownloadPdf = async () => {
    setPdfError('');
    setPdfGenerating(true);
    try {
      // Use the pre_screening_data blob from fullData (flat JSONB)
      const preScreeningBlob = fullData?.pre_screening_data ?? fullData?.pre_screening ?? {};
      const result = await generateAndDownloadPdf(
        'pre-screening',
        preScreeningBlob,
        residentName,
        accessToken
      );
      if (!result.success) {
        setPdfError(result.error || 'Failed to generate PDF');
      }
    } catch (err) {
      setPdfError(err.message || 'Failed to generate PDF');
    } finally {
      setPdfGenerating(false);
    }
  };

  const activeTabMeta = FORM_TABS.find(t => t.key === activeTab);
  const activeBlob = fullData ? fullData[activeTabMeta.dataKey] : null;
  const activeFlat = getFormFlatData(activeBlob);
  const activeHasData = activeBlob && Object.keys(activeFlat).length > 0;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 45, 94, 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: C.bg, borderRadius: 12, width: 'min(960px, 96vw)', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ background: C.navy, padding: '16px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '12px 12px 0 0', flexShrink: 0, gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', flex: 1, minWidth: 0 }}>
            Pre-Screening Review — {residentName}
            <span style={{ marginLeft: 10, fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.65)' }}>
              Awaiting approval decision
            </span>
          </div>
          {/* Download PDF button in header */}
          <button
            onClick={handleDownloadPdf}
            disabled={pdfGenerating || loadingData || !!loadError}
            title="Download pre-screening PDF"
            style={{
              padding: '7px 14px',
              border: '1px solid rgba(255,255,255,0.35)',
              borderRadius: 6,
              background: pdfGenerating ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.15)',
              color: '#fff',
              cursor: (pdfGenerating || loadingData || !!loadError) ? 'default' : 'pointer',
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              opacity: (pdfGenerating || loadingData || !!loadError) ? 0.6 : 1,
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            {pdfGenerating ? (
              <>
                <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                Generating…
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download PDF
              </>
            )}
          </button>
          <button onClick={onClose} disabled={submitting} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, color: '#fff', cursor: submitting ? 'default' : 'pointer', fontSize: 16, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: submitting ? 0.5 : 1, flexShrink: 0 }}>✕</button>
        </div>

        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          {/* PDF error */}
          {pdfError && (
            <div style={{ background: C.redBg, border: `1px solid ${C.red}`, borderRadius: 6, padding: '9px 12px', marginBottom: 14, color: C.red, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>PDF error: {pdfError}</span>
              <button onClick={() => setPdfError('')} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '0 2px' }}>✕</button>
            </div>
          )}

          {/* Approve success banner */}
          {approveSuccess && (
            <div style={{ background: C.greenBg, border: `1px solid ${C.green}`, borderRadius: 6, padding: '11px 14px', marginBottom: 14, color: C.green, fontSize: 13, fontWeight: 600 }}>
              Admission approved. This client is now available under Residents → Admit Resident once staff complete the nursing assessment and advance directive.
            </div>
          )}

          {/* Form Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
            {FORM_TABS.map(({ key, completeKey }) => {
              const present = fullData ? !!fullData[completeKey] : false;
              const isPrimary = key === 'pre_screening';
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  title={isPrimary ? 'Pre-screening — this is the form submitted for review' : 'Not yet submitted (completed after approval)'}
                  style={{
                    padding: '12px 16px', border: 'none',
                    background: activeTab === key ? C.blue : 'transparent',
                    color: activeTab === key ? '#fff' : C.text,
                    cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    borderRadius: '6px 6px 0 0', marginBottom: -1,
                  }}
                >
                  {ADMISSION_REVIEW_CONFIG[key].label}
                  {isPrimary && <span style={{ marginLeft: 5, fontSize: 10, fontWeight: 700, color: activeTab === key ? 'rgba(255,255,255,0.75)' : C.blue }}>(primary)</span>}
                  <span style={{ marginLeft: 6, opacity: 0.85 }}>{present ? '✓' : '○'}</span>
                </button>
              );
            })}
            <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.muted, cursor: 'pointer', paddingBottom: 8 }}>
              <input type="checkbox" checked={showEmpty} onChange={e => setShowEmpty(e.target.checked)} />
              Show empty fields
            </label>
          </div>

          {/* Tab help text for non-primary tabs */}
          {activeTab !== 'pre_screening' && (
            <div style={{ background: C.amberBg, border: `1px solid ${C.amber}`, borderRadius: 6, padding: '9px 12px', marginBottom: 14, color: C.amber, fontSize: 12 }}>
              This form is completed after the pre-screening is approved. Only the Pre-Screening tab has data at this stage.
            </div>
          )}

          {/* Form Content */}
          {loadingData ? (
            <div style={{ padding: 30, textAlign: 'center', color: C.muted, fontSize: 13 }}>Loading full submission…</div>
          ) : loadError ? (
            <div style={{ background: C.redBg, border: `1px solid ${C.red}`, borderRadius: 6, padding: '10px 12px', marginBottom: 16, color: C.red, fontSize: 13 }}>{loadError}</div>
          ) : !activeHasData ? (
            <div style={{ color: C.muted, fontSize: 13, padding: '16px 0' }}>No {ADMISSION_REVIEW_CONFIG[activeTab].label} form submitted yet.</div>
          ) : (
            <FormReview formKey={activeTab} flat={activeFlat} showEmpty={showEmpty} />
          )}

          {/* Review Notes */}
          <div style={{ marginTop: 20, marginBottom: 6 }}>
            <label style={{ ...lbl, marginBottom: 8 }}>
              Review Notes
              <span style={{ marginLeft: 6, fontWeight: 400, color: C.red, textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>* Required when declining</span>
            </label>
            <TA value={notes} onChange={v => { setNotes(v); if (declineError) setDeclineError(''); }} placeholder="Add approval notes or decline reason..." rows={4} />
          </div>

          {/* Decline validation error */}
          {declineError && (
            <div style={{ background: C.redBg, border: `1px solid ${C.red}`, borderRadius: 6, padding: '9px 12px', marginBottom: 10, color: C.red, fontSize: 13 }}>
              {declineError}
            </div>
          )}

          {/* General Error Message */}
          {error && !declineError && (
            <div style={{ background: C.redBg, border: `1px solid ${C.red}`, borderRadius: 6, padding: '10px 12px', marginBottom: 16, color: C.red, fontSize: 13 }}>
              {error}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ borderTop: `1px solid ${C.border}`, padding: '16px 24px', display: 'flex', gap: 12, justifyContent: 'flex-end', background: C.white, flexShrink: 0 }}>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{ padding: '9px 18px', border: `1px solid ${C.border}`, borderRadius: 7, background: C.white, cursor: submitting ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, color: C.text, opacity: submitting ? 0.5 : 1 }}
          >
            Cancel
          </button>
          <button
            onClick={handleDecline}
            disabled={submitting}
            style={{ padding: '9px 18px', border: 'none', borderRadius: 7, background: C.red, color: '#fff', cursor: submitting ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? 'Processing...' : 'Decline'}
          </button>
          <button
            onClick={handleApprove}
            disabled={submitting || approveSuccess}
            style={{ padding: '9px 18px', border: 'none', borderRadius: 7, background: C.green, color: '#fff', cursor: (submitting || approveSuccess) ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, opacity: (submitting || approveSuccess) ? 0.7 : 1 }}
          >
            {submitting ? 'Processing...' : approveSuccess ? 'Approved' : 'Approve'}
          </button>
        </div>
      </div>
      {/* Keyframe for PDF spinner — scoped inline style tag */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export function PendingAdmissionsSection() {
  const { auth, csrfToken } = useAuth();
  const [tab, setTab] = useState('all');
  const [admissions, setAdmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedAdmission, setSelectedAdmission] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch pending admissions
  const fetchAdmissions = useCallback(async () => {
    if (!auth?.accessToken) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/v1/admission/pending?limit=100', {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
        credentials: 'same-origin',
      });
      if (!response.ok) throw new Error('Failed to load pending admissions');
      const data = await response.json();
      setAdmissions(data.admissions || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [auth]);

  // Load on mount and when the authenticated user changes.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!auth?.accessToken) {
        setAdmissions([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const response = await fetch('/api/v1/admission/pending?limit=100', {
          headers: { Authorization: `Bearer ${auth.accessToken}` },
          credentials: 'same-origin',
        });
        if (!response.ok) throw new Error('Failed to load pending admissions');
        const data = await response.json();
        if (!cancelled) setAdmissions(data.admissions || []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [auth?.accessToken]);

  // Handle review submission
  const handleReviewSubmit = async (admissionId, status, notes) => {
    setSubmitting(true);
    try {
      const response = await fetch(`/api/v1/admission/${admissionId}/review`, {
        method: 'PATCH',
        headers: authHeaders(auth?.accessToken, csrfToken),
        credentials: 'same-origin',
        body: JSON.stringify({ status, notes: notes || null })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to submit review');
      }

      setSelectedAdmission(null);
      await fetchAdmissions();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Filter admissions by tab
  const filtered = admissions.filter(a => {
    if (tab === 'all') return true;
    const hasPreScreening = !!a.pre_screening;
    const hasNursing = !!a.nursing_assessment;
    const hasDirective = !!a.advance_directive;

    if (tab === 'pre_screening_only') return hasPreScreening && !hasNursing && !hasDirective;
    if (tab === 'nursing_only') return hasNursing && !hasPreScreening && !hasDirective;
    if (tab === 'directive_only') return hasDirective && !hasPreScreening && !hasNursing;
    return true;
  });

  // Build table rows
  const rows = filtered.map(admission => {
    const dob = admission.pre_screening?.date_of_birth ? new Date(admission.pre_screening.date_of_birth).toLocaleDateString() : '—';
    const submitted = admission.submitted_at ? new Date(admission.submitted_at).toLocaleDateString() : '—';
    const hasPreScreening = admission.pre_screening ? '✓' : '○';
    const hasNursing = admission.nursing_assessment ? '✓' : '○';
    const hasDirective = admission.advance_directive ? '✓' : '○';

    return [
      admission.pre_screening?.full_name || '—',
      dob,
      submitted,
      `${hasPreScreening} ${hasNursing} ${hasDirective}`,
      <Badge key={`badge-${admission.id}`} status={admission.status} />,
      <button
        key={`review-${admission.id}`}
        onClick={() => setSelectedAdmission(admission)}
        style={{
          padding: '6px 12px',
          border: `1px solid ${C.blue}`,
          borderRadius: 5,
          background: C.white,
          color: C.blue,
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
          whiteSpace: 'nowrap'
        }}
      >
        Review
      </button>
    ];
  });

  return (
    <>
      <SH>Pending Admissions — Pre-Screenings Awaiting Decision</SH>

      {/* Contextual info banner */}
      <div style={{ background: C.bluePale, border: `1px solid ${C.blueBorder}`, borderRadius: 7, padding: '10px 14px', marginBottom: 16, color: C.navy, fontSize: 12 }}>
        Each row is a pre-screening submitted by staff and awaiting your Approve or Decline decision.
        Nursing assessment and advance directive are completed after approval.
      </div>

      {/* Error Message */}
      {error && (
        <div style={{ background: C.redBg, border: `1px solid ${C.red}`, borderRadius: 6, padding: '10px 12px', marginBottom: 16, color: C.red, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { key: 'all', label: `All (${admissions.length})` },
          { key: 'pre_screening_only', label: `Pre-Screen Only (${admissions.filter(a => a.pre_screening && !a.nursing_assessment && !a.advance_directive).length})` },
          { key: 'nursing_only', label: `Nursing Only (${admissions.filter(a => a.nursing_assessment && !a.pre_screening && !a.advance_directive).length})` },
          { key: 'directive_only', label: `Directive Only (${admissions.filter(a => a.advance_directive && !a.pre_screening && !a.nursing_assessment).length})` },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '9px 16px',
              border: tab === t.key ? 'none' : `1px solid ${C.border}`,
              borderRadius: 6,
              background: tab === t.key ? C.blue : C.white,
              color: tab === t.key ? '#fff' : C.text,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ padding: 20, textAlign: 'center', color: C.muted }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', color: C.muted }}>No pending admissions in this category.</div>
      ) : (
        <Table
          cols={['Client Name', 'DOB', 'Submitted', 'Forms (Pre-Screen | Nursing | Directive)', 'Status', 'Action']}
          rows={rows}
        />
      )}

      {/* Review Modal */}
      {selectedAdmission && (
        <AdmissionReviewModal
          admission={selectedAdmission}
          accessToken={auth?.accessToken}
          onClose={() => setSelectedAdmission(null)}
          onReviewSubmit={handleReviewSubmit}
          error={submitting ? '' : error}
        />
      )}
    </>
  );
}

export function PendingAdmissionsNotification({ admissions = [] }) {
  const pendingCount = admissions.filter(a => a.status === 'pending').length;
  if (pendingCount === 0) return null;

  return (
    <div style={{
      background: C.amberBg,
      border: `1px solid ${C.amber}`,
      borderRadius: 8,
      padding: '12px 16px',
      marginBottom: 20,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }}>
      <div style={{ color: C.amber, fontSize: 13, fontWeight: 600 }}>
        {pendingCount} pending admission{pendingCount !== 1 ? 's' : ''} awaiting review
      </div>
      <a href="#pending-admissions" style={{ color: C.amber, fontSize: 12, fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}>
        View
      </a>
    </div>
  );
}
