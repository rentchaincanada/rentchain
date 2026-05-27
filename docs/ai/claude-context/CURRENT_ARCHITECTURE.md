# Current Architecture

## Architecture Map Maturity

Architecture diagrams and maps should be read as operational evolution maps, not guaranteed live production state maps.

Use `GOVERNANCE_REFERENCE.md` for shared definitions of implementation status, projection safety, append safety, metadata-first evidence/export posture, supervised AI, and controlled operational routing.

Use these labels:

- Implemented: materially present in current code, routes, docs, tests, or UI surfaces.
- In Development: partial foundations, helpers, read models, tests, docs, or preview surfaces.
- Planned / Roadmap: future strategic direction requiring scoped implementation, governance review, QA, and deployment verification.

Planned government, subsidy, welfare support, payment/disbursement, identity/KYC, settlement, inter-agency, and interoperability nodes must not be described as live integrations.

## Architecture-to-Mission Phase Mapping

Use this table to connect architecture layers to `CURRENT_ACTIVE_MISSIONS.md` without turning roadmap work into implemented claims.

| Architecture layer | Mission phase | Maturity | Governance risk | Claude interpretation |
| --- | --- | --- | --- | --- |
| Layer 1 — Operational System of Record | Phase 2 — Tenant & Operational Continuity Foundations | Implemented foundations / in development | Medium | Core operational surfaces exist; workflow depth still needs scoped verification per surface. |
| Layer 2 — Human Accountability Layer | Phase 3 — Governed Review Workspace Hardening | Implemented and in development | High | Review workspaces, incidents, and support escalations are human-review foundations, not autonomous execution. |
| Layer 3 — Evidence & Institutional Trust Infrastructure | Phase 5 — Evidence, Export & Institutional Trust | In development | High | Evidence/export surfaces are metadata-first readiness layers unless deployed payloads prove a narrower implemented export. |
| Layer 4 — Controlled Operational Routing | Phase 3 and Phase 4 — Review plus Security/Operational Hardening | In development | High | Routing is supervised triage and continuity, not enforcement, remediation, or uncontrolled escalation. |
| Layer 5 — Operational Governance & Scaling Foundations | Phase 1, Phase 3, and Phase 4 — QA, Review, and Security Hardening | In development | Medium / High | QA, projection safety, deployment verification, route/access regression, mobile access, and AI cowork process reduce operational risk. |
| Layer 6 — Institutional Coordination Infrastructure | Phase 6 — Institutional Coordination Readiness | Planned / Roadmap | Very High | Government, subsidy/program, lender, insurer, auditor, and institutional identity/sharing coordination remain roadmap/readiness work. |
| Layer 7 — Long-Term Interoperability & Integrity Readiness | Phase 7 — Long-Term Interoperability & Integrity Readiness | Planned / Roadmap | Very High | Interoperability, settlement rail readiness, selective verification, tokenization readiness, and portable evidence compatibility remain later-stage roadmap work. |

If a claim depends on environment flags, representative payloads, Cloud Run deployment freshness, external integration behavior, or end-to-end QA, label it **Needs Verification**.

## Backend Stack

- Node.js and Express.
- TypeScript.
- Firestore for persistence.
- Firebase Auth and server-side authorization.
- Google Cloud Storage where storage is required.
- Cloud Run for the main API.

Core API routes live in `rentchain-api`. Route ownership and route-source headers are important for preview QA and governance attribution.

## Frontend Stack

- React.
- TypeScript.
- Vite with SWC.
- Vercel for frontend deployment.
- Frontend API calls should use helpers that resolve to `VITE_API_BASE_URL` and Cloud Run for core API routes.

## Deployment Model

- Vercel deploys the frontend.
- Cloud Run serves `rentchain-api`.
- GitHub Actions run backend/frontend checks.
- Terraform status is part of repo-level deployment context.

Vercel preview freshness does not prove Cloud Run backend freshness. Backend changes require Cloud Run revision/image/traffic verification.

## Runtime Alignment Boundary

The current application includes mounted frontend pages and backend route families across public, landlord, tenant, admin, support, review workspace, export/readiness, screening, billing/payment, maintenance, message, registry, audit, and observability surfaces.

For Claude review, distinguish these states:

- a route/page exists: implemented surface, but not proof of full workflow depth
- a helper/read model exists: implemented foundation, but not proof of live persistence or mutation controls
- a readiness/export page exists: implemented review/readiness surface, but not proof of external submission, legal certification, or institution integration
- a route is mounted: implemented API surface, but deployed behavior still requires Cloud Run revision and payload verification

Do not convert route inventory into production capability claims without checking current code path, tests, authorization, deployment revision, and representative payloads.

## Event, Ledger, and Review Principles

RentChain architecture favors:

- audit continuity
- append-safe records
- metadata-only review envelopes
- deterministic read models
- manual review before operational mutation
- projection-safe user-facing views

Avoid hidden automation, unreviewed workflow mutation, or raw debug explorers.

## Projection-Safe Read Models

Tenant-facing data should use whitelist projections. Landlord/admin/support views should use explicit safe summaries. Internal support/admin metadata must not leak to tenant, landlord, public export, analytics, dashboard, or timeline surfaces.

Raw Firestore IDs should not be user-facing labels.

## AI-Assisted Workflow Posture

AI can assist review, drafting, analysis, and triage, but workflows remain supervised. Current governance docs repeatedly prohibit autonomous remediation, hidden enforcement, and unsupervised status mutation unless an explicit mission defines safe controls.

Use terms like "human-reviewed, AI-assisted triage" and "controlled operational routing with supervised assistance." Avoid wording that implies autonomous escalation or agent-driven operational execution.

## CI/CD Notes

Required check policy emphasizes actual frontend/backend delivery checks and Vercel contexts. `merge-gate` is supplemental, not a substitute for delivery checks.

Cloud Run deployment verification is required for backend payload QA when stale deployment drift is plausible.
