# RC1 Visible Surface Safe-Language Sweep v1

Branch: `audit/rc1-visible-surface-safe-language-sweep-v1`

Status: audit only. No runtime, frontend, backend, schema, routing, or projection changes.

## Executive Summary

No P0 RC1 demo blocker was found in the current landlord demo surface.

Recent RC1 polish materially improved the most visible paths:

- Application Review Summary no longer exposes raw application context and now uses landlord-facing screening guidance.
- Unified Inbox now prefers backend-generated safe source actions.
- Operations now clearly bridges into Unified Inbox.
- Application Review Summary now carries approved/lease-ready records toward `/leases`.
- `/leases` no longer displays raw `lease.id` as visible table copy.

The main remaining P1 safe-language risk is concentrated in landlord-visible screening surfaces, not across the whole app. The `/applications` screening panel can still render provider/debug-oriented copy such as `Provider: ...`, `Order ID`, `Reference ID`, `Copy reference ID`, and a `STUB` fallback. The `/verified-screenings` landlord route uses the shared `AdminVerifiedScreeningsPage` component and keeps raw enum-style queue values such as `QUEUED`, `IN_PROGRESS`, and service-level codes visible in landlord-facing queue cards.

Recommended next PR:

`fix/landlord-screening-visible-safe-language-v1`

## Routes Reviewed

Primary visible landlord RC1 demo routes reviewed:

- `/dashboard`
- `/operations`
- `/landlord/unified-inbox`
- `/applications`
- `/applications/:applicationId/review-summary`
- `/leases`
- `/leases/:leaseId/summary`
- `/leases/:leaseId/ledger`
- `/maintenance`
- `/analytics`
- `/contractors`
- `/verified-screenings`

Supporting route-shell check:

- `/admin/verified-screenings`

## Source Files Reviewed

- `rentchain-frontend/src/pages/DashboardPage.tsx`
- `rentchain-frontend/src/pages/OperationalCommandCenterPage.tsx`
- `rentchain-frontend/src/pages/UnifiedInboxPage.tsx`
- `rentchain-frontend/src/components/UnifiedInbox/UnifiedInboxList.tsx`
- `rentchain-frontend/src/pages/ApplicationsPage.tsx`
- `rentchain-frontend/src/pages/ApplicationReviewSummaryPage.tsx`
- `rentchain-frontend/src/pages/LandlordActiveLeasesPage.tsx`
- `rentchain-frontend/src/pages/LandlordLeaseSummaryPage.tsx`
- `rentchain-frontend/src/pages/LeaseLedgerPage.tsx`
- `rentchain-frontend/src/pages/MaintenanceRequestsPage.tsx`
- `rentchain-frontend/src/pages/landlord/LandlordAnalyticsPage.tsx`
- `rentchain-frontend/src/pages/landlord/ContractorsPage.tsx`
- `rentchain-frontend/src/pages/AdminVerifiedScreeningsPage.tsx`
- `rentchain-frontend/src/App.tsx`
- `rentchain-frontend/src/components/layout/LandlordNav.tsx`
- `rentchain-frontend/src/components/layout/navConfig.ts`

## P0 Blockers

None found.

No reviewed primary route appears to default-render raw Firestore IDs, storage paths, source lineage fields, provider payloads, or raw lease/application IDs in the main RC1 demo path after the recent fixes.

## P1 Recommended Next PR

### `fix/landlord-screening-visible-safe-language-v1`

Problem:

Landlord-visible screening surfaces still have the highest concentration of demo-unfriendly technical language. This is not a proven data-projection failure, but it can weaken enterprise-demo trust because the UI can look implementation-facing instead of landlord-facing.

Affected routes:

- `/applications`
- `/verified-screenings`

Likely files:

- `rentchain-frontend/src/pages/ApplicationsPage.tsx`
- `rentchain-frontend/src/pages/ApplicationsPage.test.tsx`
- `rentchain-frontend/src/pages/AdminVerifiedScreeningsPage.tsx`
- `rentchain-frontend/src/pages/AdminVerifiedScreeningsPage.test.tsx`

Findings:

- `/applications` still contains a completed-screening detail path that can render `Order ID`, `Provider: {detail.screening.provider || "STUB"}`, and screening result implementation fields.
- `/applications` screening receipt can render `Reference ID` and `Copy reference ID`, which reads like a vendor/internal reference in a landlord demo.
- `/applications` does format several screening statuses and provider labels safely in other areas, so the issue is localized rather than systemic.
- `/verified-screenings` is landlord-routed through `LandlordNav`, but the shared page still uses queue labels and enum-style values such as `QUEUED`, `IN_PROGRESS`, `COMPLETE`, `CANCELLED`, `APPROVE`, `DECLINE`, and `CONDITIONAL`.
- `/verified-screenings` hides the raw ID detail panel from the landlord audience, while `/admin/verified-screenings` still exposes `Order ID`, `Application ID`, `Property ID`, and `Unit ID` for admin use. This audience split should be preserved.

Proposed minimal fix:

- Normalize landlord-visible screening statuses to business-readable labels.
- Replace `STUB` fallback with `Not provided`, `Screening provider not available`, or another landlord-safe value.
- Hide or rename vendor-like `Order ID` and `Reference ID` fields on landlord-facing surfaces unless they are explicitly intended as safe display references.
- Preserve admin-only internal detail fields on `/admin/verified-screenings` if they remain necessary for operator support.
- Keep backend projection unchanged unless frontend data proves insufficient.

Acceptance criteria:

- `/applications` does not display `STUB`, raw provider codes, raw order IDs, or raw screening reference IDs as landlord-facing copy.
- `/verified-screenings` landlord route uses readable labels for screening status, recommendation, and service level.
- `/admin/verified-screenings` can retain admin/operator detail where appropriate.
- No raw application, property, unit, provider, vendor, or Firestore IDs are exposed on landlord-facing screening surfaces.
- Application Review Summary remains unchanged unless a regression is found.
- Regression routes load: `/dashboard`, `/operations`, `/applications`, `/verified-screenings`, `/leases`, `/maintenance`.

Risk level:

Low to medium. This should be frontend-only copy/label normalization if existing data is sufficient. Risk increases if product decides that vendor/order references must be preserved for landlord audit workflows; that should be handled by safe display-reference copy, not raw identifiers.

## Route-By-Route Findings

### `/dashboard`

No P0/P1 safe-language issue found. The scan did not identify default-visible raw IDs, provider refs, storage paths, or Firestore-like references in the dashboard page.

### `/operations`

No P0/P1 issue found. The command center has helper functions that map known internal signal keys into landlord-facing copy. Unknown multi-underscore keys can still be title-cased as a fallback, which is acceptable for now but belongs in P3 polish if new raw signal keys appear in demo data.

### `/landlord/unified-inbox`

No P0/P1 issue found. The frontend filters records by audience role, uses safe source labels, validates backend-provided `sourceAction.href` as a safe relative path, and preserves broad fallback actions when no safe action exists. This aligns with the recent safe source-action work.

### `/applications`

P1 screening-safe-language issue found.

The route is otherwise much stronger after recent Application Review Summary and Applications workflow polish, but the selected application screening area still contains localized provider/vendor-oriented copy that can appear in landlord-facing review. The main concern is not broad route safety; it is specific screening receipt and completed-screening detail language.

### `/applications/:applicationId/review-summary`

No new P0/P1 issue found. Recent fixes appear to have addressed raw Application ID, screening status/provider label normalization, source-safe context hydration, status-aware guidance, and page/PDF layout clarity.

Do not reopen this route unless manual QA finds a regression.

### `/leases`

No new P0/P1 issue found. The prior raw `lease.id` table subline has been replaced with landlord-facing `Lease workspace` copy.

### `/leases/:leaseId/summary`

No P0/P1 issue found. URL routing still uses canonical lease IDs, which is expected. Visible summary actions and lease context are landlord-facing.

### `/leases/:leaseId/ledger`

No P0/P1 issue found. The page does include an explicitly collapsed `Advanced lease reference` detail using `formatInternalReference("lease", leaseId)`. Because it is not default-visible and is labeled as advanced reference context, this is not a blocker for RC1 demo flow. Consider a future review only if the demo script expands advanced references.

### `/maintenance`

No P0/P1 issue found. Existing helpers avoid falling back to raw property/unit IDs in the visible maintenance labels by returning generic `Property` or `Unit` when safe labels are unavailable.

### `/analytics`

No P0/P1 issue found. Property filtering uses safe property names or generic `Filtered property`/`All properties` labels.

### `/contractors`

No P0/P1 issue found. Invite history shows email, status, dates, invite link, and actions. Status values may remain lowercase depending on payload, but no raw internal IDs were found in the reviewed visible table/card output.

### `/verified-screenings`

P1 screening-safe-language issue found.

The route now correctly uses `LandlordNav`, which fixes the prior shell problem. The remaining issue is that the landlord-facing audience still sees raw-ish queue/status/service-level values from the shared `AdminVerifiedScreeningsPage`. Admin-only raw detail fields remain gated behind the admin audience path and should not be removed without an admin-support decision.

## P2 Later Polish

- Contractor invite status labels could be normalized from raw payload values to title-case landlord-facing values if demo data exposes lowercase or snake-case status strings.
- Lease ledger `Advanced lease reference` could be renamed to clarify that it is support/reference context, not normal landlord workflow content.
- Operations unknown signal fallback could avoid title-casing arbitrary internal keys and instead use a generic "Operational review needed" fallback when no known copy exists.

## P3 Optional Refinements

- Add a route-level visible-language snapshot test for the landlord RC1 demo routes once Playwright coverage is stable enough to make this low-maintenance.
- Document a reusable frontend helper for landlord-safe enum/status labeling across screening, contractors, operations, and ledger surfaces.

## Validation Run

Planned validation for this docs-only audit:

- `git diff --check`
- `git diff --cached --check`
- competitor-name scan on this audit artifact
- docs-only diff confirmation
- working tree clean confirmation

## Merge / Defer Recommendation

Merge this audit if validation passes and PR checks are green/non-blocking.

Proceed next to:

`fix/landlord-screening-visible-safe-language-v1`

Defer broad UI redesign. The current finding is focused enough for a small frontend-only PR and should not require backend or projection changes unless implementation discovers that the public payload itself contains unsafe landlord-visible values with no safe display alternative.
