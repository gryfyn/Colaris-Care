# COLARIS CARE — Product & Strategy

**Owner:** Ava, Product Management, Glass Inc.  
**Status:** Product direction for validation  
**Date:** 2026-06-22  
**Horizon:** 24 months

## 1. Executive decision

COLARIS CARE will be the operational system of record for small and mid-sized residential care organizations. It will connect the work that begins with a prospective resident, continues through admission and care planning, and becomes the daily record of medications, observations, incidents, requests, appointments, and compliance activity.

Our initial wedge is **admission-to-care-plan continuity plus daily proof-of-care**. The product must make it faster to admit the right resident, turn assessment data into an actionable care plan, show staff what requires attention now, and give managers defensible evidence that care was delivered.

We will not position COLARIS CARE as a hospital EHR, payroll system, claims platform, clinical decision engine, or family social network. Integrations may connect those systems later. The near-term product wins by replacing fragmented forms, spreadsheets, binders, and disconnected point tools inside residential facilities.

**Product promise:** Every resident need becomes an accountable care action, and every care action leaves trustworthy evidence.

## 2. Why this product should exist

Residential care teams operate across three realities that general-purpose software handles poorly:

1. Care is continuous and shift-based. The next staff member needs to know what changed, what is due, and what remains unresolved.
2. The same resident information is repeatedly captured across screening, admission, care plans, medication workflows, progress notes, incidents, and audits.
3. Operators must prove not only what they intended to do, but what was completed, by whom, when, and under which authorization.

The resulting failure modes are predictable: duplicate entry, incomplete handoffs, missed follow-up, weak accountability, slow audits, and low visibility across homes. COLARIS CARE should turn these disconnected records into one operational loop:

**Assess → Plan → Assign → Deliver → Document → Review → Improve**

## 3. Target market

### Initial ideal customer profile

US-based operators of residential care settings with approximately 1–20 facilities and 10–500 residents, where direct-care staff work in shifts and management is responsible for resident documentation, medication records, incident response, and regulatory evidence.

The best design-partner profile is:

- currently dependent on paper, spreadsheets, shared drives, or several disconnected tools;
- has an owner, administrator, or director who can make a purchasing decision;
- experiences visible admission delays, documentation gaps, or audit preparation burden;
- has enough operational complexity to value standardization, but not a large internal IT team;
- is willing to deploy one facility first and provide weekly workflow feedback.

The product may serve assisted living, adult foster/group homes, behavioral residential programs, and similar facilities, but the first launch cohort should share one regulatory and workflow profile. We should not attempt multiple care segments or jurisdictions before the core workflows are proven.

### Expansion market

After product-market fit in the initial segment:

- multi-facility operators needing portfolio visibility;
- larger regional providers requiring SSO, configurable permissions, APIs, and data exports;
- referral partners and authorized family/resident users who need limited collaboration;
- adjacent community-based care programs with similar documentation workflows.

## 4. Buyers, users, and jobs to be done

| Persona | Primary job | Product outcome |
|---|---|---|
| Owner / executive operator | Run safe, consistent facilities without losing visibility as the organization grows | Portfolio risk, occupancy, quality, and operational trends are visible without reading individual charts |
| Facility administrator / manager | Keep the home staffed, compliant, and ready for review | Exceptions, overdue work, incidents, credentials, and approvals are actionable from one queue |
| Admissions / clinical lead | Decide fit and complete admission without re-entering resident information | Screening data flows through approval, nursing assessment, directives, resident creation, and initial care plan |
| Direct-care staff | Know what to do this shift and document it quickly | A mobile-ready shift workspace shows residents, due work, medications, notes, and urgent changes |
| Nurse / medication-authorized staff | Administer and reconcile medications safely | A clear medication schedule and administration record captures given, refused, held, late, and exception states |
| Compliance / quality lead | Demonstrate that policy and required workflows were followed | Searchable, exportable audit evidence connects approvals, signatures, changes, and timestamps |
| Resident / authorized representative | Understand relevant care information and make bounded requests | A permissioned portal supports requests, appointments, documents, and selected plan visibility |
| Glass support / platform operations | Operate the SaaS without accessing tenant data by default | Tenant lifecycle, health, entitlements, and audited support access are separated from facility administration |

## 5. Product definition

### Core product pillars

#### A. Resident journey

- referral and standalone pre-screening;
- pending-admission review, approval, and decline;
- nursing assessment and advance directive workflow;
- resident face sheet, contacts, diagnoses, documents, consent, and status history;
- discharge and archive lifecycle.

Data should be captured once and deliberately inherited downstream. Approval of a pre-screening does not itself create a resident; resident creation happens only when required admission work is finalized.

#### B. Care planning and delivery

- versioned care plans with needs, goals, objectives, interventions, owners, review dates, and signatures;
- shift workspace organized around due work and exceptions;
- daily/progress notes tied to the resident and care plan where applicable;
- staff clock-in/out and facility presence;
- resident requests, appointments, announcements, and handoff notifications.

The care plan is not a static document. It must drive work and receive evidence back from daily care.

#### C. Medication operations

- medication profile and schedule;
- medication administration record with given/refused/held/late/not-given states;
- PRN reason and outcome documentation;
- exception and missed-dose escalation;
- controlled-drug disposal with witness evidence;
- review-ready medication history.

Medication workflows are safety-critical. They require separate validation, permission, audit, and rollout gates from general documentation features.

#### D. Safety, quality, and compliance

- incident capture, notifications, follow-up, and review;
- evacuation drill documentation;
- staff credentials and expiration tracking;
- form review and approval queues;
- immutable audit history, data exports, and retention controls;
- facility-level quality trends and readiness views.

The product should turn compliance into a by-product of normal work rather than a separate documentation exercise.

#### E. Multi-tenant operations

- organization → facility → user/resident hierarchy;
- strict facility data isolation with organization-level access only when explicitly granted;
- facility branding, timezone, settings, workflow configuration, and entitlements;
- users who may hold different roles across facilities without sharing facility data accidentally;
- tenant onboarding, suspension, export, retention, and offboarding;
- audited, time-bounded Glass support access.

Historical implementation assumed one tenant per facility and one facility per staff login. That is acceptable for the first pilot, but the target model must support an operator with multiple homes and consolidated reporting. Tenant isolation must remain facility-scoped; organization access is an explicit aggregation layer, not a bypass.

## 6. Product principles

1. **The shift is the unit of work.** Default experiences answer: what is due, what changed, what is blocked, and what needs handoff?
2. **Capture once, reuse with provenance.** Inherited information shows its source and can be amended without silently rewriting signed history.
3. **Exceptions outrank dashboards.** A missed dose or unreviewed incident matters more than decorative aggregate metrics.
4. **Fast documentation is a safety feature.** Common staff actions should be usable on a phone, require minimal typing, and preserve drafts through interruption.
5. **Signed history is append-only.** Corrections create amendments with actor, reason, and timestamp.
6. **Least privilege is the default.** Role, facility, assignment, record sensitivity, and action all matter; UI hiding is never authorization.
7. **Configuration has limits.** We will support controlled templates and rules, not bespoke per-customer code paths.
8. **Compliance claims require evidence.** Security controls, operating procedures, contracts, and independent review—not feature checklists—support market claims.

## 7. Differentiation and positioning

### Positioning statement

For residential care operators who need consistent care delivery across shifts and facilities, COLARIS CARE is the care operations platform that connects admission, care planning, daily work, medication activity, incidents, and audit evidence in one resident-centered workflow. Unlike paper processes, generic document systems, or disconnected point tools, COLARIS CARE carries verified information forward and turns required documentation into operational visibility.

### Defensible differentiation

Our differentiation should come from the workflow graph, not from having the longest feature list:

- pre-screening information becomes admission information and seeds the first care plan;
- the care plan produces shift actions, notes, and review signals;
- medication and incident exceptions create accountable follow-up;
- every approval, signature, access, and amendment contributes to audit evidence;
- facility workflows roll up into organization-level operating insight.

As structured longitudinal data accumulates, COLARIS CARE can identify operational patterns such as recurring missed tasks, repeated incidents, documentation bottlenecks, and care-plan review risk. These are decision-support signals, not diagnoses or autonomous clinical recommendations.

## 8. Scope boundaries

### Must own

- resident identity and lifecycle within the care organization;
- admission and assessment workflow;
- care plan lifecycle;
- daily care documentation and handoff;
- medication administration evidence;
- incidents, required operational logs, review, and audit history;
- staff roles, credentials, facility access, and relevant time records.

### Integrate, do not rebuild initially

- payroll and full workforce scheduling;
- accounting, invoicing, and general ledger;
- pharmacy dispensing and e-prescribing;
- laboratory, imaging, and hospital EHR data;
- claims submission and payer adjudication;
- background checks and formal learning management;
- general-purpose file storage and e-signature platforms.

### Explicitly out of scope for the first release

- autonomous clinical decisions or diagnostic recommendations;
- open-ended AI generation of signed clinical records;
- a marketplace of care providers;
- real-time family social feeds;
- broad customization that changes core safety state machines;
- cross-tenant data access for Glass personnel without a controlled support workflow.

## 9. Release strategy

### Release 0 — Foundation and workflow validation (0–3 months)

Goal: prove one complete, safe workflow in one design-partner facility.

- establish organization/facility/user/resident tenancy contracts;
- implement authentication, role permissions, audit events, tenant-scoped storage, backup/restore, and environment controls;
- deliver pre-screening → review → nursing assessment → directives → resident creation;
- deliver resident face sheet and initial versioned care plan;
- provide manager queues for incomplete and overdue work;
- instrument the product from the first pilot;
- run usability tests with administrators and direct-care staff before live PHI.

Exit criteria:

- zero known cross-tenant access paths in automated and manual tests;
- one design partner completes at least five representative admissions end to end;
- at least 90% of required admission fields are carried forward without re-entry;
- median active time to complete the workflow is at least 30% lower than baseline;
- backup restore, access review, incident response, and tenant export are exercised;
- the security/compliance readiness checklist is signed by accountable owners.

### Release 1 — Daily proof-of-care (3–6 months)

Goal: become part of every shift, not only every admission.

- staff shift workspace and handoff;
- clock-in/out, resident roster, progress notes, tasks, and requests;
- medication schedule and administration pilot behind a facility-level feature flag;
- incident capture, escalation, review, and follow-up;
- drug disposal and evacuation drill workflows;
- notifications driven by actionable events;
- responsive/PWA-quality experience with resilient draft handling.

Exit criteria:

- at least 70% weekly active direct-care staff in pilot facilities;
- at least 80% of active shifts have a documented handoff or completed shift workflow;
- at least 95% of due records are completed or carry an explicit exception reason;
- no unresolved severity-one safety or privacy defects;
- medication administration completes a supervised parallel run before becoming the official record.

### Release 2 — Manager control and paid launch (6–12 months)

Goal: demonstrate measurable operating value and repeatable onboarding.

- operational and compliance exception dashboards;
- care-plan review cadence and quality workflows;
- staff credential tracking;
- configurable templates within approved boundaries;
- organization-level multi-facility views;
- exports, retention controls, onboarding tools, subscription entitlements, and support operations;
- initial integrations chosen from customer evidence, likely identity, pharmacy data exchange, or payroll time export.

Exit criteria:

- five or more paying facilities across at least three operators;
- median facility go-live within 30 days;
- greater than 90% logo retention through the first renewal cohort;
- at least 30% reduction in audit-preparation time or overdue documentation, validated with customer baselines;
- support burden is below four hours per facility per month after onboarding.

### Release 3 — Network expansion (12–24 months)

Goal: expand account value without diluting the care-operations core.

- mature portfolio reporting and benchmarking;
- SSO, APIs, webhooks, and enterprise provisioning;
- resident/authorized-representative collaboration;
- higher-value integrations and data migration tooling;
- rules-based risk and quality signals with transparent source data;
- jurisdiction-specific content packs only where legal and clinical review can be maintained.

## 10. Commercial strategy

### Packaging hypothesis

Use facility platform pricing plus an active-resident band. Avoid pricing primarily by staff seat because broad staff adoption creates product value and should not be penalized.

| Package | Intended customer | Included scope |
|---|---|---|
| Essentials | Single-facility operators moving off paper | Admission, residents, care plans, notes, incidents, audit basics, standard support |
| Operations | Growing operators | Medication operations, staff credentials/time records, advanced workflows, exports, configurable templates |
| Network | Multi-facility organizations | Portfolio views, SSO, API/webhooks, advanced controls, priority support, contractual service levels |

Implementation, migration, and training should be priced separately when material. Final price points require willingness-to-pay interviews and competitive validation; repository evidence does not justify setting dollar amounts yet.

### Land-and-expand motion

1. Sell an operational outcome to an owner or administrator, not a generic “digital transformation.”
2. Launch one facility and one workflow with a named operational champion.
3. Establish baseline measures before configuration.
4. Add daily shift and medication workflows after admission data quality is proven.
5. Expand to sibling facilities using a reusable tenant template and portfolio reporting.

### Go-to-market focus

- founder/PM-led discovery and sales for the first ten operators;
- partnerships with compliance consultants and regional provider associations after repeatable proof;
- case studies based on admission cycle time, documentation completion, incident follow-up, and audit preparation;
- a structured migration offer for spreadsheets and common resident exports;
- no broad paid acquisition until onboarding and retention are repeatable.

## 11. Success model

### North-star metric

**Verified Care Actions per Active Resident Week (VCA/ARW)**

A verified care action is a planned or required action that is completed by an authorized user, linked to a resident and facility, timestamped, and auditable. Examples include a completed intervention, medication administration, progress note, incident follow-up, assessment step, or care-plan review. Raw clicks, logins, autosaves, and duplicate records do not count.

This metric connects breadth of adoption with actual resident care operations. It must always be paired with completion quality and safety guardrails; increasing low-value documentation is not success.

### Company and product scorecard

| Dimension | Metric | Initial target |
|---|---|---|
| Adoption | Weekly active staff / provisioned active staff | ≥70% by week 8 |
| Workflow value | Required actions completed on time or exception-documented | ≥95% |
| Data quality | Signed records returned for correction | <3% |
| Admission | Median active time and calendar time from screening to decision | 30% better than baseline |
| Care planning | Active residents with current signed care plan | ≥95% |
| Safety | Medication/incident follow-up outside configured SLA | Downward trend; zero silent misses |
| Reliability | Successful save rate for critical workflows | ≥99.9% |
| Trust | Confirmed cross-tenant disclosure events | 0 |
| Onboarding | Contract-to-live time | ≤30 days by Release 2 |
| Retention | Paying facility logo retention | >90% at first renewal |
| Economics | Support hours per facility per month after onboarding | <4 hours |

Metrics must be segmented by facility, role, workflow, device class, and tenure. Product analytics must not capture PHI in event properties.

## 12. Discovery and validation plan

Before locking Release 1, complete:

- 15 contextual interviews: five administrators, five direct-care staff, three nurses/medication staff, and two owners/compliance leaders;
- observation of at least six shift handoffs and three admission workflows;
- artifact review of the actual forms, logs, audit requests, and spreadsheets used by design partners;
- baseline measurement for admission effort, documentation timeliness, correction rate, and audit preparation;
- concept testing of the shift workspace and admission handoff with clickable prototypes;
- pricing interviews with economic buyers after value is demonstrated, not during generic feature discovery.

Every roadmap item should identify the user problem, current workaround, frequency, consequence, success metric, and evidence owner. A customer request alone is not prioritization evidence.

## 13. Prioritization model

Use a weighted score, then apply mandatory gates:

- 30% resident safety / compliance risk reduced;
- 25% frequency and severity of the user problem;
- 20% strategic fit with the admission-to-daily-care loop;
- 15% measurable customer or commercial impact;
- 10% confidence in evidence;
- divide by estimated delivery and operational complexity.

No item ships if it fails a privacy, tenant-isolation, accessibility, data-migration, auditability, or critical-workflow recovery gate, regardless of score.

## 14. Trust, safety, and regulatory strategy

COLARIS CARE will handle sensitive health and identity information. The product must be designed for applicable privacy and security obligations, but Glass Inc must not claim “HIPAA compliant,” jurisdictional form compliance, medication safety certification, or equivalent status solely because controls exist in code.

Production readiness includes:

- appropriate customer agreements and Business Associate Agreements where applicable;
- documented risk analysis, policies, workforce controls, vendor review, and incident response;
- encryption in transit and at rest with managed per-tenant key strategy and rotation;
- tested tenant isolation, least privilege, session revocation, audit integrity, and support access;
- backup, restore, disaster recovery, retention, legal hold, export, correction, and deletion procedures;
- accessibility target of WCAG 2.2 AA for supported workflows;
- independent security testing before material production use;
- clinical and legal review of medication workflows, signatures, forms, and jurisdiction-specific content;
- explicit downtime procedures and printable/exportable continuity records.

AI, when introduced, should initially support low-risk work such as summarizing an authorized record set, suggesting draft categorization, or identifying missing documentation. It must show source records, require human confirmation, preserve the original, prevent cross-tenant context, and never silently write or sign a clinical record.

## 15. Strategic risks and responses

| Risk | Consequence | Response |
|---|---|---|
| Building too many modules before one workflow works | Broad demo, weak daily value | Enforce release exit criteria and start with admission-to-care-plan continuity |
| Treating historical code as production evidence | Unsafe launch assumptions | Re-verify every control and workflow in the current codebase and deployed environment |
| Medication scope exceeds product maturity | Resident safety risk | Feature flag, supervised parallel run, clinical review, and dedicated safety test plan |
| Per-customer customization fragments the product | Slow delivery and high support cost | Controlled templates, configuration limits, and paid integrations |
| Small-provider budgets create poor unit economics | Unsustainable support burden | Repeatable onboarding, resident-band pricing, and multi-facility expansion |
| Jurisdiction-specific requirements diverge | Legal exposure and roadmap sprawl | Launch in one defined regulatory profile; maintain reviewed content packs |
| Staff reject slow documentation | Incomplete records and churn | Mobile-first workflows, observation-led design, drafts, and task-time metrics |
| Tenant hierarchy is under-designed | Cross-facility access errors | Separate facility isolation from organization aggregation and test both explicitly |

## 16. Repository assessment and immediate implications

The current working tree is a Next.js 16.2.4 / React 19.2.4 shell containing a root page, global design tokens, brand assets, and deployment/planning files. It does **not** currently contain the prior application routes, database schema, API handlers, or tests.

The Git index and queue history describe a substantially broader previous implementation: admin and staff portals, admissions, residents, care plans, progress notes, medications, incidents, drug disposal, evacuation drills, appointments, notifications, resident requests, staff time records, PostgreSQL row-level security, audit logging, PHI encryption, and role-based access. Those artifacts are useful product discovery evidence, but their completion claims are not current release evidence.

Therefore:

1. Treat the repository as a deliberate product rebuild with reusable historical specifications, not as a production-ready system.
2. Do not restore every historical feature by default. Rebuild in the release order above.
3. Reconcile `README.md`, `DEPLOYMENT.md`, environment examples, and queue history with the current architecture before engineering commitments; they presently describe infrastructure and files absent from the working tree.
4. Preserve useful historical contracts—especially pre-screening-first admission, care-plan states, tenant isolation, audit events, and staff shift workflows—after explicit product and technical review.

## 17. Decisions required in the next 30 days

| Decision | Owner | Required evidence |
|---|---|---|
| Select the first care segment and launch jurisdiction | Product + legal/clinical advisor | Customer concentration, workflow similarity, regulatory review |
| Confirm facility tenancy and multi-facility user model | Product + engineering + security | Operator interviews, access matrix, isolation threat model |
| Choose three design partners | Product / GTM | ICP fit, executive sponsor, workflow access, data readiness |
| Approve Release 0 workflow contract | Product + design + engineering | Observations, prototype tests, state diagrams, field provenance |
| Define production trust gate | Security + operations + legal | Risk analysis, control owners, test plan, contracts |
| Set pricing experiment ranges | Product / GTM / finance | Competitive research, willingness-to-pay interviews, onboarding cost |
| Decide historical asset reuse policy | Engineering | Code provenance, current-framework fit, security review, testability |

## 18. One-year outcome

Within 12 months, COLARIS CARE should have a small set of paying operators using it as the daily operational record in live facilities. Success is not the number of modules shipped. Success is that resident information moves from screening into an active care plan without avoidable re-entry, direct-care staff reliably complete and document required work, managers resolve exceptions before they become audit findings or safety events, and a second facility can launch from a proven template without compromising tenant isolation.

