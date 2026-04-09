# GitHub Actions Codex Phase 2 Autofix

## Purpose

Phase 2 adds a bounded Codex-powered CI autofix loop on top of the Phase 1 workflow layer.

The goal is to let GitHub Actions attempt a single scoped repair pass after a failed `ci` workflow on a pull request branch, while keeping the safety boundaries explicit:

- no auto-merge
- no background infinite loops
- no broad branch writes
- no workflow bypass of repo guidance

## What Phase 2 Adds

Phase 2 adds:

- `codex-ci-autofix.yml`
- failed `ci` run detection through `workflow_run`
- failure-context gathering from the GitHub Actions API
- a bounded Codex repair attempt
- a scoped bot commit back to the same PR branch when a safe fix exists
- a PR comment describing the autofix outcome

## What Phase 2 Does Not Add

Phase 2 still does not include:

- auto-merge
- merge-gate approvals
- deployment automation changes
- repeated background retries outside GitHub’s natural workflow triggers
- product or application-scope changes unrelated to CI repair

## Trigger Model

The autofix workflow runs on:

- `workflow_run`
  - workflow: `ci`
  - type: `completed`

It proceeds only when the upstream `ci` run concludes with:

- `failure`
- `timed_out`
- `action_required`

It proceeds only for:

- pull requests associated with the failed run
- same-repository PR branches

It skips safely for:

- failed branch pushes with no PR
- fork-based PRs
- missing Codex secret configuration

## Bounded Repair Rules

Phase 2 uses a strict bounded model:

- one autofix workflow run per failed `ci` run
- one autofix attempt per PR by default
- commit only when actual changes exist
- push only to the PR head branch
- stop when no safe fix is produced

The default attempt cap is enforced through PR comment markers rather than labels or external state.

## Required Secrets And Permissions

Required secret:

- `OPENAI_API_KEY`

Workflow permissions:

- `actions: read`
- `contents: write`
- `issues: write`
- `pull-requests: write`

These permissions are intentionally narrower than a general admin workflow and are used only for:

- reading failed job details
- pushing a scoped autofix commit
- posting or updating a PR comment

## Autofix Flow

1. GitHub finishes a `ci` run
2. `codex-ci-autofix.yml` inspects the result
3. if the run failed and belongs to an eligible PR branch:
   - it gathers failing job and step context
   - installs repo dependencies
   - runs Codex with repo guidance plus failure context
4. if Codex produces a safe scoped diff:
   - the workflow commits it with a bot commit
   - pushes it back to the same PR branch
5. GitHub reruns CI naturally on the new commit
6. the workflow posts or updates a PR comment with the outcome

## Stop Conditions

The autofix workflow stops safely when:

- there is no associated PR
- the PR is from a fork
- `OPENAI_API_KEY` is missing
- the PR already reached the autofix attempt cap
- Codex cannot produce a safe scoped fix
- there are no file changes to commit

## Operational Notes

- The workflow comments on the PR using a stable marker so the latest autofix status is updated rather than spammed.
- The workflow does not merge PRs.
- The workflow does not open new PRs.
- The workflow does not attempt unlimited retries.

## Future Phase 3 Possibilities

Potential later work could include:

- richer autofix eligibility rules per failing job
- optional maintainer approval before applying a fix
- explicit merge-gate integration
- selective retry policies
