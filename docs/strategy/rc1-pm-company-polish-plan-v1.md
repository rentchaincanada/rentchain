# RC1 PM Company Polish Plan v1

Branch: `docs/rc1-enterprise-demo-readiness-plan-v1`
Scope: planning only; no UI, backend, schema, auth, or notification implementation.

## Purpose

PM Company workflows are one of RentChain's strongest enterprise validation surfaces. RC1 should make these workflows credible for a one-building pilot demo by improving clarity, feedback, history, mobile behavior, and operational confidence.

## Current State

Implemented PM Company capabilities include:

- non-landlord PM company auth/profile support
- landlord-created pending relationships
- PM Company Admin acceptance
- active, suspended, terminated relationship lifecycle
- staff assignment creation and lifecycle
- scope ceilings
- landlord and PM company management UI

Known polish gaps remain around notifications, mobile information architecture, grouping, timeline/history, and relationship/assignment readability.

## RC1 Polish Areas

### PM Company Mobile IA

Related issue: #1221

RC1 should audit and improve mobile scanability for:

- relationship cards
- assignment cards
- history sections
- status summaries
- action buttons
- confirmation dialogs

Mobile should avoid dense desktop-table assumptions.

### PM Company Email Notifications

Related issue: #1232

RC1 should add or plan notifications for:

- landlord creates pending relationship
- PM Company Admin accepts relationship
- assignment created
- assignment suspended/reactivated/removed
- landlord suspends/reactivates/terminates relationship

Failed email dispatch must not block lifecycle state changes.

### Assignment Grouping By User

Assignments should be easier to review by:

- staff user
- relationship
- landlord workspace
- role template
- active/suspended/removed status

Grouping should not hide removed assignment history.

### Timeline And History Improvements

Relationship and assignment history should show:

- created
- accepted
- suspended
- reactivated
- terminated
- assignment created
- assignment suspended
- assignment reactivated
- assignment removed

History should remain metadata-first and avoid raw internal IDs as labels.

### Empty-State Improvements

Empty states should distinguish:

- no relationships yet
- pending relationship waiting for company acceptance
- active relationship with no assignments
- no active assignments because all were removed or suspended
- no company context available

Empty states should explain next actions without implying records were deleted.

### Visual Polish

RC1 visual polish should focus on:

- consistent status badges
- readable role labels
- clear primary actions
- restrained confirmations for destructive actions
- card spacing and mobile wrapping
- no nested-card clutter

### Role And Status Clarity

Role templates should remain predefined:

- Company Owner
- Company Admin
- Regional Manager
- Property Manager
- Leasing Agent
- Office Administrator
- Maintenance Coordinator
- Read-only Staff

Assignment statuses should remain:

- active
- suspended
- removed

Relationship statuses should remain:

- pending
- active
- suspended
- terminated

### Landlord And PM Company View Consistency

The landlord and PM company views should agree on:

- relationship label
- status
- scope
- assigned staff summary
- assignment status
- lifecycle history

Landlord views should preserve visibility without allowing landlord direct management of PM company employees beyond relationship controls.

### Performance Review

RC1 should review:

- relationship list load behavior
- assignment projection load behavior
- repeated reads when switching tabs
- large relationship/assignment list behavior
- safe empty/loading/error states

## Risks

- A polished UI can accidentally imply enterprise-complete readiness.
- Relationship and assignment data can become difficult to scan if history is shown without grouping.
- Email notification failures could create distrust if lifecycle states are correct but users miss context.
- Mobile overload can weaken demo confidence.

## Suggested Missions

1. `feat/property-manager-company-email-notifications-v1`
2. `audit/pm-company-mobile-ux-v1`
3. `feat/property-manager-company-assignment-grouping-v1`
4. `feat/property-manager-company-timeline-history-v1`
5. `feat/property-manager-company-empty-state-polish-v1`

## Acceptance Criteria For RC1

- landlord and PM company views remain consistent
- no raw IDs appear as user-facing labels
- action confirmations remain clear
- assignment grouping is easy to scan
- removed/suspended history remains visible
- mobile core paths are usable
- notification behavior is either implemented or clearly roadmap-scoped
