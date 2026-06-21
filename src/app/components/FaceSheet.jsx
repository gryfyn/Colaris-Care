'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth, authHeaders } from '@/contexts/AuthContext';
import {
  FACE_SHEET_SECTIONS,
  faceSheetAutofill,
  computeAge,
} from '@/app/components/faceSheetConfig';
import { downloadFaceSheetPDF } from '@/lib/face-sheet-pdf';

const C = {
  bg: '#FFFFFF',
  border: '#E2E8F0',
  navy: '#0F2D5E',
  blue: '#2563EB',
  bluePale: '#EFF4FF',
  blueBorder: '#C7D7F5',
  muted: '#64748B',
  text: '#1E2D40',
  green: '#0A7C4E',
  red: '#B91C1C',
};

function fmtDate(v) {
  if (!v) return '';
  const d = new Date(String(v).length <= 10 ? `${v}T12:00:00` : v);
  return isNaN(d) ? String(v) : d.toLocaleDateString('en-US');
}

// 40px controls, 8/12 spacing, AA-contrast text (rubric §4/§5).
const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: 40,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  padding: '9px 12px',
  fontSize: 13,
  color: C.text,
  background: C.bg,
  fontFamily: 'inherit',
};

// Self-contained Resident Face Sheet: fetches by resident, displays all
// sections, and (when canEdit) toggles an inline editable form that persists
// to /api/v1/face-sheets. Used in both the admin and staff views.
export default function FaceSheet({ residentId, resident, canEdit = false }) {
  const { auth, csrfToken } = useAuth();
  const token = auth?.accessToken;

  const [sheetId, setSheetId] = useState(null);
  const [stored, setStored] = useState({});      // persisted form_data
  const [draft, setDraft] = useState({});         // edit buffer
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);

  // Full resident record (admission data) — fetched so demographics captured
  // at admission are reliably retrieved and displayed, regardless of how thin
  // the `resident` prop passed by the caller is.
  const [residentRecord, setResidentRecord] = useState(resident || null);
  const residentAutofill = useMemo(
    () => residentRecord?.face_sheet_autofill || {},
    [residentRecord]
  );

  const autofill = useMemo(
    () => faceSheetAutofill([
      residentRecord || resident,
      residentAutofill,
    ]),
    [residentRecord, resident, residentAutofill]
  );

  const sheetSeed = useMemo(
    () => ({ ...autofill, ...stored }),
    [autofill, stored]
  );

  // Pull the resident's admission record for auto-fill (PHI is decrypted for
  // privileged roles and masked for others by the residents API).
  useEffect(() => {
    if (!residentId || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/v1/residents/${residentId}`, {
          headers: authHeaders(token, csrfToken),
          credentials: 'include',
        });
        if (res.ok && !cancelled) {
          const { data } = await res.json();
          if (data) setResidentRecord(data);
        }
      } catch {
        /* fall back to the resident prop */
      }
    })();
    return () => { cancelled = true; };
  }, [residentId, token, csrfToken]);

  const load = useCallback(async () => {
    if (!residentId || !token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/face-sheets/resident/${residentId}`, {
        headers: authHeaders(token, csrfToken),
        credentials: 'include',
      });
      if (res.status === 404) {
        setSheetId(null);
        setStored({});
      } else if (res.ok) {
        const { data } = await res.json();
        setSheetId(data.id);
        setStored(data.form_data || {});
        setPhotoUrl(data.photo_url || null);
      } else {
        throw new Error('Failed to load face sheet');
      }
    } catch (e) {
      setError(e.message || 'Failed to load face sheet');
    } finally {
      setLoading(false);
    }
  }, [residentId, token, csrfToken]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  // Resolve the value shown for a field: stored value wins, else resident autofill.
  const resolve = (src, f) => {
    if (f.computed === 'age') return computeAge(src.date_of_birth ?? autofill.date_of_birth);
    const v = src[f.key];
    if (v != null && v !== '') return v;
    return autofill[f.key] ?? '';
  };

  const startEdit = () => {
    // Seed the draft with stored values merged over autofill so the editor
    // shows (and can persist) the resident-derived defaults too.
    setDraft({ ...sheetSeed });
    setEditing(true);
    setError(null);
  };

  const setField = (key) => (e) => {
    const val = e?.target ? e.target.value : e;
    setDraft((prev) => ({ ...prev, [key]: val }));
  };

  const residentName =
    [residentRecord?.first_name, residentRecord?.last_name].filter(Boolean).join(' ').trim() ||
    stored.legal_name || autofill.legal_name ||
    [resident?.first_name, resident?.last_name].filter(Boolean).join(' ').trim() ||
    'Resident';

  const handleExport = async () => {
    setExporting(true);
    try {
      const u = auth?.user || {};
      const generatedBy =
        [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.name || u.email || '';
      const exportValues = editing ? { ...sheetSeed, ...draft } : sheetSeed;
      // Merge stored over resident auto-fill so the PDF reflects exactly what
      // is displayed (admission data + any saved face-sheet edits).
      await downloadFaceSheetPDF({ residentName, values: exportValues, generatedBy, photoUrl });
    } catch (e) {
      setError(e.message || 'Failed to export PDF');
    } finally {
      setExporting(false);
    }
  };

  const save = async (payload = sheetSeed) => {
    setSaving(true);
    setError(null);
    try {
      const isNew = !sheetId;
      const res = await fetch(
        isNew ? '/api/v1/face-sheets' : `/api/v1/face-sheets/${sheetId}`,
        {
          method: isNew ? 'POST' : 'PATCH',
          headers: authHeaders(token, csrfToken, { 'Content-Type': 'application/json' }),
          credentials: 'include',
          body: JSON.stringify(isNew ? { resident_id: residentId, form_data: payload } : { form_data: payload }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to save face sheet');
      }
      setEditing(false);
      await load();
    } catch (e) {
      setError(e.message || 'Failed to save face sheet');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploadingPhoto(true);
    setError(null);
    try {
      let activeSheetId = sheetId;
      if (!activeSheetId) {
        const uploadSeed = editing ? { ...sheetSeed, ...draft } : sheetSeed;
        // Create the sheet from the resident/admission snapshot so the photo can
        // be attached immediately instead of forcing a separate manual save.
        const res = await fetch('/api/v1/face-sheets', {
          method: 'POST',
          headers: authHeaders(token, csrfToken, { 'Content-Type': 'application/json' }),
          credentials: 'include',
          body: JSON.stringify({ resident_id: residentId, form_data: uploadSeed }),
        });
        const createPayload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(createPayload.error || 'Failed to create face sheet');
        activeSheetId = createPayload.data?.id;
        if (!activeSheetId) throw new Error('Face sheet created but no sheet ID was returned');
        setSheetId(activeSheetId);
        setStored(uploadSeed);
      }

      const body = new FormData();
      body.set('photo', file);
      const headers = {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      };
      const res = await fetch(`/api/v1/face-sheets/${activeSheetId}/photo`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body,
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to upload photo');
      setPhotoUrl(payload.data?.photo_url || null);
    } catch (e) {
      setError(e.message || 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 24, color: C.muted, fontSize: 13 }}>Loading face sheet…</div>;
  }

  const src = editing ? draft : stored;

  return (
    <div>
      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>
          {error}
        </div>
      )}

      {!sheetId && !editing && (
        <div style={{ background: C.bluePale, border: `1px solid ${C.blueBorder}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, color: C.navy, marginBottom: 14 }}>
          No face sheet on file for this resident yet.{' '}
          {canEdit ? 'Fields below are pre-filled from the resident record — click “Create Face Sheet” to complete and save.' : 'Ask an administrator to create one.'}
        </div>
      )}

      <section
        style={{
          background: C.bg,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: 20,
          marginBottom: 16,
          boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
        }}
      >
        <h3 style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 700, color: C.navy, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span aria-hidden="true" style={{ width: 18, height: 2, background: C.blue, borderRadius: 2, flexShrink: 0 }} />
          Resident Photo
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <div style={{ width: 132, height: 132, borderRadius: 10, border: `1px solid ${C.border}`, background: C.bluePale, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.navy, fontSize: 32, fontWeight: 800 }}>
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt={`${residentName} resident photo`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              residentName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
            )}
          </div>
          <div style={{ minWidth: 220, flex: '1 1 260px' }}>
          <div style={{ fontSize: 13, color: C.text, fontWeight: 700, marginBottom: 4 }}>{photoUrl ? 'Photo on file' : 'No photo uploaded'}</div>
            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5, marginBottom: canEdit ? 12 : 0 }}>
              The resident photo is stored in Cloudinary and included when this face sheet is downloaded.
            </div>
            {canEdit && (
              <label style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 38, padding: '0 14px', background: C.bluePale, border: `1px solid ${C.blueBorder}`, borderRadius: 7, color: C.blue, fontSize: 13, fontWeight: 700, cursor: uploadingPhoto ? 'not-allowed' : 'pointer', opacity: uploadingPhoto ? 0.7 : 1 }}>
                {uploadingPhoto ? 'Uploading...' : (photoUrl ? 'Replace Photo' : 'Upload Photo')}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={uploadingPhoto}
                  onChange={handlePhotoUpload}
                  style={{ display: 'none' }}
                />
              </label>
            )}
          </div>
        </div>
      </section>

      {FACE_SHEET_SECTIONS.map((section) => (
        <section
          key={section.id}
          /* Faint logo watermark behind each section card — suppressed while
             editing so inputs stay distraction-free (rubric §10). */
          className={editing ? undefined : 'dc-watermark'}
          style={{
            background: C.bg,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: 20,
            marginBottom: 16,
            boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
          }}
        >
          <h3 style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 700, color: C.navy, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span aria-hidden="true" style={{ width: 18, height: 2, background: C.blue, borderRadius: 2, flexShrink: 0 }} />
            {section.title}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
            {section.fields.map((f) => {
              const value = resolve(src, f);
              const span = f.type === 'textarea' ? '1 / -1' : 'auto';
              const fieldId = `fs-${f.key}`;
              const editable = editing && !f.computed;
              return (
                <div key={f.key} style={{ gridColumn: span }}>
                  <label htmlFor={editable ? fieldId : undefined}
                    style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{f.label}</label>
                  {editable ? (
                    f.type === 'textarea' ? (
                      <textarea id={fieldId} value={value} onChange={setField(f.key)} rows={2}
                        style={{ ...inputStyle, resize: 'vertical' }} />
                    ) : f.type === 'select' ? (
                      <select id={fieldId} value={value} onChange={setField(f.key)} style={inputStyle}>
                        <option value="">—</option>
                        {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input id={fieldId} type={f.type === 'date' ? 'date' : 'text'} value={value} onChange={setField(f.key)}
                        style={inputStyle} />
                    )
                  ) : (
                    <div style={{ fontSize: 13, color: value ? C.text : C.muted, minHeight: 18, fontWeight: value ? 500 : 400, whiteSpace: f.type === 'textarea' ? 'pre-wrap' : 'normal' }}>
                      {f.type === 'date' ? (fmtDate(value) || '—') : (value || '—')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <div data-noprint style={{ display: 'flex', gap: 10, marginTop: 8, justifyContent: 'flex-end' }}>
        {editing ? (
          <>
            <button onClick={() => { setEditing(false); setError(null); }} disabled={saving}
              style={{ padding: '9px 18px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, color: C.muted, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>Cancel</button>
            <button onClick={() => save(draft)} disabled={saving}
              style={{ padding: '9px 20px', background: C.green, border: 'none', borderRadius: 7, color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Saving…' : (sheetId ? 'Save Changes' : 'Create Face Sheet')}
            </button>
          </>
        ) : (
          <>
            {canEdit && (
              <button onClick={startEdit}
                style={{ padding: '9px 18px', background: C.bluePale, border: `1px solid ${C.blueBorder}`, borderRadius: 7, color: C.blue, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {sheetId ? 'Edit Face Sheet' : 'Create Face Sheet'}
              </button>
            )}
            <button onClick={handleExport} disabled={exporting}
              style={{ padding: '9px 18px', background: C.navy, border: 'none', borderRadius: 7, color: '#fff', fontSize: 13, fontWeight: 600, cursor: exporting ? 'not-allowed' : 'pointer', opacity: exporting ? 0.7 : 1 }}>{exporting ? 'Preparing PDF...' : 'Download Form'}</button>
          </>
        )}
      </div>
    </div>
  );
}
