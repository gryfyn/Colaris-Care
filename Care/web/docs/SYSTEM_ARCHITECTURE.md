# COLARIS CARE — System Architecture

**Owner:** Ravi, System Architect, Glass Inc.  
**Status:** Target architecture for validation  
**Date:** 2026-06-22  
**Applies to:** `@colaris/care-web`

## 1. Architecture decision

COLARIS CARE will be built as a modular monolith on Next.js and PostgreSQL. The browser, server-rendered application, API handlers, workflow services, and background-job entry points will live in one deployable codebase. PostgreSQL is the system of record. Object storage holds documents and images; a durable job mechanism handles asynchronous work. External services are reached only through explicit adapters.

Here, **modular monolith** means one source repository, one versioned release artifact, and one coordinated release train. It does not require one operating-system process. The same immutable artifact is started with a `web`, `worker`, or migration entry point; web and worker processes may scale independently, but incompatible module versions may not be deployed independently. This removes ambiguity between a single logical deployment unit and the separately scalable worker topology described below.

This shape is appropriate for the current team and product stage: it preserves transactional consistency across admission, care-plan, and proof-of-care workflows without creating distributed-system overhead. Module boundaries are mandatory even though deployment boundaries are not. A module can be extracted later only when measured scaling, availability, security, or ownership needs justify it.

The current repository is a clean Next.js shell, not a working care platform. Historical deployment files describe components that are absent from the working tree. This document therefore separates verified current state from target state and must not be used as evidence that a control is implemented.

## 2. Architecture drivers

The system must optimize for:

1. **Resident safety:** critical actions cannot disappear silently; overdue, failed, and corrected work must remain visible.
2. **Tenant isolation:** organization and facility access must be enforced in the database and application, with automated negative tests.
3. **Auditability:** signed or completed records are append-only business evidence. Corrections create new versions and preserve prior values.
4. **Workflow continuity:** screening data should flow into admission and care planning with recorded provenance rather than copy-and-paste.
5. **Recoverability:** users on unreliable networks need durable drafts, idempotent submission, and explicit conflict handling.
6. **Operability:** every critical request and job needs correlation, metrics, actionable alerts, and a tested recovery procedure.
7. **Pragmatic delivery:** the first release must remain operable by a small engineering team.

## 3. Current-state assessment

Verified in the working tree on 2026-06-22:

- Next.js 16.2.4, React 19.2.4, and the App Router are installed.
- The application contains a root layout, a clean-slate landing page, global CSS, and brand assets.
- Security headers are configured in `next.config.mjs`, including CSP, HSTS, frame denial, and MIME sniffing protection.
- Jest, React Testing Library, and Playwright are declared as development dependencies.
- No current API routes, domain modules, database schema, migrations, authentication implementation, job worker, or application test suites are present under `src`.
- `DEPLOYMENT.md` and environment examples refer to PostgreSQL, JWT keys, encryption, migrations, and files that do not exist in this working tree.

Consequently, no production-readiness, privacy, security, availability, or regulatory claim can be inferred from historical queue status or documentation.

## 4. System context

```text
Administrators ─┐
Care staff ─────┼── HTTPS ──> COLARIS CARE ──> PostgreSQL
Clinical users ─┤                    │          Object storage
Residents* ─────┘                    │          Job queue/worker
                                     └────────> Approved external services

* Resident access is a later, separately authorized surface.
```

Primary external dependencies are identity/email delivery, managed object storage, observability, and—only after approval—customer-specific integrations. All vendors that may process protected or sensitive data require security review, contractual approval, regional configuration, and data-flow documentation.

## 5. Logical architecture

```text
Presentation
  App Router pages, layouts, server components, client interaction islands
       │
Application boundary
  Route handlers, server actions, input schemas, authorization policy
       │
Domain modules
  Identity | Tenancy | Residents | Admissions | Care Plans | Work | Records
  Medications | Incidents | Documents | Notifications | Reporting | Audit
       │
Infrastructure ports
  Repositories | Object storage | Jobs | Mail | Telemetry | Key management
       │
Infrastructure adapters
  PostgreSQL | managed blob store | durable queue | approved providers
```

Dependencies point inward. Domain code must not import Next.js request objects, database clients, or vendor SDKs. Route handlers authenticate, validate, authorize, call an application use case, and translate its result. They do not contain workflow logic or issue ad hoc SQL.

### Module contract

Each module owns:

- its business vocabulary, invariants, state transitions, and authorization actions;
- application use cases and transaction boundaries;
- persistence interfaces and database migrations for its tables;
- emitted domain events and accepted commands;
- unit, integration, authorization, and migration tests.

Cross-module reads use published query interfaces. Cross-module writes use application commands inside an explicit transaction or durable event processing. Direct imports of another module's repository are prohibited.

### Cross-module transaction ownership

An application workflow that must update more than one module is owned by a named orchestration use case in an application layer outside the participating modules. The orchestrator opens one PostgreSQL transaction through a unit-of-work abstraction, passes transaction-bound ports to module commands, and commits domain state, audit evidence, and outbox records together. Participating modules still enforce their own invariants and expose commands; the orchestrator may not issue SQL or import their repositories.

If atomicity is not a user-visible safety invariant, the source module commits locally and publishes a versioned outbox event. Consumers are idempotent and expose retry/reconciliation state. A workflow specification must state which model it uses; an event chain must not be presented as atomic, and a cross-module transaction must not include network calls.

## 6. Initial bounded modules

| Module | Responsibility | Key invariants |
|---|---|---|
| Identity | accounts, sessions, MFA, recovery | session revocation is enforceable; no shared accounts |
| Tenancy | organizations, facilities, memberships, scopes | every tenant record has an organization and facility scope where applicable |
| Residents | identity, contacts, demographics, identifiers | sensitive identifiers are encrypted; merge is controlled and auditable |
| Admissions | screening through admission decision | state transitions are explicit; source-field provenance is retained |
| Care Plans | goals, needs, interventions, review/signature | only an authorized signed version is active |
| Work | assignments, due actions, completion, exceptions | a required action is completed, exception-documented, or visibly overdue |
| Records | progress notes and observations | signed records are immutable; corrections are linked versions |
| Medications | orders, schedules, administration evidence | medication scope remains feature-gated pending clinical safety approval |
| Incidents | incident capture, escalation, follow-up | severity and follow-up rules cannot be silently bypassed |
| Documents | upload, metadata, access, malware status | private by default; access is audited; unscanned content is quarantined |
| Notifications | in-app/email delivery derived from domain events | notification failure never changes the source transaction outcome |
| Reporting | operational projections and authorized exports | reports preserve scope and do not become a second system of record |
| Measurement & Analytics | product and operational metrics, north-star and per-release exit criteria | reads only non-PHI events; never queries PHI-bearing module tables |
| Audit | security and business audit events | append-only, tamper-evident, searchable by correlation ID |

#### Measurement & Analytics

This module owns all product and operational measurement. It is the single owner of the
VCA/ARW north-star metric and of the per-release exit criteria used to decide whether a
release boundary has been met; no other module computes or asserts those numbers. It exists
because measurement was previously unowned — operational signals in §13 describe *what* to
watch, but this module owns *how those numbers are derived, named, and reported*.

Its event boundary is strict and one-directional. Measurement & Analytics consumes only the
non-PHI events derived from the transactional outbox (`outbox_events`); it subscribes to the
same durable stream that Notifications and Reporting projections consume. It never reads
PHI-bearing module tables (residents, admissions, care plans, records, medications, incidents,
documents) directly, and it holds no published query interface into them. If a metric requires
a field that is not present on an emitted event, the answer is to enrich the event contract with
a non-PHI attribute at the source module, not to grant the analytics module table access.

Derived metrics and reporting projections live in module-owned projection tables (or replaceable
materialized views) populated by idempotent outbox consumers, exactly as in the Reporting module
data-architecture rule: they preserve source scope, never grant broader access than their source
events, store tenant-safe operational identifiers and non-PHI measures only, and can always be
rebuilt from the event stream. These projections are not a system of record and carry no
authoritative state.

## 7. Data architecture

PostgreSQL is authoritative for transactional and audit data. The schema uses stable UUID identifiers, UTC timestamps, explicit status columns, optimistic version numbers, and foreign keys. JSON may store versioned form payloads or integration envelopes, but searchable and policy-relevant fields remain typed columns.

The normative logical schema, table ownership, relationship model, isolation rules, and phased migration plan are defined in [`DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md). This architecture document governs system boundaries; the database schema document governs persistence contracts. Neither document is evidence that the target controls have been implemented.

### Tenant model

- `organization_id` represents the customer boundary.
- `facility_id` represents an operating location and is required for facility-scoped records.
- Membership grants explicit role/action scope at organization or facility level.
- A request obtains scope from the authenticated server-side session, never from a trusted client claim alone.
- Row-level security is defense in depth and uses transaction-local tenant context.
- Elevated support access is time-bound, approved, reason-coded, and audited.
- Database roles separate migration, application, reporting, and operational access.

Tenant context is a server-derived authorization envelope, not a collection of caller-selected IDs. It records the actor/session, organization, access mode (`facility`, `organization`, or `support`), permitted facility set, authorized action, and—when applicable—the validated organization membership or support grant. The database context setter verifies those references and their validity window before setting transaction-local values.

Tables are classified as global, organization-owned, or facility-owned. Global identity/session tables are not exposed through tenant-scoped application queries. Organization-owned rows require the matching organization plus an authorized organization-level action. Facility-owned rows require the matching organization and facility; organization-wide access is allowed only through an explicit action whose database policy/function expands to authorized facilities. Neither an organization role name, an empty facility array, nor a support flag is a facility bypass.

Every tenant-owned table must have a tenant-isolation test that proves cross-organization and unauthorized cross-facility reads and writes fail.

### Record integrity

Drafts may be edited in place and carry a version for optimistic concurrency. Signing/completion freezes the evidentiary record. A correction references the original, records a reason, creates a new version, and never erases audit history. Deletion is a policy-controlled lifecycle operation, not an ordinary CRUD endpoint.

### Documents and sensitive fields

Database rows store document metadata, tenant scope, checksum, retention state, and an opaque object key. Buckets are private; downloads use short-lived server-authorized access. Uploads are size/type constrained and quarantined until malware scanning succeeds.

Highly sensitive identifiers use authenticated field encryption with managed, tenant-scoped keys. Key identifiers and cipher versions are stored with ciphertext. Rotation is online and resumable. Secrets and keys never enter source control, browser bundles, logs, analytics, or error payloads.

## 8. Request and workflow execution

For a state-changing request:

1. Establish correlation ID and authenticated session.
2. Resolve organization, facility, user, role, and session assurance on the server.
3. Validate content type, size, schema, and business command.
4. Authorize the named action against the target resource and scope.
5. Start a database transaction and set tenant context.
6. Enforce workflow invariants and optimistic version checks.
7. Persist the state change, audit event, and outbox event atomically.
8. Commit and return a stable result or typed error.
9. Process notifications, projections, and integrations asynchronously from the outbox.

Critical mutations accept an idempotency key scoped to tenant, actor, operation, and route. Replays return the original outcome. Clients must distinguish validation, authorization, conflict, rate-limit, and transient server errors.

Long-running actions use durable jobs with bounded retries, exponential backoff, dead-letter handling, and operator-visible status. Jobs carry identifiers, not PHI-rich payloads.

## 9. Authentication and authorization

Use an established identity provider or a standards-based server library; do not design custom cryptographic authentication. Production requires secure, HTTP-only, same-site cookies, short session lifetime appropriate to risk, server-side revocation, session rotation, rate limiting, and MFA for privileged roles.

Authorization is deny-by-default and action-based. Representative actions include `resident.read`, `admission.decide`, `care_plan.sign`, `medication.administer`, `incident.review`, `report.export`, and `membership.manage`. Role names map to actions; sensitive actions may additionally require assignment, facility scope, credential status, or recent MFA.

Route visibility is not authorization. Every server entry point and object lookup enforces policy. Bulk queries, search, exports, document access, background jobs, and support tools follow the same rules.

## 10. Frontend architecture

Prefer server components for read-oriented screens and initial data access. Use client components only for interaction, local draft behavior, and browser APIs. Mutations cross a server boundary and reuse the same application use cases as route handlers.

Feature code should be organized by domain rather than one global component directory. Shared UI contains presentation primitives only; business-specific components remain in their feature. Forms use a shared schema on the server and client where safe, while the server remains authoritative.

Critical workflows need:

- accessible keyboard and screen-reader behavior targeting WCAG 2.2 AA;
- explicit save, saving, saved, conflict, offline, and failure states;
- resumable drafts without placing PHI in analytics or unsafe browser storage;
- confirmation and reason capture for irreversible or safety-relevant actions;
- responsive support for staff devices without reducing data visibility.

## 11. API conventions

HTTP APIs use `/api/v1` and resource-oriented nouns. Responses have stable schemas and errors use a consistent envelope containing `code`, `message`, `correlationId`, and optional field errors. Internal exceptions and SQL details are never exposed.

List endpoints use cursor pagination, bounded page sizes, deterministic sorting, explicit filtering, and policy-aware queries. Exports are asynchronous for large result sets and require step-up authorization where warranted. Breaking changes require a new version or a documented compatibility window.

Health endpoints are split into liveness and readiness. Public health output exposes no dependency details; deeper diagnostics require operator authorization.

## 12. Deployment topology

Release 1 should use managed services where available:

```text
CDN / WAF / TLS
       │
One versioned application artifact (released together, run as separate process types)
       ├── Web process type — stateless Next.js (minimum two instances in production)
       └── Worker process type — durable outbox/job consumer (separately scaled)
                    │
Shared managed dependencies
       ├── Managed PostgreSQL with point-in-time recovery
       ├── Private object storage
       ├── Durable job queue / message transport
       ├── Managed key and secret service
       └── Logs, metrics, traces, error reporting, alerting
```

The web and worker process types are the same immutable artifact started with different
entry points, not separately versioned services; the queue is the managed transport between
them, not a third deployable component.

Environments are isolated accounts/projects with separate databases, buckets, keys, identities, and secrets. Production data is not copied to development or preview environments. Infrastructure and database changes are versioned, reviewed, and promoted through CI/CD. Deployments must support rollback of application code; schema changes use expand/migrate/contract so rollback never depends on reversing destructive DDL.

### Connection pooling and tenant context

Production runs behind transaction-mode connection pooling (Neon/PgBouncer on Vercel). Under
transaction-mode pooling a backend connection is handed to a request only for the duration of a
single transaction and may be reassigned to a different tenant's request immediately afterward.
This makes the following rule a hard constraint, not a guideline:

**Every query in a request MUST run inside the single transaction that issued its
`SET LOCAL` tenant context.** `SET LOCAL` is scoped to the surrounding transaction and is
discarded at commit/rollback. Issuing `SET LOCAL` outside an explicit transaction — or relying on
it to persist across separate statements on a pooled connection — is invalid and forbidden,
because the next statement may execute on a different backend with no tenant context (failing
closed) or, worse, inherit a connection still associated with another tenant. There is no
session-level tenant context under transaction-mode pooling. A request that needs tenant-scoped
access opens one transaction, calls the context setter, runs all of its scoped reads and writes,
and commits; work that cannot share that transaction must re-establish context in its own
transaction.

## 13. Reliability and operations

Initial service objectives:

| Signal | Objective |
|---|---|
| Monthly availability for authenticated core workflows | 99.9% |
| Successful critical mutations, excluding validated user errors | 99.9% |
| p95 server latency for normal interactive requests | under 500 ms |
| Recovery point objective | 15 minutes or better |
| Recovery time objective | 4 hours or better |
| Confirmed cross-tenant disclosure | zero |

Measure these from user-visible outcomes, not process uptime alone. Alerts require an owner, severity, threshold, and runbook. At minimum instrument authentication failures, authorization denials, critical mutation failures, job lag/dead letters, database saturation, storage failures, audit pipeline failures, and unusual export volume.

Backups are encrypted and restore-tested. Disaster recovery is exercised at least twice yearly before scale increases. A downtime mode must provide approved continuity exports and a reconciliation procedure; a static “system unavailable” page is insufficient for live care operations.

## 14. Security and privacy controls

- TLS in transit and managed encryption at rest.
- Managed secrets, rotation, least-privilege service identities, and no long-lived developer production credentials.
- CSP without production `unsafe-inline` scripts, CSRF protection for cookie-authenticated mutations, restricted CORS, secure headers, and bounded inputs.
- Parameterized database access and output encoding by default.
- Immutable security/business audit events with protected access and retention.
- Data classification, minimization, retention, export, correction, legal hold, and deletion procedures.
- Dependency, secret, static-analysis, migration, authorization, and dynamic security checks in CI.
- Independent penetration testing and documented risk analysis before material live use.

These controls support a compliance program; they do not independently establish HIPAA, SOC 2, GDPR, clinical, or jurisdictional compliance.

## 15. Engineering quality gates

A change cannot ship when it introduces an unreviewed tenant boundary, destructive migration, undocumented sensitive-data flow, unaudited privileged action, or untested critical state transition.

CI must include formatting/linting, type checking once TypeScript is adopted, unit tests, database integration tests, migration tests, authorization matrix tests, dependency/secret scanning, production build, and focused end-to-end tests. Release candidates run accessibility checks, backup/restore verification when infrastructure changes, and smoke tests against a production-like environment.

## 16. Delivery sequence

### Foundation

- Reconcile or replace stale deployment documentation.
- Establish TypeScript, module boundaries, error contracts, telemetry, CI, and environment validation.
- Implement identity, tenancy, authorization, database migrations, audit, outbox, and test harnesses.
- Prove cross-tenant isolation and backup restore before domain expansion.

### Admission-to-care-plan release

- Resident identity, screening, admission decision, source-field provenance, care-plan drafting/review/signature, and authorized documents.
- Draft recovery, optimistic conflicts, immutable signed records, operational dashboards, and audit exports.

### Daily proof-of-care release

- Assigned actions, shift workspace, progress notes, completion/exception evidence, handoff, notifications, and supervisor exception views.
- Medication workflows remain gated behind dedicated clinical review and safety validation.

### Scale and integration

- Multi-facility aggregation, migration tooling, approved integrations, configurable content packs, retention automation, and customer-facing operational reporting.

## 17. Explicit non-decisions

The following are intentionally deferred: microservices, event sourcing, GraphQL, multi-region active-active writes, custom identity cryptography, a generic workflow engine, a data warehouse, native mobile applications, and AI-authored clinical records. Each requires evidence that the simpler architecture cannot meet a measured need.

## 18. Required decisions before implementation

| Decision | Owner | Blocking evidence |
|---|---|---|
| First launch jurisdiction and care segment | Product + legal/clinical | reviewed workflow and record requirements |
| Organization/facility membership semantics | Product + architecture + security | access matrix and design-partner validation |
| Identity provider and MFA/session policy | Security + architecture | threat model, vendor review, operating cost |
| Hosting region and managed service set | Architecture + operations | data residency, BAA/vendor terms, recovery capability |
| Retention and correction policy by record class | Legal/privacy + product | jurisdiction and contract requirements |
| Medication scope | Clinical safety + product | hazard analysis and supervised validation plan |
| Historical asset reuse | Engineering + security | provenance, dependency, test, and threat review |

## 19. Architecture governance

Material decisions are recorded as ADRs in `docs/architecture/`. An ADR is required for changes to tenant boundaries, identity, cryptography, record immutability, deployment topology, data stores, external PHI processors, module ownership, or critical workflow state models. Architecture review evaluates evidence and trade-offs; it is not a substitute for code ownership or security review.

This document is reviewed after each release boundary or whenever a material architecture decision changes.

## 20. Peer-review resolution record

The 2026-06-22 peer review identified and resolved three specification gaps:

1. **Deployment-unit ambiguity:** “one deployable codebase” now means one versioned artifact/release train with independently scalable web and worker process types, not one process.
2. **Cross-module atomicity:** multi-module safety-critical changes now have an explicit orchestration and unit-of-work owner; asynchronous collaboration is reserved for non-atomic follow-up work.
3. **Organization-wide RLS ambiguity:** tenant context and table scope classes now distinguish facility, organization, and time-bounded support access without treating roles or empty facility sets as bypasses.
