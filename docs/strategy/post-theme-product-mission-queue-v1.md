# Post-Theme Product Mission Queue v1

Branch: `audit/operations-command-center-simplification-v1`
Scope: product mission sequencing and audit planning only; no implementation authorization.

## Executive Summary

The warm-neutral design/theme cycle is complete through PR #1339. The next product phase should shift away from brand/theme polish and toward landlord workflow clarity, operational throughput, evidence defensibility, and enterprise/demo validation.

Every mission below should support at least one strategic filter:

- Revenue
- Operational efficiency
- Enterprise readiness
- Customer validation
- Government/institutional readiness
- Evidence/audit defensibility
- Workflow continuity

The recommended first mission is the paired `/operations` audit and simplification sequence. `/operations` is the best next leverage point because it should become the landlord daily command center, but the current page blends dashboard summary, decision inbox, manually-derived workflow signals, broad filters, and embedded review panels into one dense surface.

## Recommended Order

1. `audit/operations-command-center-simplification-v1`
2. `polish/operations-command-center-simplification-v1`
3. `feat/landlord-decision-queue-api-v1`
4. `feat/embedded-signed-document-workspace-v1`
5. `feat/renewal-pipeline-visibility-v1`
6. `feat/messaging-to-decision-routing-v1`
7. `feat/maintenance-entry-notice-workflow-v1`
8. `feat/contractor-work-order-portal-v1`
9. `feat/lease-lifecycle-hardening-v1`
10. `feat/institutional-export-framework-v1`

## Mission Queue

### 1. `audit/operations-command-center-simplification-v1`

Purpose: Simplify `/operations` into the landlord's daily command center.

Strategic filters:

- Operational efficiency
- Enterprise readiness
- Workflow continuity
- Evidence/audit defensibility

Focus:

- What needs attention today
- What is waiting on tenant, landlord, or contractor
- What is overdue
- What is blocked
- What can be completed quickly
- What has evidence/audit trail attached

Likely future outcome:

Group `/operations` around daily work buckets:

- Urgent
- Maintenance
- Lease actions
- Notices
- Payments
- Tenant requests
- Contractor follow-ups
- Evidence-ready items

Notes:

- This audit is the current active mission.
- No UI/product behavior should be implemented until the audit is reviewed.

### 2. `polish/operations-command-center-simplification-v1`

Purpose: Implement the approved `/operations` simplification plan after audit.

Strategic filters:

- Operational efficiency
- Customer validation
- Enterprise readiness

Expected scope:

- Frontend-only first pass if possible.
- Reorganize visible sections around urgent/waiting/overdue/blocked/quick-complete/evidence-ready groups.
- Preserve source-workspace routing.
- Preserve decision queue, manual review, lease, payment, property, and inbox behavior.
- Avoid new backend data contracts unless the audit identifies a hard blocker.

Do not implement in the audit PR.

### 3. `feat/landlord-decision-queue-api-v1`

Purpose: Create or harden a backend-backed decision queue source for landlord operational work.

Strategic filters:

- Operational efficiency
- Evidence/audit defensibility
- Enterprise readiness

Current-state note:

- The current repo already includes `rentchain-api/src/routes/landlordDecisionQueueRoutes.ts`, `rentchain-api/src/services/landlordDecisionQueue/`, and frontend client `rentchain-frontend/src/api/landlordDecisionQueueApi.ts`.
- `/dashboard` already consumes `/api/landlord/decision-queue`.
- `/operations` currently consumes `/api/landlord/decision-inbox`, lease list data, property data, dashboard summary data, and operator-review manual metadata, then derives its own command-center signals client-side.

Recommended reframing:

- Keep the branch name for continuity if desired, but treat this as a decision queue integration/hardening mission rather than a greenfield API mission.

Focus:

- Decision item model completeness
- Severity
- Due dates
- Related lease/property/tenant/payment/maintenance references
- Dismiss/acknowledge/resolve lifecycle
- Audit events
- Frontend integration into `/operations`

### 4. `feat/embedded-signed-document-workspace-v1`

Purpose: Replace external signed-document link dependency with an embedded landlord/tenant document workspace.

Strategic filters:

- Revenue
- Enterprise readiness
- Evidence/audit defensibility
- Workflow continuity

Focus:

- Show signed lease/document in-app
- Download button
- Evidence/audit connection
- Signing status
- Document source/fallback handling
- Tenant and landlord access boundaries

Reference:

- Existing follow-up issue #1182 is open: "Embedded Signed Document Workspace".

### 5. `feat/renewal-pipeline-visibility-v1`

Purpose: Give landlords a pipeline of upcoming renewal/rent-increase/expiry actions.

Strategic filters:

- Revenue
- Operational efficiency
- Workflow continuity

Focus:

- Leases expiring soon
- Rent increase eligibility dates
- Notice deadlines
- Tenant renewal status
- Draft/send notice actions
- Evidence trail

### 6. `feat/messaging-to-decision-routing-v1`

Purpose: Allow landlord messages to become decisions, tasks, maintenance actions, notices, or evidence.

Strategic filters:

- Operational efficiency
- Customer validation
- Evidence/audit defensibility
- Workflow continuity

Focus:

- Convert message to action request
- Convert message to maintenance item
- Convert message to lease decision
- Attach message to evidence package
- Thread-level audit trail

### 7. `feat/maintenance-entry-notice-workflow-v1`

Purpose: Help landlords coordinate contractor access to occupied units with proper tenant notice.

Strategic filters:

- Government/institutional readiness
- Evidence/audit defensibility
- Operational efficiency
- Workflow continuity

Focus:

- Contractor requests access date/time
- Landlord approves
- Tenant receives notice
- Jurisdiction-specific warning/copy
- Evidence that notice was sent
- Link notice to maintenance/work order

### 8. `feat/contractor-work-order-portal-v1`

Purpose: Create minimum viable contractor workflow.

Strategic filters:

- Revenue
- Operational efficiency
- Customer validation
- Workflow continuity

Focus:

- Contractor login
- Assigned work orders
- Accept/decline
- Schedule request
- Before/after photos
- Quote upload
- Invoice upload
- Mark complete
- Tenant notice coordination
- Audit trail

### 9. `feat/lease-lifecycle-hardening-v1`

Purpose: Strengthen lease renewal, rent increase, notices, deposits, move-out, and execution workflows.

Strategic filters:

- Enterprise readiness
- Government/institutional readiness
- Evidence/audit defensibility
- Revenue

Focus:

- Clear lifecycle states
- Better next-action prompts
- Jurisdiction-aware warnings
- Evidence trail
- Workflow completion states
- Deadlines and reminders

### 10. `feat/institutional-export-framework-v1`

Purpose: Create structured exports for tenancy board, property manager, lender, or institutional review.

Strategic filters:

- Government/institutional readiness
- Evidence/audit defensibility
- Enterprise readiness
- Revenue

Focus:

- Lease evidence package
- Payment timeline
- Notices
- Maintenance records
- Messages
- Audit trail
- Export allowlist
- PDF/ZIP/package format

## Queue Rules

- Do not treat strategy docs as implementation authorization.
- Keep each implementation mission PR-sized and independently reviewable.
- Prefer frontend simplification before backend expansion where existing safe data already supports a useful experience.
- Use backend changes only when source-of-truth, lifecycle, audit, or projection safety requires them.
- Preserve server-side authority checks and whitelist public projections.
- Avoid raw/internal identifiers as visible labels or exports.
- Distinguish current capability from roadmap language in demos.

## Immediate Recommendation

Proceed with `audit/operations-command-center-simplification-v1` as the current docs/audit PR. The smallest likely implementation after that audit is:

`polish/operations-command-center-simplification-v1`

That PR should simplify the current `/operations` information architecture without creating new operational behavior, changing backend contracts, or replacing the deeper `/decision-inbox`, `/landlord/unified-inbox`, `/properties`, `/leases`, `/maintenance`, and `/payments` workspaces.
