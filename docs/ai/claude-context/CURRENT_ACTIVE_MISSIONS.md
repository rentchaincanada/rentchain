# Current Active Missions

This file replaces stale `CURRENT_MISSION.md` context for Claude.ai sharing. It is strategic, chronological, and phase-oriented. It is not an implementation branch plan by itself; each item still requires an explicit operator mission before Codex or Claude acts on it.

Use `GOVERNANCE_REFERENCE.md` for shared governance definitions and status labels before converting any mission theme into implementation scope.

## Current Platform Phase

RentChain has completed the first governed operational infrastructure layer around:

- impersonation governance and actor-chain attribution
- admin/support projection safety
- security incident review
- support escalation runbooks
- escalation history and manual review note contracts
- admin support escalation review
- cross-workflow escalation/workspace links
- governed review workspace summaries, persistence-readiness contracts, append adapter, read routes, admin page, navigation, and test-only fixtures
- AI cowork protocol, Dev Container foundation, Playwright QA readiness, and Cloud Run deployment verification checklists

These are governance and review foundations. They should not be treated as autonomous remediation, workflow execution, or external institutional integration.

Runtime alignment note: route/page/API inventory shows many implemented surfaces across landlord, tenant, admin, support, export/readiness, and review-workspace areas. A mounted route or visible page should be treated as implemented surface area, not automatically as complete production workflow, live integration, or deployed-current behavior.

## Current Strategic Direction

RentChain is moving toward governed operational housing infrastructure:

- operational system of record for rental workflows
- human-accountable review and escalation surfaces
- evidence and export readiness
- support/security governance
- tenant-safe trust and controlled sharing
- mobile operational access
- supervised AI collaboration and QA
- institutional coordination readiness after governance layers mature

The next missions should continue hardening review, QA, projection safety, tenant continuity, and institutional evidence readiness before adding broad automation or external integrations.

Architecture diagrams should be interpreted as evolution maps with maturity labels: implemented, in development, and planned / roadmap. Planned institutional, government, payment, identity, settlement, and interoperability layers must not be described as live production systems.

Before a future mission upgrades any roadmap item to implemented status, require source-code audit, route/payload verification, test evidence, and Cloud Run/Vercel deployment alignment where applicable.

## Architecture Layer Mapping

This mission sequence maps to the architecture layers in `ARCHITECTURE.md` and `CURRENT_ARCHITECTURE.md`:

- **Phase 1 — AI Collaboration & QA Infrastructure** supports Layer 5 by improving deployment verification, Playwright readiness, QA artifacts, and supervised AI cowork process.
- **Phase 2 — Tenant & Operational Continuity Foundations** supports Layer 1 by hardening tenant, landlord, lease, document, occupancy, engagement, and property continuity surfaces.
- **Phase 3 — Governed Review Workspace Hardening** supports Layers 2 and 4 by strengthening security incident, support escalation, review workspace, append-event, and metadata-only routing foundations.
- **Phase 4 — Security & Operational Hardening** supports Layers 4 and 5 by protecting route scope, projection safety, sessions, telemetry, dependencies, and support/admin access.
- **Phase 5 — Evidence, Export & Institutional Trust** supports Layer 3 by expanding consent-aware evidence, export, trust, allowlist, and attestation readiness.
- **Phase 6 — Institutional Coordination Readiness** supports Layer 6 and remains planned/readiness-oriented until scoped missions verify specific institutional workflows.
- **Phase 7 — Long-Term Interoperability & Integrity Readiness** supports Layer 7 and remains roadmap-oriented until governance, consent, projection, evidence, and review layers mature.

This mapping is an operational evolution map. It does not imply live government, subsidy, payment/disbursement, KYC, settlement, inter-agency, tokenization, or external institutional integrations.

## Active Next Sequence

### Phase 1 — AI Collaboration & QA Infrastructure

Purpose: make Codex, Claude, Playwright, GitHub, Vercel, and Cloud Run collaboration safer and more repeatable.

- `docs/ai-cowork-vscode-sandbox-protocol-v1` — completed protocol for AI cowork authority, QA, and deployment boundaries.
- `chore/devcontainer-codex-claude-playwright-foundation-v1` — completed Dev Container and safe QA script foundation.
- `feat/playwright-mobile-preview-qa-harness-v1` — add deterministic mobile preview QA harness using `PREVIEW_URL`.
- `feat/playwright-admin-tenant-landlord-smoke-suite-v1` — add small role-aware smoke coverage for admin, tenant, and landlord surfaces.
- `fix/cloud-run-preview-revision-verification-script-v1` — add safe helper script for Cloud Run revision/image/traffic verification.
- `feat/qa-report-artifact-generation-v1` — generate safe QA summaries without committing secrets, screenshots with sensitive data, or raw payloads.
- `feat/playwright-authenticated-storage-state-foundations-v1` — completed optional local storage-state support without committing cookies, tokens, or credentials.
- `feat/qa-report-artifact-claude-review-pack-v1` — completed Claude-ready QA review pack generation.
- `feat/playwright-authenticated-admin-smoke-v1` — completed authenticated admin smoke coverage with read-only operational checks.
- `feat/playwright-authenticated-landlord-smoke-v1` — completed authenticated landlord smoke coverage with read-only operational checks.
- `feat/playwright-authenticated-tenant-smoke-v1` — current authenticated tenant smoke coverage with read-only tenant portal checks.
- `feat/playwright-storage-state-capture-workflow-v1` — future operator-supervised storage-state capture workflow. Expected commands: `npm run qa:capture-tenant-state`, `npm run qa:capture-landlord-state`, and `npm run qa:capture-admin-state`. The operator signs in manually, Playwright saves local state under `~/rentchain-auth/`, and no credentials or auth JSON are committed or uploaded.

### Phase 2 — Tenant & Operational Continuity Foundations

Purpose: strengthen tenant continuity and operational readiness without leaking private data or creating hidden scoring.

- `fix/tenant-profile-email-card-responsive-polish-v1` — polish profile typography and card overflow.
- `feat/tenant-identity-readiness-foundation-v1` — clarify identity readiness metadata without biometrics, KYC claims, or active provider-integration claims.
- `feat/tenant-multi-lease-readiness-v1` — represent multi-lease or historical lease readiness safely.
- `feat/tenant-operational-engagement-signals-v1` — define metadata-only engagement/readiness signals without surveillance scoring.
- `feat/governed-access-continuity-v1` — preserve tenant-safe access state across profile, documents, lease, and messages.
- `feat/operational-telemetry-readiness-v1` — define safe telemetry summaries for operational QA and support.
- `feat/smart-property-governance-foundation-v1` — prepare property governance labels and readiness states without ownership overclaims.
- `feat/tenancy-continuity-foundation-v1` — connect tenant, lease, unit, document, and message continuity through safe summaries.
- `feat/occupancy-continuity-readiness-v1` — prepare occupancy continuity read models and evidence summaries.

### Phase 3 — Governed Review Workspace Hardening

Purpose: harden governed review workspaces before adding any mutation controls or workflow execution.

- `feat/governed-review-workspace-dev-fixture-toggle-v1` — add safe local/test fixture visibility controls.
- `fix/governed-review-workspace-empty-states-v1` — improve empty states and no-data explanations.
- `feat/governed-review-workspace-ui-contracts-v1` — document UI/read model contracts for review surfaces.
- `test/governed-review-workspace-route-access-regression-v1` — protect admin-only read routes and route-source attribution.
- `test/governed-review-workspace-metadata-response-safety-v1` — assert metadata-only responses and raw payload exclusion.
- `feat/incident-escalation-review-integration-v1` — connect incident and escalation summaries without mutation controls.
- `feat/review-workspace-append-event-audit-trail-v1` — expose append-event audit lineage safely.
- `feat/review-workspace-audit-export-readiness-v1` — prepare admin-only, metadata-safe export readiness.
- `feat/review-workspace-cross-surface-readiness-summaries-v1` — summarize security, escalation, evidence, and export readiness across surfaces.

### Phase 4 — Security & Operational Hardening

Purpose: strengthen operational security posture, support boundaries, and route/projection safety.

- session and token governance hardening
- frontend security headers and CSP review
- dependency and supply-chain governance
- document upload and malware-governance readiness
- secret rotation and environment governance
- security audit and incident response foundations
- support/admin route-scope regression protection
- telemetry and screening route governance
- admin/support access governance

### Phase 5 — Evidence, Export & Institutional Trust

Purpose: expand evidence and export readiness while preserving consent, redaction, and projection safety.

- export integrity and signature foundations
- institutional export allowlist governance
- consent governance timeline
- institutional trust export framework hardening
- recipient-authenticated access readiness
- trust export adoption readiness
- portable attestation readiness
- institution interoperability readiness
- institution legal and compliance readiness
- external legal review preparation

### Phase 6 — Institutional Coordination Readiness

Purpose: prepare controlled institutional workflows after governance, evidence, and consent layers are stable.

- pilot institution operations runbooks
- institution partner readiness
- institution access operational QA
- institution access support/admin readiness
- institution review invite operational QA
- institutional identity readiness
- institutional identity assurance framework
- institutional sharing room readiness
- subsidy/program coordination readiness as planned governance infrastructure, not live welfare support or government eligibility operation
- lifecycle continuity for institution-facing workflows

### Phase 7 — Long-Term Interoperability & Integrity Readiness

Purpose: plan interoperability and integrity layers without bypassing governance foundations.

- provincial adapter standard readiness
- external adapter compatibility
- selective integrity verification
- portable evidence package compatibility
- future RWA execution readiness audit
- settlement rail readiness as a future coordination concept, not live regulated financial rail operation
- asset tokenization readiness infrastructure
- cross-organization trust layer
- release governance and public exposure hardening

## Strategic Principles

- Governance-first evolution.
- Operational infrastructure before interoperability.
- Supervised operational AI, not autonomous enforcement.
- Projection safety for every audience.
- Audit continuity and append-safe history.
- Institutional-safe exports with consent, redaction, and provenance.
- Gradual institutional coordination layering.
- Cloud Run backend freshness must be verified separately from Vercel frontend freshness.
- Future strategy must not be described as implemented production behavior.

## Recommended Next Documentation Missions

1. `docs/readme-modernization-v1` — completed; keep README aligned with governance-first platform framing.
2. `docs/architecture-modernization-v1` — completed; keep architecture layers current as review/export/institutional foundations evolve.
3. `docs/platform-state-runtime-alignment-audit-v1` — completed; keep runtime surface claims separated from complete workflow and live integration claims.
4. `docs/governance-reference-consolidation-v1` — current consolidation mission; use `GOVERNANCE_REFERENCE.md` as the canonical vocabulary layer.
5. `docs/diagram-to-mission-phase-mapping-v1` — recommended next mission to map architecture diagram layers to mission phases without turning roadmap concepts into implemented claims.

## Best Immediate Claude Cleanup

Remove from Claude.ai project context:

- `CURRENT_MISSION.md`

Add to Claude.ai project context:

- `CURRENT_ACTIVE_MISSIONS.md`

Preferred Claude upload order:

1. `PROJECT_OVERVIEW.md`
2. `PLATFORM_GUARDRAILS.md`
3. `CURRENT_PLATFORM_STATE.md`
4. `CURRENT_STRATEGIC_DIRECTION.md`
5. `CURRENT_ARCHITECTURE.md`
6. `CURRENT_GOVERNANCE_MODEL.md`
7. `CURRENT_ACTIVE_MISSIONS.md`
8. `CURRENT_PRICING_AND_CAPABILITIES.md`
9. `CLAUDE_ROLE.md`
10. `AI_COWORK_PROTOCOL.md`
11. `CURRENT_MOBILE_DIRECTION.md`

## Staleness Rule

If an operator prompt, active PR, or current source code contradicts this file, the newer prompt/PR/code path wins. Claude should recommend an audit before turning this strategic sequence into implementation work.
