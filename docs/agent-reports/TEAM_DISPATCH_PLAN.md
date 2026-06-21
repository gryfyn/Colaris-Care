# Team Dispatch Plan - Issue Resolution
## Fix All 20 Issues - Teams in Action

**Status:** ACTIVE DEPLOYMENT  
**Date:** May 27, 2026  
**Total Tasks:** 21 created + assigned  
**Priority Levels:** P0 (Critical) → P3 (Enhancement)

---

## 🎯 TEAM ASSIGNMENTS

### **TEAM A: Backend/API (api-builder agent)**
**Priority:** CRITICAL  
**Deadline:** 48 hours  
**Owner:** API Development Team

| Task # | Issue | Severity | Status |
|--------|-------|----------|--------|
| #7 | Add permission enforcement to care plan APIs | CRITICAL | 🟡 Assigned |
| #12 | Add appointment conflict detection | MAJOR | 🟡 Assigned |
| #21 | Add null-check protection for PHI decryption | CODE | 🟡 Assigned |
| #23 | Add appointment duration field - track end time | CODE | 🟡 Assigned |
| #24 | Implement audit logging for care plan changes | COMPLIANCE | 🟡 Assigned |

**Actions:**
- [ ] Add guardResidentAccess() to care plan routes
- [ ] Implement appointment overlap validation
- [ ] Wrap decryption in try-catch
- [ ] Add end_time field to appointments
- [ ] Create audit_log trigger
- [ ] Deploy and test all endpoints

---

### **TEAM B: Frontend/Forms (form-builder + front-end agents)**
**Priority:** CRITICAL + MAJOR  
**Deadline:** 72 hours  
**Owner:** Frontend Development Team

| Task # | Issue | Severity | Status |
|--------|-------|----------|--------|
| #5 | Fix admission form data persistence | CRITICAL | 🟡 Assigned |
| #6 | Implement resident search in dashboard | CRITICAL | 🟡 Assigned |
| #8 | Implement cross-step form validation | MAJOR | 🟡 Assigned |
| #9 | Add care plan resident selector | MAJOR | 🟡 Assigned |
| #13 | Add form dirty-check confirmation | MODERATE | 🟡 Assigned |
| #16 | Add loading indicators to forms | MODERATE | 🟡 Assigned |
| #19 | Add multi-step form progress indicators | MODERATE | 🟡 Assigned |
| #20 | Fix age validation vs DOB | CODE | 🟡 Assigned |
| #25 | Improve error messages | UX | 🟡 Assigned |

**Actions:**
- [ ] Test form persistence with SessionStorage/IndexedDB
- [ ] Build resident search component with filtering
- [ ] Add form validation middleware
- [ ] Create resident selector modal
- [ ] Implement dirty-check confirmation dialog
- [ ] Add loading spinners to all submit buttons
- [ ] Add progress bar component
- [ ] Add age vs DOB validation
- [ ] Create error message mapping system

---

### **TEAM C: Medication/Features (dashboard-builder + general agents)**
**Priority:** MAJOR  
**Deadline:** 5 days  
**Owner:** Feature Development Team

| Task # | Issue | Severity | Status |
|--------|-------|----------|--------|
| #10 | Implement medication schedule time matrix | MAJOR | 🟡 Assigned |
| #11 | Implement password reset flow | MAJOR | 🟡 Assigned |
| #15 | Implement care plan status transitions | MODERATE | 🟡 Assigned |
| #17 | Prevent past date appointments | MODERATE | 🟡 Assigned |
| #18 | Add session-based form autosave | MODERATE-HIGH | 🟡 Assigned |
| #22 | Fix medication dosage with units | CODE | 🟡 Assigned |

**Actions:**
- [ ] Design medication schedule UI (morning/afternoon/evening/night)
- [ ] Create forgot-password endpoint and page
- [ ] Implement care plan state machine
- [ ] Add date picker with past-date prevention
- [ ] Build autosave with 30-second intervals
- [ ] Refactor dosage input with unit dropdown

---

### **TEAM D: Design/Polish (code-simplifier + general)**
**Priority:** MODERATE  
**Deadline:** 5 days  
**Owner:** Design/QA Team

| Task # | Issue | Severity | Status |
|--------|-------|----------|--------|
| #14 | Remove hardcoded colors | MODERATE | 🟡 Assigned |

**Actions:**
- [ ] Grep all files for hex color codes
- [ ] Replace with CSS variables
- [ ] Verify all components use STATE_TONES
- [ ] Test UI consistency

---

## 📋 EXECUTION PHASES

### **PHASE 1: CRITICAL (Days 1-2)**
🔴 Block all other work - These must be fixed before user testing

**Tasks:** #5, #6, #7

**Checklist:**
- [ ] TEAM B: Form persistence tested end-to-end
- [ ] TEAM B: Resident search working in dashboard
- [ ] TEAM A: Care plan permissions enforced
- [ ] Deploy to staging
- [ ] Run manual smoke tests

**Success Criteria:**
- Residents found after creation
- Form data survives all 3 steps
- Staff cannot access unassigned records

---

### **PHASE 2: MAJOR (Days 3-4)**
🟠 High priority - Needed for launch

**Tasks:** #8, #9, #12, #11, #10

**Checklist:**
- [ ] TEAM B: Cross-step validation preventing incomplete forms
- [ ] TEAM B: Care plan resident selector with confirmation
- [ ] TEAM A: Appointment conflict detection working
- [ ] TEAM C: Password reset flow complete
- [ ] TEAM C: Medication schedule times implemented
- [ ] Deploy to staging
- [ ] Test complete workflows

**Success Criteria:**
- Forms can't be submitted incomplete
- Appointments can't double-book
- Residents can reset password
- Medication times are schedulable

---

### **PHASE 3: MODERATE (Days 5-7)**
🟡 UX improvements

**Tasks:** #13, #15, #16, #17, #18, #19

**Checklist:**
- [ ] TEAM B: Form dirty-checks preventing loss
- [ ] TEAM C: Care plan status validation
- [ ] TEAM B: Loading states on submissions
- [ ] TEAM C: Past dates prevented
- [ ] TEAM C: Autosave working
- [ ] TEAM B: Progress indicators visible
- [ ] Deploy to staging

**Success Criteria:**
- Users warned before losing data
- Invalid state transitions blocked
- Loading feedback present
- Forms auto-save drafts

---

### **PHASE 4: CODE ISSUES (Days 8-9)**
🔵 Technical debt

**Tasks:** #20, #21, #22, #23, #24, #25, #14

**Checklist:**
- [ ] TEAM B: Age validation secure
- [ ] TEAM A: Decryption error handling
- [ ] TEAM C: Dosage units enforced
- [ ] TEAM A: Duration field added
- [ ] TEAM A: Audit logging working
- [ ] TEAM D: All colors use variables
- [ ] TEAM B: Error messages user-friendly
- [ ] Deploy to production

**Success Criteria:**
- No console errors
- All validations working
- Audit trail complete
- Consistent UI styling

---

## 🚀 WORK QUEUE

```
READY TO START (17 tasks):
├─ P0 (Critical):
│  ├─ #5: Form persistence (TEAM B) [START IMMEDIATELY]
│  ├─ #6: Resident search (TEAM B) [START IMMEDIATELY]
│  └─ #7: Care plan permissions (TEAM A) [START IMMEDIATELY]
│
├─ P1 (Major - Week 1):
│  ├─ #8: Form validation (TEAM B)
│  ├─ #9: Care plan selector (TEAM B)
│  ├─ #10: Med scheduling (TEAM C)
│  ├─ #11: Password reset (TEAM C)
│  └─ #12: Conflict detection (TEAM A)
│
├─ P2 (Moderate - Week 2):
│  ├─ #13: Dirty-check (TEAM B)
│  ├─ #15: Status transitions (TEAM C)
│  ├─ #16: Loading states (TEAM B)
│  ├─ #17: Date validation (TEAM C)
│  ├─ #18: Autosave (TEAM C)
│  └─ #19: Progress indicators (TEAM B)
│
└─ P3 (Code/Design):
   ├─ #20: Age validation (TEAM B)
   ├─ #21: Decryption safety (TEAM A)
   ├─ #22: Dosage units (TEAM C)
   ├─ #23: Duration field (TEAM A)
   ├─ #24: Audit logging (TEAM A)
   ├─ #25: Error messages (TEAM B)
   └─ #14: Color cleanup (TEAM D)
```

---

## 📊 METRICS & TRACKING

### Daily Standup (9am)
- How many tasks moved to "In Progress"?
- Any blockers?
- Tests passing?
- Staging deployment ready?

### Completion Goals
- **Day 1:** Tasks #5, #6, #7 = 3/21 (14%)
- **Day 2:** Tasks #8, #9, #12, #11, #10 = 8/21 (38%)
- **Day 4:** Tasks #13-19 = 15/21 (71%)
- **Day 9:** All 21 tasks = 21/21 (100%)

---

## 🔄 DEPLOYMENT STRATEGY

### Staging Deployment (After Each Phase)
```
Phase 1 Complete → Deploy to staging → Manual testing → Go/No-go
Phase 2 Complete → Deploy to staging → Smoke tests → Go/No-go
Phase 3 Complete → Deploy to staging → Full regression → Go/No-go
Phase 4 Complete → Deploy to staging → Final QA → Production Deploy
```

### Production Rollout
- All phases complete and tested
- Stakeholder sign-off
- Rollback plan ready
- Monitor for 2 hours post-deploy

---

## ✅ SUCCESS CRITERIA

### By End of Day 2
- ✅ Form data persists across all 3 admission steps
- ✅ Newly created residents immediately searchable
- ✅ Staff cannot access unassigned records
- ✅ No console errors
- ✅ Staging build passes

### By End of Day 4
- ✅ All forms have validation
- ✅ Appointments prevent double-booking
- ✅ Password reset works end-to-end
- ✅ Medications schedulable with times
- ✅ Staging passes smoke tests

### By End of Day 7
- ✅ Users warned before losing data
- ✅ Status transitions validated
- ✅ Loading feedback present
- ✅ Forms auto-save
- ✅ Full regression testing passed

### By End of Day 9
- ✅ All 21 issues resolved
- ✅ Code quality gates passed
- ✅ Production ready
- ✅ Stakeholder approved

---

## 📞 ESCALATION CONTACTS

| Team | Lead | Slack | Phone |
|------|------|-------|-------|
| Backend | API Team Lead | #backend-issues | ext-5001 |
| Frontend | Frontend Lead | #frontend-issues | ext-5002 |
| Features | Product Engineer | #feature-work | ext-5003 |
| Design/QA | QA Lead | #qa-testing | ext-5004 |

---

## 🔐 RISK MITIGATION

| Risk | Mitigation | Owner |
|------|-----------|-------|
| Data loss during migration | Backup before changes | TEAM A |
| Permission bypass | Code review all permission checks | TEAM A |
| Form regression | Run full E2E test suite after each change | TEAM B |
| Appointment conflicts | Test with overlapping times | TEAM A |
| Database consistency | Audit all schema changes | TEAM A |

---

## 📝 SIGN-OFF

**Created By:** Development Team Lead  
**Date:** May 27, 2026  
**Status:** ACTIVE - Teams mobilized  
**Next Review:** Daily standup 9am  

**Team Acknowledgments Required:**
- [ ] TEAM A Backend: Acknowledged and starting P0 tasks
- [ ] TEAM B Frontend: Acknowledged and starting P0 tasks
- [ ] TEAM C Features: Acknowledged and queued for P1
- [ ] TEAM D Design: Acknowledged and ready for P3

---

**GOAL STATUS:** 🚀 **IN PROGRESS - Teams deployed**

All tasks created and assigned. Teams should claim their P0 tasks immediately.
Next checkpoint: EOD May 27 - Phase 1 progress update.

