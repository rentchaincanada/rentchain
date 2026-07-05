# RC1 Demo Navigation Friction Audit v1

## Executive Summary

No P0 demo blockers were found. The RC1 landlord-to-tenant story is now coherent across dashboard decisions, operations review, application review, lease setup, rent readiness, ledger review, inbox state, analytics destinations, and tenant reflection surfaces.

The remaining friction is mostly navigation continuity rather than missing capability. A demo operator can move through the primary path without hidden URLs for the core landlord story, but a few destination pages still feel terminal or context-light after the user arrives from a decision queue, inbox item, or focused CTA.

The highest-value follow-up is to make source-aware next actions clearer on inbox and deep destination pages. The second priority is to reduce generic workspace hops where a record already implies a more specific source context. These should be handled as small polish missions, not as a navigation redesign.

## Demo Path Reviewed

The audit reviewed the current RC1 demo path across these surfaces:

- `/dashboard`
  - Decision Queue Preview
  - revenue, vacancy, operations, application, lease, and payment decision CTAs
- `/operations`
  - operational review queue
  - manual review states
  - payment and lease-level decision routing
- `/applications`
  - application selection
  - decision panel
  - screening setup
  - review summary action
  - browser Print / Save PDF
- `/applications/:id/review-summary`
  - Application Review Summary route and PDF download
- `/leases`
  - lease status
  - rent readiness action visibility
  - ledger access
  - staged rent setup actions
- `/leases/:leaseId/summary?section=rent-payment`
  - rent and payment terms destination
- `/leases/:leaseId/ledger`
  - payment ledger destination
  - print/PDF access
  - payment/obligation context
- `/landlord/unified-inbox`
  - persisted read state
  - message-to-action behavior
- `/analytics?entry=revenue-pressure`
- `/analytics?entry=vacancy-readiness`
- Tenant reflection spot-checks
  - tenant dashboard/profile
  - tenant lease page
  - tenant payments
  - tenant documents

## Route-by-Route Findings

### `/dashboard`

Status: healthy for RC1 demo.

Dashboard decision routing is now clear enough for the main story. Lease-level payment decisions route to Payment ledger language, portfolio revenue pressure routes to analytics, vacancy readiness routes to analytics, application funnel work routes to Applications, and operations-oriented work routes to Operations.

The Dashboard and Operations split remains sensible: Dashboard is the operational home and signal surface; Operations is the work queue and execution workspace. This should not be reopened for RC1.

Friction:

- P3: Some analytics destinations are useful once reached but do not strongly guide the user to the next operational step after the signal has been reviewed.

### `/operations`

Status: healthy, with one follow-up opportunity.

Operations is now discoverable from the landlord mobile bottom nav and remains available in broader workspace navigation. This resolves the earlier discoverability issue for the command-center role.

Operations payment decisions correctly preserve lease-level routing to `/leases/:leaseId/ledger` when a lease context exists. This should remain the expected behavior. Portfolio-level revenue pressure should continue to route to analytics or portfolio context, not to a lease ledger.

Friction:

- P2: Some review cards can still feel like queue items rather than guided workflows after the user opens the destination. The fix should be destination-side context/back/next actions, not an Operations redesign.

### `/applications`

Status: healthy for RC1 demo.

Application review flow is materially improved:

- application selection is visible
- filters remain available
- the decision panel is readable
- screening setup is collapsed by default
- browser Print / Save PDF is richer
- `Open review summary` now exposes the backend Application Review Summary route from the normal review flow

Friction:

- P3: Review-summary language appears in more than one place: `Open review summary` in the selected application header and `Application review summary` in the screening area. This is understandable, but the labels could be harmonized later so one action reads as the primary destination and the other as contextual supporting access.
- P3: Landlord mobile bottom nav uses `Applicants` while broader route and drawer language uses `Applications`. This is not a blocker, but RC1 narration would be cleaner if the product chose one label family or documented why the shorter mobile label is intentional.

### `/applications/:id/review-summary`

Status: connected, with a small continuity gap.

The route is now reachable from `/applications`, includes a `Back` action, and exposes `Download PDF`. This solves the previous hidden-URL problem.

Friction:

- P2: The `Back` action depends on browser history. If the route is opened directly from a copied link, refresh, or bookmark, the page does not provide a source-aware path back to the selected application or Applications list.
- P3: The page is a strong terminal review artifact, but it does not clearly suggest the next landlord action after review, such as returning to the application decision workspace.

### `/leases`

Status: healthy for RC1 demo.

Lease list/card actions now expose the important RC1 paths:

- `Payment ledger`
- lease summary
- staged rent setup actions such as `Review rent terms`
- `Enable rent collection` only when readiness allows it

This is the correct safety behavior. When due day or rent terms are missing, hiding direct enablement and showing a review/setup action is clearer than offering a button that backend eligibility would reject.

Friction:

- P3: Lease cards are doing a lot of work. They are currently acceptable, but longer-term polish should keep the highest-value lease action visually distinct from secondary actions.

### `/leases/:leaseId/summary?section=rent-payment`

Status: acceptable destination for rent setup review.

The rent-payment section can be reached from `/leases`, and the destination makes rent/payment term readiness visible. It includes a path back to leases.

Friction:

- P2: After a landlord reviews rent terms, the page does not strongly stage the next action. If the lease is still not ready, the missing prerequisite should stay prominent. If it becomes ready to configure, the next action should be obvious without sending the user back through the list to rediscover it.

### `/leases/:leaseId/ledger`

Status: healthy content destination, with navigation continuity friction.

The ledger destination is now readable on mobile, has improved decision context, prints actual ledger content, and exposes expected ledger actions. Internal references are hidden behind advanced details by default.

Friction:

- P2: The ledger can be reached from Dashboard, Operations, lease lists, and lease summary, but the page does not preserve much source context. A user who arrives from a decision queue may need to decide whether to return to Dashboard, Operations, or the lease summary.
- P3: The ledger is a strong terminal artifact after print/export, but demo flow would be smoother with clearer back/next actions tied to the lease context.

### `/landlord/unified-inbox`

Status: persistence fixed; action routing needs polish.

Unread state now persists after opening messages against the deployed backend. The route is discoverable from mobile bottom nav and workspace navigation.

Friction:

- P1: Message detail actions currently route to broad workspaces based on source kind or keyword, such as `Open applications`, `Open leases`, `Open payments`, or `Open work orders`. That keeps the inbox usable, but it can force the demo operator to rediscover the exact related record after opening a message.
- P2: Payment-like messages route to `/payments`, while lease-level payment decisions elsewhere route to `/leases/:leaseId/ledger`. This is acceptable when no lease context exists, but the label/path should become more specific when a safe lease-level destination is available.

### Analytics Routes

Status: healthy for signal review.

`/analytics?entry=revenue-pressure` and `/analytics?entry=vacancy-readiness` are now readable on mobile and better use desktop width. Dashboard CTAs route to the right analytics destinations.

Friction:

- P3: Analytics pages are signal destinations but can feel terminal. A light contextual action such as returning to Dashboard or opening Operations for review work would make the demo path feel less like a branch that ends.

## Mobile Navigation Findings

Landlord mobile navigation now supports the RC1 demo path well:

- Dashboard
- Properties
- Applicants
- Inbox
- Operations
- More

Operations as a direct bottom-nav tab is the right RC1 choice because it supports review queue, payment readiness, lease lifecycle, occupancy, screening, and document work. More/drawer access still covers Leases, Analytics, Payments, Tenants, and other workspace routes.

Tenant mobile navigation is also broadly sufficient. The tenant shell includes direct mobile tabs for Dashboard, Lease, Documents, and Messages, while profile and payments are reachable from drawer/navigation and from tenant workspace/profile action links.

Friction:

- P2: Tenant payments is important in the reflection story, but it is not one of the direct tenant mobile tabs. This is acceptable for now because the tenant dashboard/profile links to payments, but future demo polish could make the tenant reflection path more explicit.
- P3: Landlord mobile uses `Applicants` while desktop/workspace language often uses `Applications`.

## Action-Label Consistency Findings

Strong labels now in use:

- `Open payment ledger`
- `Payment ledger`
- `Review rent terms`
- `Open review summary`
- `Import payments CSV`
- `Open screening setup`
- `Operations`

Labels that may need future harmonization:

- `Applicants` versus `Applications`
- `Open review summary` versus `Application review summary`
- broad inbox actions such as `Open payments` when the intended source may be a lease-level ledger or rent readiness surface

No label issue was found that blocks the RC1 demo.

## Dead-End and Missing Next-Action Findings

The remaining dead-end risk is concentrated in destination pages rather than source pages:

- Application Review Summary is now discoverable, but direct-link users need a deterministic return path to Applications.
- Lease Ledger is action-rich but not source-aware after arrival from Dashboard or Operations.
- Analytics routes explain the signal but do not always guide the operator back to work.
- Unified Inbox actions are broad workspace jumps instead of exact source actions.

These are polish issues, not data or routing blockers.

## Tenant Reflection Navigation Notes

Tenant reflection is now coherent for the current RC1 scenario:

- Tenant dashboard/profile explains active tenancy.
- Tenant lease page distinguishes provider-signed state from signed-copy-pending document state.
- Tenant payments no longer claims `No active lease found` when the workspace has an active lease but rent collection is not enabled.
- Tenant documents remains empty when no tenant-safe signed document context exists.

Friction:

- P2: Tenant reflection is easy to explain once the operator is on the tenant surfaces, but the demo would benefit from one intentional "tenant reflection" path or checklist from the landlord side. This should not expose tenant-only private state; it should only help an operator narrate what the tenant will safely see.

## Prioritized Follow-Up Queue

### P0

No P0 demo blockers identified.

### P1: `polish/unified-inbox-source-context-actions-v1`

Problem:
Unified Inbox message detail actions route to broad workspaces instead of exact related records when the message implies application, lease, payment, or work-order context.

Affected routes:

- `/landlord/unified-inbox`
- `/applications`
- `/leases`
- `/payments`
- `/work-orders`
- `/leases/:leaseId/ledger` if a safe lease-level payment destination exists

Proposed minimal fix:
Use existing tenant-safe or landlord-safe destination metadata if available on inbox records. If no exact destination exists, keep broad workspace fallbacks but label them honestly, such as `Open related workspace`. Do not add backend projection fields in the polish PR unless a narrow source-route field already exists and is simply not used.

Acceptance criteria:

- Inbox remains usable if source routing metadata is missing.
- Exact source actions appear only when a valid safe destination exists.
- Lease-level payment messages route to Payment ledger when lease context is available.
- Broad fallbacks remain clear and non-misleading.
- Read-state persistence remains unchanged.
- No raw internal IDs are exposed in labels or URLs beyond existing authorized route parameters.

Risk level:
Medium. The frontend behavior is small, but exact routing may depend on whether inbox records already carry safe destination metadata.

### P2: `polish/rc1-demo-back-links-and-next-actions-v1`

Problem:
Deep destinations reached from Dashboard, Operations, or shared links can feel terminal or lose source context.

Affected routes:

- `/applications/:id/review-summary`
- `/leases/:leaseId/ledger`
- `/analytics?entry=revenue-pressure`
- `/analytics?entry=vacancy-readiness`
- `/leases/:leaseId/summary?section=rent-payment`

Proposed minimal fix:
Add lightweight source-aware return or next-action affordances where route context already exists. Prefer safe generic fallbacks such as `Back to applications`, `Back to lease summary`, `Open operations`, or `Back to dashboard` over complex route-state plumbing.

Acceptance criteria:

- Direct-link and refreshed pages still offer a useful return path.
- Pages reached from Dashboard/Operations do not trap the demo operator.
- Existing route behavior and calculations remain unchanged.
- Mobile layout remains readable.
- No source-aware link appears when it would require unsafe or unavailable context.

Risk level:
Low to medium. Mostly frontend copy/actions, with risk only if source-aware behavior tries to infer unavailable context.

### P2: `polish/lease-summary-rent-payment-next-step-v1`

Problem:
The rent-payment section shows readiness state, but the next action after review can be unclear when setup is incomplete or becomes ready.

Affected routes:

- `/leases`
- `/leases/:leaseId/summary?section=rent-payment`

Proposed minimal fix:
Make the rent-payment section explicitly state the next landlord step. If due day or rent terms are missing, keep the missing prerequisite prominent. If the lease becomes ready to configure, surface the safe enable/configure action from the section rather than requiring the landlord to rediscover it on the leases list.

Acceptance criteria:

- Missing due day/rent terms remain clear.
- Online rent collection is not offered before readiness allows it.
- Ready-to-configure leases expose the next safe payment setup action.
- Existing lease summary and lease list behavior remains intact.

Risk level:
Low. This should be a small frontend state/copy/action polish if current readiness data is already present.

### P2: `polish/tenant-reflection-demo-links-v1`

Problem:
Tenant reflection is accurate, but the demo story could make the landlord-to-tenant continuity easier to narrate without relying on hidden route knowledge.

Affected routes:

- tenant dashboard/profile
- tenant lease page
- tenant payments
- tenant documents
- possible landlord-side demo checklist surfaces if already present

Proposed minimal fix:
Add or clarify existing tenant-side links so the reflection path is obvious: lease details, payments, documents, and profile/rental record. Keep this tenant-facing; do not expose landlord-only evidence or internal state.

Acceptance criteria:

- Tenant can move between lease, payments, documents, and profile/rental record without hidden URLs.
- Signed-copy-pending and document-ready states remain accurate.
- Payment checkout remains hidden until rent collection is enabled.
- No internal/provider/storage identifiers are exposed.

Risk level:
Low. Scope should stay frontend-only unless an existing safe field is missing.

### P3: `polish/applications-review-summary-label-harmony-v1`

Problem:
Applications has multiple review-summary entry labels and mobile uses `Applicants` while workspace routes use `Applications`.

Affected routes:

- `/applications`
- landlord mobile nav
- Applications drawer/workspace navigation

Proposed minimal fix:
Choose a consistent label pattern for the primary route and contextual action. Keep the mobile tab short if needed, but ensure it does not confuse demo narration.

Acceptance criteria:

- Primary Application Review Summary action is easy to identify.
- Screening-context summary action does not look like a separate destination.
- Existing review-summary route and entitlement behavior remain unchanged.
- Mobile nav remains readable.

Risk level:
Low.

### P3: `polish/analytics-demo-next-actions-v1`

Problem:
Analytics destination pages are readable but can feel like terminal signal pages during a demo.

Affected routes:

- `/analytics?entry=revenue-pressure`
- `/analytics?entry=vacancy-readiness`
- `/dashboard`
- `/operations`

Proposed minimal fix:
Add small contextual actions from analytics entries back to Dashboard or Operations where appropriate. Do not change analytics calculations, dashboard routing, or portfolio/lease-level routing rules.

Acceptance criteria:

- Analytics entry pages remain readable on desktop and mobile.
- Revenue pressure and vacancy readiness retain their current route semantics.
- Users can return to Dashboard or open Operations from analytics without hidden navigation.
- No dashboard or analytics data logic changes.

Risk level:
Low.