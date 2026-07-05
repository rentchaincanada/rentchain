# Mobile Responsive Routes Contractors Screenings Audit v1

Issue: route-level responsive audit before broader RC1 navigation polish
Mission: `audit/mobile-responsive-routes-contractors-screenings-v1`
Status: audit only, no implementation changes

## Executive Summary

Two concrete route issues were reviewed:

- `/contractors` is inside the landlord navigation shell, so the mobile bottom nav should appear. The likely responsive problem is page-level content density, especially the invite-history table and contractor form/card rows that can force narrow layouts or horizontal overflow at reduced widths.
- `/verified-screenings` is not inside `LandlordNav`. It renders `AdminVerifiedScreeningsPage` directly inside `RequireAuth`, and that page renders its own `MacShell`. This explains why the landlord mobile bottom nav is missing on mobile and reduced-width layouts.

The two issues do not appear to share one layout-shell root cause. The safest implementation follow-up is one focused frontend branch with two route-specific fixes:

1. Make `/contractors` mobile-safe by converting or containing the invite-history table and hardening contractor cards/forms for narrow widths.
2. Put the landlord-facing `/verified-screenings` route into the correct landlord shell or introduce a landlord-safe wrapper for that route, while keeping the admin route separate.

Recommended follow-up: `fix/mobile-responsive-contractors-and-verified-screenings-v1`.

## Source Files Reviewed

- `rentchain-frontend/src/App.tsx`
- `rentchain-frontend/src/components/layout/LandlordNav.tsx`
- `rentchain-frontend/src/components/layout/LandlordNav.css`
- `rentchain-frontend/src/components/layout/LandlordNav.test.tsx`
- `rentchain-frontend/src/components/layout/navConfig.ts`
- `rentchain-frontend/src/components/layout/MacShell.tsx`
- `rentchain-frontend/src/components/layout/ResponsiveMasterDetail.css`
- `rentchain-frontend/src/pages/landlord/ContractorsPage.tsx`
- `rentchain-frontend/src/pages/landlord/ContractorsPage.test.tsx`
- `rentchain-frontend/src/components/marketplace/ContractorCard.tsx`
- `rentchain-frontend/src/components/marketplace/ContractorFilterBar.tsx`
- `rentchain-frontend/src/components/marketplace/ContractorProfileForm.tsx`
- `rentchain-frontend/src/pages/AdminVerifiedScreeningsPage.tsx`
- `rentchain-frontend/src/index.css`

## Current Behavior

### `/contractors`

`App.tsx` registers `/contractors` under the standard landlord shell:

- `RequireAuth`
- `LandlordNav`
- `Suspense`
- `ContractorsPage`

`navConfig.ts` also includes `Contractors` at `/contractors` with `showInDrawer: true` and `requiresLandlordOrAdmin: true`.

This means the route already uses the same broad shell family as known-good landlord pages. Mobile bottom nav should be available for landlord users unless the actor is admin-like, because `LandlordNav` only renders landlord bottom tabs for non-admin landlord contexts.

The route content itself is dense:

- filter grid
- active/archived toggles
- create/edit contractor form
- contractor cards
- invite contractor form
- invite history table with seven columns

The invite-history table is the clearest overflow risk. It renders as a plain full-width table with columns for Email, Status, Created, Expires, Accepted, Invite Link, and Actions. There is no mobile card alternative and no controlled horizontal-scroll wrapper.

### `/verified-screenings`

`App.tsx` registers `/verified-screenings` as:

- `RequireAuth`
- `Suspense`
- `AdminVerifiedScreeningsPage`

It does not wrap the route in `LandlordNav`.

The same `AdminVerifiedScreeningsPage` also backs `/admin/verified-screenings`, which makes the current route look like an admin queue exposed at a non-admin path. The page itself renders `MacShell`, not `LandlordNav`, so it gets `TopNav`/MacShell behavior but not the landlord mobile topbar, bottom nav, drawer spacing, or mobile shell constraints.

`navConfig.ts` includes a `Verified Screenings` drawer item at `/verified-screenings` without `requiresAdmin`. That suggests the route is intended to be discoverable from landlord workspace navigation, but the route component is not using the landlord shell that provides the bottom nav.

## Root Cause Hypothesis

### `/contractors`

Root cause category: page CSS/component responsiveness.

The route shell is correct. The issue is likely caused by route content that assumes desktop width:

- invite-history table is not converted into mobile cards or contained in a bounded scroll area
- contractor card header uses a horizontal flex row that can compress name/status content
- form and filter grids are responsive but still use minimum column widths that may need `minmax(0, 1fr)` and explicit `min-width: 0`
- raw invite links, long emails, contractor names, service areas, or categories can create text wrapping pressure

The fix should not change route registration or landlord nav for `/contractors`.

### `/verified-screenings`

Root cause category: route shell mismatch.

The route is outside `LandlordNav`, so landlord mobile bottom nav cannot render. Wrapping only the admin implementation in a landlord shell is not enough to consider the job done, because the page currently displays admin-oriented title and detail fields.

There is also a safety/product clarity concern: `AdminVerifiedScreeningsPage` detail content includes raw-looking labels such as Order ID, Application ID, Property ID, and Unit ID. If `/verified-screenings` is meant to be a landlord-facing route, the implementation should avoid exposing raw internal/provider identifiers by default. If it is meant to be admin-only, the drawer visibility and route should be corrected instead.

## Route-by-Route Findings

### `/contractors`

Findings:

- Uses `LandlordNav` through `App.tsx`.
- Has a drawer entry through `navConfig.ts`.
- Does not appear to be missing the landlord mobile bottom nav.
- Main responsive risk is the invite-history table.
- Secondary risk is narrow text wrapping in contractor profile cards, contact fields, categories, service areas, and the embedded create/edit form.
- Existing tests cover directory rendering, entitlement teaser, create/edit, active/archived filtering, archive, and restore behavior. They do not cover responsive layout or mobile table/card behavior.

Recommended implementation:

- Keep `/contractors` route shell unchanged.
- Replace invite history table with mobile cards at narrow widths, or wrap the table in a controlled scroll container with visible bounds. Mobile cards are preferred for RC1 usability.
- Add `minWidth: 0`, `overflowWrap: "anywhere"`, and `flexWrap` where contractor names, emails, categories, and service areas can be long.
- Keep desktop table behavior if it is still useful on wide viewports.
- Add focused tests that prove invite history remains visible and contractor action buttons remain available after the layout change.

### `/verified-screenings`

Findings:

- `/verified-screenings` is not wrapped in `LandlordNav`.
- `/admin/verified-screenings` uses the same page component.
- `AdminVerifiedScreeningsPage` renders `MacShell`, which has its own sticky `TopNav`.
- `LandlordNav.css` is where landlord mobile bottom nav, drawer, bottom spacing, and mobile overflow containment are provided.
- The page already uses `ResponsiveMasterDetail`, which should help the queue/detail split on mobile once the shell is corrected.
- Detail content includes internal-looking identifiers and admin terminology, so a landlord-facing fix should include display-safety review.

Recommended implementation:

- Decide whether `/verified-screenings` is landlord-facing or admin-only before changing markup.
- If landlord-facing:
  - Wrap `/verified-screenings` in `LandlordNav`.
  - Prefer a landlord-safe verified-screenings page or mode that avoids raw provider/internal IDs by default.
  - Keep `/admin/verified-screenings` on the admin shell/admin route.
  - Confirm bottom nav appears for landlord role contexts at mobile widths.
- If admin-only:
  - Add the appropriate admin guard and remove or restrict the non-admin drawer entry.
  - Do not present this route as a landlord mobile-nav issue.

The current product/navigation shape suggests landlord-facing access is intended because `Verified Screenings` is in `navConfig.ts` without `requiresAdmin`, but the implementation should confirm this expectation before exposing admin-detail fields in the landlord shell.

## Shared Layout and Navigation Findings

Known-good routes such as `/dashboard`, `/operations`, `/applications`, `/leases`, and `/maintenance` use `LandlordNav` in `App.tsx`. That shell provides:

- mobile topbar
- bottom tab bar
- More/drawer menu
- mobile bottom padding
- mobile overflow containment for ordinary landlord pages

`/contractors` already follows that pattern.

`/verified-screenings` does not follow that pattern. It is the outlier for missing landlord bottom nav.

There is no evidence that a shared global shell regression is causing both observed issues. A shared fix to `LandlordNav` would risk unnecessary blast radius. The follow-up should be route-specific.

## Recommended Implementation Mission

Branch: `fix/mobile-responsive-contractors-and-verified-screenings-v1`

Problem:

- `/contractors` content can fail mobile/reduced-width layout because the invite-history table and dense contractor content are not fully responsive.
- `/verified-screenings` misses landlord bottom nav because it is not rendered inside `LandlordNav`.

Affected routes:

- `/contractors`
- `/verified-screenings`

Proposed minimal fix:

- For `/contractors`, keep route shell unchanged and make the invite-history area responsive. Use mobile cards at narrow widths or a bounded table scroll container, with mobile cards preferred. Add safe text wrapping for contractor/invite fields.
- For `/verified-screenings`, put the landlord-facing route in the landlord shell or create a landlord-safe wrapper/page for that route. Keep `/admin/verified-screenings` separate. Do not expose raw internal/provider IDs in the default landlord-facing view.

Risk level: medium.

The `/contractors` fix is low-risk frontend layout work. The `/verified-screenings` fix is medium-risk because the route currently reuses an admin page and may need a small audience/surface decision to avoid making admin-oriented fields landlord-facing.

## Implementation Acceptance Criteria

- `/contractors` resizes cleanly on mobile and reduced desktop widths.
- `/contractors` has no uncontrolled horizontal page overflow.
- `/contractors` cards/forms/tables stack or scroll in a controlled, readable way.
- `/contractors` filters still work.
- `/contractors` invite history remains visible and usable.
- `/contractors` existing contractor create/edit/archive/restore behavior remains intact.
- `/verified-screenings` displays the landlord bottom nav on mobile/reduced desktop if it is intended to be landlord-facing.
- `/verified-screenings` uses the correct landlord shell/layout for landlord contexts.
- `/verified-screenings` does not expose raw internal IDs, provider order IDs, or unit/property/application IDs by default in landlord-facing view.
- `/admin/verified-screenings` remains available for admin use if required.
- Existing desktop layouts remain acceptable.
- Regression routes remain intact:
  - `/dashboard`
  - `/operations`
  - `/applications`
  - `/leases`
  - `/maintenance`

## Suggested Test Coverage

- `ContractorsPage.test.tsx`
  - invite history renders in the responsive presentation
  - invite actions remain available
  - contractor cards still expose edit/archive/restore actions
- `LandlordNav.test.tsx` or route-level test
  - landlord mobile shell can include `/verified-screenings` when that route is landlord-facing
  - admin-like contexts still do not render landlord bottom nav
- `App.routes.test.tsx`
  - `/verified-screenings` uses the intended shell/guard
  - `/admin/verified-screenings` remains separate if admin route is preserved

## Manual QA Checklist

### `/contractors` Desktop

- Confirm filters work.
- Confirm contractor cards are readable.
- Confirm create/edit profile form remains usable.
- Confirm invite contractor form remains usable.
- Confirm invite history remains visible and usable.
- Confirm no desktop regression.

### `/contractors` Mobile / Reduced Desktop

- Confirm page resizes cleanly.
- Confirm no horizontal page overflow.
- Confirm contractor cards stack/read cleanly.
- Confirm invite history is readable without forcing full-page horizontal scroll.
- Confirm drawer and bottom nav remain available.

### `/verified-screenings` Desktop

- Confirm the intended route audience:
  - landlord-facing `/verified-screenings`, or
  - admin-only `/verified-screenings`.
- Confirm page layout remains usable.
- Confirm no raw internal/provider IDs are visible in landlord-facing mode.

### `/verified-screenings` Mobile / Reduced Desktop

- Confirm landlord bottom nav appears if the route is landlord-facing.
- Confirm the mobile topbar/drawer spacing matches other landlord routes.
- Confirm queue/detail layout remains readable.
- Confirm no horizontal page overflow.

### Regression

- `/dashboard`
- `/operations`
- `/applications`
- `/leases`
- `/maintenance`

## Non-Goals for Follow-Up

- No backend changes unless the implementation discovers that a landlord-safe verified-screenings projection is missing.
- No screening provider workflow changes.
- No contractor/work-order data model changes.
- No nav redesign.
- No tenant navigation changes.
- No admin-console redesign.
