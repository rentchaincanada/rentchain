# GitHub Actions Workflow Consolidation

## Final Workflow Stack

RentChain's consolidated GitHub Actions stack is:

- `ci.yml`
- `codex-mission-runner.yml`
- `codex-pr-review.yml`
- `codex-autofix-ci.yml`
- `merge-gate.yml`

These workflows are the authoritative automation layer for the current Phase 1, Phase 2, and Phase 3 model.

## Authoritative Workflows

### `ci.yml`

Purpose:

- runs the standard backend and frontend verification path for pull requests and active working branches

Authoritative checks:

- `backend`
- `frontend`

These are the stable CI job names intended to be used as required checks in branch protection.

### `merge-gate.yml`

Purpose:

- evaluates guarded merge readiness
- separates blocking conditions from founder-operated advisories
- runs in PR context and merge queue compatibility context

Authoritative check:

- `merge-gate`

This workflow is intended to be treated as a required readiness gate alongside the CI checks.

### `codex-pr-review.yml`

Purpose:

- runs Codex review on pull requests when configured

Policy:

- advisory only
- not intended as a required branch-protection check

### `codex-autofix-ci.yml`

Purpose:

- performs a bounded Codex autofix pass after failed CI runs on same-repo pull requests

Policy:

- operational only
- not intended as a required branch-protection check

### `codex-mission-runner.yml`

Purpose:

- lets a maintainer execute a mission spec on a target branch through `workflow_dispatch`

Policy:

- operational only
- not intended as a required branch-protection check

## Legacy Workflow Cleanup

The following legacy workflows were removed because their responsibilities were already covered by the authoritative stack:

- `api-build.yml`
- `ai-build.yml`

Why they were removed:

- `api-build.yml` duplicated the backend build path now covered by the `backend` job in `ci.yml`
- `ai-build.yml` duplicated the frontend verification path and backend build path now covered by `ci.yml`
- keeping them would create overlapping pull request checks with less clear naming and more branch-protection ambiguity

## Required Check Policy

The intended required checks after consolidation are:

- `backend`
- `frontend`
- `merge-gate`

These checks serve different purposes:

- `backend` validates the current trusted backend build path
- `frontend` validates frontend tests and frontend build
- `merge-gate` adds guarded merge-readiness evaluation on top of GitHub branch protection

Operational or advisory workflows that should generally not be configured as required checks:

- `codex-pr-review`
- `codex-autofix-ci`
- `codex-mission-runner`

## Transitional Notes

This consolidation is intentionally conservative:

- workflow names and stable CI job names were not renamed to avoid unnecessary branch-protection churn
- backend CI remains build-only because that is the repo's current trusted GitHub Actions contract
- Codex automation remains bounded and non-merging

## Known Limitations

- `merge-gate` still falls back to the `backend` and `frontend` check names when branch-protection metadata is not readable with the workflow token
- backend tests are still not part of the standard GitHub Actions baseline
- Codex review and autofix still depend on `OPENAI_API_KEY`

## Future Directions

Potential later work could include:

- branch-protection migration review if required check names ever need to change
- deeper CI consolidation only after required-check stability is confirmed
- optional future merge execution work only through a separate, explicit mission
