# Current Platform State

## Current

RentChain currently has material foundations for:

- landlord property, unit, tenant, application, lease, maintenance, message, document, and portfolio workflows
- tenant portal profile, lease, document, message, maintenance, and trust/export-facing surfaces
- Free, Starter, Pro, and Elite plan/capability tiers
- backend-first entitlement/capability resolution
- admin/support projection-safety helpers and tests
- governed impersonation attribution and metadata-only audit continuity
- admin security incident review surface
- support escalation runbook helpers
- support escalation history and manual review note helper contracts
- admin support escalation review surface
- governed review workspace models, append-readiness contracts, append adapter/helper foundations, read routes, admin page, navigation, and test-only fixtures
- mobile landlord and tenant bottom navigation work
- Cloud Run deployment verification docs and AI cowork protocol docs

Current admin/support governance surfaces are intentionally metadata-only, manual-review-oriented, and projection-safe.

Architecture diagrams and maps should be read as operational evolution maps. They combine current foundations, in-development hardening, and future roadmap layers. Do not treat every diagram node as live production behavior.

## Runtime Surface Audit Notes

Recent route and page inspection confirms these implemented runtime surface categories are materially present:

- public/marketing, authentication, invite, application, help, legal, trust, security, status, and contact pages
- landlord dashboard, billing, properties, tenants, applications, analytics, operations, decision inbox, agent supervision, institution exports, audit/compliance, evidence packs, review timeline, identity readiness, sharing-room, rental history, rental debt, settlement-readiness, regulatory, tokenization-readiness, network participant, cross-organization trust, portfolio, action recommendation, lease, ledger, payment, expense, work order, contractor, message, maintenance, account, and screening surfaces
- tenant dashboard/workspace, application, lease, ledger, activity, participation, attachments/documents, notices, profile, screening, access, account, messages, maintenance, feedback, invite, and public sharing surfaces
- admin dashboard, control tower, properties, tenants, leases, integrity, audit, security incidents, support escalations, review workspaces, screening usage, registry, observability, alerting, notification, release governance, public exposure, commercial readiness, controlled/production integration readiness, enterprise/municipal readiness, ecosystem coordination, platform credentialing, consumer reporting governance, portfolio score, support console, triage, and lease lifecycle review surfaces
- Cloud Run API mounts for core public, authenticated, landlord, tenant, admin, support, review workspace, export/readiness, screening, billing/payment, maintenance, message, registry, audit, and observability route families

This audit establishes that a route, page, helper, or test exists. It does not by itself prove production data availability, live external integrations, full workflow execution, regulated compliance status, or every page's deployed freshness.

## Unclear / Needs Verification

Treat the following as needing route-level, payload-level, or deployment verification before making production claims:

- whether a specific preview or production environment is serving the latest Cloud Run backend revision
- whether tenant portal behavior is enabled in a target environment through `VITE_TENANT_PORTAL_ENABLED`
- whether a readiness page is backed by live operational data, static readiness summaries, test fixtures, or empty-state projections
- whether any export/trust surface creates an external submission, signed package, legal artifact, or institution-facing handoff
- whether identity, settlement, payment/disbursement, subsidy/program, government, insurer, lender, auditor, or inter-agency workflows have live integrations
- whether admin/support review surfaces remain read-only, metadata-only, and free of mutation controls after future missions

## In Progress

Active direction includes:

- improving tenant and landlord mobile workflows
- tightening projection consistency between admin, landlord, and tenant views
- building safe review workspace continuity across incidents, escalations, runbooks, notes, and evidence references
- improving QA discipline for Vercel frontend previews and Cloud Run backend revision alignment
- preparing Claude/Codex/Playwright cowork context and sandbox workflows

`docs/execution/CURRENT_MISSION.md` appears to be a template placeholder rather than a live active mission source. Use explicit operator prompts and current PR/branch context as the current mission source of truth.

## Future / Strategic

Future-facing areas in docs include:

- institution export and institutional trust export expansion
- tenant identity readiness foundations and property/operator authority readiness
- support escalation workflow execution after append-only governance is approved
- governed review workspace production persistence, write governance, and supervised coordination beyond current read/helper foundations
- tenant trust portability and controlled sharing
- institutional partner and legal/compliance readiness
- physical mobile/PDF QA confidence improvements
- rental subsidy, housing program, government, welfare support, payment/disbursement, settlement coordination, and inter-agency workflows only after scoped governance and implementation missions
- long-term interoperability and selective integrity verification after consent, projection, evidence, and review layers mature

Do not represent future-facing strategy as implemented production capability unless source code, routes, tests, and current PR context confirm it.
