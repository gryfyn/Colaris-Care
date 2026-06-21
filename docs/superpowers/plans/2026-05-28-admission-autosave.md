# Admission Form Autosave Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire session-based autosave (30-second interval, sessionStorage) into all three admission form wizards so users' progress is preserved across page reloads.

**Architecture:** Each wizard gets: (1) a `DRAFT_KEY` constant tied to its form type, (2) a mount effect that checks sessionStorage and surfaces a ResumeDraftDialog, (3) a periodic interval effect that writes to sessionStorage when `isDirty` is true, (4) `sessionStorage.removeItem` on successful final submit, (5) an "Auto-saved at HH:MM" indicator rendered in the footer. The nursing-assessment wizard already has ~90% of the code wired in — it just needs the dialog rendered and the indicator shown. Pre-screening and advance-directive need the full autosave block added.

**Tech Stack:** React (useState, useEffect, useCallback), sessionStorage browser API, existing ResumeDraftDialog component pattern from nursing-assessment.

---

## File Map

| File | What changes |
|------|-------------|
| `src/app/admission/nursing-assessment/page.js` | Add `ResumeDraftDialog` to JSX render; add "Auto-saved at HH:MM" to footer; call `sessionStorage.removeItem(NURSING_DRAFT_KEY)` in `handleFormCompleted` |
| `src/app/admission/pre-screening/page.js` | Add 4 state vars (`isDirty`, `lastSavedTime`, `resumeDraftPrompt`, `pendingDraft`), `PRESCREENING_DRAFT_KEY` constant, `ResumeDraftDialog` component, draft-check useEffect, periodic-save useEffect; mark `isDirty` in `set()`; clear draft on submit; show autosave indicator in footer; render `ResumeDraftDialog` |
| `src/app/admission/advance-directive/page.js` | Same additions as pre-screening but for a flat `formData` object (not step-keyed) |

---

### Task 1: Nursing Assessment — wire the already-defined dialog and indicator

**Files:**
- Modify: `src/app/admission/nursing-assessment/page.js:1390-1436` (handleFormCompleted — add removeItem)
- Modify: `src/app/admission/nursing-assessment/page.js:1621-1678` (footer — add autosave indicator)
- Modify: `src/app/admission/nursing-assessment/page.js:1693-1705` (end of return — render ResumeDraftDialog)

- [ ] **Step 1: Add `sessionStorage.removeItem` in `handleFormCompleted`**

In `handleFormCompleted` (line ~1390), after `await handleSaveDraft(true)` succeeds, add the removeItem call. The existing try block already wraps the save call. Insert immediately after `storeFormDataInSession('nursing-assessment', allData)` (line ~1407):

```javascript
      // Clear autosave draft on successful submission
      try { sessionStorage.removeItem(NURSING_DRAFT_KEY); } catch { /* ignore */ }
```

- [ ] **Step 2: Add autosave timestamp indicator to footer**

In the footer center column (line ~1632-1640), after the "N of M required fields complete" div and before the errors div, insert:

```jsx
            {lastSavedTime && (
              <div style={{ fontSize: 11, color: C.green, fontWeight: 500 }}>
                Auto-saved at {lastSavedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
```

- [ ] **Step 3: Render ResumeDraftDialog inside the return**

Immediately before the closing `</div>` of the outer wrapper (after the `ConfirmDialog` component, line ~1703), add:

```jsx
      {/* Resume Draft Dialog */}
      <ResumeDraftDialog
        isOpen={resumeDraftPrompt}
        accentColor={C.purple}
        accentBg={C.lilac}
        accentBorder={C.lilacBorder}
        onResume={() => {
          if (pendingDraft) setFormData(pendingDraft);
          setResumeDraftPrompt(false);
          setPendingDraft(null);
        }}
        onDiscard={() => {
          try { sessionStorage.removeItem(NURSING_DRAFT_KEY); } catch { /* ignore */ }
          setResumeDraftPrompt(false);
          setPendingDraft(null);
        }}
      />
```

- [ ] **Step 4: Verify nursing-assessment compiles**

Run: `cd D:\Freelance\dcllc\dcllc && npx next build --no-lint 2>&1 | head -30`
Expected: No errors referencing nursing-assessment/page.js

- [ ] **Step 5: Commit**

```bash
git add src/app/admission/nursing-assessment/page.js
git commit -m "feat(autosave): wire ResumeDraftDialog, autosave indicator, and clear-on-submit in nursing assessment"
```

---

### Task 2: Pre-screening — add full autosave block

**Files:**
- Modify: `src/app/admission/pre-screening/page.js:797-822` (before export default, add ResumeDraftDialog component and DRAFT_KEY constant)
- Modify: `src/app/admission/pre-screening/page.js:826-843` (state declarations — add 4 new state vars)
- Modify: `src/app/admission/pre-screening/page.js:887-898` (set() callback — add setIsDirty(true))
- Modify: `src/app/admission/pre-screening/page.js:956-978` (handleSaveDraft success branch — add removeItem on markComplete)
- Modify: `src/app/admission/pre-screening/page.js:1294-1348` (footer — add autosave indicator)
- Modify: `src/app/admission/pre-screening/page.js:1362-1374` (end of return — add ResumeDraftDialog render)

- [ ] **Step 1: Add DRAFT_KEY constant and ResumeDraftDialog component**

Before `const formDataChanged = (initial, current) => {` (line 797), insert:

```javascript
const PRESCREENING_DRAFT_KEY = 'admission_prescreening_draft';

function ResumeDraftDialog({ isOpen, onResume, onDiscard, accentColor, accentBg, accentBorder }) {
  if (!isOpen) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(9,38,42,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 32, maxWidth: 440, width: "90%", boxShadow: "0 20px 25px rgba(0,0,0,0.15)" }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: accentColor, marginBottom: 10 }}>Resume your draft?</div>
        <div style={{ fontSize: 13, color: "#4a7275", lineHeight: 1.6, marginBottom: 24 }}>
          A saved draft was found for this form. Would you like to pick up where you left off, or start fresh?
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onDiscard} style={{ padding: "9px 20px", background: accentBg, border: `1px solid ${accentBorder}`, borderRadius: 7, fontSize: 13, fontWeight: 600, color: accentColor, cursor: "pointer" }}>Start Fresh</button>
          <button onClick={onResume} style={{ padding: "9px 20px", background: accentColor, border: "none", borderRadius: 7, fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer" }}>Resume Draft</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add 4 new state variables inside PreAdmissionWizard**

After `const [submitError, setSubmitError] = useState(null);` (line 843), add:

```javascript
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const [resumeDraftPrompt, setResumeDraftPrompt] = useState(false);
  const [pendingDraft, setPendingDraft] = useState(null);
```

- [ ] **Step 3: Add setIsDirty(true) in set() callback**

In `set` (the useCallback at line ~889), after `setSaved(false);`, add:

```javascript
    setIsDirty(true);
```

- [ ] **Step 4: Add draft-check useEffect after the existing loadFormData useEffect**

After the `}, [admissionId, accessToken]);` closing of the loadFormData effect (line ~887), insert:

```javascript
  // ── Check sessionStorage for draft on mount (after server-load settles)
  useEffect(() => {
    if (isLoading) return;
    if (typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(PRESCREENING_DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setPendingDraft(parsed);
        setResumeDraftPrompt(true);
      }
    } catch {
      // ignore corrupt draft
    }
  }, [isLoading]);

  // ── Periodic autosave to sessionStorage every 30 seconds when dirty
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saveTimer = setInterval(() => {
      if (isDirty) {
        try {
          sessionStorage.setItem(PRESCREENING_DRAFT_KEY, JSON.stringify(formData));
          setLastSavedTime(new Date());
          setIsDirty(false);
        } catch {
          // storage quota exceeded — silently skip
        }
      }
    }, 30000);
    return () => clearInterval(saveTimer);
  }, [formData, isDirty]);
```

- [ ] **Step 5: Clear sessionStorage on final submit**

In `handleSaveDraft`, in the `if (response.ok)` branch (line ~965), after `setSaved(true)` add:

```javascript
        if (markComplete) {
          try { sessionStorage.removeItem(PRESCREENING_DRAFT_KEY); } catch { /* ignore */ }
        }
```

- [ ] **Step 6: Add autosave indicator to footer**

In the footer center column (line ~1302), after the "N of M required fields complete" div, insert:

```jsx
            {lastSavedTime && (
              <div style={{ fontSize: 11, color: C.green, fontWeight: 500 }}>
                Auto-saved at {lastSavedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
```

- [ ] **Step 7: Render ResumeDraftDialog**

Before the closing `</div>` of the outermost return wrapper (after the `ConfirmDialog` block, line ~1372), insert:

```jsx
      {/* Resume Draft Dialog */}
      <ResumeDraftDialog
        isOpen={resumeDraftPrompt}
        accentColor={C.teal}
        accentBg={C.tealPale}
        accentBorder={C.bgBorder}
        onResume={() => {
          if (pendingDraft) setFormData(pendingDraft);
          setResumeDraftPrompt(false);
          setPendingDraft(null);
        }}
        onDiscard={() => {
          try { sessionStorage.removeItem(PRESCREENING_DRAFT_KEY); } catch { /* ignore */ }
          setResumeDraftPrompt(false);
          setPendingDraft(null);
        }}
      />
```

- [ ] **Step 8: Commit**

```bash
git add src/app/admission/pre-screening/page.js
git commit -m "feat(autosave): add full autosave block (draft check, periodic save, indicator, dialog) to pre-screening"
```

---

### Task 3: Advance Directive — add full autosave block

Note: advance-directive uses a flat `formData` object (not step-keyed like the other two). The autosave writes the whole flat object directly.

**Files:**
- Modify: `src/app/admission/advance-directive/page.js:352-376` (before export default)
- Modify: `src/app/admission/advance-directive/page.js:376-408` (state declarations)
- Modify: `src/app/admission/advance-directive/page.js:463-472` (set() callback)
- Modify: `src/app/admission/advance-directive/page.js:529-531` (handleSubmit success branch)
- Modify: `src/app/admission/advance-directive/page.js:745-803` (footer)
- Modify: `src/app/admission/advance-directive/page.js:818-831` (end of return)

- [ ] **Step 1: Add DRAFT_KEY constant and ResumeDraftDialog component**

Before `const formDataChanged = (initial, current) => {` (line 352), insert:

```javascript
const ADVANCE_DIRECTIVE_DRAFT_KEY = 'admission_advance_directive_draft';

function ResumeDraftDialog({ isOpen, onResume, onDiscard, accentColor, accentBg, accentBorder }) {
  if (!isOpen) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(30,27,75,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 32, maxWidth: 440, width: "90%", boxShadow: "0 20px 25px rgba(0,0,0,0.15)" }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: accentColor, marginBottom: 10 }}>Resume your draft?</div>
        <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6, marginBottom: 24 }}>
          A saved draft was found for this form. Would you like to pick up where you left off, or start fresh?
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onDiscard} style={{ padding: "9px 20px", background: accentBg, border: `1px solid ${accentBorder}`, borderRadius: 7, fontSize: 13, fontWeight: 600, color: accentColor, cursor: "pointer" }}>Start Fresh</button>
          <button onClick={onResume} style={{ padding: "9px 20px", background: accentColor, border: "none", borderRadius: 7, fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer" }}>Resume Draft</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add 4 new state variables inside AdvanceDirectiveWizard**

After `const [showConfirmClose, setShowConfirmClose] = useState(false);` (line ~407), add:

```javascript
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const [resumeDraftPrompt, setResumeDraftPrompt] = useState(false);
  const [pendingDraft, setPendingDraft] = useState(null);
```

- [ ] **Step 3: Add setIsDirty(true) in set() callback**

In `set` (the useCallback at line ~463), after `setSaved(false);`, add:

```javascript
    setIsDirty(true);
```

- [ ] **Step 4: Add draft-check and periodic-save useEffects**

After the closing `}, [admissionId, accessToken]);` of the loadFormData effect (line ~461), insert:

```javascript
  // ── Check sessionStorage for draft on mount (after server-load settles)
  useEffect(() => {
    if (isLoading) return;
    if (typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(ADVANCE_DIRECTIVE_DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setPendingDraft(parsed);
        setResumeDraftPrompt(true);
      }
    } catch {
      // ignore corrupt draft
    }
  }, [isLoading]);

  // ── Periodic autosave to sessionStorage every 30 seconds when dirty
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saveTimer = setInterval(() => {
      if (isDirty) {
        try {
          sessionStorage.setItem(ADVANCE_DIRECTIVE_DRAFT_KEY, JSON.stringify(formData));
          setLastSavedTime(new Date());
          setIsDirty(false);
        } catch {
          // storage quota exceeded — silently skip
        }
      }
    }, 30000);
    return () => clearInterval(saveTimer);
  }, [formData, isDirty]);
```

- [ ] **Step 5: Clear sessionStorage on successful submit**

In `handleSubmit`, in the `if (response.ok)` branch (line ~529), after `setSaved(true)` and before `setTimeout`, add:

```javascript
        try { sessionStorage.removeItem(ADVANCE_DIRECTIVE_DRAFT_KEY); } catch { /* ignore */ }
```

- [ ] **Step 6: Add autosave indicator to footer**

In the footer center column (line ~752), after the "N of M required fields complete" div, insert:

```jsx
            {lastSavedTime && (
              <div style={{ fontSize: 11, color: C.green, fontWeight: 500 }}>
                Auto-saved at {lastSavedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
```

- [ ] **Step 7: Render ResumeDraftDialog**

Before the closing `</div>` of the outermost return wrapper (after the `ConfirmDialog` block, line ~828), insert:

```jsx
      {/* Resume Draft Dialog */}
      <ResumeDraftDialog
        isOpen={resumeDraftPrompt}
        accentColor={C.purple}
        accentBg={C.mauveLight}
        accentBorder={C.mauveBorder}
        onResume={() => {
          if (pendingDraft) setFormData(pendingDraft);
          setResumeDraftPrompt(false);
          setPendingDraft(null);
        }}
        onDiscard={() => {
          try { sessionStorage.removeItem(ADVANCE_DIRECTIVE_DRAFT_KEY); } catch { /* ignore */ }
          setResumeDraftPrompt(false);
          setPendingDraft(null);
        }}
      />
```

- [ ] **Step 8: Commit**

```bash
git add src/app/admission/advance-directive/page.js
git commit -m "feat(autosave): add full autosave block (draft check, periodic save, indicator, dialog) to advance-directive"
```

---

### Task 4: Final verification

- [ ] **Step 1: Build check**

```bash
cd D:\Freelance\dcllc\dcllc && npx next build --no-lint 2>&1 | tail -20
```
Expected: `Route (app)` build table with no errors.

- [ ] **Step 2: Manual smoke test checklist**

Open each form in the browser. Fill in 2–3 fields, wait 31 seconds, then reload. Confirm:
- The "Resume your draft?" dialog appears
- Clicking "Resume Draft" restores the filled values
- Clicking "Start Fresh" clears the dialog and leaves the form empty
- After completing and submitting the form, reloading shows no draft dialog

- [ ] **Step 3: Verify autosave indicator**

Fill any field, wait 31 seconds. Confirm "Auto-saved at H:MM AM/PM" text appears in the footer center column in the accent color (green).
