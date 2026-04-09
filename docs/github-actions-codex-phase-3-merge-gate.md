# GitHub Actions Codex Phase 3 Merge Gate

## What Phase 3 Adds

Phase 3 adds a guarded merge-gate workflow that evaluates whether a pull request is merge-ready under RentChain policy.

It provides:

- an explicit `merge-gate` check in GitHub
- a concise PR comment that explains missing requirements when comment writes are permitted
- a policy layer that works alongside GitHub branch protection instead of replacing it
- optional merge queue compatibility through the `merge_group` event

## Founder-Operated Policy

RentChain currently uses a founder-operated merge process.

That means the merge gate is designed to protect against true safety blockers while remaining compatible with direct founder judgment.

As a result:

- `maintainer-approved` is advisory only
- formal approved review is advisory only
- outstanding review requests are advisory only

These signals appear in the summary, but they do not fail the merge gate by themselves.

## Blocking Conditions

The merge gate fails only when one or more of the following are true:

1. the PR is draft
2. the PR head branch is not in the same repository
3. required CI checks are not passing
4. a blocking label is present
5. a blocking changes-requested review is still active
6. required check evaluation cannot be determined safely

Current blocking labels:

- `do-not-merge`
- `manual-review-required`

## Advisory Conditions

The merge gate may warn about these conditions without failing:

- missing `maintainer-approved` label
- no approved review decision
- outstanding review requests

These are advisory-only signals that support founder-operated judgment rather than replace it.

## How It Determines Required Checks

The workflow uses GitHub state as the source of truth where possible.

Primary behavior:

- it attempts to read required status check configuration from branch protection for the PR base branch

Fallback behavior:

- if branch-protection metadata is not accessible with the workflow token, it falls back to the repo's current guarded CI check names:
  - `backend`
  - `frontend`

## Relationship To Branch Protection

GitHub branch protection remains the primary enforcement mechanism.

The merge gate adds:

- a readable readiness signal
- explicit separation between blockers and advisories
- a founder-compatible policy layer for merge judgment

It does not replace GitHub’s merge controls.

## Merge Queue Notes

The workflow includes the `merge_group` event for merge queue compatibility.

In merge queue context:

- the workflow runs a compatibility path
- PR-level founder review signals are evaluated on PR events before queue entry
- the workflow does not attempt to reconstruct full PR policy inside merge queue context

## Comment Posting Behavior

Merge-gate comments are best-effort only.

- merge readiness evaluation remains the source of truth
- comment posting does not determine workflow success
- comment posting is skipped or downgraded safely when token permissions do not allow writes

## What Phase 3 Intentionally Does Not Do

Phase 3 does not:

- auto-merge pull requests
- perform merges directly
- change branch protection rules
- override required checks
- modify application code

## Future Phase 4 Possibilities

Potential future work could include:

- optional maintainer-triggered merge execution after merge-gate passes
- tighter merge queue policy integration
- workflow consolidation once the phase stack is stable
