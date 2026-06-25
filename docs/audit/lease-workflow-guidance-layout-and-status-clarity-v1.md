# Lease Workflow Guidance Layout And Status Clarity Audit v1

Branch: `audit/lease-workflow-guidance-layout-and-status-clarity-v1`
Scope: audit and documentation only; no UI, API, schema, vacancy automation, PAD, screening, or Operations persistence changes.

## Purpose

This audit reviews the lease workflow guidance pages for RC1 demo readiness, layout clarity, lifecycle status clarity, and operator comprehension.

The reviewed workflow routes are:

- `/leases/:leaseId/workflows/renewal`
- `/leases/:leaseId/workflows/rent-increase`
- `/leases/:leaseId/workflows/notice`
- `/leases/:leaseId/workflows/execution`
- `/leases/:leaseId/workflows/deposit`

## Enterprise Validation Filter

This mission advances:

- Revenue: renewal and lease workflow clarity supports the one-building pilot story from renewal review through occupancy operations.
- Operational efficiency: operators should understand the lease-level workflow state without switching between unrelated pages to decode missing fields.
- Enterprise readiness: enterprise demos need clear workflow ownership, safe guidance language, and consistent page layout.
- Customer validation: the audit distinguishes current implemented behavior from follow-up polish needed for RC1 demo confidence.

## Files Reviewed

Frontend:

- `rentchain-frontend/src/pages/LandlordLeaseWorkflowPage.tsx`
- `rentchain-frontend/src/pages/LandlordLeaseWorkflowPage.test.tsx`
- `rentchain-frontend/src/pages/LandlordActiveLeasesPage.tsx`
- `rentchain-frontend/src/pages/landlord/PortfolioHealthSummaryPage.tsx`
- `rentchain-frontend/src/api/leasesApi.ts`
- `rentchain-frontend/src/api/landlordLeaseRenewalApi.ts`
- `rentchain-frontend/src/lib/leases/leaseLifecycle.ts`

Backend:

- `rentchain-api/src/routes/leaseRoutes.ts`
- `rentchain-api/src/routes/leaseNoticeLandlordRoutes.ts`
- `rentchain-api/src/services/leaseLifecycle/deriveLeaseLifecycleSummary.ts`
- `rentchain-api/src/services/leaseNoticeWorkflowService.ts`

Related audit:

- `docs/audit/lease-renewal-route-visibility-v1.md`

## Current Behavior By Workflow Page

All five workflow pages are rendered by `LandlordLeaseWorkflowPage.tsx` and differ mainly by workflow configuration.

| Workflow | Current facts shown | Current guidance | Audit finding |
| --- | --- | --- | --- |
| Renewal | Lease end, lifecycle, days until end | Renewal review checklist, jurisdiction context, link to portfolio renewal inputs | Correct route and workbench link now exist, but lifecycle and days may show unavailable even when lease end is visible. |
| Rent increase | Monthly rent, lease end, payment readiness | Rent review checklist and jurisdiction context | Useful basic context; still inherits the same page layout constraints and generic jurisdiction language. |
| Notice | Lease status, lifecycle, next action | Notice readiness checklist and jurisdiction context | Depends on `leaseLifecycleSummary` for lifecycle and next action, so missing summary weakens the page. |
| Execution | Execution status, tenant signature, lease document | Execution checklist and jurisdiction context | Page opens, but the unframed header/action area can feel visually loose; QA flagged width/container clarity. |
| Deposit | Property, tenant, lease dates | Deposit checklist and jurisdiction context | Least dependent on lifecycle summary; still benefits from consistent workflow page framing. |

## Source Of Truth For Lease End, Lifecycle, And Days

### Lease End

Source of truth: lease record date fields, primarily `lease.endDate`.

Current flow:

- Backend `GET /api/leases/:id` loads a landlord-scoped lease through `getLeaseEntityForLandlord(...)`.
- The route returns `enrichLeaseRow(...)`.
- Frontend `getLeaseById(...)` loads that route.
- `LandlordLeaseWorkflowPage` displays `formatDate(lease.endDate)`.

This explains why the QA lease can show `Lease end: July 31, 2026`.

### Lifecycle Status

Source of truth: derived lifecycle summary from lease fields and latest lease notice state.

Current derivation exists in:

- `rentchain-api/src/services/leaseLifecycle/deriveLeaseLifecycleSummary.ts`
- `rentchain-api/src/routes/leaseRoutes.ts` inside `listLandlordLeaseRows(...)`
- `rentchain-api/src/routes/leaseNoticeLandlordRoutes.ts` inside `/api/landlord/leases/expiring`

Current gap:

- `GET /api/leases/:id` returns `enrichLeaseRow(...)` directly.
- The single lease detail response does not attach `leaseLifecycleSummary`.
- The workflow page reads `lease.leaseLifecycleSummary?.lifecycleLabel`.
- When the single detail projection lacks that summary, the UI falls back to `Lifecycle status unavailable`.

This is a projection mismatch, not a missing lease end date and not a new data model need.

### Days Until End

Source of truth: `deriveLeaseLifecycleSummary(...)` computes `daysUntilExpiry` from `leaseEndDate` or `endDate` when the lease end is in the future.

Current gap:

- The workflow page only reads `lease.leaseLifecycleSummary?.daysUntilExpiry`.
- It does not derive a local fallback from `lease.endDate`.
- Therefore a visible future lease end date can still render `Days until end: Not available` when the detail projection omits `leaseLifecycleSummary`.

This should be fixed by adding the lifecycle summary to the single lease detail projection and optionally adding a small frontend fallback for days until end when `endDate` is present but the summary is absent.

## UI Or Data Classification

The known renewal status mismatch is primarily a backend projection issue with a small frontend resilience component.

It is not caused by:

- a missing standalone renewal route
- a new collection requirement
- a missing renewal data model
- vacancy automation
- PAD, screening, or external integrations

It is caused by:

- list and renewal workbench routes deriving lifecycle summary
- the single lease detail route not projecting the same summary
- the workflow page relying on that summary without a lease-end fallback for the days count

## Layout And Scanability Findings

Current implementation:

- The workflow page root uses a simple grid with `maxWidth: 920`.
- Header, purpose copy, and action links are unframed.
- Lease facts, checklist, renewal inputs, and jurisdiction context use bordered panels.
- There is no top-level workflow shell/card that visually groups the page inside the landlord layout.

QA implication:

- The execution workflow can appear visually borderless or under-contained, especially at wider viewport widths.
- The five workflow pages share logic, so one targeted layout pass can improve all pages together.
- The existing panel pattern is close to acceptable; this does not require a leases workspace redesign.

Recommended layout direction:

- Keep the current route and workflow config model.
- Add a consistent workflow page shell with constrained width, clear panel grouping, and responsive spacing.
- Keep cards at 8px radius or less.
- Avoid nested card-heavy redesign.
- Preserve the existing Back to leases, Lease summary, and Ledger actions.

## Wording And Operator Clarity Findings

Current safe wording:

- The page clearly says workflow guidance is operational only.
- It tells operators to verify provincial requirements.
- It does not overclaim legal compliance or automated enforcement.

Clarity gaps:

- Missing lifecycle summary reads like missing data rather than derived status not projected.
- `Days until end: Not available` conflicts with a visible lease end date.
- Jurisdiction context fallback says no specific policy is available, but the page title and source surface can imply NS Workflow Guidance exists elsewhere.
- The renewal workflow now links to portfolio renewal inputs, but the page should make source ownership clearer: lease-level page for execution context, portfolio health for batch/operator input editing.

Recommended wording direction:

- Replace generic unavailable lifecycle copy with explicit fallback states.
- If lifecycle summary is unavailable but lease end exists, show a deterministic days-until-end fallback or a clear "Lifecycle summary not available for this lease detail yet" message.
- Label the portfolio-health link as the current operator-input workbench, not a duplicate workflow.

## Current Data Ownership Model

Keep the existing source-of-truth model:

- Lease record owns lease dates, lifecycle-relevant status, renewal operator inputs, renewal outcome, and move-out state.
- Lease notice records own notice dispatch, tenant response, no-response timing, and notice evidence.
- `deriveLeaseLifecycleSummary(...)` owns lifecycle summary derivation.
- Portfolio Health owns portfolio-level renewal workbench and batch operator inputs.
- Lease workflow pages own lease-level workflow guidance and execution context.

Do not create:

- a new renewal collection
- a standalone renewal data model
- a separate workflow status model for the five pages

## Single Mission Or Split Missions?

Recommendation: one narrow implementation mission can fix the RC1 workflow guidance issue if it stays tightly scoped.

The projection and layout problems appear together on the same workflow pages, and the backend work is limited to reusing existing lifecycle summary derivation on the single lease detail projection. A single follow-up can be reviewable if it avoids broader leases workspace changes.

Do not include:

- Operations reviewer assignment persistence
- Operations navigation visibility
- vacancy scheduling
- public listing automation
- PAD
- screening automation
- lease workspace redesign

## Recommended Follow-Up Mission

```text
fix/lease-workflow-guidance-status-and-layout-v1
```

Recommended scope:

- Add `leaseLifecycleSummary` to the landlord-scoped single lease detail response using the existing `deriveLeaseLifecycleSummary(...)` service.
- Include latest lease notice/no-response context consistently with the landlord lease list and portfolio renewal workbench where practical.
- Add a frontend fallback for `Days until end` from `lease.endDate` when the lifecycle summary is absent or malformed.
- Improve workflow page framing, width, border, spacing, and scanability across renewal, rent increase, notice, execution, and deposit workflows.
- Clarify renewal page copy so operators understand the lease workflow page versus the portfolio renewal operator-input workbench.
- Preserve `/portfolio-health?entry=lease-renewals` as the portfolio renewal workbench.
- Preserve `/leases/:leaseId/workflows/:workflowKey` as the lease-level workflow route.

Suggested files:

- `rentchain-api/src/routes/leaseRoutes.ts`
- focused backend route tests for `GET /api/leases/:id`
- `rentchain-frontend/src/pages/LandlordLeaseWorkflowPage.tsx`
- `rentchain-frontend/src/pages/LandlordLeaseWorkflowPage.test.tsx`

## Acceptance Criteria For Follow-Up Fix

- Renewal page with a future `endDate` does not show `Days until end: Not available`.
- Lease detail API returns `leaseLifecycleSummary` for landlord-scoped Firestore leases when enough lease data exists.
- Missing or malformed lifecycle data fails closed with clear copy rather than contradictory facts.
- Renewal, rent-increase, notice, execution, and deposit pages share consistent width, border, spacing, and scanability.
- Execution page no longer appears visually uncontained.
- Renewal page still links to `/portfolio-health?entry=lease-renewals` for operator input editing.
- No raw internal IDs are introduced as user-facing labels.
- No new renewal collection or standalone renewal data model is created.
- Backend tests cover detail projection lifecycle summary.
- Frontend tests cover days-until-end fallback and page framing.

## Separate Follow-Ups Kept Out Of Scope

```text
fix/operations-manual-review-assignment-persistence-v1
```

Investigate reviewer assignment on `/operations` prompting Save/Cancel but not persisting after refresh.

```text
audit/operations-navigation-visibility-v1
```

Confirm whether `/operations` being removed from main nav is intentional, and recommend restoration only if needed.

## RC1 Demo Readiness Conclusion

The lease workflow routes are structurally present and safe to demo with caveats, but the workflow guidance pages need one focused status/layout hardening mission before they are strong RC1 demo surfaces.

The highest-priority issue is not route availability. It is consistency between lease detail workflow pages and the lifecycle summary already derived for list and renewal workbench surfaces.

No schema redesign is recommended.
