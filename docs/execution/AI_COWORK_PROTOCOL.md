# AI Cowork Protocol

## 1. Purpose

This protocol defines how RentChain uses AI coworkers inside the VS Code, Dev Container, and sandbox workflow. It clarifies role ownership, authority boundaries, QA handoffs, deployment verification, and stop conditions for ChatGPT/Orion, Codex, Claude, Playwright, GitHub, Vercel, and Cloud Run.

The goal is to reduce mission friction while preserving RentChain's existing engineering rules:

- one active mission at a time
- audit before implementation
- scoped changes only
- deterministic validation
- operator-controlled approval, merge, and deployment decisions

This document extends `AGENTS.md`, `PROCESS.md`, `codex.md`, and the active mission file. It does not replace them.

## 2. Operating Model

RentChain cowork uses a commander, implementer, auditor, deterministic browser runner, and deployment truth model.

The normal operating loop is:

1. Orion/ChatGPT or the operator defines the active mission.
2. Codex audits the repo, implements scoped changes, runs local validation, and opens a PR.
3. Claude independently inspects, tests, and reports risks or root causes when requested.
4. Playwright performs deterministic browser QA where UI behavior, responsive layout, auth flow, or preview behavior matters.
5. GitHub PRs remain the code review and required check source of truth.
6. Vercel previews prove frontend deployment state.
7. Cloud Run revision and image checks prove backend deployment state.
8. Orion/operator interprets QA findings and gives explicit merge or deploy authorization.

No agent should treat another agent's output as final authority without PR checks, deterministic validation, and operator approval where the action changes repository or deployment state.

## 3. Role Ownership

### Orion / ChatGPT

Orion/ChatGPT owns mission command, product strategy, sequencing, QA interpretation, and merge decision support.

Responsibilities:

- define the active mission and branch
- interpret preview QA findings
- decide whether a finding is blocking, non-blocking, or future scope
- authorize merge overrides when appropriate
- authorize deployment or production-impacting actions
- keep future roadmap private until a mission is activated

### Codex

Codex owns implementation inside the local workspace.

Responsibilities:

- read required governance docs before edits
- inspect source-of-truth files before implementation
- edit files locally
- run targeted tests, builds, and diff checks
- commit scoped changes
- push branches and open PRs
- report validation results, changed files, risks, and limitations

Codex must not merge or deploy without explicit operator authorization.

### Claude

Claude owns independent audit, root-cause review, and sandbox QA assessment when requested.

Responsibilities:

- inspect implementation from a separate review stance
- verify assumptions and route/code paths
- identify likely root causes for failing QA
- recommend targeted fixes
- report findings without mutating production state

Claude should not implement, merge, or deploy unless the operator explicitly assigns that role in a controlled workflow.

### Playwright

Playwright owns deterministic browser QA.

Responsibilities:

- exercise preview URLs using repeatable browser steps
- capture screenshots, traces, console output, and network evidence where applicable
- verify responsive layouts, auth redirects, route-source behavior, and user-visible state
- avoid production mutation unless the operator explicitly authorizes a safe test flow

### GitHub PRs

GitHub PRs are the code review and required check source of truth.

Responsibilities:

- hold the branch diff
- run required checks
- record review status
- expose mergeability and protection state
- preserve discussion and audit trail

Merge readiness depends on real required delivery checks, not local optimism.

### Vercel and Cloud Run

Vercel and Cloud Run are deployment truth surfaces.

Responsibilities:

- Vercel proves frontend preview deployment state.
- Cloud Run proves backend revision, image, and traffic state.
- Neither surface alone proves full-stack freshness.

For backend changes, a green Vercel preview does not prove Cloud Run is serving the PR or merged backend code.

## 4. Authority Boundaries

Codex may:

- edit files in scope
- run local commands and validation
- create commits
- push branches
- open PRs
- inspect PR checks
- report merge readiness

Claude may:

- inspect code
- run tests in an approved sandbox
- review PR diffs
- perform root-cause analysis
- report pass/fail evidence

Codex and Claude must not:

- merge PRs without explicit operator authorization
- deploy to production or preview infrastructure without explicit operator authorization
- mutate production data from sandbox
- expose secrets or raw sensitive payloads
- create uncontrolled agent-to-agent loops
- widen permissions, auth, or access outside mission scope

The operator controls final approval, merge authorization, deployment authorization, and production-impacting decisions.

## 5. Mission Workflow

Every mission follows the `PROCESS.md` loop: Explore, Plan, Implement, Verify.

### 5.1 Mission Prompt

The operator provides:

- expected branch
- objective
- scope
- guardrails
- files or areas to inspect
- validation commands
- manual QA requirements
- output requirements

If the prompt conflicts with repository governance, Codex stops and reports the conflict.

### 5.2 Audit

Codex inspects:

- `AGENTS.md`
- `PROCESS.md`
- `codex.md`
- current mission spec or operator prompt
- source-of-truth files for the touched area
- existing tests and docs relevant to the mission

Codex reports what it found before or during the final summary.

### 5.3 Implementation Plan

Codex defines:

- exact files expected to change
- tests/builds to run
- data, route, projection, or UI boundaries
- explicit non-goals
- risks that could force a split mission

### 5.4 Tests and Build

Codex runs the smallest relevant validation set first, then broader checks where practical.

Required validation normally includes:

- targeted tests for touched files
- relevant package build
- `git diff --check`
- docs lint if a docs-only mission has one available

If validation cannot run, Codex reports the blocker and does not claim completion.

### 5.5 PR

Codex opens a PR after:

- scoped changes are committed
- validation has passed or known failures are disclosed
- branch is pushed
- PR body documents summary, root cause, safety, validation, and limitations

### 5.6 Preview QA

Preview QA is required when the mission affects:

- frontend UI
- routing
- auth flow
- deployment behavior
- API surface consumed by preview UI
- mobile/responsive layout
- tenant, landlord, admin, or support user-visible behavior

Preview QA may be skipped for pure helper, test, or docs missions when no runtime behavior is changed.

### 5.7 Merge

Merge is allowed only when:

- required checks are green
- blocking QA findings are resolved
- review status is satisfied or operator authorizes an admin override
- scope remains limited
- operator explicitly authorizes merge

Codex must not merge autonomously.

### 5.8 Post-Merge Cleanup

After authorized merge, Codex may:

- sync local `main`
- delete local and remote feature branches
- confirm clean working tree
- report merge commit and final status

Backend missions require Cloud Run verification when backend deployment freshness matters.

## 6. Sandbox Rules

Use the Dev Container or approved local sandbox where possible.

Rules:

- do not commit secrets, tokens, credentials, `.env` values, or key material
- do not store agent credentials in the repo
- do not run production writes from sandbox unless explicitly authorized
- do not use sandbox access to bypass auth, policy, or Firestore rules
- do not create uncontrolled Codex-to-Claude or Claude-to-Codex loops
- do not let one agent automatically approve, merge, or deploy another agent's work
- keep generated artifacts out of the repo unless they are intentional deliverables
- prefer deterministic commands over ad hoc manual state changes

Sandbox permissions must remain narrow and task-specific.

## 7. QA Workflow

Codex builds and fixes.

Claude independently tests or reviews when requested.

Playwright captures deterministic browser evidence where applicable:

- screenshots
- traces
- console errors
- network responses
- route-source headers
- viewport-specific layout evidence

Orion/operator decides pass/fail status.

QA findings are classified as:

- blocking: must be fixed before merge
- non-blocking: documented and allowed to follow up
- out of scope: split into a future mission
- environment drift: deployment, cache, auth, or revision mismatch to resolve before judging code

Agents should not dismiss QA evidence because local tests pass. Local tests and preview QA answer different questions.

## 8. Deployment Verification

Vercel preview proves frontend preview state only.

For backend changes, confirm Cloud Run directly:

- active revision name
- revision creation timestamp
- service image tag or digest
- expected commit or build identifier where available
- traffic allocation, ideally 100 percent to the expected revision
- route or payload behavior from the expected backend revision

If Vercel is current but Cloud Run is stale, backend QA may show false failures. In that case:

1. stop projection or API coding
2. confirm deployed revision and image
3. deploy or sync the expected backend revision when authorized
4. retest authenticated payloads after Cloud Run is current

Deployment truth must be reported with concrete revision and traffic evidence when backend freshness is part of the issue.

## 9. Required Mission Output Template

Every mission report should include the relevant subset of:

1. Branch name
2. Docs and source files inspected
3. Audit findings
4. Files changed
5. Implementation summary
6. Safety and projection/auth boundaries preserved
7. Tests and build commands run
8. Results
9. Manual QA status or reason manual QA was not required
10. Preview URL when applicable
11. PR link
12. Check status
13. Merge status when authorized
14. Post-merge cleanup status when authorized
15. Known limitations
16. Recommended next mission

Reports must distinguish local validation, PR checks, preview QA, and deployment verification.

## 10. Escalation and Split-Scope Rules

Stop and report before continuing when:

- the requested fix requires protected areas outside mission scope
- auth, payments, pricing, screening, Firestore rules, or deployment config would need changes without explicit authorization
- production data mutation appears necessary
- a route or projection issue may actually be stale deployment drift
- a QA finding belongs to a different product area
- a dependency or lockfile change would be required for a docs/tooling mission
- a broad refactor is required to solve a narrow bug

Create a follow-up mission when:

- the issue is real but not blocking the active mission
- the fix requires separate manual QA
- the change touches a different role, route family, or data boundary
- the work would make the current PR harder to review safely

## 11. Non-Goals

This protocol does not:

- grant agents autonomous merge authority
- grant agents autonomous deploy authority
- define production incident response authority
- replace GitHub PR review or required checks
- replace Cloud Run revision verification for backend changes
- permit secret sharing through repository files
- create a new CI pipeline
- change product runtime behavior
- create a general-purpose raw debug console

## 12. Future Roadmap

Future cowork improvements may include:

- Dev Container foundation for Codex, Claude, and Playwright workflows
- lightweight Playwright smoke scripts for tenant, landlord, and admin previews
- Cloud Run deployment verification checklist
- standardized preview QA evidence folders that avoid secrets and raw payloads
- operator dashboard for mission status, PR status, preview URLs, and backend revision state
- clearer split between docs-only, helper-only, frontend, backend, and full-stack mission templates

Each roadmap item must be activated as its own scoped mission before implementation.
