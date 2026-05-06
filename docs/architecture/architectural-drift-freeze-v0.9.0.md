# Architectural Drift Freeze Guidance — v0.9.0-core-foundation

## Purpose

This guidance protects the stable foundation established by `v0.9.0-core-foundation`. Future missions should extend the existing foundation instead of creating parallel systems or bypassing safety controls.

This is internal architecture guidance, not public launch certification, legal compliance certification, or institutional approval.

## Stable Foundation Systems

Protect and extend these systems:

- decision inbox
- workflow routing
- delinquency action scaffolding
- institution export preview
- audit/compliance readiness
- operator review sessions
- evidence packs
- canonical review timeline
- automated workflow previews
- policy-gated agent actions
- agent supervision console

## Extension Rules

- Extend existing systems before creating new systems.
- Keep deterministic derivation logic centralized.
- Preserve landlord/admin permission boundaries.
- Preserve manual review requirements.
- Preserve policy guard checks.
- Preserve audit and review lineage.
- Preserve redaction-aware evidence and export behavior.
- Keep external execution disabled unless a mission explicitly authorizes controlled execution.

## What Must Not Be Duplicated

- Do not create a parallel decision inbox.
- Do not create a parallel workflow routing layer.
- Do not create a parallel evidence pack system.
- Do not create a parallel review timeline.
- Do not create a parallel agent-action system.
- Do not create a parallel supervision console.
- Do not create separate severity, status, queue, or action vocabularies without migration guidance.

## Future Mission Guidance

Every future mission should audit the stable systems before implementation and answer:

1. Which existing layer owns this concept?
2. Can this be represented as an extension of an existing read model, route, or UI surface?
3. Does the mission require mutation or execution, or can it remain preview/read-only?
4. Which permission boundary applies?
5. Which sensitive payloads must be excluded or redacted?
6. Which canonical event or timeline relationship already exists?

## Required Audit Before New Feature Work

Before adding feature work, inspect the relevant existing layers:

- decision and workflow models
- decision inbox aggregation
- operator review sessions
- evidence pack derivation
- canonical review timeline derivation
- institution export preview derivation
- audit/compliance readiness derivation
- automated workflow previews
- policy-gated agent suggestions
- agent supervision snapshot

## When New Systems Are Allowed

New systems are allowed only when:

- no existing stable layer owns the concept;
- extending an existing layer would create ambiguity or unsafe coupling;
- the new system has explicit permission, scope, and guardrail definitions;
- the new system does not duplicate existing decision, workflow, evidence, timeline, or agent infrastructure;
- the PR documents why a new system is necessary.

## Drift Warning Signs

- A new route or helper recreates decision/workflow/evidence/timeline concepts.
- A UI surface introduces action controls that bypass policy guards.
- A model adds a new status/severity vocabulary that overlaps existing types.
- A feature hides automation behind read-only wording.
- A landlord route exposes admin-only context.
- A preview endpoint starts persisting or submitting data externally.
- A feature claims public launch readiness without readiness review.
- A feature claims legal/compliance certification.

## Non-Negotiable Rules

- Do not bypass policy guards.
- Do not add hidden automation.
- Do not widen permissions casually.
- Do not introduce public launch claims without readiness review.
- Do not claim legal/compliance certification without a separate approved process.
- Do not add autonomous execution, payment automation, legal notice automation, external filing, or live institutional submission without an explicit execution mission.
