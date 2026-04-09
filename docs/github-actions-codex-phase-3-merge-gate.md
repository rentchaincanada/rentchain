# GitHub Actions Codex Phase 3 Merge Gate

## What Phase 3 Adds

Phase 3 adds a guarded merge-gate workflow that evaluates whether a pull request is merge-ready under RentChain policy.

It provides:

- an explicit `merge-gate` check in GitHub
- a concise PR comment that explains missing requirements
- a policy layer that works alongside GitHub branch protection instead of replacing it
- optional merge queue compatibility through the `merge_group` event

## What Merge Gate Checks

The merge gate treats a PR as merge-ready only when all of the following are true:

1. the PR is not draft
2. the PR head branch is in the same repository
3. required CI checks are passing
4. there is no active blocking review state
5. there are no outstanding review requests
6. the maintainer approval label is present
7. no explicit blocking label is present

Current label policy:

- required approval label:
  - `maintainer-approved`
- blocking labels:
  - `do-not-merge`
  - `manual-review-required`

## How It Determines Required Checks

The workflow uses GitHub state as the source of truth where possible.

Primary behavior:

- it attempts to read required status check configuration from branch protection for the PR base branch

Fallback behavior:

- if that branch-protection metadata is not accessible with the workflow token, it falls back to the repo's current guarded CI check names:
  - `backend`
  - `frontend`

This keeps the gate usable without requiring elevated secret access while still aligning with the repo's current CI structure.

## What Phase 3 Intentionally Does Not Do

Phase 3 does not:

- auto-merge pull requests
- perform merges directly
- change branch protection rules
- override required reviews or required checks
- replace GitHub's protection model

The merge gate is an explicit readiness signal, not a merge executor.

## Relationship To Branch Protection

GitHub branch protection remains the primary enforcement mechanism.

The merge gate adds:

- a human-readable readiness check
- explicit policy around labels and blocking conditions
- a consistent signal that maintainers can use before merging

If branch protection and merge-gate disagree, branch protection still controls whether GitHub allows the merge.

## Merge Queue Notes

The workflow includes the `merge_group` event for merge queue compatibility.

Why:

- GitHub merge queues require required checks to run in merge queue context when those checks are part of the protected branch policy

Behavior in merge queue context:

- the workflow runs a compatibility path
- PR-level labels and review requirements are expected to have been satisfied before the PR entered the queue
- the workflow does not attempt to reconstruct full PR policy from merge queue context

## Maintainer Signals

Current maintainer-controlled approval signal:

- `maintainer-approved`

Current explicit block signals:

- `do-not-merge`
- `manual-review-required`

Maintainers should remove block labels and add the approval label only after reviewing the PR normally.

## Why Auto-Merge Is Not Included

Auto-merge is intentionally excluded in Phase 3 because this mission is about readiness signaling, not merge execution.

That keeps the system safer while the automation stack is still maturing:

- CI remains the check path
- autofix remains bounded
- maintainers still decide when to merge

## Future Phase 4 Possibilities

Potential future work could include:

- optional maintainer-triggered auto-merge after merge-gate passes
- tighter merge queue policy integration
- workflow consolidation once the phase stack is stable
