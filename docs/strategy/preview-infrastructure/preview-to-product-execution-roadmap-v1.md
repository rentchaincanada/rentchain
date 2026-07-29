# Preview-to-Product Execution Roadmap v1

## Purpose and authority

This document records the active execution order after completion of the B7
Vercel Preview OIDC identity foundation. It is a planning artifact only. It
does not authorize implementation, merge, deployment, Terraform apply, Vercel
configuration, Cloud Run mutation, production change, or modification of either
held product PR.

Repository `main` at this decision:
`966b0a08b805eda5378acc29f17cf4c577cc3995`.

## Current state

- The B7 Vercel Preview OIDC identity foundation is complete.
- Terraform state contains exactly 46 managed resources.
- The latest main-branch HCP result is 0 add, 0 change, 0 destroy, and
  0 actions.
- `rentchain-preview-backend` remains private.
- Production is untouched.
- PR #1453 is open, draft, behind `main`, and not merge-ready. Authenticated
  Preview QA has not been completed.
- PR #1435 is open, draft, behind `main`, and not merge-ready. Seeded
  authenticated tenant/landlord Preview QA remains pending.
- Operational Credits remains paused.

## Governing dependency chain

Vercel OIDC identity foundation
→ Vercel server-side proxy
→ Preview-only frontend routing
→ authenticated Preview runtime validation
→ PR #1453 reconciliation QA and merge
→ PR #1435 messaging QA and merge
→ later Operational Credits or other product work

Stages must proceed in this order. Completion of an earlier foundation is not
authorization to skip a later validation gate.

## Stage 1 — Vercel server-side proxy

Implement a Preview-only, same-origin Vercel Function route:

`/api/preview-backend/*`

Required architecture:

Preview browser
→ Vercel Function
→ Vercel OIDC
→ Google Workload Identity Federation
→ `vercel-preview-proxy` service account
→ private `rentchain-preview-backend`

Required boundaries:

- Cloud Run remains private.
- No long-lived Google credential or service-account key is introduced.
- No public Invoker binding is added.
- Browser code does not access private Cloud Run directly.
- Production and the landlord API remain unchanged.
- The initial proxy allowlist is limited to the minimum authenticated backend
  paths required for smoke testing.

## Stage 2 — Preview-only frontend routing

Route Preview frontend API calls through the same-origin proxy.

Required environment behavior:

- Preview: `VITE_API_BASE_URL=/api/preview-backend`
- Production: retain the existing absolute landlord API.
- Development: retain existing local behavior unless a separately approved
  implementation requirement proves a narrow change is necessary.

Implementation concerns:

- Narrowly update API-base validation only enough to accept the exact relative
  Preview path.
- Audit `vercel.json` rewrite precedence.
- Prove `/api/preview-backend/*` reaches the Vercel Function rather than the
  existing landlord API rewrite.
- Prove there is no production-routing regression.

## Stage 3 — Preview authentication/runtime smoke test

Complete authenticated runtime QA through the private Preview backend.

Minimum evidence:

1. A valid Preview login succeeds through the Vercel Preview frontend,
   same-origin proxy, and private Preview Cloud Run service.
2. Invalid credentials return the expected controlled error.
3. Logout succeeds.
4. Cloud Run logs contain the authenticated requests without exposing secrets.
5. Browser network traffic uses `/api/preview-backend/*`, not the production
   landlord API hostname.
6. Google OIDC and Workload Identity Federation token exchange succeeds.
7. No Google service-account key exists.
8. Cloud Run remains private.
9. Production remains untouched.

Record the exact deployment URL, commit SHA, Cloud Run revision, request path,
and supporting evidence. Stage 3 does not pass on configuration inspection
alone.

## Stage 4 — Rebase and QA PR #1453

Only after Stage 3 passes:

- update PR #1453 onto current `main`;
- preserve its intended product behavior;
- resolve conflicts from intervening infrastructure and frontend changes;
- rerun focused backend and frontend tests;
- rerun all required CI;
- deploy the updated PR head to Vercel Preview; and
- perform authenticated Preview QA against `rentchain-preview-backend`.

Required QA:

1. End an active lease.
2. Confirm the lease status changes correctly.
3. Confirm the linked unit becomes vacant.
4. Confirm stale tenant `currentLeaseId` is cleared.
5. Confirm the tenant list refreshes.
6. Confirm tenant detail refreshes.
7. Confirm failed reconciliation does not leave partial state.
8. Confirm desktop tenant panes scroll independently.
9. Confirm the mobile layout remains stacked and usable.
10. Confirm no production data repair or migration runs.

Do not merge until every required test, CI check, and authenticated Preview QA
step passes.

## Stage 5 — Merge PR #1453

After successful rebase, CI, and Preview QA:

- mark the PR ready;
- verify the final head and changed-file scope;
- merge with a merge commit;
- use an admin override only when `REVIEW_REQUIRED` is the sole blocker and all
  substantive checks and QA gates pass;
- synchronize `main`;
- delete the local and remote feature branch;
- confirm a clean working tree; and
- record the final pre-merge head and merge commit.

## Stage 6 — Rebase and QA PR #1435

Only after PR #1453 is merged:

- update PR #1435 onto the new `main`;
- resolve conflicts and outdated assumptions;
- rerun focused backend and frontend tests;
- rerun all required CI;
- deploy the updated head to Preview; and
- run seeded authenticated tenant/landlord QA.

Required QA:

1. A tenant sends a message.
2. The landlord unread badge updates.
3. Unified Inbox shows one projection-safe item for the conversation.
4. The item deep-links to the correct Messages conversation.
5. The landlord opens and reads the thread.
6. Unread state updates consistently.
7. The landlord replies.
8. The tenant receives the reply in the expected conversation.
9. Cross-landlord conversation isolation remains enforced.
10. Unsafe preview text and routing context remain sanitized.
11. No notification-system, pricing, billing, screening, payment, PAD, or
    Operational Credits expansion is introduced.

Do not merge until every required test, CI check, and seeded authenticated
Preview QA step passes.

## Stage 7 — Merge PR #1435

After successful rebase, CI, and Preview QA:

- mark the PR ready;
- verify the final head and changed-file scope;
- merge with a merge commit;
- use an admin override only when `REVIEW_REQUIRED` is the sole blocker and all
  substantive checks and QA gates pass;
- synchronize `main`;
- delete the local and remote feature branch;
- confirm a clean working tree; and
- record the final pre-merge head and merge commit.

## Stage 8 — Resume later product work

Only after PR #1453 and PR #1435 are merged and stabilized:

- reassess Operational Credits;
- resume other deferred product work only through explicit Founder priority;
- do not automatically start another product PR; and
- first provide a current-state recommendation and dependency review.

## Hold rules

Until Stages 1–3 are complete:

- PR #1453 remains draft and unmerged.
- PR #1435 remains draft and unmerged.
- Production QA does not substitute for Preview QA.
- Preview browser traffic does not route directly to private Cloud Run.
- Cloud Run does not receive public access.
- The landlord API is not repointed.
- Operational Credits implementation does not begin.

Until PR #1453 is merged, PR #1435 remains held except for read-only conflict
and freshness audit.

## Explicit non-authorization

This roadmap does not implement or authorize the Vercel Function proxy,
frontend routing, authentication smoke test, held-PR rebases, product QA,
merges, deployment, Terraform apply, cloud mutation, Vercel setting change,
production change, data mutation, or Operational Credits work. Each stage
requires its own scoped mission and applicable approval gates.
