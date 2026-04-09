# GitHub Actions Codex Phase 1

## What Phase 1 Includes

Phase 1 adds the first safe GitHub Actions automation layer for RentChain:

- a manual Codex mission runner for executing a mission spec on a named branch
- a standard CI workflow for backend and frontend verification
- a Codex PR review workflow that comments on pull requests when configured

The focus is workflow safety, repeatability, and repo-guided execution.

## What Phase 1 Intentionally Does Not Include

Phase 1 does not include:

- CI autofix loops
- auto-merge
- merge gates beyond normal CI visibility
- deployment approval automation
- infra mutation outside workflow files
- Slack, Linear, or other notification integrations

Existing legacy workflows remain in place in this phase. The new `ci.yml` is the Phase 1 baseline workflow, and consolidating older workflow overlap can happen in a follow-up mission.

## Workflows Added

### `codex-mission-runner.yml`

Purpose:

- lets a maintainer run Codex from `workflow_dispatch`
- requires a mission spec path and target branch
- seeds the target branch from a selected base branch
- installs repo dependencies before invoking Codex
- commits only when Codex actually changes files
- pushes only the requested target branch

Inputs:

- `mission_spec_path` required
- `target_branch` required
- `base_branch` optional, defaults to `main`

Behavior:

1. checks out the base branch
2. validates the mission spec and guidance files exist
3. installs backend and frontend dependencies with Node 20
4. checks out or creates the requested target branch
5. runs Codex with `AGENTS.md`, `PROCESS.md`, `codex.md`, and the mission spec as the core prompt context
6. commits only if there are changes
7. pushes the target branch

Safety constraints:

- no auto-merge
- no push to `main`
- no secret hardcoding
- no mission execution when `OPENAI_API_KEY` is missing

### `ci.yml`

Purpose:

- runs standard verification for pull requests and active working branches

Jobs:

- backend
  - Node 20
  - `npm ci`
  - `npm run test`
  - `npm run build`
- frontend
  - Node 20
  - `npm ci`
  - `npm run test`
  - `npm run build`

Push branches covered:

- `feat/**`
- `fix/**`
- `docs/**`
- `chore/**`
- `hotfix/**`
- `refactor/**`
- `perf/**`
- `harden/**`
- `test/**`

### `codex-pr-review.yml`

Purpose:

- runs a read-only Codex review on pull requests
- posts or updates a PR comment with the review summary

Trigger types:

- `opened`
- `synchronize`
- `reopened`
- `ready_for_review`

Behavior:

1. checks out the PR merge ref
2. fetches base and head refs for review context
3. skips safely when `OPENAI_API_KEY` is not configured
4. runs Codex in read-only mode when configured
5. posts or updates a single bot comment on the pull request

This workflow is intentionally non-blocking when the Codex review secret is absent.

## How To Trigger The Mission Runner

From GitHub:

1. open the `Actions` tab
2. choose `codex-mission-runner`
3. click `Run workflow`
4. enter:
   - `mission_spec_path`, for example `docs/specs/my-mission.md`
   - `target_branch`, for example `feat/my-mission`
   - optional `base_branch`, usually `main`
5. review the workflow summary and push result
6. open or update a pull request manually after review

## Required Secrets And Setup

Required secrets:

- `OPENAI_API_KEY`
  - required for `codex-mission-runner.yml`
  - required for live Codex execution in `codex-pr-review.yml`

Built-in token usage:

- `github.token`
  - used for push operations inside the mission runner
  - used for PR comments in the review workflow

Repository setup expectations:

- GitHub Actions must have permission to write contents for the mission runner workflow
- pull request comment permissions must be allowed for the review workflow
- target branches should be reviewed through normal PR flow

## What CI Verifies

The Phase 1 CI workflow verifies:

- backend dependency installation
- backend tests
- backend build
- frontend dependency installation
- frontend tests
- frontend build

The workflow uses the commands already established in the repo’s `package.json` files and pins Node to version 20.

## What Codex PR Review Does

Codex PR review:

- reviews pull request changes only
- follows repo guidance files
- runs in read-only mode
- comments on the pull request instead of modifying code
- skips safely if the API secret is missing

## Future Phase 2 Possibilities

Potential follow-up work for Phase 2:

- Codex-assisted CI autofix loops
- merge gate logic
- optional auto-merge after green verification and review policy checks
- workflow consolidation once the Phase 1 baseline is stable
