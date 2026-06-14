# Platform State Snapshot — v0.9.0-core-foundation

## Purpose

This snapshot documents the internal platform state at `v0.9.0-core-foundation`, the RentChain Core Foundation Release. It describes the operational layers now present and the guardrails that remain in force.

This snapshot is not a public launch declaration, legal/compliance certification, or external institutional approval.

## Current System Layers

RentChain now has four internal foundation layers:

1. Operational system of record.
2. Human accountability layer.
3. Institutional evidence infrastructure.
4. Controlled agentic infrastructure.

## Layer 1: Operational System Of Record

Layer 1 provides deterministic operational visibility and routing:

- canonical events
- derived decisions
- workflow routing
- decision inbox

This layer makes operational state visible and reviewable without replacing lease, payment, screening, maintenance, or property source-of-truth records.

## Layer 2: Human Accountability Layer

Layer 2 provides human review and accountability:

- operator review sessions
- audit/compliance readiness
- review outcomes
- manual accountability

Review sessions are permissioned, deterministic, and audit-oriented. Audit/compliance readiness summarizes evidence and blocking conditions but does not certify legal compliance.

## Layer 3: Institutional Evidence Infrastructure

Layer 3 organizes evidence for internal and future institutional review:

- evidence packs
- canonical review timeline
- institution export previews
- redaction-aware evidence summaries

Evidence and export surfaces are preview-only. Sensitive tenant, screening, payment, identity, private document, and message payloads are excluded or redacted where applicable.

## Layer 4: Controlled Agentic Infrastructure

Layer 4 introduces supervised operational intelligence without autonomous execution:

- automated workflow previews
- policy-gated agent suggestions
- agent supervision console

Automated workflows are deterministic previews of internal review state. Agent suggestions are operator-visible recommendations only. The Agent Supervision Console centralizes visibility into workflow previews, suggestions, blocked states, escalations, review lineage, evidence references, and timeline references.

## Current Guardrail Model

- Manual review remains required.
- Policy guards remain explicit.
- Human approval remains required for suggested actions.
- External execution remains disabled.
- Autonomous execution remains disabled.
- Landlord routes remain landlord-scoped.
- Admin-only data must not leak into landlord surfaces.
- Sensitive tenant/payment/screening/private document payloads must not be exposed.

No autonomous execution, payment automation, legal notice automation, external filing, or live institutional submission exists in this release.

## Current Non-Goals

- Public launch readiness.
- Legal compliance certification.
- Regulatory filing.
- External lender, insurer, government, auditor, or institutional submission.
- Tenant communication automation.
- Payment collection automation.
- Legal notice or eviction workflow automation.
- Autonomous agent execution.
- Background workers, cron, queues, Pub/Sub, or scheduled reporting.

## Phase 3 Identity Roadmap

Phase 3 should focus on identity and trust infrastructure, including:

- canonical identity layer
- actor identity and attribution strengthening
- tenant/landlord/entity verification surfaces
- permissioned identity references for evidence and review surfaces
- identity-safe redaction and disclosure rules

These additions should extend existing review, evidence, timeline, policy, and supervision layers rather than creating parallel identity workflows.

## Phase 4 Evidence, Export, And Institutional Trust Roadmap

Phase 4 should prepare evidence, export, trust, and signing-dispatch foundations without bypassing the foundation guardrails.

Locked next mission order:

1. `feat/evidence-package-generation-v1`
2. `feat/evidence-chain-custody-v1`
3. `feat/institutional-export-framework-v1`
4. `feat/trust-and-compliance-center-v1`
5. `feat/signing-provider-real-dispatch-v1`

Evidence package generation should come first because it is the next platform-defining capability. Chain of custody should follow immediately because evidence without integrity metadata is weaker. Institutional export should build on evidence packages and custody metadata. The trust and compliance center should centralize governance after export and evidence primitives exist. Real signing-provider dispatch remains a separate external integration mission after governance foundations are stronger.

Future institutional and signing-provider rails must remain permissioned, auditable, redaction-aware, and operator-controlled until explicit execution missions authorize controlled actions.
