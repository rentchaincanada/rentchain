# PROCESS.md

## Mandatory Workflow

Every mission must follow this loop:

1. Audit
2. Plan
3. Implement
4. QA / Verify
5. PR and merge only with explicit authorization

Do not skip steps.

Mission execution follows the mission promotion pipeline: only the active operator-approved mission is executed. Future roadmap remains strategic context until explicitly activated.

## Repository Discovery

All missions inherit the repository discovery and governance-resolution rules from `codex.md` when `codex.md` exists.

Mission prompts should not repeat generic repository bootstrap instructions unless the mission has specialized audit requirements.

If `codex.md` is absent, Codex should follow the nearest available process/governance document and document assumptions.

## 1. Audit

Before editing:

- inspect relevant files
- inspect existing patterns
- identify touched routes, services, schemas, docs, tests, and surfaces
- identify dependencies and constraints from `codex.md`, `AGENTS.md`, and the mission prompt
- inspect relevant `.codex/docs/*` only if needed for that domain
- confirm whether the mission is docs-only, frontend-only, backend-only, or full-stack
- identify projection, auth, privacy, audit, and deployment risks

Output expected in summary:

- files reviewed
- existing pattern identified
- risks/dependencies found
- whether manual preview QA is required

## 2. Plan

Before coding or editing:

- define the exact files to change
- define route/schema/data/doc/test approach
- define what is explicitly out of scope
- confirm how acceptance criteria will be verified
- decide whether frontend, backend, mobile, Playwright, Cloud Run, or manual QA is required
- identify split-scope candidates before implementation begins

Output expected in summary:

- implementation plan
- file list
- test/build/QA plan
- known risks

## 3. Implement

During implementation:

- keep changes scoped to the mission
- preserve repo conventions
- avoid unrelated refactors
- prefer deterministic logic
- preserve security boundaries
- preserve projection-safe read models
- preserve append-safe operational history
- add/update tests with code changes
- keep docs aligned with current implementation and clearly label future direction

Rules:

- no hidden scope expansion
- no "while I am here" changes
- no placeholder-only implementation
- no broad rewrites without mission-level justification
- no autonomous remediation or hidden workflow execution
- no tenant visibility widening
- no raw ID or sensitive payload exposure

## 4. QA / Verify

Before completion:

- run relevant targeted tests
- run relevant build commands
- run `git diff --check`
- confirm acceptance criteria
- confirm no unrelated files changed
- summarize known limitations honestly

Preview/manual QA is required when the mission affects:

- frontend rendering
- mobile layout
- auth flow
- routing
- API behavior consumed by preview UI
- tenant, landlord, admin, or support user-visible behavior

Cloud Run verification is required when backend freshness affects QA. Vercel preview freshness does not prove Cloud Run backend freshness.

Output expected in summary:

- commands run
- results
- files changed
- manual QA status or reason it was not required
- limitations
- next recommended mission

## 5. PR and Merge

Codex may open PRs after scoped validation. Codex must not merge without explicit operator authorization.

Before merge:

- required checks must be green
- blocking QA findings must be resolved
- diff scope must still match the mission
- review protection must be satisfied or operator-approved override must be explicit

After authorized merge:

- sync local `main`
- delete local and remote feature branch
- confirm clean working tree
- report merge commit and cleanup status

## Completion Standard

A mission is complete only when:

- implementation matches scope
- acceptance criteria are satisfied
- verification was actually performed
- remaining issues are disclosed honestly
- source-of-truth and Claude/reference docs do not overclaim production status

## Failure Standard

If verification cannot be completed:

- say so clearly
- explain what blocked it
- distinguish local test failure, PR check failure, preview QA failure, and deployment drift
- do not claim completion

`merge-gate` must only fail on actual failed required checks, not on pending checks. Merge safety depends on real required PR delivery checks; `merge-gate` remains supplemental.
