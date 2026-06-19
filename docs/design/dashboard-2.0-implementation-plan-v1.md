# Dashboard 2.0 Implementation Plan V1

## Scope

This document plans the future implementation sprint for `feat/dashboard-2.0-operational-home-v1`.

It is planning only. It does not implement UI, API routes, backend services, CSS, navigation, or data model changes.

This plan assumes:

- The normalized landlord decision queue service from PR #1184 exists.
- The read-only decision queue API from PR #1185 is the intended decision source once reviewed and merged.
- Dashboard 2.0 IA from PR #1186 and the Dashboard versus Operations entrypoint model from PR #1187 are the design baseline.

## Product Objective

Dashboard 2.0 should become the landlord operational home.

It should answer:

1. Is my portfolio healthy?
2. What requires attention today?
3. What decisions must I make?
4. What actions should I take next?
5. How is my business performing?

Dashboard should summarize and route. Operations should own the full queue. Source workspaces should resolve the work.

## Implementation Phases

### Phase 0: Preconditions

Goal: ensure prerequisites are merged and stable before UI work begins.

Required before implementation:

- PR #1185 reviewed and merged.
- Dashboard IA docs reviewed and merged.
- Entrypoint architecture reviewed and merged.
- Current Dashboard behavior documented enough to avoid losing existing onboarding and free-tier states.

Validation:

- Confirm `GET /api/landlord/decision-queue` contract.
- Confirm route-version header and filter semantics.
- Confirm no Dashboard 2.0 UI work starts before the API contract is available.

### Phase 1: Data Adapter And Page Boundary

Goal: introduce a frontend adapter layer for Dashboard 2.0 data without changing the visual experience yet.

Work:

- Add a Dashboard 2.0 data adapter that consumes existing dashboard summary data and the decision queue API.
- Normalize dashboard widget inputs into stable view models.
- Preserve existing dashboard route and auth behavior.
- Keep existing onboarding/free-tier prompts available.

Outputs:

- Portfolio status view model.
- Decision queue preview view model.
- Upcoming actions view model.
- Financial snapshot view model.
- Portfolio detail view model.

Non-goals:

- No visual redesign in this phase.
- No Operations queue implementation.
- No new backend aggregation endpoint unless later justified.

### Phase 2: Portfolio Status And Decision Preview

Goal: replace the top dashboard experience with the new operational home hierarchy.

Work:

- Implement Portfolio Status as the first section.
- Implement Decision Queue Preview using the normalized queue.
- Cap visible queue items.
- Use clear empty and degraded states.
- Link "View all decisions" to Operations or the existing full queue route until Operations 2.0 exists.

Critical details:

- Do not show all queue items on Dashboard.
- Do not treat ordinary unread messages as warnings.
- Do not turn onboarding setup into critical issues.

### Phase 3: Upcoming Actions And Financial Snapshot

Goal: separate planned work from warnings and restore financial business context.

Work:

- Implement Upcoming Actions from upcoming queue items and safe lifecycle dates.
- Implement Financial Snapshot from existing payment/ledger summaries and payment queue items.
- Keep overdue/failed/underpaid states distinct from missing setup.

Decision rules:

- Upcoming items should not look broken until thresholds are crossed.
- Missing rent terms are warnings only when they block a real workflow.
- Financial totals must show freshness or degrade safely.

### Phase 4: Portfolio Detail And Workspace Routing

Goal: provide compact workspace routing without recreating source tables.

Work:

- Add compact Portfolio Detail for Properties, Tenants, Leases, Maintenance, Payments, Messaging, and Trust/Compliance as applicable.
- Annotate detail rows with queue counts by workspace where available.
- Route to source workspaces for detail and resolution.

Avoid:

- Full tenant table.
- Full lease table.
- Full maintenance list.
- Full message inbox.
- Full ledger.

### Phase 5: Operations Handoff And Navigation Prep

Goal: make Dashboard handoffs ready for Operations and future sticky navigation.

Work:

- Ensure Dashboard item actions route directly to owning workspace when possible.
- Ensure secondary "View all" routes to Operations or the current queue surface.
- Preserve route labels that can survive a future sticky workspace shell.
- Confirm mobile route targets remain usable.

Non-goals:

- No full Operations redesign unless separately scoped.
- No sticky shell build unless separately approved.

### Phase 6: QA, Preview, And Iteration

Goal: verify the operational home behavior before merge.

Work:

- Run focused frontend tests.
- Run frontend build.
- Run backend checks only if Dashboard touches backend code.
- Run manual preview QA for first-login, active portfolio, empty portfolio, mobile, degraded queue, and routing.

## Component Ownership

| Component or adapter | Responsibility | Data source | Owning surface |
| --- | --- | --- | --- |
| Dashboard page shell | Maintains Dashboard as post-login operational home. | Existing frontend route/auth state. | Dashboard |
| Portfolio Status section | Shows portfolio health and critical count. | Dashboard summary, decision queue aggregates, domain summaries. | Dashboard |
| Decision Queue Preview | Shows top actionable items only. | Decision queue API. | Dashboard preview; Operations owns full queue. |
| Upcoming Actions | Shows near-term planned work. | Decision queue upcoming items, lease/notice lifecycle summaries. | Dashboard preview; source workspaces resolve. |
| Financial Snapshot | Shows rent/payment pulse. | Payment/ledger summaries and payment queue items. | Dashboard preview; Ledger/Payments resolve. |
| Portfolio Detail | Routes to domain workspaces. | Property/unit/tenant/lease/maintenance summaries. | Dashboard navigation |
| Messaging Signal Preview | Shows only urgent/awaiting-response communication signals. | Message-derived queue items and safe inbox aggregates. | Dashboard preview; Messaging resolves. |
| Dashboard data adapter | Converts API/domain data into widget-ready view models. | API clients and existing hooks. | Frontend data boundary |
| Dashboard empty/degraded state helpers | Prevent false urgency and stale critical states. | Adapter-level status. | Dashboard |

## Data Dependencies

Primary:

- Decision queue API for critical/warning/needs-review/upcoming decision preview.
- Existing dashboard summary for activation and portfolio baseline.
- Payment/ledger summaries for financial snapshot.
- Lease lifecycle and notice timing data for upcoming actions where already available.
- Property/unit/tenant/maintenance summaries for portfolio detail.

Secondary:

- Unified inbox or message-derived queue items for communication signals.
- Trust/compliance summaries only when material and already available.

Do not add new backend dependencies unless implementation proves the existing APIs cannot support safe Dashboard view models.

## API Dependencies

Required:

- `GET /api/landlord/decision-queue` after PR #1185 is merged.

Expected filters:

- `severity`
- `workspace`
- `status` or `open`
- `limit`

Expected queue behavior:

- Landlord-authenticated.
- Read-only.
- Deterministically sorted.
- Deduped.
- Safe normalized item shape.
- No source record mutation.
- No audit event creation.

Fallback behavior if queue API is unavailable:

- Dashboard should show portfolio summaries that can load independently.
- Decision Queue Preview should show unavailable/degraded state.
- Dashboard should not synthesize critical queue items from stale local state.

## Migration Strategy

Dashboard 2.0 should be migrated incrementally.

Step 1:

- Add adapter and view models while keeping existing visual structure mostly intact.

Step 2:

- Replace existing decision/action areas with Decision Queue Preview and Portfolio Status.

Step 3:

- Move legacy setup/onboarding prompts into Activation or Upcoming Actions, separate from critical decisions.

Step 4:

- Add Upcoming Actions and Financial Snapshot refinements.

Step 5:

- Add Portfolio Detail routing and messaging signal treatment.

Step 6:

- Remove redundant legacy dashboard panels only after the new equivalents are validated.

Do not remove current onboarding/free-tier guidance until the new Dashboard path has equivalent or better behavior.

## Routing Strategy

Dashboard should route in this order:

1. Direct workspace action when an item has one clear resolution path.
2. Operations filtered queue when the item belongs to a larger group.
3. Source workspace fallback when no specific target exists.

Examples:

- Overdue rent -> Ledger or Payments.
- Lease signing blocked -> Leases.
- Tenant awaiting reply -> Tenant profile or Messaging.
- Maintenance blocker -> Maintenance request.
- Notice deadline -> Notice or lease workflow.
- Property action request -> Property workspace.

## Out Of Scope For First Implementation

- Full Operations redesign.
- Sticky workspace shell.
- Visual chart system.
- New backend summary endpoint.
- New queue persistence.
- AI assistant or chatbot.
- Notification delivery.
- Tenant portal simplification.
- Evidence/compliance feature expansion.

## Merge Readiness Criteria For Future Implementation

Future Dashboard implementation should not be merge-ready until:

- Queue-driven decision preview works.
- Dashboard still supports empty/new landlord state.
- Existing onboarding/free-tier paths are not regressed.
- Dashboard routes correctly into Operations and source workspaces.
- Mobile layout is usable.
- Degraded queue behavior is safe.
- Manual preview QA passes.
