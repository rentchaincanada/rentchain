# Dashboard 2.0 QA Plan V1

## Scope

This document defines the future QA plan for `feat/dashboard-2.0-operational-home-v1`.

It is planning only. It does not implement tests, UI, APIs, backend services, routes, CSS, or deployment changes.

Manual preview QA is not required for this planning mission. It will be required once Dashboard 2.0 UI implementation begins.

## QA Goals

Dashboard 2.0 QA should prove:

1. Dashboard remains the default operational home.
2. Decision items appear in the right order.
3. Dashboard routes to Operations and source workspaces correctly.
4. Mobile remains usable.
5. Empty and degraded states are calm and accurate.
6. Sticky navigation assumptions do not break route context.
7. Existing landlord onboarding/free-tier behavior is not regressed.

## Automated Validation Targets

Future implementation should include focused frontend tests for:

- Dashboard renders Portfolio Status.
- Dashboard renders Decision Queue Preview from normalized queue data.
- Critical items sort above warnings, needs-review, upcoming, and informational items.
- Informational items do not appear in the default dashboard preview.
- Message-derived items appear only when actionable.
- Empty queue shows "No open decisions" style state.
- Queue API failure shows degraded state, not false all-clear.
- Dashboard "View all" routes to Operations or current full queue route.
- Decision action buttons use `recommendedActionHref`.
- Financial snapshot handles empty, loading, and degraded states.
- Mobile-friendly content caps are enforced where testable.

Backend tests are not expected unless the implementation changes backend code.

## Manual Preview QA Preconditions

Before manual QA:

- PR #1185 or equivalent decision queue API is merged.
- Dashboard implementation branch is deployed to Vercel preview.
- Cloud Run parity is confirmed if backend code changes are included.
- Test landlord accounts or fixtures are available for:
  - empty/new landlord
  - active portfolio
  - landlord with critical/warning queue items
  - landlord with upcoming actions
  - landlord with no open decisions
  - landlord with degraded or simulated queue failure if feasible

## QA Scenario 1: First Login Experience

Goal: confirm the landlord sees calm operational orientation first.

Steps:

1. Log in as a new or low-data landlord.
2. Confirm Dashboard is default post-login destination.
3. Confirm first viewport answers portfolio status and next action.
4. Confirm setup/activation prompts are not styled as critical issues.
5. Confirm route options to Properties, Applications, or setup flow remain clear.

Pass criteria:

- Dashboard feels like an operational home.
- No dense Operations queue appears by default.
- No false red/critical warnings appear for normal empty state.

## QA Scenario 2: Decision Ordering

Goal: confirm decision severity hierarchy is respected.

Steps:

1. Use a landlord with multiple normalized queue items.
2. Confirm critical items appear before warnings.
3. Confirm warnings appear before needs-review.
4. Confirm upcoming items appear in Upcoming Actions rather than mixed as failures.
5. Confirm informational items are hidden from Dashboard preview.

Pass criteria:

- Queue order matches severity model.
- Dashboard preview is capped.
- No duplicate item appears for the same underlying issue.

## QA Scenario 3: Dashboard To Operations Routing

Goal: confirm Dashboard hands off to Operations for full triage.

Steps:

1. Click "View all decisions" or equivalent.
2. Confirm user lands on Operations or the current full queue route.
3. Confirm filters/context preserve the expected queue lane when applicable.
4. Return to Dashboard.

Pass criteria:

- Dashboard preview and Operations full queue feel complementary.
- Operations provides broader queue context.
- Dashboard does not become full queue.

## QA Scenario 4: Workspace Routing

Goal: confirm decision actions route to source workspaces.

Test examples:

- Payment issue routes to Ledger or Payments.
- Lease signing/document issue routes to Leases.
- Tenant move-in issue routes to tenant profile.
- Maintenance issue routes to maintenance request/workspace.
- Notice issue routes to notice or lease workflow.
- Property action request routes to property workspace.
- Message awaiting reply routes to Messaging or source workspace.

Pass criteria:

- Each item opens the workspace where the landlord can act.
- No item routes to a generic summary when a focused destination exists.
- No raw IDs appear in labels.

## QA Scenario 5: Messaging-Derived Decisions

Goal: confirm communication signals do not flood Dashboard.

Steps:

1. Use queue data with ordinary unread messages.
2. Confirm ordinary unread messages do not appear as dashboard warnings.
3. Use urgent/awaiting-response message-derived item.
4. Confirm it appears as actionable.
5. Confirm action routes to Messaging, tenant profile, maintenance, notice, or support context as appropriate.

Pass criteria:

- Dashboard shows only actionable communication items.
- Full inbox remains outside Dashboard.
- Message bodies are not exposed in dashboard cards.

## QA Scenario 6: Mobile Behavior

Goal: confirm first-screen hierarchy works on mobile.

Viewports:

- Small mobile width.
- Tablet width.

Steps:

1. Open Dashboard on mobile viewport.
2. Confirm Portfolio Status appears first.
3. Confirm top decision or no-decision state appears near top.
4. Confirm upcoming and financial sections stack cleanly.
5. Confirm Portfolio Detail collapses or remains compact.
6. Confirm no text overlaps or buttons overflow.

Pass criteria:

- First viewport is understandable.
- Critical action is reachable.
- Dashboard does not become a long dense queue.

## QA Scenario 7: Empty States

Goal: confirm empty states do not feel broken or alarmist.

Cases:

- No properties.
- Properties but no leases.
- No open decisions.
- No upcoming actions.
- No rent collection data.
- No actionable messages.

Pass criteria:

- Each empty state is specific.
- Empty state offers a route or explanation when useful.
- Empty state does not imply compliance approval, legal certainty, or hidden failure.

## QA Scenario 8: Degraded States

Goal: confirm degraded data does not produce false confidence or false urgency.

Cases:

- Decision queue unavailable.
- Financial summary unavailable.
- Portfolio detail partially unavailable.
- Messaging summary unavailable.

Pass criteria:

- Affected section says unavailable/degraded.
- Other sections remain usable.
- Dashboard does not show "no decisions" when queue failed.
- Raw API errors are not exposed.

## QA Scenario 9: Sticky Navigation Validation

Goal: confirm Dashboard implementation remains compatible with future sticky workspace shell.

Steps:

1. Confirm page title/context remains visible or recoverable.
2. Confirm Dashboard and Operations are clearly distinct nav destinations.
3. Confirm route transitions preserve workspace context.
4. Confirm mobile navigation does not hide the primary action.

Pass criteria:

- Dashboard can support future sticky title/workspace nav.
- Breadcrumbs are not needed on Dashboard cards.
- Source workspace routes remain stable.

## QA Scenario 10: Regression Coverage

Confirm existing flows still work:

- Free-tier onboarding dashboard prompts.
- Add property/unit path.
- Applications/manual applicant guidance path.
- Leases page access.
- Tenants page access.
- Maintenance workspace access.
- Payments/Ledger access.
- Messages or unified inbox access.
- Trust/Compliance access where available.

Pass criteria:

- Dashboard 2.0 does not break existing workspace access.
- Existing landlord conversion paths remain discoverable.

## Manual QA Evidence To Capture

For future implementation PRs, capture:

- Preview URL and commit SHA.
- Backend Cloud Run image/revision if backend changed.
- Landlord account type used.
- Screenshots for first viewport desktop and mobile.
- Screenshots for decision preview and empty/degraded states.
- Browser URL after Dashboard -> Operations and Dashboard -> workspace clicks.
- Any failed route, console error, or missing data condition.

## Go / No-Go Criteria

Go:

- Decision ordering is correct.
- Dashboard routes correctly.
- Empty/degraded states are safe.
- Mobile is usable.
- Existing onboarding and workspace access are preserved.
- CI is green.
- Manual preview QA passes.

No-go:

- Dashboard shows full queue or full inbox.
- Critical/warning states are false or duplicated.
- Queue failure appears as no open work.
- Mobile first viewport hides primary action.
- Source workspace routes are broken.
- Raw IDs, provider IDs, storage paths, or message bodies appear.
