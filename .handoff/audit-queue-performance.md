# Review Queue Performance Audit

## Scope

Mission: Phase 2 Mission 8, Review Queue Frontend Performance Optimization.

Scope is frontend-only memoization for:

- `OperationalReviewQueue`
- `DecisionQueueSummary`
- `RegistryReviewQueueRow`
- `TriageQueueTable`
- immediate parent/dependency surfaces where prop stability affects those queues

No API routes, middleware, services, collections, auth rules, permissions, backend code, dependency versions, or visual designs were changed.

## Files Reviewed

- `rentchain-frontend/src/components/reviewWorkspaces/OperationalReviewQueue.tsx`
- `rentchain-frontend/src/components/reviewWorkspaces/OperationalReviewQueue.test.tsx`
- `rentchain-frontend/src/components/analytics/DecisionQueueSummary.tsx`
- `rentchain-frontend/src/components/analytics/DecisionQueueSummary.test.tsx`
- `rentchain-frontend/src/components/admin/RegistryReviewQueueRow.tsx`
- `rentchain-frontend/src/components/adminTriage/TriageQueueTable.tsx`
- `rentchain-frontend/src/components/reviewWorkspaces/ReviewWorkspacePanel.tsx`
- `rentchain-frontend/src/components/operatorReviews/OperatorReviewSessionPanel.tsx`
- `rentchain-frontend/src/components/reviewTimeline/CanonicalReviewTimeline.tsx`
- `rentchain-frontend/src/pages/OperationalCommandCenterPage.tsx`
- `rentchain-frontend/src/pages/admin/AdminRegistryReviewPage.tsx`
- `rentchain-frontend/src/pages/admin/AdminTriageQueuePage.tsx`
- `rentchain-frontend/src/pages/landlord/ActionRecommendationsPage.tsx`
- `rentchain-frontend/src/pages/landlord/LandlordAnalyticsPage.tsx`
- `rentchain-frontend/src/api/adminReviewWorkspacesApi.ts`
- `rentchain-frontend/src/api/operatorReviewApi.ts`
- `rentchain-frontend/src/hooks/`

## Baseline Profiling Notes

Browser React DevTools profiling was not completed in this terminal-only run. A live browser pass is still needed to record exact baseline and after-change render counts/timings.

Static render audit found these likely re-render triggers:

- `OperationalReviewQueue` received memoized `reviewQueueItems` from `OperationalCommandCenterPage`, but each queue item rendered inline metadata and safe label derivations on every queue render.
- `DecisionQueueSummary` recalculated decision state aggregation and recreated inline filter button callbacks on each render.
- `RegistryReviewQueueRow` was already wrapped in `memo`, but row address formatting and destination encoding were recalculated every render. Its parent virtual list calculated all row metrics and visible row slices during render.
- `TriageQueueTable` rendered each row inline, recalculated signal text and formatted timestamps during every table render, and had no row-level memo boundary.

## Existing Memoization Patterns

Observed conventions:

- Components and hooks use `React.useMemo`, `React.useCallback`, and imported `useMemo` / `useCallback` depending on file style.
- Existing hooks such as dashboard, onboarding, ledger, billing, and property hooks use callback-stable loaders and memoized return derivations.
- `OperatorReviewSessionPanel` already uses `React.useCallback` for session loading.
- `RegistryReviewQueueRow` already used `memo`, making row-level optimization a local extension rather than a new pattern.
- Parent pages already use memoized derived lists in several places, including `OperationalCommandCenterPage`.

## Prop and Dependency Map

### OperationalReviewQueue

- Props: `items`
- Parent: `OperationalCommandCenterPage`
- Parent derivation: `reviewQueueItems` is derived with `React.useMemo` from `visibleSignals`.
- Optimization target: queue shell, assigned count, and individual item card derivations.
- Risk to avoid: stale safe labels and stale review assignment control props.

### DecisionQueueSummary

- Props: `decisions`, `filter`, `onFilterChange`
- Parents: landlord action recommendations and landlord analytics pages.
- Parent callback: state setter is stable.
- Optimization target: aggregate counts and filter button callbacks.
- Risk to avoid: stale active filter state.

### RegistryReviewQueueRow

- Props: `item`
- Parent: `AdminRegistryReviewPage` virtualized list.
- Parent dependencies: item array from registry review API and paginated append.
- Optimization target: derived address strings, encoded paths, measured row boundary, virtual metrics, visible slice, and scroll callback.
- Risk to avoid: changing virtual list reset behavior, row keys, or navigation targets.

### TriageQueueTable

- Props: `items`
- Parent: `AdminTriageQueuePage`
- Parent dependencies: triage API response array and filter state.
- Optimization target: table shell, row boundary, formatted timestamp, signal summary line.
- Risk to avoid: stale signal text if nested signal fields change.

## Hook and API Audit

No queue component imports a custom hook directly.

API helpers inspected:

- `adminReviewWorkspacesApi.ts` constructs query strings and returns projected admin-only review workspace data. No client-side memoization change was needed.
- `operatorReviewApi.ts` exposes operator review session fetch/mutation helpers. `OperatorReviewSessionPanel` already wraps its loader in `useCallback`; no API change was needed.

No unnecessary refetch loop was introduced or found in the touched queue components.

## Auth and Data Safety

Safety checks preserved:

- No auth or permission logic changed.
- No backend route, middleware, service, collection, or API response shape changed.
- No tenant, landlord, admin, or support visibility boundary changed.
- No sorting, filtering, status workflow, status controls, or data display behavior intentionally changed.
- Existing safe display label fallback behavior in `OperationalReviewQueue` is preserved.
- Memoization uses prop/object identity and scalar field dependencies. No custom comparator was added that could hide legitimate data updates.

Existing note:

- Some admin registry labels already display internal registry/property identifiers. This mission did not add new labels or exports and did not broaden that existing display surface.

## Optimization Targets Implemented

- Wrapped `OperationalReviewQueue` in `memo`.
- Added memoized `OperationalReviewQueueCard` rows with memoized display labels and metadata descriptors.
- Memoized operational assigned count.
- Wrapped `DecisionQueueSummary` in `memo`.
- Memoized decision state aggregation and state filter descriptors.
- Added memoized `DecisionQueueFilterButton` with stable per-button click handlers.
- Kept `RegistryReviewQueueRow` memoized and memoized row address/path derivations.
- Wrapped registry virtual rows and virtual list in `memo`.
- Memoized registry virtual metrics and visible slice.
- Added a stable registry virtual list scroll handler.
- Wrapped `TriageQueueTable` in `memo`.
- Added memoized `TriageQueueRow` with memoized timestamp and signal summary derivations.

## Browser QA Still Needed

Run a live browser/React DevTools pass after local validation:

- Admin operational command center: record queue filter interactions and compare row renders.
- Decision queue summary page: toggle unrelated page state and verify summary does not repaint unless props change.
- Registry review queue: select/filter/scroll and verify virtual rows remain stable.
- Admin triage queue: filter and scroll with update highlighting enabled.
- Mobile viewport at 375 px for operational/admin queue surfaces.
