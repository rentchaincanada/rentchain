# Landlord Dashboard Theme Alignment Audit

## Executive Summary

The logged-in landlord app is still primarily built on the older cool blue/white product palette. That theme is not concentrated in one route. It comes from shared frontend tokens, shared UI primitives, the landlord shell/navigation layer, and route-local inline styles on dashboard and operational pages.

There are no P0 blockers for RC1 demo readiness. The risk is brand continuity: the public landing, pricing, auth, and tenant-entry surfaces now use the warmer RentChain brand direction, while the landlord command center still reads as a separate blue SaaS product.

The safest next implementation PR should not repaint the whole logged-in app or edit global primitives. Start with a small landlord-only foundation:

`polish/landlord-shell-dashboard-warm-neutral-foundation-v1`

That PR should align the landlord shell and `/dashboard` first-screen surfaces with warm neutral page, card, nav, and action treatments while preserving status colors, workflow semantics, mobile bottom nav, and existing dashboard behavior.

## Routes Reviewed

Primary surfaces:

- `/dashboard`
- `/properties`
- `/tenants`
- `/leases`
- `/applications`
- `/landlord/unified-inbox`
- `/operations`
- `/maintenance`
- `/payments`
- `/analytics`

Supporting shell and primitives:

- `rentchain-frontend/src/styles/tokens.ts`
- `rentchain-frontend/src/components/ui/Ui.tsx`
- `rentchain-frontend/src/components/layout/MacShell.tsx`
- `rentchain-frontend/src/components/layout/TopNav.tsx`
- `rentchain-frontend/src/components/layout/LandlordNav.tsx`
- `rentchain-frontend/src/components/layout/LandlordNav.css`

## Current Theme Source Map

### Global Tokens

`rentchain-frontend/src/styles/tokens.ts` defines the current app-wide product palette:

- `colors.bg` uses a cool off-white.
- `colors.bgAmbient` uses a blue/sky ambient gradient.
- `colors.panel` and `colors.card` are white.
- `colors.accent` is blue.
- `colors.accentSoft` is blue-tinted.
- `shadows.focus` uses a blue focus ring.

These tokens are imported by landlord, tenant, contractor, admin, auth-adjacent, and shared operational components. Changing them globally would be high blast radius and should not be the first step.

### Shared UI Primitives

`rentchain-frontend/src/components/ui/Ui.tsx` uses the global tokens for:

- primary and secondary buttons
- inputs and focus states
- pills and accent badges
- cards, sections, empty states, skeletons, and inline errors

The shared primitives are useful long-term alignment points, but not safe as the first PR because they affect logged-in product pages across roles. Error semantics in `InlineError` should be preserved.

### Shell and Navigation

The landlord shell is a better first target than global tokens:

- `MacShell.tsx` applies the app background and top nav wrapper.
- `TopNav.tsx` uses blue account and unread indicators.
- `LandlordNav.css` controls the landlord workspace row, active workspace pill, account badges, drawer, and mobile bottom navigation.

The shell is visible on most landlord surfaces. A landlord-scoped theme layer here would create immediate brand continuity without changing workflows.

### Route-Local Inline Styles

Several routes add blue visual emphasis directly:

- `/dashboard`: blue upcoming state, route icons, selected views, collected-rent chart, focus cards.
- `/operations`: blue selected filters and operational inbox bridge accents.
- `/landlord/unified-inbox`: blue selected tabs and counts.
- `/leases`: blue lease workspace/status accents.
- `/maintenance`: blue scheduled/normal tones and active calendar filters.
- `/tenants` and `/properties`: blue links, selected cards, and action highlights.
- `/decision-inbox`: blue pending/under-review/derived states and links.

These should be handled in phases, preserving semantic status colors where blue currently means an actual workflow state.

## Surface Findings

### `/dashboard`

Priority: P1 first implementation surface.

The dashboard is the landlord's first logged-in command-center impression and contains the highest brand-continuity mismatch. It uses a mix of `MacShell`, shared cards, route-local blue accent styles, KPI cards, review queues, calendar, command routes, and operational status panels.

The dashboard should be warmed carefully. Do not alter data fetching, command-center filtering, onboarding logic, or decision routing. The safe first pass is visual containment: page background, top cards, nav action accents, command route cards, and selected control treatment.

### `/operations`

Priority: P2 after shell/dashboard.

Operations recently received Unified Inbox bridge polish. Its purpose is now clear, but it still uses blue selected filters and card emphasis. Since it is status-heavy and review-workflow-heavy, treat it after the shell foundation so operational semantics remain stable.

### `/landlord/unified-inbox`

Priority: P2 after shell/dashboard.

Unified Inbox now carries safe source actions and read-state behavior. Its selected tab styling and counts still use blue accents. It should follow the shell foundation, but avoid changing source-action labels, routing, read-state persistence, or public payload assumptions.

### `/properties`

Priority: P2/P3.

Properties is dense and workflow-sensitive. It includes property/unit management, action requests, leases, print summaries, upgrade CTAs, and several inline styles. It should not be bundled into the first shell/dashboard PR. A later route-specific PR can align cards, headers, empty states, and safe action accents.

### `/tenants`

Priority: P2/P3.

Tenants uses shared cards and selected states, plus route-local blue links/action highlights. It is less urgent than dashboard and operations, but should be included in a second landlord workspace pass with properties.

### `/leases`

Priority: P2/P3.

Lease list, summary, ledger, and workflow pages are highly operational and status-heavy. Recent RC1 work improved safe references, workflow spacing, and navigation continuity. Theme alignment should preserve status/readiness semantics and not change ledger, payment, signing, or PDF behavior.

### `/applications`

Priority: P2/P3.

Applications and Application Review Summary are already RC1-ready for content, safety, state-aware guidance, and layout clarity. Do not reopen them unless a visible theme mismatch is part of a broader landlord shell pass. Preserve review summary, print/PDF, and decision behavior.

### `/maintenance`

Priority: P2/P3.

Maintenance has recent density polish and uses blue tones for scheduled/normal states and active calendar filters. It should be handled after the landlord shell foundation, preserving lifecycle and priority semantics.

### `/payments`

Priority: P3/defer.

Payments and obligation surfaces are financial and status-sensitive. Theme changes here should be later and explicitly validated against payment readiness, ledger, checkout, and evidence behavior.

### `/analytics`

Priority: P2/P3.

Analytics uses a broad set of panels, tabs, metrics, alerts, and print output. Brand alignment is useful but should not be first because route density and report semantics are more important than palette in the first implementation.

### Admin/Internal Surfaces

Priority: defer.

Admin/support surfaces should not be warmed as part of the landlord theme pass. They have different audience and support/debug requirements. Keep admin route behavior and identifiers intact unless a separate admin-facing mission asks otherwise.

## Risk Classification

### Safe First

- Landlord shell/workspace nav colors and active states.
- Dashboard top-level page background and card styling.
- Dashboard command route cards and selected non-status controls.
- Focus ring/color tokens only if scoped locally to the landlord shell/dashboard.

### Moderate Risk

- Properties, tenants, applications, leases list, maintenance, operations, and Unified Inbox card accents.
- Route-local selected states where blue may be only decorative.
- Links and helper copy inside workflow-heavy pages.

### Defer

- Shared `tokens.ts`.
- Shared `Ui.tsx` primitives.
- Payment, ledger, signing, screening, and decision workflow semantics.
- Admin/support routes.
- Backend, entitlement, auth, billing, and projection behavior.

## Recommended First PR

Branch:

`polish/landlord-shell-dashboard-warm-neutral-foundation-v1`

Objective:

Create a landlord-scoped warm neutral visual foundation for the logged-in command center without touching shared product primitives or changing workflow behavior.

Likely files:

- `rentchain-frontend/src/components/layout/LandlordNav.css`
- `rentchain-frontend/src/components/layout/LandlordNav.tsx`
- `rentchain-frontend/src/components/layout/TopNav.tsx`
- `rentchain-frontend/src/pages/DashboardPage.tsx`
- `rentchain-frontend/src/pages/DashboardPage.test.tsx`
- `rentchain-frontend/src/components/layout/LandlordNav.test.tsx` if an existing test file is present or practical

Minimal fix direction:

- Add landlord-only CSS variables or route-local constants for warm paper, pine, amber, navy, and muted text.
- Apply them to the landlord nav shell, workspace active state, account badge, drawer header, and mobile bottom nav active state.
- Align `/dashboard` top-level background, first-screen cards, command route cards, and non-status selected controls.
- Preserve semantic status colors for critical, warning, success, unavailable, delinquent, and readiness states.
- Preserve mobile bottom nav and reduced-desktop wrapping behavior.

Acceptance criteria:

- `/dashboard` feels aligned with the warm neutral public/auth brand direction.
- Landlord top nav, workspace nav, drawer, and mobile bottom nav use landlord-scoped warm neutral treatments.
- No global shared token or shared UI primitive repaint is introduced.
- Dashboard workflow data, filters, onboarding, queues, routes, and CTAs are unchanged.
- Status/error/warning/success meaning remains obvious and accessible.
- Desktop, reduced desktop, and mobile layouts remain readable.
- No horizontal overflow.
- Regression routes still load:
  - `/dashboard`
  - `/operations`
  - `/properties`
  - `/applications`
  - `/leases`
  - `/landlord/unified-inbox`
  - `/maintenance`

Validation:

- `npm run test -- DashboardPage`
- `npm run test -- LandlordNav` if a test exists or is added
- `npm run build`
- `git diff --check`

Manual QA:

- Desktop `/dashboard`: confirm warmer first impression, readable cards, no data/control regressions.
- Reduced desktop `/dashboard`: confirm nav wraps cleanly and cards remain balanced.
- Mobile `/dashboard`: confirm bottom nav remains usable and no overflow appears.
- Landlord shell routes: spot-check `/operations`, `/properties`, `/applications`, `/leases`, `/landlord/unified-inbox`, and `/maintenance`.
- Confirm visible focus states remain clear.
- Confirm error and warning states are not softened into low-contrast decorative states.

## Phased Rollout Plan

### Phase 1: Landlord Shell + Dashboard Foundation

Implement the recommended first PR. This gives the landlord app a new visual entry point without touching dense workflows or cross-role primitives.

### Phase 2: Core Landlord Workspace Lists

Align lower-risk list/card surfaces after the shell is stable:

- `/properties`
- `/tenants`
- `/leases`
- `/applications`

Keep each route grouped by workflow risk. Preserve routing, print/export, status labels, and safe-ID rules.

### Phase 3: Operational Bridge Surfaces

Align:

- `/operations`
- `/landlord/unified-inbox`
- `/decision-inbox`
- `/maintenance`
- work-order surfaces if included in the landlord shell

These pages should keep priority, escalation, read-state, and source-action semantics intact.

### Phase 4: Financial, Lease, and Evidence-Heavy Surfaces

Align:

- `/payments`
- lease summary
- lease ledger
- lease workflow routes
- analytics print/report surfaces

Treat these as high-validation routes because status colors, payment readiness, document availability, evidence, and export behavior are operationally meaningful.

### Phase 5: Admin/Internal Surfaces

Evaluate admin/support styling separately. Do not include admin surfaces in the landlord brand alignment sequence unless a route is intentionally landlord-facing.

## P0 Blockers

None found.

## P1 Recommended Next PR

`polish/landlord-shell-dashboard-warm-neutral-foundation-v1`

This is the highest-leverage first implementation because `/dashboard` is the landlord's first command-center impression and the landlord shell frames every major landlord route. It also avoids the risk of repainting shared primitives used by tenant, contractor, admin, and auth surfaces.

## P2 Later Polish

- Route-specific list/card alignment for properties, tenants, leases, applications, and maintenance.
- Unified Inbox and Operations accent alignment after confirming source-action/read-state behavior still passes.
- Analytics visual alignment with care around charts, print output, and metric semantics.

## P3 Optional Refinements

- Document a landlord-only semantic color guide that separates brand accents from operational states.
- Add visual regression screenshots for `/dashboard`, `/operations`, and `/landlord/unified-inbox` once the shell foundation is implemented.
- Consider a longer-term shared token migration only after landlord-only alignment proves stable.

## Validation Run

This audit is docs-only. Required validation:

- `git diff --check`
- docs-only diff confirmation
- working tree clean after commit

## Merge / Defer Recommendation

Merge this audit as a docs-only planning PR if validation passes. Defer implementation to `polish/landlord-shell-dashboard-warm-neutral-foundation-v1`; do not bundle route repainting, shared token migration, or operational workflow changes into the audit PR.
