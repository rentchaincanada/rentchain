# Lease Renewal Route Visibility Audit v1

Branch: `audit/lease-renewal-route-visibility-v1`
Scope: audit and documentation only; no route, UI, API, schema, PAD, screening, vacancy feed, or dashboard redesign implementation.
Issue: #1243

## Purpose

This audit evaluates renewal route and navigation visibility for RC1 enterprise demo readiness.

The objective is to determine whether `/lease-renewal` should exist, redirect, or remain retired; confirm the renewal source of truth; and define how renewal state should connect to vacancy and lease-up visibility for a one-building pilot conversation.

## Enterprise Validation Filter

This mission advances:

- Revenue: renewal visibility is the first handoff into vacancy, listing, inquiry, application, screening, lease, and occupancy.
- Operational efficiency: renewal decisions should route operators to the right workbench without hunting through unrelated dashboard panels.
- Enterprise readiness: large operators need a credible renewal-to-vacancy story before piloting even one building.
- Customer validation: the RC1 demo can show what exists today and what remains roadmap without overclaiming.

## Files Reviewed

Frontend:

- `rentchain-frontend/src/App.tsx`
- `rentchain-frontend/src/App.routes.test.tsx`
- `rentchain-frontend/src/components/layout/navConfig.ts`
- `rentchain-frontend/src/pages/DashboardPage.tsx`
- `rentchain-frontend/src/pages/OperationalCommandCenterPage.tsx`
- `rentchain-frontend/src/pages/LandlordActiveLeasesPage.tsx`
- `rentchain-frontend/src/pages/LandlordLeaseWorkflowPage.tsx`
- `rentchain-frontend/src/pages/landlord/PortfolioHealthSummaryPage.tsx`
- `rentchain-frontend/src/pages/landlord/PortfolioHealthSummaryPage.test.tsx`
- `rentchain-frontend/src/api/landlordLeaseRenewalApi.ts`

Backend:

- `rentchain-api/src/app.build.ts`
- `rentchain-api/src/routes/leaseNoticeLandlordRoutes.ts`
- `rentchain-api/src/routes/tenantLeaseNoticeRoutes.ts`
- `rentchain-api/src/routes/dashboardRoutes.ts`
- `rentchain-api/src/services/leaseNoticeWorkflowService.ts`
- `rentchain-api/src/services/leaseLifecycle/deriveLeaseLifecycleSummary.ts`

Existing strategy and audit docs:

- `docs/strategy/lease-up-renewal-pipeline-v1.md`
- `docs/strategy/rc1-renewal-pipeline-visibility-plan-v1.md`
- `docs/audit/decision-routing-model-v1.md`
- `docs/audit/decision-queue-source-of-truth-v1.md`

## Current Renewal Routes And Surfaces

| Surface | Current route or source | Current behavior | Audit finding |
| --- | --- | --- | --- |
| Standalone renewal route | `/lease-renewal` | No route found in `App.tsx`. | Hidden/missing as a direct discovery route. |
| Portfolio renewal workbench | `/portfolio-health?entry=lease-renewals` | Loads expiring lease renewal operator inputs and allows saving renewal term/deadline choices. | Best current portfolio-level renewal workbench. |
| Lease-specific renewal workflow | `/leases/:leaseId/workflows/renewal` | Shows lease-specific renewal workflow guidance. | Best current lease-level execution route, but it does not currently expose the same unit-specific renewal operator input actions as the portfolio renewal workbench. |
| Leases page | `/leases` | Displays lease status labels and jurisdiction policy guidance, including Renewal Review links to lease workflow pages. | Useful source workspace, but not a portfolio renewal queue. |
| Dashboard | `/dashboard` | Shows decision queue, upcoming actions, workspace routing, and links to `/portfolio-health` generally. | Summarizes renewal risk only when queue items exist; does not expose a stable renewal entry. |
| Operations | `/operations` | Builds lease-ending and policy signals, currently sending lease lifecycle signals to `/leases` or lease summary destinations. | Good candidate for triage, but renewal-specific destinations are less direct than existing workflow pages. |
| Decision/analytics | analytics decision paths | Renewal decisions use `/portfolio-health?entry=lease-renewals&propertyId=...`. | Strong evidence that portfolio health is already used as renewal workbench. |
| Tenant response | tenant notice route | Tenant renewal response sets lease status to `renewal_accepted` or `move_out_pending`. | Confirms lease record is the canonical state target for response outcome. |

## Preview QA Findings

User preview QA confirmed the following with lease `oTmWc8UxDj9u7Asgaqe7`:

- `/leases/oTmWc8UxDj9u7Asgaqe7/workflows/renewal` opens successfully.
- `/portfolio-health?entry=lease-renewals` shows renewal operator inputs for the unit.
- `/leases` exposes workflow buttons such as renewal and rent increase guidance.

Confirmed gaps:

- The lease-level renewal workflow route exists and is reachable directly, but it is not easily discoverable through normal navigation.
- On `/operations`, the "Lease lifecycle source workflow" link routes to `/leases/:id/summary`, not `/leases/:leaseId/workflows/renewal`.
- Renewal-specific Operations signals should route to `/leases/:leaseId/workflows/renewal` when safe lease context exists.
- The lease-level renewal workflow opens, but it does not display the same unit-specific renewal operator input options that appear in `/portfolio-health?entry=lease-renewals`.
- This creates an execution mismatch: Portfolio Health has actionable renewal inputs, while the lease-level workflow page is less useful for completing renewal review.

Separate issue observed during QA:

- On `/operations`, selecting reviewer prompts Save/Cancel, but reviewer assignment does not persist after refresh.
- Treat this as a separate suspected manual-review persistence/projection bug unless implementation work proves it shares the same routing path.

## Current Backend Renewal Model

The backend exposes renewal work through landlord lease routes mounted at:

```text
/api/landlord/leases
```

Relevant routes:

- `GET /api/landlord/leases/expiring`
- `GET /api/landlord/leases/:id/renewal-inputs`
- `PUT /api/landlord/leases/:id/renewal-inputs`

Important behavior:

- `GET /expiring` derives landlord-visible expiring leases from lease and lease-notice documents.
- `PUT /:id/renewal-inputs` persists renewal operator inputs directly onto the lease record.
- Tenant notice response updates the lease with `latestRenewalIntent`, `latestRenewalIntentAt`, `moveOutDate`, and status `renewal_accepted` or `move_out_pending`.
- `deriveLeaseLifecycleSummary` maps lease and notice facts into lifecycle statuses and next actions.

## Source Of Truth Recommendation

Renewal source of truth should remain the lease record plus related lease notice records.

Recommended ownership model:

- Lease record owns lifecycle status, renewal operator inputs, lease dates, renewal outcome, and move-out date.
- Lease notice records own notice dispatch, tenant response, no-response timing, and notice-specific evidence.
- Portfolio health owns portfolio-level renewal workbench and batch review.
- Lease workflow pages own lease-specific renewal execution.
- Operations owns prioritization and triage, not renewal data mutation.
- Dashboard owns summary and entry points, not renewal source of truth.

Do not create a separate renewal entity or duplicate renewal state for RC1.

## Should `/lease-renewal` Exist?

Recommendation: create `/lease-renewal` as a redirect/discovery route in a follow-up implementation mission.

Recommended behavior:

```text
/lease-renewal -> /portfolio-health?entry=lease-renewals
```

Rationale:

- The route is intuitive and has already appeared in strategic discussion.
- A redirect improves discoverability without creating another source surface.
- Portfolio health already contains the portfolio renewal workbench.
- The redirect avoids making `/lease-renewal` a competing page.

Do not build a new standalone `/lease-renewal` page in RC1 unless a later implementation mission proves portfolio health cannot support the demo workflow.

## Broken, Hidden, Duplicated, Or Misleading Paths

### Hidden

- `/lease-renewal` does not exist.
- Top-level landlord navigation does not include a Renewal or Lease Renewal item.
- Dashboard links to `/portfolio-health` generally, but not consistently to `/portfolio-health?entry=lease-renewals`.

### Duplicated

- Renewal-related work appears in portfolio health, lease workflow pages, Leases policy guidance, Operations signals, analytics decisions, and dashboard summaries.
- This is acceptable only if each surface has clear ownership. Current ownership is understandable in code but not obvious to an operator.

### Misleading Or Weak

- Operations lease-ending signals route to `/leases` or lease summary destinations rather than directly to `/leases/:leaseId/workflows/renewal` when the required next action is renewal-specific.
- Decision-routing docs already identify `/leases/:leaseId/workflows/renewal` as the preferred destination for lease-expiring decisions, but the live Operations signal path is less specific.
- The lease-level renewal workflow is reachable but less actionable than the portfolio renewal workbench because renewal operator inputs are currently edited in `/portfolio-health?entry=lease-renewals`.
- Portfolio-health empty copy says no expiring leases are visible for the scope. That is accurate for the current filter, but the RC1 demo may need clearer distinction between no expiring leases, no pending responses, and no no-response cases.

### Not Found

- No evidence was found that `/lease-renewal` currently redirects.
- No evidence was found that renewal state is stored in a separate dedicated renewal collection.

## Recommended Renewal State Mapping

RC1 should use this language when connecting current implementation to demo states:

| RC1 state | Current implementation signal |
| --- | --- |
| Expiring soon | `deriveLeaseLifecycleSummary` status `expiring_soon`, notice bucket `expiring` |
| Renewal notice pending | Lease status `renewal_pending`, latest notice pending, lifecycle `renewal_pending` |
| Renewal sent | Lease notice exists with renewal notice metadata; surfaced through notice/workflow history |
| Tenant accepted | Tenant response `renew`; lease status `renewal_accepted`; lifecycle `renewed` |
| Tenant declined | Tenant response `quit`; lease status `move_out_pending`; lifecycle `ending` |
| Vacancy scheduled | Not first-class in current renewal implementation; should be follow-up pipeline work |

## Renewal To Vacancy / Lease-Up Connection

Current implementation supports renewal decision visibility but does not complete the vacancy pipeline.

Recommended RC1 narrative:

```text
Renewal -> Vacancy -> Listing -> Inquiry -> Application -> Screening -> Lease
```

Current capability:

- Renewal review and operator inputs are supported.
- Tenant renewal response can mark a lease as renewed or moving out.
- Lease lifecycle summary can show ending and no-response states.

Current gap:

- Decline/non-renewal does not appear to create a first-class pending vacancy record.
- Vacancy scheduling and public listing are future missions, not current RC1 capability.

## Recommended Follow-Up Mission

```text
fix/lease-renewal-navigation-visibility-v1
```

Recommended scope:

- Add `/lease-renewal` redirect to `/portfolio-health?entry=lease-renewals`.
- Add a focused Renewal entry point from the Leases workspace or Dashboard upcoming-actions area.
- Route renewal-specific Operations signals to `/leases/:leaseId/workflows/renewal` when safe lease context exists.
- Preserve `/portfolio-health?entry=lease-renewals` as the portfolio-level renewal workbench.
- Preserve `/leases/:leaseId/workflows/renewal` as the lease-level renewal execution surface.
- Ensure the lease-level renewal workflow shows enough unit-specific renewal context/actions to be useful, or clearly links back to `/portfolio-health?entry=lease-renewals` for editing renewal inputs.
- Keep lease records and lease notices as source of truth.
- Add route/navigation tests for the redirect, focused entry points, and Operations renewal-signal destination.

Non-goals for that mission:

- no vacancy feed
- no public listing
- no screening automation
- no PAD
- no broad dashboard redesign
- no new renewal collection
- no new standalone renewal page unless the redirect model cannot support the existing route structure

## Separate Follow-Up Candidate

```text
fix/operations-manual-review-assignment-persistence-v1
```

Recommended scope:

- Investigate why reviewer/manual assignment changes on `/operations` prompt Save/Cancel but do not persist after refresh.
- Confirm whether the issue is frontend state only, API persistence, projection refresh, or missing backend write.
- Keep this separate from renewal routing unless implementation proves the persistence bug shares the same route/data path.

## RC1 Demo Readiness Conclusion

Renewal is implemented enough to discuss as a current workflow foundation, but it is not discoverable enough for a confident enterprise demo without operator guidance.

RC1 should not claim complete renewal-to-vacancy automation. It should show:

- portfolio renewal review through `/portfolio-health?entry=lease-renewals`
- lease-specific renewal review through `/leases/:leaseId/workflows/renewal`
- tenant response driving lease lifecycle state
- vacancy scheduling and public listing as next pipeline work

Before demo, implement the narrow navigation/redirect follow-up or prepare demo script guidance that opens the portfolio renewal workbench directly.
