# ADR-0001: Start as a modular monolith

**Status:** Accepted for initial implementation  
**Date:** 2026-06-22  
**Decision owner:** Ravi, System Architect, Glass Inc  
**Scope:** `@colaris/care-web`

## Context

COLARIS CARE is being rebuilt from a minimal Next.js 16 / React 19 shell. The intended product joins workflows that are transactionally and semantically coupled: resident identity, screening, admission, care planning, assigned work, daily records, incidents, documents, notifications, and audit evidence.

The current working tree has no active domain implementation, database schema, API handlers, job system, or production test evidence. The engineering team first needs to establish correct domain boundaries, tenant isolation, authorization, record integrity, observability, and reliable delivery. There is no measured load, independent service-availability requirement, or stable team ownership model that justifies distributed deployment.

Healthcare and identity data raise the cost of accidental complexity. Splitting the system into networked services now would multiply authentication paths, authorization enforcement points, PHI data flows, deployment coordination, observability requirements, failure modes, and audit scope before the core workflows are proven.

At the same time, an unstructured monolith would make future change unsafe. The decision must preserve strong logical boundaries and an evidence-based extraction path.

## Decision

Build COLARIS CARE as a **modular monolith**:

- one versioned application repository;
- one stateless Next.js application deployment plus separately scalable worker processes from the same codebase;
- one PostgreSQL system of record with module-owned schemas/tables and explicit transaction boundaries;
- private object storage for document bodies;
- a durable outbox and job mechanism for asynchronous side effects;
- domain modules with enforced dependency direction and published contracts.

“One deployment” in this ADR means one immutable, versioned application artifact and one coordinated release train. That artifact can run as multiple process types (`web`, `worker`, or migration), and each process type can have multiple instances and independent capacity. Web and worker versions must remain schema- and contract-compatible during rolling deployment; individual domain modules are not independently released.

Next.js is a delivery adapter, not the domain architecture. Pages, route handlers, server actions, and jobs call application use cases. Business rules remain independent of framework request/response types and vendor SDKs.

### Required module rules

1. A module owns its state transitions, application services, repository interfaces, authorization actions, events, and migrations.
2. A module may not directly write another module's tables or import its internal repository.
3. Cross-module reads use a published query interface. Cross-module changes use an application command or a durable event.
4. User-visible atomic workflows use a single database transaction when consistency requires it.
5. External side effects are triggered from a transactional outbox after commit.
6. Tenant context and actor identity are explicit inputs at every application boundary.
7. Domain code does not import Next.js, database-driver, object-storage, email, or telemetry SDK types.
8. Architectural dependency rules are checked automatically in CI.
9. A cross-module atomic workflow is owned by a named application orchestrator. It opens a unit of work and invokes published module commands with transaction-bound ports; it does not import module repositories or issue SQL.
10. Non-atomic collaboration crosses a commit boundary through the transactional outbox. Its consumers must be idempotent, observable, and reconcilable, and the workflow must not claim atomic completion before required consumers finish.

### Initial module map

The initial modules are Identity, Tenancy, Residents, Admissions, Care Plans, Work, Records, Medications, Incidents, Documents, Notifications, Reporting, and Audit. This map may change as workflows are validated; changes require an ADR when ownership or data boundaries materially move.

### Deployment model

The web application and worker may scale independently but are released from the same version. PostgreSQL, object storage, key management, secrets, and telemetry should be managed services in production where contractual and residency requirements allow.

Background work carries opaque identifiers and retrieves authorized data at execution time. It does not place PHI-rich payloads in queue messages. Jobs are idempotent, observable, retry-bounded, and dead-lettered after exhaustion.

### Tenant enforcement model

The application derives an action-specific authorization envelope from the authenticated session and current database records. The envelope distinguishes facility-scoped, organization-wide, and time-bounded support access. PostgreSQL policies revalidate the referenced authorization and fail closed when context is missing, expired, revoked, cross-organization, or broader than the named action. Organization roles and empty facility lists are never implicit facility bypasses. The detailed table classifications and policy contract are normative in `docs/DATABASE_SCHEMA.md`.

## Alternatives considered

### Microservices from the start

Rejected for the initial releases. This would provide independent deployment and stronger runtime isolation, but current module boundaries, traffic, service-level needs, and team ownership are unproven. It would add distributed transactions, service authentication, contract versioning, network failure, replicated authorization logic, and substantially larger operational and compliance surfaces.

### Unstructured Next.js application

Rejected. Placing domain logic directly in route handlers, server actions, and components is fast only at the beginning. It makes authorization inconsistent, transaction boundaries implicit, tests framework-heavy, and future extraction expensive.

### Event-sourced system

Rejected. Append-only evidence is required for signed records and audit events, but full event sourcing would impose projection, schema-evolution, replay, and operational complexity across every workflow. Conventional transactional state plus immutable versions, audit events, and an outbox meets the known requirements.

### Backend-as-a-service as the primary architecture

Rejected as the default. Managed PostgreSQL, storage, and identity components may be used behind adapters, but browser-to-database access and provider-specific policy logic would make authorization, audit, portability, and critical workflow transactions harder to control consistently.

### Separate frontend and API repositories

Rejected initially. The product benefits from atomic schema/API/UI changes, shared validation contracts, and one release train. Repository separation can be reconsidered if independent team ownership and release cadence become real constraints.

## Consequences

### Positive

- Critical workflows can commit domain state, audit evidence, and outbox events atomically.
- Tenant and authorization controls have fewer enforcement surfaces.
- Local development, testing, deployment, incident response, and schema evolution remain tractable for a small team.
- Module contracts create clear ownership and make selective extraction possible.
- The architecture supports server-rendered and interactive workflows without duplicating domain logic.

### Negative

- A bad release can affect the whole application.
- Database contention and application resource contention require discipline and observability.
- Teams cannot deploy modules independently.
- Logical boundaries rely partly on engineering controls and automated enforcement rather than network isolation.
- Reporting or document workloads could degrade interactive traffic unless resource limits and worker separation are configured.

### Mitigations

- Use feature flags and backward-compatible expand/migrate/contract database changes.
- Maintain bounded queries, timeouts, connection budgets, pagination, and workload metrics.
- Run asynchronous and resource-heavy work in separately scaled worker processes.
- Add dependency-boundary tests, module contract tests, tenant-isolation tests, and code ownership.
- Isolate high-risk external adapters and medication functionality behind explicit interfaces and release gates.

## Extraction criteria

A module becomes a candidate for service extraction only when at least one condition is measured and the extraction demonstrably improves it:

- it needs materially different scaling or compute characteristics;
- it needs an availability or failure-isolation objective the monolith cannot meet;
- a stable team owns it and requires an independent release cadence;
- a security or contractual boundary requires separate runtime/data isolation;
- database or deployment contention remains material after simpler remediation;
- an integration boundary has stabilized and multiple independent consumers need it.

Before extraction, the module must have a stable contract, isolated ownership of data, contract tests, independent telemetry, a failure/retry model, an authorization model, a migration plan, and a quantified operating-cost estimate. “Microservices are more scalable” is not sufficient evidence.

## Validation plan

This decision is validated during the foundation and first product release by proving:

1. admission-to-care-plan changes and their audit/outbox records commit atomically;
2. cross-organization and unauthorized cross-facility access fail at application and database layers;
3. background notification or export failure does not corrupt the source workflow;
4. modules can be tested without booting the full Next.js application;
5. production-like load meets the published latency and successful-mutation objectives;
6. application and worker deployments can be rolled forward and back through compatible schema versions;
7. operators can trace a request and its asynchronous consequences through one correlation chain.

## Review trigger

Review this ADR after Release 2, or earlier if an extraction criterion is met, a material compliance boundary changes, or production evidence shows the deployment model cannot meet agreed service objectives.

## Peer-review resolution

The 2026-06-22 peer review is resolved by this revision: deployment unit versus runtime process is defined explicitly; cross-module atomic work has a named orchestration/unit-of-work pattern; and organization-wide or support access has an action-specific, fail-closed RLS contract. These are constraints of the accepted decision, not deferred implementation choices.

## Compliance note

This architecture decision reduces some security and operational complexity. It is not evidence of HIPAA, SOC 2, GDPR, clinical, or jurisdictional compliance. Those outcomes require implemented controls, organizational policies, contracts, risk management, validation, and continuing operation.
