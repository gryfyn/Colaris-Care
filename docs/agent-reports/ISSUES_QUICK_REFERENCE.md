# Issues Quick Reference
## Resident Workflow - Errors & Issues Summary

**Last Updated:** May 27, 2026  
**Total Issues:** 20  
**Critical:** 3 | **Major:** 5 | **Moderate:** 5 | **Warnings:** 7

---

## 🔴 CRITICAL ISSUES (Must Fix Before Release)

| # | Title | Location | Impact | Fix Priority |
|---|-------|----------|--------|--------------|
| C1 | Admission Form Data Loss Risk | `src/app/admission/*.js` | Session data may be lost | P0 - Immediate |
| C2 | Admin Dashboard Resident Lookup Missing | `src/app/admin/page.js` | Can't find newly created residents | P0 - Immediate |
| C3 | Care Plan Permission Enforcement Gap | `src/app/api/v1/care-plans/route.js` | Staff can access unassigned residents' plans | P0 - Immediate |

---

## 🟠 MAJOR ISSUES (Should Fix Before Launch)

| # | Title | Location | Impact | Fix Priority |
|---|-------|----------|--------|--------------|
| M1 | Form Cross-Step Validation Missing | `src/app/admission/nursing-assessment/page.js` | Incomplete forms can be submitted | P1 - Week 1 |
| M2 | Care Plan Resident Association UI Unclear | `src/app/admin/page.js:CarePlansSection` | Wrong resident could be assigned plan | P1 - Week 1 |
| M3 | Medication Schedule Times Not Implemented | `src/app/admin/page.js:MedicationsSection` | Can't set med administration times | P1 - Week 1 |
| M4 | Portal Password Reset Not Implemented | `src/app/admin/page.js:PasswordResetModal` | Residents can't recover lost passwords | P1 - Week 1 |
| M5 | Appointment Conflict Detection Missing | `src/app/api/v1/appointments/route.js` | Double-booked appointments possible | P1 - Week 1 |

---

## 🟡 MODERATE ISSUES (Improve User Experience)

| # | Title | Location | Issue Type | Fix Priority |
|---|-------|----------|-----------|--------------|
| Mo1 | Form Modal Close Without Confirmation | `src/app/admin/page.js:Modal` | Accidental data loss possible | P2 - Week 2 |
| Mo2 | State Color Hardcoding Remaining | `src/app/admin/page.js` | Some areas not using CSS variables | P2 - Week 2 |
| Mo3 | Care Plan Status Transition Validation Missing | `src/app/admin/page.js:CarePlansSection` | Invalid state changes possible | P2 - Week 2 |
| Mo4 | Form Submission Loading States Missing | Multiple forms | User unsure if form processing | P2 - Week 2 |
| Mo5 | Past Date Appointment Not Prevented | `src/app/admin/page.js:appointment` | Past appointments can be scheduled | P2 - Week 2 |

---

## ⚠️ WARNINGS & OBSERVATIONS

| # | Warning | Category | Severity | Notes |
|---|---------|----------|----------|-------|
| W1 | Session Storage Data Persistence | Architecture | Medium | Data lost if tab closes |
| W2 | No Multi-Step Form Progress Indicator | UX | Low | Users don't know progress |
| W3 | Audit Logging Not Implemented | Compliance | High | Required for healthcare |
| W4 | No Drug-Drug Interaction Checking | Safety | High | Could miss medication conflicts |
| W5 | Accessibility Issues (WCAG 2.1) | Compliance | High | May fail accessibility audit |
| W6 | Error Messages Not User-Friendly | UX | Low | Technical jargon showing |
| W7 | No Offline Support | Reliability | Low | Needs internet connection |

---

## 🔍 CODE-LEVEL ISSUES

| # | File | Line | Issue | Recommendation |
|----|------|------|-------|-----------------|
| CL1 | `nursing-assessment/page.js` | ~950 | Age not validated vs DOB | Add cross-field validation |
| CL2 | `[id]/route.js` | PHI decrypt | No null check on encryption_key | Wrap in try-catch |
| CL3 | `admin/page.js` | CarePlan section | No past-date validation | Disable past dates |
| CL4 | `admin/page.js` | Medications | Free-text dosage no unit | Use dropdown selectors |
| CL5 | `admin/page.js` | Appointments | No duration tracked | Add end time field |

---

## 📋 ACTIONABLE CHECKLIST

### P0 - Do Before Testing with Users
- [ ] Run Playwright test suite and fix blocking issues
- [ ] Implement resident search/filter in admin dashboard
- [ ] Add permission checks to care plan APIs
- [ ] Test form data persistence across all 3 steps
- [ ] Verify appointment conflict detection

### P1 - Do This Week
- [ ] Add form dirty-check confirmation on close
- [ ] Implement medication scheduling times matrix
- [ ] Add password reset email functionality
- [ ] Add care plan resident selector confirmation
- [ ] Implement care plan status transition validation

### P2 - Do Next Week
- [ ] Add loading indicators on form submissions
- [ ] Add progress indicators to multi-step forms
- [ ] Prevent past date appointment scheduling
- [ ] Fix remaining hardcoded color references
- [ ] Add form validation error messaging

### P3 - Do Next Sprint
- [ ] Implement audit logging for all changes
- [ ] Add drug-drug interaction API integration
- [ ] Improve accessibility (WCAG 2.1 compliance)
- [ ] Add session-based form autosave
- [ ] Create offline-first architecture

---

## 🎯 Testing Priorities

### Immediate Testing Needed
1. **Multi-step form persistence** - Does data survive all 3 steps?
2. **Permission enforcement** - Can staff access others' records?
3. **Appointment conflicts** - Can double-book be prevented?
4. **Care plan assignments** - Is correct resident assigned?
5. **Medication scheduling** - Are times properly set?

### Manual Test Cases
```
Test 1: Complete full admission workflow end-to-end
Test 2: Navigate away from form and return - verify data persists
Test 3: Create care plan without selecting resident - verify error
Test 4: Schedule appointment in past - verify prevented
Test 5: Schedule overlapping appointments - verify conflict detected
Test 6: View resident as different staff member - verify not visible
Test 7: Generate portal credentials - verify login works
Test 8: Close form without saving - verify confirmation prompt
Test 9: Create medication without time - verify UI shows issue
Test 10: Search for newly created resident - verify found
```

---

## 📊 Issue Statistics

```
Issues by Category:
├─ Critical:   ███ 3 (15%)
├─ Major:      █████ 5 (25%)
├─ Moderate:   █████ 5 (25%)
└─ Warnings:   ███████ 7 (35%)

Issues by Component:
├─ Admission Forms:     4 issues
├─ Admin Dashboard:     8 issues
├─ Appointments:        2 issues
├─ Medications:         2 issues
├─ Care Plans:          2 issues
└─ General/UX:          2 issues

Fix Effort Estimate:
├─ P0 (Critical):     ~20-30 hours
├─ P1 (Major):        ~15-20 hours
├─ P2 (Moderate):     ~10-15 hours
└─ P3 (Warnings):     ~5-10 hours
└─ TOTAL:             ~50-75 hours
```

---

## ✅ Resolution Status Tracking

### Issues to Fix Before MVP Release
- [ ] C1: Data persistence across form steps
- [ ] C2: Resident search/lookup functionality
- [ ] C3: Care plan permission enforcement
- [ ] M1: Multi-step form validation
- [ ] M5: Appointment conflict detection

### Issues to Fix for Version 1.1
- [ ] M2-M4: UI/Feature enhancements
- [ ] Mo1-Mo5: UX improvements

### Issues to Fix for Version 2.0
- [ ] W3-W7: Compliance & safety features

---

## 📞 Quick Issue Reference by Component

### 🩺 Admission Forms
- **C1**: Data loss risk
- **M1**: Form validation gaps
- **CL1**: Age validation

### 👥 Resident Management  
- **C2**: No search functionality
- **Mo1**: Modal close behavior

### 📋 Care Plans
- **C3**: Permission gap
- **M2**: Resident assignment unclear
- **Mo3**: Status transitions

### 💊 Medications
- **M3**: No scheduling times
- **CL4**: Dosage validation

### 📅 Appointments
- **M5**: Conflict detection missing
- **Mo5**: Past dates not prevented
- **CL5**: No duration tracking

### 🔑 Portal & Credentials
- **M4**: Password reset missing

---

## 🚀 Success Criteria

Once all issues are resolved, verify:
- ✅ Admission forms complete without data loss
- ✅ Resident created and searchable in dashboard
- ✅ Care plans assignable to correct resident only
- ✅ Medications schedulable with times
- ✅ Appointments show conflicts
- ✅ Portal access works
- ✅ Staff can only access assigned residents
- ✅ No console errors during workflow
- ✅ Forms show loading states
- ✅ Accessibility passes WCAG checks

---

**Document Version:** 1.0  
**Last Updated:** May 27, 2026  
**Status:** Ready for Development  

