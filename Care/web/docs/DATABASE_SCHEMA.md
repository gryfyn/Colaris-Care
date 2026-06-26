# COLARIS CARE — Database Schema

**Owner:** Ravi, System Architect, Glass Inc.  
**Status:** Target logical schema for validation  
**Date:** 2026-06-22  
**Applies to:** `@colaris/care-web`  
**Database:** PostgreSQL 16 or later

## 1. Purpose and scope

This document defines the target persistence contract for COLARIS CARE. It is grounded in the approved product strategy: Release 0 proves screening-to-admission-to-care-plan continuity; later releases add daily proof-of-care, medications, incidents, and portfolio operations.

The current repository does not contain a database implementation or migrations. The tables below are a design, not a statement of deployed capability. Release 0 tables are implementation scope. Later tables reserve coherent boundaries but must not be built until their release and safety gates are approved.

## 2. Data design decisions

1. PostgreSQL is the transactional system of record. Object bytes live in private object storage; the database stores metadata and integrity hashes.
2. Customer isolation is organization-scoped and operational access is facility-scoped. Organization-wide access is an explicit membership capability, never an implicit facility bypass.
3. Every tenant-owned row carries `organization_id`; every facility-owned row also carries `facility_id`. Redundant tenant keys are intentional because they make policy enforcement and partition-safe foreign keys explicit.
4. Drafts are mutable with optimistic concurrency. Signed, approved, completed, or otherwise evidentiary records are immutable. Corrections are linked amendments.
5. Workflow status is represented by constrained typed columns and transition services, not inferred from nullable timestamps.
6. Shared identifiers are UUIDv7 where the selected library and PostgreSQL version support it; otherwise use cryptographically random UUIDs. Human identifiers are separate, facility-scoped values.
7. All instants are `timestamptz` in UTC. Facility-local dates use `date`; schedules retain the IANA timezone used to interpret wall-clock time.
8. JSONB is allowed for versioned form answers and external envelopes. Authorization, tenancy, state, due dates, signatures, and commonly queried clinical/operational fields remain relational columns.
9. PHI must not appear in database diagnostics, job payloads, analytics events, correlation IDs, object keys, or idempotency keys.
10. Physical deletion is exceptional. Retention, legal hold, de-identification, and purge run through controlled policy workflows.

## 3. Naming and common columns

- Tables and columns use `snake_case`; primary keys use `id`.
- Foreign keys use `<entity>_id`; timestamps use `<event>_at`.
- Tenant tables include `organization_id uuid not null` and, when facility-owned, `facility_id uuid not null`.
- Mutable aggregates include `version integer not null default 1`, `created_at`, `created_by`, `updated_at`, and `updated_by`.
- Lifecycle removal uses a domain status or `archived_at`; `deleted_at` is not a generic substitute for retention policy.
- Currency, if later introduced, uses integer minor units plus ISO currency code; floating point is prohibited.
- Enumerations begin as `text` plus `check` constraints so rolling deployments can add values without blocking enum DDL. Stable values may later become lookup tables.

Every facility-owned parent exposes a unique key on `(organization_id, facility_id, id)`. Child foreign keys include the same columns, preventing accidental cross-tenant or cross-facility relationships even if application authorization fails.

### 3.1 Ownership classes and module boundaries

Every table is registered in the schema catalogue with one scope class and one owning module:

| Scope class | Required key | Application access rule |
|---|---|---|
| Global identity | none | Identity module only; tenant workflows use published identity references and queries |
| Organization-owned | `organization_id` | matching organization plus an explicit organization-level action |
| Facility-owned | `organization_id`, `facility_id` | matching organization and an authorized facility in the validated context |

Module ownership controls writes, but it does not create a separate database transaction per module. A named cross-module application orchestrator may enlist published module commands in one transaction through a shared unit of work. It cannot issue SQL against module tables. Non-atomic collaboration uses the outbox and idempotent consumers instead. Migration review verifies both the owning module and scope class for every new table.

## 4. Relationship overview

```text
organizations
  ├─ facilities
  │    ├─ facility_memberships ─ users ─ sessions
  │    ├─ admission_cases
  │    │    ├─ screening_versions ─ field_provenance
  │    │    ├─ assessment_versions ─ field_provenance
  │    │    ├─ directive_versions
  │    │    └─ admission_decisions
  │    ├─ residents ─ resident_contacts
  │    │    ├─ care_plans ─ care_plan_versions
  │    │    │                 ├─ care_plan_needs
  │    │    │                 ├─ care_plan_goals
  │    │    │                 ├─ care_plan_interventions
  │    │    │                 └─ signatures
  │    │    ├─ care_actions ─ care_action_evidence
  │    │    ├─ clinical_notes ─ record_amendments
  │    │    ├─ medication_orders ─ medication_schedules ─ administrations
  │    │    └─ incidents ─ incident_follow_ups
  │    └─ documents ─ document_links
  └─ organization_memberships

All state-changing aggregates ─ audit_events
All asynchronous side effects ─ outbox_events ─ jobs/dead_letters
```

An admission case is not a resident. Finalizing all required admission work creates the resident and links `residents.source_admission_case_id`; approval of screening alone never creates one.

## 5. Release 0 schema

### 5.1 Tenancy and identity

| Table | Purpose | Important columns and constraints |
|---|---|---|
| `organizations` | Contract/customer boundary | `id`, `name`, `slug unique`, `status in (onboarding, active, suspended, offboarding, archived)`, `default_timezone`, timestamps |
| `facilities` | Isolation and operating location | `organization_id`, `id`, `name`, `code`, `timezone`, `status`, `settings jsonb`; unique `(organization_id, code)` and `(organization_id, id)` |
| `users` | Global login identity; contains no facility role | `id`, `identity_provider_subject unique`, normalized email, display name, status, last authentication time |
| `organization_memberships` | Explicit portfolio access | `organization_id`, `user_id`, `role`, `status`, validity window; unique active membership per organization/user |
| `facility_memberships` | Facility authorization | `organization_id`, `facility_id`, `user_id`, `role`, `status`, validity window; composite FK to facility and unique active membership per facility/user |
| `role_grants` | Controlled role-to-action mapping | scope type, role, action, optional conditions; configuration is versioned and audited |
| `sessions` | Revocable server-side sessions | `user_id`, opaque token hash, assurance level, issued/expires/revoked timestamps, rotation family; never store raw session tokens |
| `support_access_grants` | Time-bounded Glass access | organization/facility scope, support user, approver, reason, ticket reference, start/end/revoked times; no standing tenant-data access |

Organization membership permits only named aggregate actions. Access to a facility record still requires either a matching facility membership or an explicitly defined organization-level action evaluated by policy.

### 5.2 Admissions and residents

| Table | Purpose | Important columns and constraints |
|---|---|---|
| `admission_cases` | Aggregate root from referral through finalization | tenant keys, `case_number`, candidate display fields, `status`, `current_step`, assigned user, decision deadline, `version`; unique `(facility_id, case_number)` |
| `screening_versions` | Append-only snapshots after submission | tenant keys, case ID, version number, `state`, structured answers JSONB, schema version, submitted/signed metadata, content hash; unique `(admission_case_id, version_number)` |
| `assessment_versions` | Versioned nursing/admission assessment | same versioning pattern; reviewer and signature metadata; no overwrite after signature |
| `directive_versions` | Versioned advance-directive record | type, status, answer payload, effective date, source document ID, signature metadata |
| `admission_decisions` | Immutable decision evidence | case ID, `decision in (approved, declined, deferred)`, reason code/text, actor, decided time; a later decision supersedes rather than updates |
| `field_provenance` | Trace carried-forward values | source table/row/path/hash, target table/row/path, transform version, copied time and actor; target uniqueness prevents ambiguous ancestry |
| `residents` | Resident identity and lifecycle | tenant keys, source case ID, facility resident number, names, DOB, status, admitted/discharged dates, encrypted sensitive identifier fields; unique resident number within facility |
| `resident_status_history` | Append-only lifecycle history | resident ID, from/to status, effective time, reason, actor |
| `resident_contacts` | Representatives and emergency contacts | resident ID, relationship/type, names, encrypted contact values, authorization flags and validity window |
| `resident_identifiers` | External or sensitive identifiers | type, encrypted value, keyed lookup hash, key ID/version, validity window; no plaintext identifier |

Admission states are:

```text
draft → screening_submitted → under_review
under_review → declined | assessment_required
assessment_required → directives_required
directives_required → ready_to_finalize
ready_to_finalize → admitted
any nonterminal state → withdrawn
```

`admitted` requires an approved current screening, completed required assessment/directives, a resident created in the same transaction, and provenance links for inherited fields. Transition history is recorded in `workflow_transitions`.

### 5.3 Care plans

| Table | Purpose | Important columns and constraints |
|---|---|---|
| `care_plans` | Stable aggregate identity | tenant keys, resident ID, status, current version ID, review due date, owner, `version`; at most one active plan per resident |
| `care_plan_versions` | Immutable plan snapshot after submission | plan ID, version number, state, effective/review dates, source assessment ID, schema version, submitted/approved/signed metadata, content hash |
| `care_plan_needs` | Version-owned assessed needs | version ID, category, description, priority, source provenance reference, display order |
| `care_plan_goals` | Version-owned outcomes | version ID, need ID, description, target date, status, display order |
| `care_plan_interventions` | Actionable plan instructions | version ID, goal/need ID, instruction, frequency/rule JSONB, responsible role, evidence requirement, active window |
| `signatures` | Signature ceremony evidence | tenant keys, record type/ID/version/hash, signer user/role, meaning, signed time, authentication assurance, signature method; append-only |

A plan version progresses `draft → in_review → approved → signed → active → superseded`. Rejection returns a new editable draft or records a review outcome; it never mutates a signed version. Activating a version and superseding the previous active version occur atomically.

### 5.4 Documents, audit, and reliable processing

| Table | Purpose | Important columns and constraints |
|---|---|---|
| `documents` | Private object metadata | tenant keys, opaque object key, filename, media type, byte size, SHA-256, scan status, retention class, uploaded actor/time; unique object key and checksum where policy permits |
| `document_links` | Authorized link to a domain record | document ID, record type/ID, purpose; uniqueness prevents duplicate links |
| `workflow_transitions` | State-transition evidence | tenant keys, aggregate type/ID, from/to state, reason, actor, occurred time, correlation ID; append-only |
| `audit_events` | Security and business audit trail | tenant scope, sequence ID, occurred/recorded time, actor/session/action, target, outcome, reason, correlation/request IDs, source IP classification, metadata, previous/event hashes |
| `outbox_events` | Transactional event publication | tenant scope, aggregate/event identifiers, event type/version, minimal payload, occurred/available/published times, attempts; unique event ID |
| `idempotency_records` | Safe mutation replay | tenant scope, actor, operation, key hash, request hash, response status/body reference, expires time; unique `(organization_id, actor_id, operation, key_hash)` |
| `jobs` | Durable asynchronous work | event ID, type, state, attempt/max attempts, available/lease times, last error code; payload contains IDs only |
| `dead_letters` | Exhausted job evidence | job ID, failure classification, failed time, resolution state and actor |
| `data_lifecycle_holds` | Prevent policy purge | tenant scope, record selector, reason, authority, effective/released times |

Audit metadata is allow-listed and excludes raw PHI. Database permissions deny `UPDATE` and `DELETE` on audit, signature, transition, decision, and signed-version evidence to the application role. Audit integrity hashes are periodically anchored outside the application database.

### 5.5 `workflow_transitions` versus `audit_events`

These two append-only tables are deliberately separate and must not be collapsed into one.

| | `workflow_transitions` | `audit_events` |
|---|---|---|
| Concern | Domain state-machine evidence | Cross-cutting security and business audit trail |
| Grain | One row per aggregate state change | One row per security/business-relevant action |
| Scope | A single aggregate (`aggregate_type`/`aggregate_id`) | Any actor action across the system |
| Shape | `from_state` → `to_state`, reason, actor, occurred time | actor/session/action/target/outcome, hash chain, sequence ID |
| Answers | "How did *this* admission/care plan move through its lifecycle?" | "Who did what, to what, when, and was it allowed?" |

`workflow_transitions` records the *legal moves of a domain state machine* — for example an
admission going `under_review → assessment_required`, or a care-plan version going
`approved → signed`. Each row belongs to exactly one aggregate, names the prior and next state,
and exists so the lifecycle of that aggregate is reconstructable and so invalid transitions are
provably absent. It is owned by the module that owns the aggregate.

`audit_events` records *security and business-significant actions regardless of aggregate* —
logins, authorization denials, privileged/support access, exports, document downloads, and the
business fact that a decision or signature occurred. It is a tamper-evident, hash-chained trail
keyed by actor, action, target, outcome, and correlation ID, owned by the Audit module.

Use `workflow_transitions` when you are recording that an aggregate changed domain state, and you
need the from/to states and lifecycle history. Use `audit_events` when you are recording that an
actor performed a security- or business-relevant action and you need the cross-cutting,
investigable trail. A single state change frequently produces both: a domain transition row in
the owning module *and* an audit event — written in the same transaction (alongside the outbox
event) — and that duplication is intentional, because the two tables answer different questions
and have different owners, retention, and access controls.

## 6. Release 1 and later schema

These tables are architectural reservations, not Release 0 implementation commitments.

### 6.1 Shift work and proof-of-care

| Table | Purpose | Key relationships/invariants |
|---|---|---|
| `shifts` | Facility shift instance | facility, local start/end, timezone, status |
| `staff_presence` | Clock-in/out evidence | shift, user, timestamps, source; corrections are amendments |
| `care_actions` | Due unit of work | resident, intervention/source, shift, due window, assignee/role, priority, status |
| `care_action_evidence` | Completion or explicit exception | action, outcome, actor, occurred/recorded times, note/document; one current accepted outcome, amendments preserved |
| `clinical_notes` | Progress notes/observations | resident, optional action/plan link, author, state, service time, signed version/hash |
| `record_amendments` | Correction overlay | original record/version, replacement record/version, reason, actor/time |
| `handoffs` | Shift summary and acknowledgment | from/to shift, state, signed author and acknowledger |
| `resident_requests` | Bounded request workflow | resident, category, due/assigned/status, resolution evidence |
| `appointments` | Resident appointment tracking | resident, scheduled time/timezone, status, transport and follow-up state |

`care_actions.status` is constrained to `scheduled`, `due`, `completed`, `exception`, `cancelled`, or `overdue`. Overdue is derived into an operational projection but the source due window is preserved. A completed/exception action plus authorized actor and timestamp qualifies as a verified care action; autosaves and notification records do not.

### 6.2 Medication operations — separately gated

| Table | Purpose | Key relationships/invariants |
|---|---|---|
| `medication_orders` | Versioned prescriber order metadata | resident, medication code/name, dose/route, PRN flag, effective window, prescriber/source, state |
| `medication_schedules` | Administration timing rule | order, local schedule/timezone, window, instructions, generated-through time |
| `medication_doses` | Materialized due dose | order/schedule/resident, due window, state; unique schedule occurrence |
| `medication_administrations` | Append-only administration evidence | dose, outcome, actor, occurred/recorded times, reason; one initial result, corrections linked |
| `prn_outcomes` | Required PRN follow-up | administration, reason, reassessment due/time, effect and actor |
| `medication_exceptions` | Escalation and resolution | dose/administration, type, severity, assigned/reviewed/resolved evidence |
| `controlled_drug_disposals` | Disposal evidence | medication/resident, quantity, reason, actor and witness signatures |

Allowed administration outcomes are `given`, `refused`, `held`, `late`, and `not_given`. `given` requires dose/route/time evidence; PRN requires a reason and creates a follow-up obligation; disposal requires two distinct authorized identities. Medication tables remain behind a facility entitlement and clinical release gate.

### 6.3 Safety, quality, and platform growth

| Table group | Tables |
|---|---|
| Incidents | `incidents`, `incident_people`, `incident_notifications`, `incident_follow_ups`, `incident_reviews` |
| Compliance | `evacuation_drills`, `staff_credentials`, `credential_requirements`, `form_reviews` |
| Communication | `notifications`, `notification_deliveries`, `announcements` |
| Configuration | `form_templates`, `form_template_versions`, `facility_template_assignments`, `feature_entitlements` |
| Integrations | `integration_connections`, `external_identifiers`, `webhook_subscriptions`, `webhook_deliveries` |
| Export/retention | `export_requests`, `export_artifacts`, `retention_policies`, `purge_runs` |
| Reporting | replaceable projection tables or materialized views derived from source records |

Reporting projections never grant broader access than their source rows and can always be rebuilt. Product analytics stores tenant-safe operational identifiers and non-PHI measures only.

## 7. Tenant isolation and row-level security

RLS is mandatory on every tenant-owned table and supplements, rather than replaces, application authorization. Each transaction sets validated context with `SET LOCAL` through security-definer functions unavailable to the normal application role. Raw IDs from request bodies or queue payloads are never passed directly. The server first resolves a short-lived authorization envelope from the authenticated session and current membership/grant records; the context function revalidates the referenced authorization and expiry:

```sql
select app.set_request_context(
  p_user_id         => $1,
  p_session_id      => $2,
  p_organization_id => $3,
  p_scope_mode      => $4, -- facility | organization | support
  p_facility_ids    => $5,
  p_action          => $6,
  p_authorization_id => $7 -- membership or support grant
);
```

The physical function rejects a session/user/organization mismatch, inactive membership, expired or revoked support grant, an action not granted by the authorization record, and facilities outside that grant.

Representative facility policy:

```sql
alter table residents enable row level security;
alter table residents force row level security;

create policy residents_facility_scope on residents
using (
  organization_id = app.current_organization_id()
  and facility_id = any (app.current_facility_ids())
)
with check (
  organization_id = app.current_organization_id()
  and facility_id = any (app.current_facility_ids())
);
```

Rules:

- The application role does not own tables and cannot bypass RLS.
- Connection-pool checkout starts a transaction; tenant context is transaction-local and cleared by commit/rollback.
- **Transaction-mode pooling is a hard constraint.** Under transaction-mode connection pooling (Neon/PgBouncer on Vercel) a backend connection is bound to a request only for one transaction and is then reassigned, possibly to a different tenant. Therefore every query in a request **must** execute inside the single transaction that issued its `SET LOCAL` context call. `SET LOCAL` applied outside an explicit transaction, or relied upon to survive across separate statements on a pooled connection, is invalid and forbidden: there is no session-level tenant context, so a later statement either runs with no context (denying access) or on a connection still associated with another tenant. The setter, all scoped reads/writes, and the commit are one transaction.
- Missing context denies access. Background jobs establish scope from a validated job record, not payload claims.
- Organization aggregation uses separately authorized views/functions or a reporting role with equivalent policy checks.
- Migration and break-glass roles are not application credentials. Their use is alerted and audited.
- CI tests two organizations, multiple facilities, cross-scope foreign keys, pooled-connection reuse, jobs, exports, and support grant expiry.

Policy behavior by scope class is explicit:

- Global identity tables are not available to the tenant application repository role; security-definer identity functions return only the minimum authorized projection.
- Organization-owned policies require the organization match and an explicit organization action from the referenced active membership.
- Facility-owned policies always require the organization match. In `facility` mode the row facility must be in the validated facility set. In `organization` mode a policy-aware function must prove the named action permits organization aggregation and that the row belongs to an allowed facility. An empty facility set never means all facilities.
- `support` mode additionally requires the exact, unexpired, unrevoked `support_access_grant`, its reason/ticket, its granted action, and its organization/facility bounds. Every use emits a privileged-access audit event.
- Background work resolves authorization from durable job tenant and initiating-authorization references at execution time. If authorization is no longer valid, the job fails closed or follows a separately approved system-authority policy; it never trusts scope copied into the message.

Organization aggregation should normally use approved security-definer query functions or scoped views rather than broad table access. Those functions apply the same action-specific context, bounded filters, and pagination, and are covered by negative RLS tests.

## 8. Encryption and sensitive search

Managed database encryption at rest is required but insufficient for selected identifiers. Application-level envelope encryption stores:

```text
<field>_ciphertext bytea
<field>_key_id text
<field>_cipher_version smallint
<field>_lookup_hash bytea       -- only where exact lookup is approved
```

Authenticated additional data binds ciphertext to organization, facility, table, row, and field. Exact-match lookup uses a tenant-specific keyed hash; partial search of encrypted identifiers is unsupported. Names and ordinary operational fields remain database-readable only when the approved threat model and search requirements permit it. Key rotation writes a new cipher version without changing signed record content hashes; the signature manifest records whether a field is represented by ciphertext hash or normalized display value.

## 9. Index and partition strategy

Every tenant query begins with organization and facility scope. Baseline indexes include:

- `(organization_id, facility_id, status, updated_at desc)` on scoped work queues;
- `(organization_id, facility_id, resident_id, occurred_at desc)` on longitudinal records;
- partial unique indexes for one active care plan and one active membership;
- `(organization_id, correlation_id)` and `(organization_id, target_type, target_id, occurred_at desc)` on audit events;
- `(state, available_at)` partial indexes on unpublished outbox events and runnable jobs;
- GIN indexes only for approved, measured JSONB query paths.

Do not partition tenant tables initially. Consider time partitioning `audit_events`, `workflow_transitions`, administrations, and action evidence only after measured size/maintenance thresholds. Never partition by tenant in a way that creates per-customer schema operations.

## 10. Retention, correction, and deletion

Record classes map to approved retention policies by jurisdiction and contract. Until those policies are approved, migrations must not encode arbitrary purge durations.

- Drafts may be replaced according to draft policy.
- Signed care, medication, incident, decision, and audit evidence is amended, not overwritten.
- A correction stores the original, replacement, reason, actor, and time and keeps both discoverable.
- A resident discharge changes lifecycle status; it does not delete the chart.
- Export is asynchronous, scoped, encrypted, expiring, and audited.
- Purge requires policy eligibility, no active legal hold, approval where required, an immutable purge manifest, and separate object-store cleanup verification.
- Analytics is de-identified or aggregated before source-record purge when lawful and approved.

## 11. Migration and deployment rules

1. Use ordered, immutable SQL migrations owned by domain module.
2. Apply expand → backfill → validate → switch reads/writes → contract. Destructive DDL is never coupled to the application deployment that stops using it.
3. Add large constraints as `not valid`, validate separately, then enforce writes.
4. Create large indexes concurrently outside transaction-wrapped migration steps.
5. Every migration has forward recovery instructions; rollback does not depend on restoring dropped data.
6. Migration CI starts from an empty database and upgrades a representative previous snapshot.
7. Schema drift is detected in CI and production. Direct production DDL is prohibited except documented break-glass response.
8. Seed data contains no real resident or staff data.

Suggested migration order:

```text
0001 extensions, roles, request-context functions
0002 organizations, facilities, users, memberships, sessions
0003 audit, outbox, idempotency, workflow transitions
0004 documents and object metadata
0005 admission cases and versioned admission records
0006 residents, contacts, identifiers, status history
0007 care plans, versions, components, signatures
0008 RLS policies, policy tests, least-privilege grants
0009 operational projections and Release 0 performance indexes
```

## 12. Required database test gates

- Schema and migration tests from clean and prior-version databases.
- Foreign-key and check-constraint tests for every workflow invariant representable in SQL.
- RLS read/write/delete negative tests across organizations, facilities, roles, pooled sessions, jobs, and exports.
- Concurrency tests for admission finalization, plan activation, idempotent submission, and duplicate outbox processing.
- Immutability tests proving application credentials cannot update/delete signed evidence or audit events.
- Restore test including database, object metadata, key references, and replay/reconciliation of the outbox.
- Query-plan tests for resident timelines, manager queues, current care plans, and audit retrieval at forecast pilot and 10× volumes.

## 13. Open decisions before physical schema approval

| Decision | Owner | Schema impact |
|---|---|---|
| First care segment and jurisdiction | Product + legal/clinical | required fields, signatures, retention classes, terminology |
| Membership and organization aggregation matrix | Product + security + architecture | membership roles, policy functions, reporting views |
| Identity provider | Security + architecture | user identity keys, session/MFA tables, provisioning events |
| Form/template strategy | Product + clinical + engineering | typed columns versus versioned JSONB payload boundaries |
| Encryption/key service | Security + operations | key references, rotation workflow, searchable field support |
| Resident duplicate/merge policy | Product + privacy | alias, merge, identifier uniqueness, audit requirements |
| Record correction and retention policies | Legal/privacy + product | amendments, purge eligibility, holds, archive structure |
| Medication vocabulary and safety model | Clinical safety | order coding, dose generation, witnesses, exception rules |

No physical migration should be approved until tenant keys, membership semantics, record immutability, and the Release 0 form contracts are reviewed together. The logical model deliberately leaves jurisdiction-dependent answer payloads flexible while fixing the safety- and authorization-critical relational structure.

## 14. Peer-review resolution record

The 2026-06-22 review clarified: (1) web and worker processes share one compatible release artifact; this schema does not support independently versioned module deployments, (2) cross-module atomic work uses published commands enlisted in one unit of work rather than repository access, and (3) RLS defines global, organization, facility, and support behavior with validated action-specific context. These rules are normative migration and database-test requirements.
