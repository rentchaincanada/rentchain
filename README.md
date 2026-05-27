# RentChain

RentChain is governed rental operations and property intelligence infrastructure. It is built to coordinate landlord, tenant, admin, support, evidence, export, and review workflows with audit continuity and projection-safe data boundaries.

This repository is not framed as generic landlord SaaS. The current direction is operational housing infrastructure: rental workflows with governed review surfaces, tenant-safe projections, support/escalation coordination, evidence lineage, and institution-ready export foundations.

## Platform Philosophy

RentChain prioritizes:

- governance before broad automation
- audit continuity before operational mutation
- projection-safe read models before data sharing
- tenant consent and privacy before portability
- supervised AI assistance before autonomous action
- institution-ready evidence summaries before external integrations

AI can help review, triage, draft, and inspect. It must remain supervised, scoped, and aligned with the mission workflow.

## Implemented Platform Capabilities

Current material foundations include:

- landlord property, unit, tenant, application, lease, maintenance, message, document, and portfolio workflows
- tenant portal profile, lease, document, message, maintenance, and controlled trust/export surfaces
- admin/security incident review and support escalation review surfaces
- governed review workspace summaries, read routes, admin page, and test-only fixtures
- impersonation governance, actor-chain attribution, and support/admin projection safety
- mobile landlord and tenant navigation foundations
- backend-first pricing and capability resolution across Free, Starter, Pro, and Elite plans
- Cloud Run deployment verification and AI cowork documentation for Codex, Claude, Playwright, and operator QA

These foundations are implemented at different maturity levels. Do not infer full workflow execution, external institutional integrations, or autonomous remediation unless current code and mission scope explicitly confirm it.

Runtime alignment note: RentChain contains many mounted pages, route families, helpers, and tests across landlord, tenant, admin, support, export/readiness, and review workspace areas. A page or route being present means the surface exists; it does not automatically prove complete workflow depth, live production data, external submission, compliance certification, or deployed-backend freshness.

## In-Progress Operational Systems

Current operational direction includes:

- governed review workspace hardening
- tenant and landlord mobile workflow polish
- tenant readiness and document consistency
- security incident and support escalation review continuity
- Playwright preview QA harnesses
- Cloud Run revision verification to prevent stale-backend QA drift
- Claude.ai context modernization for safer architectural review

## Long-Term Strategic Direction

Future-facing work trends toward:

- institutional trust/export readiness
- evidence lineage and audit package continuity
- support escalation and manual review coordination
- identity, property, and tenant trust readiness
- controlled institutional coordination such as subsidy, compliance, lender, insurer, and auditor workflows
- interoperability and integrity verification only after governance layers are mature

Avoid tokenization hype, unsupported production claims, or autonomous AI positioning when describing this repository.

## Governance Principles

RentChain engineering follows these rules:

- tenant-facing data uses explicit safe projections
- support/admin metadata stays internal unless an approved projection exposes a safe summary
- raw Firestore IDs should not be user-facing labels
- audit history should be append-safe and explainable
- unknown or ambiguous authorization fails closed
- exports are metadata-first, consent-aware, and redaction-aware
- workflow mutation requires explicit mission scope and review

## Operational Architecture Direction

The architecture is organized around layered operational infrastructure:

1. Operational system of record: events, decisions, workflows, leases, messages, documents, maintenance, and portfolio activity.
2. Human accountability layer: review workspaces, audit continuity, support escalation, incident review, and manual notes.
3. Evidence and institutional trust infrastructure: evidence lineage, export governance, projection safety, and consent-scoped trust packages.
4. Controlled operational routing: manual review routing and supervised escalation without hidden automation.
5. Governance and scaling foundations: read models, consent continuity, workflow normalization, and mobile operational access.
6. Institutional coordination infrastructure: future subsidy, compliance, lender, insurer, and institutional workflows.
7. Interoperability and integrity readiness: future selective verification and compatibility layers after governance is stable.

Architecture diagrams and maps should use the maturity legend in `ARCHITECTURE.md`. They are operational evolution maps, not guaranteed live production state maps. Planned institutional, government, payment, identity, compliance, settlement, and interoperability layers require future scoped missions before they can be represented as live capabilities.

## AI Collaboration Workflow

RentChain uses an AI cowork model:

- ChatGPT/Orion: mission command, product strategy, QA interpretation, and merge/deploy decision support.
- Codex: local implementer, code editor, test runner, committer, and PR creator.
- Claude: independent reviewer, risk analyst, root-cause assessor, UX/architecture critic, and mission drafting helper.
- Playwright: deterministic browser QA runner for preview, mobile, route, console, and screenshot evidence.
- GitHub PRs: source of truth for code review and required checks.
- Vercel and Cloud Run: deployment truth surfaces for frontend and backend respectively.

Agents must not merge, deploy, mutate production data, or expand scope without explicit operator authorization.

## Institutional Readiness Direction

Institutional readiness is a trajectory, not a blanket production claim. Current docs and foundations support:

- institution export previews
- institutional trust export frameworks
- projection-safe evidence summaries
- identity and property readiness models
- support/security review workspaces
- metadata-first redaction and provenance

Live institutional integrations, legal certification, external submissions, custody, settlement rails, and public trust profiles require future scoped missions.

Readiness pages for production integrations, enterprise/municipal coordination, platform credentialing, controlled integrations, settlement, tokenization, and interoperability should be treated as review/readiness surfaces unless runtime payloads and deployed route behavior prove a specific implemented capability.

## Halifax Registry and Compliance Direction

The repo includes registry, compliance, property trust, and identity-readiness work. Treat these as governed infrastructure foundations unless current code and deployment prove live end-to-end authority workflows.

## Tech Stack

- Frontend: React, TypeScript, Vite, SWC, Vercel.
- Backend: Node.js, Express, TypeScript, Cloud Run.
- Auth: Firebase Auth with server-side authorization.
- Database: Firestore.
- Storage: Google Cloud Storage where required.
- CI/CD: GitHub Actions, Vercel, Google Cloud Build/Cloud Run, Terraform status contexts.
- QA: Vitest, Playwright readiness, preview QA, Cloud Run revision verification.

## Node.js Requirement

This repo requires Node.js **20.x** and is pinned locally to **20.11.1**.

Quick setup:

```bash
nvm install 20.11.1
nvm use 20.11.1
```

The repo includes `.nvmrc`, `.node-version`, and package preflight checks that fail fast on unsupported Node versions.

## Development Entry Points

Frontend:

```bash
cd rentchain-frontend
npm ci
npm run test
npm run build
```

Backend:

```bash
cd rentchain-api
npm ci
npm run test
npm run build
```

Use `codex.md`, `PROCESS.md`, `AGENTS.md`, and `docs/execution/AI_COWORK_PROTOCOL.md` for mission workflow and agent operating rules.
