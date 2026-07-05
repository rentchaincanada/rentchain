# RC1 Command Center Continuity Audit v1

Branch: `audit/rc1-command-center-continuity-v1`
Status: audit only, no implementation changes

## Executive Summary

No P0 RC1 demo blockers were found in the command-center route cluster. The landlord command-center story is materially coherent:

- `/dashboard` functions as the operational home and portfolio signal surface.
- `/operations` functions as the work queue and execution workspace.
- `/landlord/unified-inbox` functions as the message bridge, with recent backend-generated safe source actions improving contextual routing.

The highest-leverage next PR is not another broad navigation redesign. It should be a small frontend polish PR that makes `/operations` explicitly bridge to the Unified Inbox and clarifies the relationship between operational queue work and message-driven source context.

Recommended next mission:

`polish/operations-unified-inbox-bridge-v1`

## Routes Reviewed

Primary command-center cluster:

- `/dashboard`
- `/operations`
- `/landlord/unified-inbox`

Secondary regression destinations considered:

- `/applications`
- `/leases`
- `/maintenance`
- `/analytics`
- `/contractors`
- `/verified-screenings`

## Source Files Reviewed

- `rentchain-frontend/src/pages/DashboardPage.tsx`
- `rentchain-frontend/src/pages/OperationalCommandCenterPage.tsx`
- `rentchain-frontend/src/pages/UnifiedInboxPage.tsx`
- `rentchain-frontend/src/components/UnifiedInbox/UnifiedInboxList.tsx`
- `rentchain-frontend/src/components/layout/LandlordNav.tsx`
- `rentchain-frontend/src/components/layout/navConfig.ts`
- `docs/audit/rc1-demo-navigation-friction-v1.md`
- `docs/audit/mobile-bottom-nav-fifth-slot-priority-v1.md`

## P0 Blockers

None found.

The command-center routes are reachable, use the landlord shell where expected, and do not show obvious raw/internal identifiers in the reviewed command-center surfaces. Recent work has already addressed the largest previous continuity gaps:

- Operations is a direct mobile bottom-nav tab.
- Unified Inbox read state persists.
- Unified Inbox source actions can prefer backend-provided safe `sourceAction` values.
- Maintenance, analytics, contractors, verified screenings, lease summary, and lease ledger have received route-level demo-readiness polish.

## P1 Recommended Next PR

### `polish/operations-unified-inbox-bridge-v1`

Problem:

`/operations` is the execution workspace, but its first-screen command-center framing still points to `Open decision inbox` at `/decision-inbox`. It does not visibly connect the Operations queue to the canonical Unified Inbox route, even though Unified Inbox is now the safer message bridge and has backend-generated source actions.

Why it matters for RC1:

The RC1 demo story should feel like one connected landlord command center:

1. Dashboard says what needs attention now.
2. Operations triages and executes the work.
3. Unified Inbox explains message/source context and routes to safe related actions.

Right now Dashboard and mobile nav make both Operations and Inbox discoverable, but Operations itself does not clearly tell the operator when to use the Inbox. That creates a subtle continuity gap during demos: after opening Operations, source messages feel like a separate workspace instead of part of the same command-center loop.

Affected routes:

- `/operations`
- `/landlord/unified-inbox`
- indirect regression: `/dashboard`

Likely files:

- `rentchain-frontend/src/pages/OperationalCommandCenterPage.tsx`
- `rentchain-frontend/src/pages/OperationalCommandCenterPage.test.tsx`
- Possibly `rentchain-frontend/src/pages/UnifiedInboxPage.test.tsx` only if route-link copy is asserted there

Proposed minimal fix:

- Add a small source-message bridge action near the `/operations` header or summary strip.
- Use landlord-facing copy such as:
  - `Open unified inbox`
  - `Review message context`
  - `Use the inbox to inspect tenant, lease, maintenance, and payment messages tied to operational work.`
- Keep `Open decision inbox` only if it remains intentionally distinct; otherwise demote it or label it as legacy/specialized review workflow access.
- Do not change queue logic, source projections, or backend contracts.
- Do not expose source IDs, source refs, provider IDs, raw Firestore IDs, or other lineage fields.

Acceptance criteria:

- `/operations` clearly exposes `/landlord/unified-inbox` as the message/source-context bridge.
- The action label and helper copy explain why a landlord would use the inbox from Operations.
- Existing Operations queue filters, manual review controls, and source workflow links continue to work.
- Existing `/decision-inbox` access is preserved or intentionally de-emphasized without removing required functionality.
- Reduced desktop and mobile action rows wrap cleanly.
- No horizontal overflow.
- No raw/internal/provider identifiers are visible.
- Regression routes load:
  - `/dashboard`
  - `/operations`
  - `/landlord/unified-inbox`
  - `/applications`
  - `/leases`
  - `/maintenance`

Risk level:

Low. This should be frontend-only copy/layout/link polish if kept to the Operations header or command summary area.

## Route-by-Route Findings

### `/dashboard`

Status: healthy for RC1 command-center entry.

What works:

- Decision Queue Preview communicates high-priority decisions needing attention.
- Upcoming Actions sends operators to `/operations`.
- Portfolio Detail / Workspace Routing opens owned workspaces such as Operations, Properties, Leases, Renewals, and Payments.
- Dashboard decision rows route to operational destinations through `operationalHref`.
- Recent reduced-desktop density work keeps the page acceptable at intermediate widths.

Friction:

- P3: Dashboard has multiple command-center concepts: Decision Queue Preview, Upcoming Actions, calendar preview, financial snapshot, and workspace routing. This is acceptable now, but future copy could make the Dashboard-to-Operations-to-Inbox relationship more explicit.
- P3: Workspace Routing does not currently include Unified Inbox. This is not a blocker because Inbox is in global nav/mobile tabs, but adding it later could reinforce the command bridge.

Recommended action:

Defer. Do not touch Dashboard in the next PR unless the Operations bridge needs one small label alignment.

### `/operations`

Status: strongest next polish target.

What works:

- The page clearly states it is a centralized operational visibility layer across leases, payments, occupancy, screening, documents, and review workflows.
- Summary strip and category lanes support landlord triage.
- Priority routing queue gives source workflow links and next-action labels.
- Reduced desktop and mobile behavior has been recently hardened.

Friction:

- P1: The header action is `Open decision inbox` and routes to `/decision-inbox`, while the canonical user-visible route for operational messages is `/landlord/unified-inbox`.
- P1: There is no first-screen action that explains Unified Inbox as the message/source-context bridge for Operations.
- P2: The distinction between Operations review items and Unified Inbox messages is implied by product architecture, not visible enough to a demo operator.

Recommended action:

Implement `polish/operations-unified-inbox-bridge-v1`.

### `/landlord/unified-inbox`

Status: healthy after recent source-action work.

What works:

- Route title/subtitle describe operational messages organized by priority, status, and workspace.
- Filters cover unread, priority, maintenance, lease, payments, and system views.
- Read-state persistence remains separate from action routing.
- Detail panels prefer backend-provided safe `sourceAction` when present.
- Broad fallback behavior remains for records without safe source actions.
- Plain messages without actions no longer show a useless self-link.

Friction:

- P2: The inbox can route outward, but the broader command-center surfaces do not yet strongly route back into the inbox when message context matters.
- P3: Exact source routing still depends on backend-safe action availability. This is correct and should not be bypassed client-side.

Recommended action:

Do not change Unified Inbox in the next PR unless a test needs to assert the Operations bridge route.

## Mobile and Reduced-Desktop Findings

The landlord mobile command-center path is now strong:

- Dashboard
- Properties
- Applicants
- Inbox
- Operations
- More

Operations and Inbox both appear as direct bottom-nav destinations, which supports the RC1 story. The issue is not availability; it is continuity. Once a user is inside Operations, there is no explicit source-message bridge back to Unified Inbox.

Reduced desktop is acceptable for the reviewed command-center pages. The recommended Operations bridge should use existing flex-wrap/grid patterns so action rows do not create horizontal overflow.

## Duplicate Concept Findings

The command-center cluster uses several related concepts:

- Dashboard
- Operations
- Decision Queue Preview
- Upcoming Actions
- Priority routing queue
- Unified Inbox
- Decision inbox

This is not currently a blocker because each surface has a defensible role. The only terminology that risks RC1 confusion is `decision inbox` versus `Unified inbox`.

Recommendation:

The next PR should avoid introducing new concepts. It should connect Operations to the existing Unified Inbox with clear helper copy and leave deeper naming consolidation for later if needed.

## Raw/Internal ID Findings

No raw/internal IDs were observed in the reviewed command-center route code or copy surfaces. The reviewed Unified Inbox UI explicitly validates backend-provided `sourceAction.href` as a safe relative href before rendering it and continues to avoid exposing raw source lineage fields client-side.

Safety guard for the follow-up:

Do not infer exact routes client-side from hidden/source lineage. Use existing route links or backend-provided safe actions only.

## Dead-End Findings

No route is a hard dead end for RC1.

The main soft dead end is conceptual: Operations can open source workflows, but does not invite the user to inspect the message context in the Unified Inbox. This matters because #1315 made the inbox more valuable as a context bridge, but Operations does not yet surface that value.

## P2 Later Polish

### `polish/dashboard-command-center-label-harmony-v1`

Problem:

Dashboard contains several action-oriented sections that are individually clear but could better explain the overall command-center hierarchy.

Minimal fix:

Add or adjust small helper copy so Dashboard reads as "overview now, Operations for execution, Inbox for source messages."

Risk:

Low, frontend-only.

### `polish/command-center-decision-inbox-naming-v1`

Problem:

`Decision inbox` and `Unified inbox` may sound like overlapping inbox products during a demo.

Minimal fix:

Audit and harmonize labels so `/decision-inbox` reads as a specialized review queue if it must remain visible, while `/landlord/unified-inbox` remains the communication/source-context inbox.

Risk:

Medium-low. Needs care to avoid hiding an operationally useful route.

### `polish/unified-inbox-command-center-return-actions-v1`

Problem:

Unified Inbox source actions route outward, but the detail panel does not provide explicit return guidance to Operations.

Minimal fix:

Consider a secondary `Open operations` action for landlord inbox records if it improves demo flow without crowding the detail panel.

Risk:

Low, but should wait until the Operations-side bridge is in place.

## P3 Optional Refinements

- Consider adding Unified Inbox to Dashboard Workspace Routing if future QA shows the Inbox is still underused from Dashboard.
- Review whether `Decision Queue Preview` and Operations `Priority routing queue` should share more label language.
- Keep watching reduced-desktop density after adding any new Operations header actions.

## Validation Run

Recommended validation for this docs-only audit:

- `git diff --check`
- competitor-name scan on this audit artifact
- docs-only diff confirmation
- working tree clean confirmation

Recommended validation for `polish/operations-unified-inbox-bridge-v1`:

- `npm run test:single -- src/pages/OperationalCommandCenterPage.test.tsx`
- `npm run test:single -- src/pages/UnifiedInboxPage.test.tsx` if route/copy assertions are added there
- frontend build
- `git diff --check`

Manual QA for follow-up:

- Desktop `/operations`
  - confirm `Open unified inbox` or equivalent bridge is visible
  - confirm it routes to `/landlord/unified-inbox`
  - confirm existing `Open source workflow` links still work
- Reduced desktop `/operations`
  - confirm action row wraps cleanly
  - confirm no horizontal overflow
- Mobile `/operations`
  - confirm bridge is visible or reachable without crowding
  - confirm bottom nav remains unchanged
- `/landlord/unified-inbox`
  - confirm source actions still render and read-state persistence remains intact
- Regression:
  - `/dashboard`
  - `/applications`
  - `/leases`
  - `/maintenance`

## Merge / Defer Recommendation

Merge this audit if the diff remains docs-only and validation passes.

Proceed next to:

`polish/operations-unified-inbox-bridge-v1`

Defer broader command-center naming or Dashboard hierarchy changes until after that single bridge PR is tested in the RC1 demo path.
