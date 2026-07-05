# RC1 Lease Workspace Continuity Audit v1

Branch: `audit/rc1-lease-workspace-continuity-v1`
Status: audit only, no implementation changes

## Executive Summary

No P0 RC1 demo blockers were found in the lease workspace route cluster. After the Application Review Summary now routes safely to `/leases`, the lease workspace is usable as the next landlord destination: lease rows expose summary and payment ledger actions, lease summary links to ledger and operations, ledger links back to summary and operations, and workflow routes link back to leases, summary, and payment ledger.

The highest-leverage remaining issue is not a missing route. It is landlord-facing safety and polish on `/leases`: the desktop table renders the raw `lease.id` under the property name. That weakens enterprise/demo readiness because the lease workspace is now the destination after application approval, and the first lease list should not display internal identifiers as user-facing context.

Recommended next mission:

`fix/lease-operations-safe-reference-display-v1`

## Routes Reviewed

Primary route cluster:

- `/leases`
- `/leases/:leaseId/summary`
- `/leases/:leaseId/ledger`
- `/leases/:leaseId/workflows/execution`
- `/leases/:leaseId/workflows/renewal`
- `/leases/:leaseId/workflows/notice`
- `/leases/:leaseId/workflows/deposit`
- `/leases/:leaseId/workflows/rent-increase`

## Source Files Reviewed

- `rentchain-frontend/src/App.tsx`
- `rentchain-frontend/src/pages/LandlordActiveLeasesPage.tsx`
- `rentchain-frontend/src/pages/LandlordActiveLeasesPage.test.tsx`
- `rentchain-frontend/src/pages/LandlordLeaseSummaryPage.tsx`
- `rentchain-frontend/src/pages/LandlordLeaseSummaryPage.test.tsx`
- `rentchain-frontend/src/pages/LeaseLedgerPage.tsx`
- `rentchain-frontend/src/pages/LeaseLedgerPage.test.tsx`
- `rentchain-frontend/src/pages/LandlordLeaseWorkflowPage.tsx`
- `rentchain-frontend/src/pages/LandlordLeaseWorkflowPage.test.tsx`
- `docs/audit/rc1-application-to-lease-continuity-v1.md`
- `docs/audit/rc1-demo-navigation-friction-v1.md`
- `docs/audit/lease-ledger-navigation-discoverability-v1.md`

## P0 Blockers

None found.

Current state is RC1-usable:

- `/leases` is the safe broad destination after application review.
- `/leases` exposes `Lease summary`, `Payment ledger`, lease document actions, staged rent setup actions, and workflow routes.
- `/leases/:leaseId/summary` exposes `Open payment ledger`, `Print / Save PDF`, `Download evidence package`, `Back to leases`, and `Open operations`.
- `/leases/:leaseId/ledger` exposes `Back to lease summary`, `Open operations`, `View archive`, ledger entry actions, CSV/PDF export, and operational decision context.
- Lease workflow routes expose `Back to leases`, `Lease summary`, and `Payment ledger`.
- Recent workflow desktop spacing keeps workflow pages centered and readable.
- Ledger print/PDF behavior remains meaningful and is not disturbed by this audit.

## P1 Recommended Next PR

### `fix/lease-operations-safe-reference-display-v1`

Problem:

`/leases` desktop rows render `lease.id` directly under the property name. In tests and fixtures this appears as values such as `lease-1`; in production-shaped data this can be a raw Firestore lease identifier. That identifier is useful for route construction, API calls, and internal debugging, but it should not be a default user-facing label in the landlord lease workspace.

Why it matters for RC1:

`/leases` is now the handoff destination from Application Review Summary. A demo operator should be able to say that the landlord moves from application approval into a clean lease operations workspace. Seeing raw lease IDs in the first lease table weakens that story and conflicts with recent review-summary, inbox, tenant, and export work that deliberately avoids raw internal identifiers.

Affected route:

- `/leases`

Likely files:

- `rentchain-frontend/src/pages/LandlordActiveLeasesPage.tsx`
- `rentchain-frontend/src/pages/LandlordActiveLeasesPage.test.tsx`

Proposed minimal fix:

- Remove the visible `{lease.id}` sublabel from the desktop lease table.
- Replace it with a landlord-safe operational sublabel if helpful, such as:
  - tenant email if already visible and safe,
  - lifecycle/payment readiness summary,
  - or no sublabel at all.
- Keep raw lease IDs available only for route construction and API calls.
- Keep the advanced lease reference behavior on `/leases/:leaseId/ledger` behind its explicit details disclosure unless a later security review decides to remove it too.
- Add/adjust tests to prove desktop `/leases` does not display the raw lease ID while still rendering safe property, unit, tenant, summary, and ledger actions.

Acceptance criteria:

- `/leases` desktop table no longer displays raw lease IDs under property names.
- `/leases` mobile cards continue not to display raw lease IDs.
- `Lease summary` and `Payment ledger` actions still route correctly.
- Existing lease document, Schedule A, email, save, archive, rent setup, and workflow actions remain intact.
- No raw property, unit, tenant, lease, provider, storage, or Firestore IDs are introduced as labels.
- Reduced desktop and mobile layouts remain readable with no horizontal overflow.
- Print / Save PDF behavior on `/leases` remains unchanged.

Risk level:

Low. This should be frontend-only presentation cleanup with targeted test coverage.

## Route-By-Route Findings

### `/leases`

Status: strong destination with one P1 presentation/safety issue.

What works:

- Page heading is landlord-facing: `Lease operations`.
- Helper copy explains canonical lease records, occupied-unit reconciliation, ledger use, and archive views.
- Active/archive toggles are clear.
- Search works by tenant, unit, or property.
- Occupied-unit reconciliation is clearly separated from true lease records and uses `Convert to lease` only in that reconciliation context.
- Lease actions include:
  - `View lease`
  - `Primary lease document unavailable`
  - `Lease summary`
  - `View Schedule A`
  - `Payment ledger`
  - `Email`
  - `Save`
  - `Enable rent collection`
  - `Review rent terms`
  - `Archive lease`
- Mobile cards use safe property/unit/tenant/rent/status/readiness context and do not show the raw lease ID.

Issues:

- P1: desktop table shows `lease.id` below `lease.propertyName`.
- P2: `Save` is somewhat vague because the button either opens a primary document or downloads a lease summary PDF depending on document state. It is not a blocker because other document actions are nearby, but a future label could be clearer.
- P3: The page now receives traffic from Application Review Summary via a broad `/leases` handoff. It does not currently show source-aware copy such as `Continue lease follow-through`, but this is acceptable because the Review Summary copy already explains the broad fallback.

Recommended action:

Implement `fix/lease-operations-safe-reference-display-v1` before broader lease workspace copy polish.

### `/leases/:leaseId/summary`

Status: healthy.

What works:

- Header explains this is the landlord-visible lease detail fallback when a separate lease document is not attached.
- Action row includes:
  - `Open payment ledger`
  - `Print / Save PDF`
  - `Download evidence package`
  - `Back to leases`
  - `Open operations`
- `?section=rent-payment` displays a workflow focus banner explaining rent terms, deposit handling, rent collection readiness, and payment setup context.
- Tests verify landlord-safe lease details and absence of storage path exposure.

Issues:

- P3: The summary page is a good hub once an exact lease is selected, but it does not need a new action for the next PR.

Recommended action:

Defer.

### `/leases/:leaseId/ledger`

Status: healthy.

What works:

- Header actions include:
  - `Back to lease summary`
  - `Open operations`
  - `View archive`
  - `Add note`
  - `Add charge`
  - `Record payment`
  - `Export CSV`
  - `Print / Save PDF`
  - archive/restore action
- Ledger summary, obligation rows, decision context, and credit/obligation mismatch notice are clear.
- CSV import remains intentionally collapsed behind `Import payments CSV`.
- Print / Save PDF uses the print-root mechanism and includes meaningful ledger content.

Issues:

- P3: `Advanced lease reference` can reveal an internal lease reference behind an explicit details disclosure. That is not the same severity as the default `/leases` table leak, but it should remain intentional and may deserve later review if export/screenshot safety requirements tighten.
- P3: A user arriving from Dashboard or Operations may not have source-aware return context. Current `Back to lease summary` and `Open operations` actions are acceptable for RC1.

Recommended action:

Do not change ledger in the next PR.

### Lease Workflow Routes

Reviewed:

- `/leases/:leaseId/workflows/execution`
- `/leases/:leaseId/workflows/renewal`
- `/leases/:leaseId/workflows/notice`
- `/leases/:leaseId/workflows/deposit`
- `/leases/:leaseId/workflows/rent-increase`

Status: healthy.

What works:

- Shared workflow page renders clear route-specific titles and purpose copy:
  - `Execution Review`
  - `Renewal Review`
  - `Notice Workflow`
  - `Deposit Workflow`
  - `Rent Increase Workflow`
- Header actions include `Back to leases`, `Lease summary`, and `Payment ledger`.
- Renewal includes `Open renewal inputs` for the specific renewal workbench path.
- Jurisdiction context copy is operational and avoids legal overclaiming.
- Shared desktop container spacing is centered and bounded after recent polish.

Issues:

- P3: Workflow pages do not include `Open operations`, but `Back to leases`, `Lease summary`, and `Payment ledger` are enough to avoid a demo dead end.
- P3: Workflow pages are review aids rather than mutation workflows. That is appropriate, but demo narration should frame them as readiness/review surfaces.

Recommended action:

Defer.

## Action Label Consistency Findings

Current labels are mostly understandable:

- `Lease summary`
- `Payment ledger`
- `Open payment ledger`
- `Back to lease summary`
- `Back to leases`
- `Open operations`
- `Review rent terms`
- `Enable rent collection`

Minor label polish:

- `Save` on `/leases` is less clear than surrounding labels. It may mean open/download depending on primary document availability. This is a P2/P3 follow-up, not the next highest-leverage PR.
- `View archive` from ledger routes to `/leases?view=archived`, which is clear enough.

## Raw/Internal ID Findings

P1 confirmed:

- `/leases` desktop table displays `lease.id` directly under the property name.

Acceptable current patterns:

- Route hrefs necessarily include lease IDs.
- Tests use fixture IDs such as `lease-1`; that is not a user-facing issue by itself.
- `/leases/:leaseId/ledger` shows advanced reference only behind `Advanced lease reference`, not as default page context.

Required rule for next implementation:

Do not replace raw lease ID with another raw identifier such as property ID, unit ID, tenant ID, provider reference, storage path, or Firestore document ID.

## P2 Later Polish

### `polish/lease-operations-document-action-labels-v1`

Problem:

The `/leases` `Save` action is ambiguous because its behavior depends on document state.

Minimal fix:

Rename or split copy into a clearer label such as `Save summary PDF` when it downloads the summary, while preserving `View lease` and Schedule A actions.

Risk:

Low, frontend-only, but it is less urgent than removing the raw lease ID.

### `polish/lease-ledger-source-aware-return-actions-v1`

Problem:

Ledger can be reached from Dashboard, Operations, Leases, and Summary, but the page currently uses generic `Back to lease summary` and `Open operations` actions.

Minimal fix:

Add source-aware return copy only if source context is already safe and available. Avoid complex route-state plumbing.

Risk:

Low to medium depending on whether source context is route-only or projection-driven.

## P3 Optional Refinements

- Add `Open operations` to lease workflow pages only if manual QA shows demo operators need a command-center escape hatch from workflow review routes.
- Consider route-source helper copy on `/leases` when reached from Application Review Summary, but only if it does not introduce brittle query-param behavior.
- Review whether `Advanced lease reference` on ledger should remain visible behind disclosure for production demo screenshots.

## Validation Run

Recommended validation for this docs-only audit:

- `git diff --check`
- competitor-name scan on this audit artifact
- docs-only diff confirmation
- working tree clean confirmation

Recommended validation for `fix/lease-operations-safe-reference-display-v1`:

- `npm run test:single -- src/pages/LandlordActiveLeasesPage.test.tsx`
- frontend build
- `git diff --check`

Manual QA for follow-up:

- `/leases` desktop:
  - confirm no raw lease ID appears under property names
  - confirm safe property/unit/tenant/rent/status/readiness context still appears
  - confirm `Lease summary` routes to `/leases/:leaseId/summary`
  - confirm `Payment ledger` routes to `/leases/:leaseId/ledger`
  - confirm document, Schedule A, email, save, archive, rent setup, and workflow actions still work
- `/leases` reduced desktop and mobile:
  - confirm no horizontal overflow
  - confirm mobile cards remain readable
  - confirm raw lease ID remains hidden
- Regression:
  - `/leases/:leaseId/summary`
  - `/leases/:leaseId/ledger`
  - lease workflow routes
  - `/dashboard`
  - `/operations`

## Merge / Defer Recommendation

Merge this audit if the diff remains docs-only and validation passes.

Proceed next to:

`fix/lease-operations-safe-reference-display-v1`

Defer broader lease workspace navigation polish until after the default `/leases` workspace stops displaying raw lease identifiers.
