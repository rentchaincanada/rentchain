# Application Review Summary Decision Surface Simplification Audit v1

Branch: `audit/application-review-summary-decision-surface-simplification-v1`
Status: audit only, no implementation changes

## Executive Summary

No P0 RC1 demo blockers were found. PR #1325 fixed the correctness problem: approved and declined applications no longer show active pre-decision controls in the Application Decision Panel. The remaining issue is presentation hierarchy.

The browser Application Review Summary Decision tab now contains too many workflow-level panels for an application review surface. It includes decision workspace, decision outcome, lease transition, lease preparation, move-in readiness, lease execution, lease signing, deposit / first payment, decision support, and insights. Those sections are accurate and safe, but the combined first-pass experience is heavier than the cleaner exported PDF and can distract from the landlord's core question: "What was decided, why, and what should I do next?"

Recommended next mission:

`polish/application-review-summary-decision-tab-simplification-v1`

## Routes Reviewed

- `/applications/:applicationId/review-summary`
- `/applications`

## Source Files Reviewed

- `rentchain-frontend/src/pages/ApplicationReviewSummaryPage.tsx`
- `rentchain-frontend/src/pages/ApplicationReviewSummaryPage.test.tsx`
- `rentchain-frontend/src/components/applications/ApplicationDecisionSummaryCard.tsx`
- `rentchain-frontend/src/components/applications/ApplicationDecisionSummaryCard.test.tsx`
- `rentchain-frontend/src/components/applications/LandlordDecisionPanel.tsx`
- `rentchain-frontend/src/components/applications/LandlordDecisionPanel.test.tsx`
- `rentchain-frontend/src/pages/leaseFlowTransitionState.ts`
- `rentchain-frontend/src/pages/leasePreparationWorkspaceState.ts`
- `rentchain-frontend/src/pages/moveInReadinessWorkspaceState.ts`
- `rentchain-frontend/src/pages/leaseExecutionWorkspace.ts`
- `rentchain-frontend/src/pages/leaseSigningWorkspaceState.ts`
- `rentchain-frontend/src/pages/depositPaymentFlowState.ts`
- `rentchain-api/src/lib/reviewSummary.ts`

## P0 Blockers

None.

The page is RC1-usable:

- Approved/final application states now show recorded-decision copy instead of active decision buttons.
- Declined/final states also suppress active pre-decision controls.
- Non-final submitted/in-review states still preserve decision controls.
- `Back to applications`, `Download PDF`, and `Print / Save PDF` remain available where expected.
- Application context and screening copy remain landlord-facing and safe.
- No raw application, property, unit, provider, screening reference, or internal IDs were identified in the reviewed Decision tab structure.

## P1 Recommended Next PR

### `polish/application-review-summary-decision-tab-simplification-v1`

Problem:

The Decision tab is carrying both application-review content and detailed lease-readiness workflow previews. For a landlord reviewing the application decision, the page feels like several workspaces embedded into one tab. This is especially heavy after final approval, when the primary need is retrospective decision clarity plus a simple route toward lease follow-through.

Why it matters for RC1:

The Application Review Summary is now one of the most important enterprise/demo artifacts. It should feel authoritative and easy to narrate:

1. Applicant and application context.
2. Screening and decision posture.
3. Recorded decision or current decision controls.
4. Clear next action into the lease workspace when appropriate.

The current Decision tab satisfies these requirements but buries them among detailed lease execution, signing, and payment readiness sections that belong more naturally in `/leases` and lease workflow routes.

Affected route:

- `/applications/:applicationId/review-summary`

Likely files:

- `rentchain-frontend/src/pages/ApplicationReviewSummaryPage.tsx`
- `rentchain-frontend/src/pages/ApplicationReviewSummaryPage.test.tsx`
- Possibly `rentchain-frontend/src/components/applications/ApplicationDecisionSummaryCard.tsx` only if a small prop or presentation hook is needed.

Proposed minimal fix:

- Keep the primary Decision tab surface focused on:
  - Decision workspace/status
  - Decision outcome
  - Recorded final-state copy or active controls from `ApplicationDecisionSummaryCard`
  - `Continue lease follow-through` action when `shouldShowLeaseWorkspaceAction(...)` is true
  - Insights
- Keep lease continuity visible, but make it compact:
  - Show a short `Lease follow-through` summary card with the broad `/leases` CTA.
  - Keep copy honest that the Review Summary does not create a lease or infer an exact lease record.
- Move detailed lease workflow panels behind a secondary disclosure/details block:
  - Lease step
  - Lease preparation
  - Move-in readiness
  - Lease execution workspace
  - Lease signing
  - Deposit / first payment
- Default that disclosure closed on desktop, reduced desktop, and mobile.
- Do not change PDF/export behavior.
- Do not change backend summary builders, screening state, lease workflow state, or application decision logic.

Suggested labels:

- Primary card: `Lease follow-through`
- CTA: `Continue to lease workspace`
- Disclosure: `Show lease readiness details`
- Helper: `Detailed lease readiness belongs in the lease workspace. This summary keeps the application decision context and the next safe handoff visible.`

Acceptance criteria:

- Decision tab first pass shows decision status/outcome, final-state copy or active controls, and lease follow-through without requiring the landlord to scan through multiple lease workflow panels.
- Approved/final states remain retrospective and do not show `Approve`, `Reject`, or `Request More Info`.
- Submitted/in-review/review-required states still show appropriate decision controls.
- `Continue lease follow-through` remains available when existing lease-transition state supports it.
- Detailed lease-preparation, move-in, execution, signing, and deposit/payment sections remain available behind a details/disclosure control.
- PDF/export content remains unchanged.
- `Back to applications`, `Download PDF`, and source route behavior remain unchanged.
- Reduced desktop and mobile stay readable with no horizontal overflow.
- No raw/internal/provider/storage IDs are visible.

Risk level:

Low to medium. This is frontend presentation hierarchy, but it touches a high-value route and several nested sections. Keep the implementation narrow and test the tab rendering carefully.

## Primary Sections To Keep Visible By Default

Keep these visible on the Decision tab:

- `Decision workspace`
- `Decision status`
- `What is still missing`
- `Next steps`
- `Decision outcome`
- `Outcome blockers`
- `Outcome next steps`
- `Continue lease follow-through` when lease transition state supports it
- `Application decision support`
- `Landlord Decision Panel`
- `Insights`

Reason:

These sections answer the actual application-review question and preserve the post-#1325 final-state behavior. They are also easier to narrate in an enterprise demo.

## Sections To Collapse Or Defer

Move these sections behind a default-closed details area or defer their full rendering to `/leases`:

- `Lease step`
- `Lease preparation`
- `Move-in readiness`
- `Lease execution workspace`
- `Lease signing`
- `Deposit / first payment`

Reason:

These sections are useful, but they represent downstream lease workflow readiness rather than the application decision itself. Their current inline expansion makes the Decision tab feel like a full lease operations workspace and dilutes the review artifact.

Recommended hierarchy:

- Keep one compact lease handoff card visible.
- Put detailed lease readiness panels under `Show lease readiness details`.
- Use `/leases` as the broad safe destination for actual follow-through.

## Browser Vs PDF Comparison

The PDF/export structure is cleaner because it keeps decision content as curated sections:

- `Application Context`
- `Applicant Overview`
- `Employment & Income`
- `Screening & Deterministic Signals`
- `Risk & Decision Guidance`
- `Notes & Flags`
- `Insights`

The PDF does not expand lease preparation, move-in readiness, lease execution, signing, and deposit/payment panels inline. That makes the PDF easier to scan as an application review artifact.

Recommendation:

- Preserve the PDF/export structure exactly.
- Bring the browser Decision tab closer to the PDF's hierarchy by keeping application decision content primary and lease workflow details secondary.

## Final-State Behavior Check

PR #1325 resolved the correctness issue:

- Approved/final state: active pre-decision controls are hidden.
- Declined/final state: active pre-decision controls are hidden.
- Non-final state: active controls remain available.

The simplification PR should not change that behavior. It should only reduce visual overload around the surrounding Decision tab sections.

## Mobile And Reduced Desktop Findings

The current sections use responsive grids and wrapping action rows, so no specific mobile P0 was identified from source review. The issue is density and comprehension, not a known overflow bug.

Mobile/reduced desktop risk:

- A long sequence of lease workflow cards creates excessive vertical scrolling.
- The user can lose the application decision context before reaching the actual decision support panel.
- A default-closed details block is the safest mobile improvement because it preserves access without forcing every downstream workflow into the main scroll path.

## P2 Later Polish

- Consider renaming `Decision workspace` to `Application decision` if manual QA finds the workspace term too broad.
- Consider adding a small source-aware `Back to applications` action inside the Decision tab body, not only in the page header.
- Consider a future backend-safe related lease action if Review Summary can expose a landlord-safe exact lease route. Do not do this in the simplification PR.

## P3 Optional Refinements

- Tune card spacing and section headings after the disclosure change.
- Add a compact count summary for hidden lease readiness sections, such as `6 lease readiness sections available`.
- Add a `View in Leases` secondary action inside the details block.

## Validation For This Audit

Required for this docs-only PR:

- `git diff --check`
- `git diff --cached --check`
- Competitor-name scan
- Docs-only diff confirmation
- Working tree clean after publish

## Recommended Implementation Validation

For `polish/application-review-summary-decision-tab-simplification-v1`:

- `npm run test:single -- src/pages/ApplicationReviewSummaryPage.test.tsx`
- `npm run test:single -- src/components/applications/ApplicationDecisionSummaryCard.test.tsx src/components/applications/LandlordDecisionPanel.test.tsx` if shared card/panel props are touched.
- `npm run build` in `rentchain-frontend`
- `git diff --check`
- Manual QA:
  - Approved `/applications/:applicationId/review-summary`
  - Submitted/in-review `/applications/:applicationId/review-summary`, if available
  - Mobile/reduced desktop Decision tab
  - `Download PDF`
  - `Back to applications`
  - `/applications`
  - `/leases`

## Merge/Defer Recommendation

Merge this audit as docs-only if validation passes.

Then proceed to:

`polish/application-review-summary-decision-tab-simplification-v1`
