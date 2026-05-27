# CODEX_RULES.md

## Purpose

Defines strict guardrails Codex must never violate.

`codex.md` describes how Codex operates. `CODEX_RULES.md` defines what Codex must not do.

## Scope Control

- Only implement the active operator-approved mission.
- Do not infer future roadmap as implementation scope.
- Do not expand scope.
- Prefer PR-sized, reviewable changes.
- Stop and report when a fix requires unrelated refactors or protected areas.

## Strategy Protection

- Treat strategic docs as context, not authorization.
- Do not expose private roadmap beyond the active mission.
- Do not generate speculative production claims.
- Clearly distinguish implemented behavior from in-progress or future direction.
- Do not position RentChain as generic landlord SaaS; preserve governed operational infrastructure framing.

## Required Check Policy

- `merge-gate` is supplemental and must not be the only required merge check.
- GitHub branch protection must require actual delivery checks directly.
- For PR merge policy, require PR delivery contexts directly:
  - `ci / frontend (pull_request)`
  - `ci / backend (pull_request)`
  - `Vercel – rentchain`
  - `Vercel – rentchain-status`
- Required check names must match exact emitted check names.
- Prefer PR contexts for merge requirements.
- Do not require both `push` and `pull_request` CI contexts for the same domain unless there is a documented reason.
- Do not assume shorthand names are equivalent.
- Do not weaken required check enforcement.

## System Safety

- Never modify auth unless the mission explicitly requires it.
- Never modify billing, pricing, or entitlement logic unless explicitly required.
- Never modify screening provider adapters unless explicitly required.
- Never redesign schema unless explicitly required.
- Never modify Firestore rules unless explicitly required.
- Never modify CI/CD, deployment config, Terraform, or infrastructure unless explicitly required.

## Projection and Privacy Safety

- Use `docs/ai/claude-context/GOVERNANCE_REFERENCE.md` for canonical definitions of projection-safe, append-safe, metadata-first, supervised AI, controlled operational routing, institutional readiness, and evidence/export governance.
- Never widen tenant visibility into landlord, admin, support, or internal metadata.
- Never expose raw Firestore IDs, unit IDs, lease IDs, landlord IDs, tenant IDs, storage paths, tokens, secrets, credentials, provider payloads, or raw documents as user-facing labels.
- Preserve tenant-safe whitelist projections.
- Preserve landlord/admin/support/export audience boundaries.
- Fail closed on unknown audience, ownership, tenant, landlord, role, policy, or projection context.
- Protect tenant consent, privacy, document minimization, and trust/export boundaries.

## Governance and Audit Safety

- Do not bypass governance layers.
- Do not remove audit continuity.
- Preserve append-safe operational history.
- Preserve route-source attribution where present.
- Preserve metadata-only review, incident, escalation, export, and evidence contracts.
- Do not create raw admin/debug explorers unless explicitly scoped and protected.
- Do not fabricate backend support or fake persistence.

## Automation and Escalation Safety

- Do not introduce hidden automation.
- Do not introduce autonomous remediation.
- Do not add approve, resolve, dismiss, impersonate, enforcement, financial mutation, or escalation execution controls unless explicitly scoped.
- Do not add uncontrolled escalation routing.
- Keep AI workflows supervised and operator-authorized.
- Do not mutate production data from sandbox without explicit operator approval.

## Architecture Discipline

- Follow existing patterns.
- Keep changes minimal and deterministic.
- Do not introduce new frameworks without explicit justification.
- Do not create duplicate source-of-truth systems.
- Use Firestore, not SQL.
- Use server-side authority resolution, never client assumptions.
- Prefer audit-first implementation and review-first operational workflows.

## Data Integrity

- Do not rewrite or delete data blindly.
- Do not merge distinct operational records unless a mission explicitly requires a reviewed data operation.
- Do not alter pricing, payments, screening, leases, exports, auth, Firestore rules, or public workflows as incidental work.
- Do not store unrelated PII in logs, events, notes, reports, or new collections.

## Execution Integrity

- Audit before implementing.
- Plan before editing.
- Run required validation before reporting completion.
- Commit, push, and open a PR when the mission asks for the full PR workflow.
- Do not stop at summary when implementation/publishing is requested.
- Do not merge without explicit operator authorization.

## Failure Handling

Stop and report when:

- schema redesign is needed
- auth, pricing, entitlement, payment, screening, Firestore rules, or deployment changes are needed but not authorized
- unsafe operation is required
- production/security uncertainty cannot be resolved safely
- preview behavior may be stale deployment drift
- required files or dependencies are missing

## Summary

RentChain work must preserve:

- governance-first architecture
- operational infrastructure positioning
- projection-safe systems
- audit continuity
- append-safe history
- supervised AI workflows
- controlled escalation and review workspaces
- institutional-safe evidence and export readiness
