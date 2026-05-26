# AGENTS.md

## Purpose

Repo-wide operating rules for AI coding agents working in RentChain.

RentChain is governed rental operations and property intelligence infrastructure. Agent work must preserve governance-first architecture, projection-safe workflows, append-safe operational history, supervised AI collaboration, and institutional-readiness boundaries.

## Required Read Order

Before making any change, read in this order:

1. `codex.md`
2. `PROCESS.md`
3. the active operator mission prompt or current mission spec in `docs/specs/` if present
4. relevant `.codex/docs/*` file only when specifically needed for that domain

When a Claude.ai context snapshot is needed, use `docs/ai/claude-context/` as reference context. Do not treat snapshot files as runtime source of truth.

## Role Boundaries

Codex is the implementation agent:

- edits local files
- runs tests/builds/checks
- commits and pushes scoped branches
- opens PRs
- reports validation, risks, and limitations

Claude is a reviewer/strategist/auditor:

- reviews architecture, governance, QA findings, and root causes
- identifies risks and recommended fixes
- labels recommendations as required fix, recommended improvement, future mission, or strategic note

Neither Codex nor Claude should merge, deploy, mutate production data, or expand mission scope without explicit operator authorization.

## Scope Discipline

- Work only inside the active mission scope.
- Prefer PR-sized, reviewable changes.
- Do not bundle adjacent refactors into the same mission.
- Do not modify unrelated files.
- If new work is discovered outside scope, report it and stop or recommend a future mission.
- Distinguish implemented behavior from in-progress or future strategic direction.

## Core Architecture Rules

- Use canonical internal IDs for product logic.
- External identifiers are attributes, not primary keys.
- Use Firestore, not SQL.
- Use existing Express route and service patterns.
- Prefer deterministic logic and pure helper functions.
- Tenant-facing data must use whitelist projections, never broad field stripping.
- Authority-sensitive access must resolve server-side, never from client assumptions.
- Preserve projection-safe read models for tenant, landlord, admin/support, export, dashboard, timeline, and debug surfaces.
- Preserve append-safe audit and review history.
- Keep AI-assisted workflows supervised; do not introduce hidden automation or autonomous remediation.

## Protected Areas

Do not edit these unless the mission explicitly requires it:

- billing flows
- auth core
- screening provider adapters
- pricing and entitlement logic
- CI/CD and deployment configuration
- `firestore.rules`
- Terraform infrastructure
- public marketing content unrelated to the mission
- production data migration or schema rewrite paths

## Security and Privacy Rules

- Do not widen public access to internal routes.
- Do not widen tenant visibility into landlord/admin/support data.
- Do not expose raw Firestore IDs, unit IDs, lease IDs, landlord IDs, tenant IDs, storage paths, tokens, secrets, credentials, or provider payloads as user-facing labels or exports.
- Do not store unrelated PII in new collections or logs.
- Do not log raw sensitive payloads.
- Fail closed on ambiguous authorization, audience, ownership, or projection scope.
- Preserve audit integrity for immutable and append-safe logs.
- Preserve tenant consent and privacy boundaries.

## Workflow Rule

Follow `PROCESS.md` exactly:

1. Audit
2. Plan
3. Implement
4. QA / Verify
5. PR / Merge only with authorization

Do not skip directly to implementation.

## Validation Rule

Before declaring completion:

- run required build/test commands for the touched area
- run `git diff --check`
- confirm acceptance criteria
- confirm no unrelated files changed
- summarize changed files
- list known limitations honestly

Docs-only missions should still run lightweight validation such as `git diff --check`.

## Stop Conditions

Stop and report instead of proceeding when:

- the requested work conflicts with mission scope
- a required dependency or file is missing
- the change would require risky refactors outside scope
- production/security uncertainty cannot be resolved safely inside the mission
- auth, pricing, entitlement, payment, screening, Firestore rules, or deployment changes are needed but not authorized
- the issue may be stale deployment drift rather than code behavior
