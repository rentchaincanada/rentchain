# RC1 Application-To-Lease Continuity Audit v1

Branch: `audit/rc1-application-to-lease-continuity-v1`
Status: audit only, no implementation changes

## Executive Summary

No P0 RC1 demo blockers were found in the application-to-lease route cluster. The landlord can discover an application, open the Application Review Summary, inspect status-aware decision guidance, and then use the lease workspace to continue lease setup, summary, ledger, and workflow review.

The remaining gap is navigation continuity at the handoff point. The Application Review Summary now explains the lease transition state, lease preparation, execution readiness, signing readiness, and payment readiness, but it does not provide a clear action that carries the landlord into the lease workspace when the review state is ready for a lease step. This makes the page feel like a strong review artifact but a soft demo dead end.

Recommended next mission:

`polish/application-review-summary-lease-next-action-v1`

## Routes Reviewed

Primary route cluster:

- `/applications`
- `/applications/:applicationId/review-summary`
- `/leases`
- `/leases/:leaseId/summary`
- `/leases/:leaseId/ledger`
- `/leases/:leaseId/workflows/execution`
- `/leases/:leaseId/workflows/renewal`
- `/leases/:leaseId/workflows/notice`
- `/leases/:leaseId/workflows/deposit`
- `/leases/:leaseId/workflows/rent-increase`

## Source Files Reviewed

- `rentchain-frontend/src/pages/ApplicationsPage.tsx`
- `rentchain-frontend/src/pages/ApplicationsPage.test.tsx`
- `rentchain-frontend/src/pages/ApplicationReviewSummaryPage.tsx`
- `rentchain-frontend/src/pages/ApplicationReviewSummaryPage.test.tsx`
- `rentchain-frontend/src/pages/leaseFlowTransitionState.ts`
- `rentchain-frontend/src/pages/leasePreparationWorkspaceState.ts`
- `rentchain-frontend/src/pages/leaseExecutionReadinessState.ts`
- `rentchain-frontend/src/pages/leaseExecutionWorkspace.ts`
- `rentchain-frontend/src/pages/leaseSigningWorkspaceState.ts`
- `rentchain-frontend/src/pages/LandlordActiveLeasesPage.tsx`
- `rentchain-frontend/src/pages/LandlordActiveLeasesPage.test.tsx`
- `rentchain-frontend/src/pages/LandlordLeaseSummaryPage.tsx`
- `rentchain-frontend/src/pages/LeaseLedgerPage.tsx`
- `rentchain-frontend/src/pages/LandlordLeaseWorkflowPage.tsx`
- `rentchain-frontend/src/api/reviewSummaryApi.ts`
- `rentchain-frontend/src/api/applicationsApi.ts`
- `rentchain-frontend/src/api/leasesApi.ts`
- `rentchain-frontend/src/App.tsx`
- `docs/audit/rc1-demo-navigation-friction-v1.md`
- `docs/audit/application-review-summary-screening-status-consistency-v1.md`

## P0 Blockers

None found.

Current state is RC1-usable:

- `/applications` exposes `Open review summary` from the selected application detail header.
- `/applications/:applicationId/review-summary` has `Back to applications`, `Download PDF`, and safe Application Context.
- Review Summary status-aware guidance avoids pre-decision copy for approved/denied final states.
- Review Summary avoids raw application, property, unit, provider, screening reference, and internal IDs in the reviewed surfaces.
- `/leases` exposes `Lease summary`, `Payment ledger`, staged rent setup actions, and lease workflow buttons.
- `/leases/:leaseId/summary` exposes `Back to leases`, `Open payment ledger`, and `Open operations`.
- `/leases/:leaseId/ledger` exposes `Back to lease summary`, `Open operations`, print/export actions, and financial/obligation context.
- Lease workflow pages expose `Back to leases`, `Lease summary`, and `Payment ledger`.

## P1 Recommended Next PR

### `polish/application-review-summary-lease-next-action-v1`

Problem:

The Application Review Summary contains the clearest application-to-lease readiness explanation, but the page does not provide a visible route into the lease workspace when the application is approved or otherwise ready for the lease step. The Decision tab tells the landlord to move the file into the lease flow, but the user must infer that they should leave the page and open `/leases`.

Why it matters for RC1:

This is the most important handoff in the application-to-lease story. A demo operator should be able to narrate:

1. Review the application.
2. Confirm the application is approved or ready for the next step.
3. Continue into lease setup/workflow review.
4. Use lease summary, ledger, signing, and rent readiness surfaces from there.

Right now steps 1 and 2 are strong, and steps 3 and 4 are strong once reached, but the bridge between them is under-actioned.

Affected routes:

- `/applications/:applicationId/review-summary`
- indirect destination: `/leases`

Likely files:

- `rentchain-frontend/src/pages/ApplicationReviewSummaryPage.tsx`
- `rentchain-frontend/src/pages/ApplicationReviewSummaryPage.test.tsx`

Proposed minimal fix:

- Add a small lease-continuity action strip/card to the Application Review Summary, preferably near the top of the Decision tab or near the existing `Lease step` section.
- Show an action such as `Open leases workspace` or `Continue in leases`.
- Route to `/leases` unless the current review summary later exposes a safe exact lease route.
- Use honest helper copy:
  - `Use Leases to continue lease setup, execution readiness, signing, ledger, and rent-payment follow-through.`
  - `Exact lease routing appears only when a safe lease link is available.`
- Keep `Back to applications`, `Download PDF`, and current Decision tab content intact.
- Do not trigger conversion, lease creation, draft generation, notifications, signing, or payment setup from this PR.

Acceptance criteria:

- Review Summary shows a clear lease-next-action affordance when decision/lease-transition state is ready for a lease step or awaiting next lease action.
- The action routes to `/leases` and does not imply an exact lease record is already available.
- Submitted/review-required applications that are not ready for lease do not receive misleading lease-next-action copy.
- Approved/ready states retain retrospective/status-aware guidance.
- Existing PDF export is unchanged.
- Existing `Back to applications` and `Download PDF` actions still work.
- No raw application, property, unit, lease, provider, storage, or Firestore IDs are visible.
- Reduced desktop and mobile action rows wrap cleanly without horizontal overflow.

Risk level:

Low if frontend-only and limited to navigation/copy. The PR should not call conversion or lease-draft APIs.

## Route-by-Route Findings

### `/applications`

Status: healthy.

What works:

- The selected application detail header shows `Open review summary` when the selected application has a valid ID and review-summary access is allowed.
- Existing `Print / Save PDF` remains available.
- Status controls remain available for submitted/reviewable applications.
- Screening setup remains separate and does not replace the review summary action.
- Mobile-safe master/detail containers are covered by existing tests.

Friction:

- P3: There are two review-summary labels: `Open review summary` in the detail header and `Application review summary` in the screening area. This is understandable and not a blocker.
- P3: Application status can be changed from the Applications page, but the next lease step is most clearly explained on the Review Summary route. That split is acceptable for RC1 because Review Summary is now discoverable.

Recommended action:

Defer. Do not change `/applications` for the next PR unless Review Summary needs a small route-state query from the source page.

### `/applications/:applicationId/review-summary`

Status: strongest next polish target.

What works:

- First-screen summary shows applicant context, application status, property/unit context where safe values exist, submitted date, and screening posture.
- Application Context is safe and does not fall back to raw IDs.
- Status-aware screening guidance avoids prospective pre-decision prompts for approved/denied final states.
- Decision tab includes:
  - Decision workspace
  - Decision outcome
  - Lease step
  - Lease preparation
  - Move-in readiness
  - Lease execution workspace
  - Lease signing
  - Deposit / first payment
- `Back to applications`, `Download PDF`, and `Copy link` are present.

Friction:

- P1: Lease-transition panels are descriptive only. They say the file may be ready to move into the lease flow, but they do not provide a clear action into `/leases`.
- P2: `reviewSummaryApi` does not currently expose safe exact lease linkage or a related lease action. This means Review Summary cannot safely link to `/leases/:leaseId/summary` today without broadening backend projection.
- P2: The current safest route is a broad `/leases` handoff with honest copy. Exact lease routing can be deferred to a later backend-safe projection if needed.

Recommended action:

Implement `polish/application-review-summary-lease-next-action-v1`.

### `/leases`

Status: healthy destination once reached.

What works:

- Lease cards expose `Lease summary`.
- Lease cards expose `Payment ledger`.
- Staged rent setup actions, such as `Review rent terms`, route to `/leases/:leaseId/summary?section=rent-payment`.
- Workflow buttons route to distinct workflow routes for renewal, rent increase, notice, and deposit review.
- Occupied-unit reconciliation exposes `Convert to lease`, with date validation and tenant-notification gating from prior work.

Friction:

- P2: `/leases` supports lease continuation once the user arrives, but it is not clearly invoked from the Review Summary lease transition handoff.
- P3: The occupied-unit conversion workflow is separate from application approval/Review Summary and should not be conflated in copy.

Recommended action:

Use `/leases` as the safe broad destination for the Review Summary lease-next-action PR.

### `/leases/:leaseId/summary`

Status: healthy.

What works:

- Header actions expose `Open payment ledger`, `Back to leases`, and `Open operations`.
- Section query handling supports `?section=rent-payment` and highlights rent/payment workflow focus.
- This is the right destination once a safe lease ID is available.

Friction:

- P2: Review Summary cannot currently link here because it does not receive a safe related lease ID/action.

Recommended action:

Do not change this route in the next PR.

### `/leases/:leaseId/ledger`

Status: healthy.

What works:

- Header actions expose `Back to lease summary` and `Open operations`.
- Print/Save PDF includes actual ledger content.
- Decision context and obligation/payment views remain separate and clearer after prior fixes.

Friction:

- P3: Ledger is not part of the initial application-to-lease handoff unless the lease record exists and payment/obligation review is needed.

Recommended action:

No change for the next PR.

### Lease Workflow Routes

Status: healthy.

Reviewed route family:

- `/leases/:leaseId/workflows/execution`
- `/leases/:leaseId/workflows/renewal`
- `/leases/:leaseId/workflows/notice`
- `/leases/:leaseId/workflows/deposit`
- `/leases/:leaseId/workflows/rent-increase`

What works:

- Shared workflow page supports execution, rent review, notice readiness, deposit review, renewal, and move-out.
- Header actions expose `Back to leases`, `Lease summary`, and `Payment ledger`.
- Recent desktop container spacing polish keeps workflow pages centered and readable.

Friction:

- P3: These routes are useful after a lease is visible, but they are too specific for the first application-to-lease bridge.

Recommended action:

Do not link directly from Review Summary to a workflow route until a safe exact lease ID and workflow target are available.

## State And Action Mapping

| Application / review state | Current Review Summary behavior | Recommended action behavior |
| --- | --- | --- |
| Submitted / follow-up needed | Shows decision blockers and not-ready lease state. | Do not show a lease-next-action CTA beyond `Back to applications`. |
| Review-required / hold for later | Shows screening/review blockers and not-ready lease state. | Do not imply lease setup is ready. |
| Approved / ready for next step | Shows ready decision outcome and ready lease-step copy. | Show `Open leases workspace` with honest broad-destination helper copy. |
| Approved without exact lease projection | Shows ready lease-step copy but no route. | Route to `/leases`, not a guessed exact lease route. |
| Converted / safe lease projection available in future | Current Review Summary API does not expose it. | Future backend-safe follow-up could provide exact `/leases/:leaseId/summary` action. |

## Raw/Internal ID Findings

No raw IDs were observed in the reviewed primary route code paths for this audit.

Safety note:

The Review Summary API currently exposes safe application context fields but not a safe related lease action. The follow-up should not infer a lease route from an application ID, property ID, unit ID, tenant ID, raw Firestore ID, or hidden source reference.

## P2 Later Polish

### `fix/application-review-summary-safe-related-lease-action-v1`

Problem:

If the application has already been converted and a safe related lease exists, Review Summary cannot currently link directly to `/leases/:leaseId/summary` because the frontend summary contract does not expose a safe related lease action.

Minimal fix:

Add a backend-generated safe `relatedLeaseAction` or `leaseWorkspaceAction` to the Review Summary response only when authorized and safe. The action should include display copy and href, not raw lineage fields.

Risk:

Medium because it touches backend projection and would require Cloud Run parity QA.

### `polish/applications-review-summary-label-harmony-v1`

Problem:

`Open review summary` and `Application review summary` both point to the same concept from different areas of `/applications`.

Minimal fix:

Keep one primary label and one supporting label or helper copy.

Risk:

Low, frontend-only.

## P3 Optional Refinements

- Consider a query-param source marker such as `/leases?source=review-summary` only if the Leases page later uses it for honest contextual helper copy.
- Consider adding a secondary `Back to selected application` pattern if the Review Summary gains a safe source query, while preserving the current `/applications` fallback.
- Consider a future exact workflow action after the app-to-lease conversion path exposes safe lease status and workflow readiness.

## Validation Run

Recommended validation for this docs-only audit:

- `git diff --check`
- competitor-name scan on this audit artifact
- docs-only diff confirmation
- working tree clean confirmation

Recommended validation for `polish/application-review-summary-lease-next-action-v1`:

- `npm run test:single -- src/pages/ApplicationReviewSummaryPage.test.tsx`
- frontend build
- `git diff --check`

Manual QA for follow-up:

- `/applications`
  - select/open an approved or ready-for-next-step application
  - confirm `Open review summary` still works
- `/applications/:applicationId/review-summary`
  - confirm the Decision tab shows a clear lease-next-action affordance only when the record is ready for lease follow-through
  - confirm action routes to `/leases`
  - confirm copy does not imply exact lease routing unless a safe exact lease action exists
  - confirm `Back to applications`, `Download PDF`, and `Copy link` still work
  - confirm PDF output is unchanged
  - confirm no raw/internal/provider/storage IDs are visible
- Reduced desktop and mobile
  - confirm action rows wrap cleanly
  - confirm no horizontal overflow
- Regression:
  - `/applications`
  - `/leases`
  - `/leases/:leaseId/summary`
  - `/leases/:leaseId/ledger`
  - `/dashboard`
  - `/operations`

## Merge / Defer Recommendation

Merge this audit if the diff remains docs-only and validation passes.

Proceed next to:

`polish/application-review-summary-lease-next-action-v1`

Defer backend exact-lease routing until after the broad `/leases` handoff is tested in the RC1 demo path.
