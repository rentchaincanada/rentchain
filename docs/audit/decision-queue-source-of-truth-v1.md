# Decision Queue Source Of Truth V1

## Scope

This audit establishes a single authoritative decision model for Dashboard 2.0 and Operations planning.

Reviewed source areas:

- Dashboard summary and action prompts.
- Operations command center.
- Decision inbox.
- Tenant profiles and move-in readiness.
- Lease profiles, state coherence, payment readiness, Form P readiness, delivery readiness, signing, documents, workflow pages.
- Maintenance workspace labels and approval readiness.
- Payments and delinquency signals.
- Notices and lease expiry workflows.
- Property action requests.
- Tenant portal as a downstream state source.
- Unified inbox, landlord/tenant messages, tenant portal communications, contractor messages, and communication-derived follow-up.

This is a documentation-only audit. It does not change code, routes, UI, database records, Cloud Run, Vercel, or tests.

## Current Generators

| Generator | Representative source | Emits today | Current destination | Source-of-truth status |
| --- | --- | --- | --- | --- |
| Dashboard summary actions | `rentchain-api/src/routes/dashboardRoutes.ts`, `ActionRequiredPanel` | Add property, add unit, track/add applicant, run first screening, invite tenant. | `/dashboard` and direct route links. | Activation prompts, not canonical decisions. |
| Dashboard decision/analytics panels | Dashboard frontend analytics components and dashboard summary API | Portfolio insights, decision summaries, KPI context. | `/dashboard`. | Summary/preview only. |
| Decision inbox engine | `deriveDecisionInbox`, `decisionEngine`, `landlordDecisionInboxRoutes` | Lease/payment lifecycle decisions plus analytics decisions. | `/decision-inbox`, Operations. | Closest existing canonical decision engine. |
| Operations command center | `OperationalCommandCenterPage.tsx` | Derived operational signals from decision inbox, leases, properties. | `/operations`. | Best landlord-facing queue shell, but currently frontend-derived. |
| Payment delinquency | `delinquencySignals`, `decisionEngine`, payment obligation ledger | Rent due, overdue, failed, missing, underpaid, manual review. | Decision inbox and Operations. | Strong candidate for canonical queue source. |
| Lease lifecycle | `leaseLifecycle`, `deriveLeaseLifecycleSummary`, notice workflow service | Expiring lease, notice period, renewal/no-response, move-out. | Leases, Dashboard lease notice summary, Operations. | Partly canonical; needs normalized queue promotion. |
| Lease state coherence | `deriveLeaseOccupancyCoherence` | Active-before-execution, active-on-vacant, occupied-without-executed-lease, payment activity without provider setup. | Leases, Tenants, Operations. | Should become canonical queue generator. |
| Lease execution/signing | Lease signing service, `LeaseSigningDashboard`, active leases projection | Draft, pending signature, signed, blocked, document availability. | `/leases`. | Source-workspace readiness; queue only when blocking or inconsistent. |
| Payment readiness | `derivePaymentReadiness` | Ready/not-ready/blocked rent term and payment setup readiness. | `/leases`, Operations. | Warning/readiness generator, not always a decision. |
| Form P readiness | Lease document/readiness projections | Missing/provided/pending/not applicable lease readiness fields. | `/leases`, generated PDF metadata. | Source readiness; queue only when blocking lease use/signing. |
| Delivery readiness | Signed lease copy and Act copy/link delivery readiness. | Delivery pending/provided/not recorded. | `/leases`. | Source readiness; queue only after generation/signing context. |
| Tenant move-in readiness | `moveInRequirements`, `moveInReadiness`, `TenantDetailPanel` | Lease signed, portal invited/activated, deposit, inspection, keys, utilities, insurance. | `/tenants` tenant profile. | Tenant-owned readiness; queue only for move-in blockers. |
| Tenant state coherence | `tenantDetailsService` plus state coherence projection | Current lease/occupancy/lifecycle agreement or conflict. | `/tenants`, Operations indirectly. | Should feed queue only when conflict is real. |
| Maintenance lifecycle | `maintenanceWorkspaceState`, `workOrderOperationalLabels` | Submitted, acknowledged, in progress, completed, needs attention. | Maintenance workspace. | Missing canonical queue integration. |
| Maintenance approval readiness | `maintenanceApprovalReadiness` | Cost/evidence/review readiness for deterministic execution. | Maintenance/cost review surfaces. | Missing canonical queue integration. |
| Notices | `leaseNoticeWorkflowService`, tenant/landlord notice routes | Notice due, sent, viewed, pending response, no response, renew/quit. | Lease workflow pages, Dashboard summary. | Should feed Upcoming/Warning queue lanes. |
| Property action requests | `actionRequestsService`, `PropertiesPage` | Open property action requests. | `/properties?panel=actionRequests`. | Missing canonical queue integration. |
| Tenant portal | Tenant portal services and frontend tenant pages | Tenant-facing documents/payments/maintenance/profile status. | Tenant portal. | State source only; landlord queue should consume only landlord-actionable items. |
| Unified inbox events | `unifiedInboxService`, unified inbox adapters | Role-scoped activity stream across messages, maintenance, lease, application, notice, viewing, work orders. | `/landlord/unified-inbox`, tenant/contractor inboxes. | Activity source, not canonical decision queue. |
| Landlord/tenant messages | `messagesRoutes.ts`, `MessagesPage.tsx`, tenant communications services | Conversations, unread/read state, tenant reply context. | `/messages`, tenant portal communications. | Message workspace source; queue only when actionable. |
| Contractor messages/work-order communication | contractor inbox adapters, work order communications | Contractor work-order messages, schedule/access/cost communication. | Contractor inbox and maintenance/work-order contexts. | Missing canonical queue integration for landlord-response-required items. |

## Duplicates

| Duplicate area | Current duplication | Recommended source of truth |
| --- | --- | --- |
| "Action Required" versus Decision Queue | Dashboard action prompts look like decisions but are mostly onboarding/activation next steps. | Keep Dashboard actions as Activation/Upcoming Actions, not Decision Queue items. |
| Operations versus Decision Inbox | Operations consumes decision inbox and adds its own lease/property signals. Decision Inbox remains separately reachable. | Operations should become landlord-facing canonical queue; Decision Inbox should be the engine/detail source. |
| Lease profile versus tenant profile state coherence | Both surfaces can display draft/pending/review labels for the same lease/tenant relationship. | Lease execution belongs to Leases; move-in/tenant linkage belongs to Tenants. Conflicts should route by owning source. |
| Lease payment readiness versus payment delinquency | Payment readiness warns about missing setup; delinquency decisions warn about missed/failed payment obligations. | Payment readiness is setup warning; delinquency is decision/critical issue. |
| Lease lifecycle summary versus notice workflow | Expiry, renewal, no-response, and notice deadlines can appear in dashboard summary, lease profile, and workflow pages. | Notice workflow owns notice action. Lease lifecycle owns status. Operations owns prioritization. |
| Maintenance labels versus operational decisions | Maintenance uses "needs attention" and "needs review" labels outside Decision Inbox. | Maintenance should emit queue items for submitted, blocked, cancelled, stalled, or cost-review cases. |
| Property action requests versus operations | Properties has action requests that are not clearly represented in Operations. | Property action requests should feed property-owned Needs Review queue items. |
| Unified Inbox versus Decision Queue | Unified Inbox contains activity records that can look like decisions. | Unified Inbox should remain activity; queue should promote only actionable message-derived items. |
| Messages versus Dashboard | Unread messages can inflate attention surfaces if all unread state is treated as action. | Dashboard should show only urgent/awaiting-response communication counts and top critical message decisions. |

## Conflicts

| Conflict | Cause | Recommendation |
| --- | --- | --- |
| "Needs Review" is used as both state and severity | State coherence, maintenance, screening, and command center all use review wording differently. | Treat Needs Review as review state. Pair with Critical/Warning/Informational severity. |
| Critical and warning thresholds vary by generator | Decision inbox has `critical/high/medium`; decision engine has `critical/warning/info`; operations has `critical/warning/info`. | Normalize into the severity model before display. |
| Upcoming items can be mixed with warnings | Lease expiry and notice timing appear as guidance, summary, or review depending on surface. | Use Upcoming until near/missed deadlines; then promote to Warning or Critical. |
| Onboarding actions can inflate open action counts | Dashboard actions count empty-state setup steps as open actions. | Separate Activation Actions from Decision Queue count. |
| Readiness gaps can look like legal/compliance failure | Form P and delivery readiness are operational readiness, not legal certification. | Label as operational readiness and keep legal disclaimers out of the decision severity model. |
| Tenant portal state may be interpreted as landlord action | Tenant-facing pending items can look like landlord blockers. | Only route to landlord queue when landlord has a concrete action or source conflict. |

## Missing Generators

| Missing generator | Why it matters | Recommended queue treatment |
| --- | --- | --- |
| Maintenance submitted/unreviewed | Landlords need to triage new requests. | Warning or Needs Review item owned by Maintenance. |
| Maintenance blocked/cancelled/stalled | Service workflow can stop without entering the canonical queue. | Critical/Warning item owned by Maintenance. |
| Maintenance cost approval readiness | Cost review can block expense/payment decisions. | Needs Review item owned by Maintenance/Expenses. |
| Property action requests | Property/unit data issues are operational work. | Needs Review item owned by Properties. |
| Form P readiness blockers | Lease readiness gaps are visible but not centrally prioritized. | Warning item owned by Leases when generation/signing/use is blocked. |
| Signed lease delivery/Act link delivery | Post-signing delivery readiness is operationally important. | Warning item owned by Leases after signing/generation context. |
| Tenant portal invite dispatch/activation mismatch | Move-in readiness can show stale invite state. | Needs Review item owned by Tenants only when move-in is blocked. |
| Notice response deadline/no response | Renewal/no-response risk should not be only a lease-page detail. | Upcoming before deadline; Warning/Critical after deadline depending business rule. |
| Lease document source/download failures | Document access can block signing, evidence, and landlord confidence. | Critical if signed lease access fails; Warning if draft preview unavailable. |
| Tenant awaiting landlord reply | Reply responsibility is operational work but currently lives mainly in messaging surfaces. | Needs Review or Warning item owned by Tenant/Messaging depending urgency. |
| Urgent high-priority tenant message | Unread urgent communication can require same-day landlord action. | Warning or Critical item owned by Tenant or Operations. |
| Contractor quote/schedule response | Contractor workflow can stall until landlord approves or responds. | Needs Review or Warning item owned by Maintenance. |
| Notice-relevant message | Communication can affect lease/notice timing or evidence context. | Upcoming/Warning item owned by Notices or Lease workflow. |
| Support escalation message | Support/admin escalation may require landlord action. | Warning/Critical item owned by Operations, with support-safe projection only. |

## Recommended Hierarchy

The authoritative queue hierarchy should be:

1. Critical Issues
   - Blocked, failed, overdue, or materially conflicting items.
   - Examples: overdue rent, failed payment, active-before-execution, signed document inaccessible after signing.

2. Decisions
   - Items requiring an explicit landlord choice or workflow action.
   - Examples: approve/manual-review screening, resolve delinquency, choose renewal/no-response path, assign maintenance.

3. Warnings / Needs Review
   - Incomplete, ambiguous, or inconsistent states that need review but are not yet critical.
   - Examples: missing due day, Form P email service consent missing, payment setup not ready, tenant portal invite pending.

4. Upcoming Actions
   - Time-bound, sequence-bound, or planning items.
   - Examples: lease expiry, notice timing, move-out prep, renewal review.

5. Informational Context
   - Completed or passive status.
   - Examples: signed lease available, delivered evidence package, completed maintenance, recent screening completed.

## Recommended Decision Object

Future consolidation should adapt all generators to a common object. The existing Decision Inbox model can be the base, but the canonical model should distinguish intent and display class more explicitly.

```ts
type LandlordDecisionQueueItem = {
  id: string;
  severity: "critical" | "warning" | "needs_review" | "upcoming" | "informational";
  intent: "decide" | "review" | "complete_setup" | "resolve_conflict" | "plan_deadline" | "observe";
  status: "open" | "pending" | "blocked" | "resolved" | "dismissed";
  domain: "lease" | "tenant" | "property" | "payment" | "maintenance" | "screening" | "notice" | "compliance" | "portfolio";
  ownerWorkspace: string;
  destination: string;
  title: string;
  summary: string;
  sourceGenerator: string;
  relatedResource: {
    type: "lease" | "tenant" | "property" | "unit" | "payment" | "maintenance_request" | "application" | "notice" | "message_thread" | "portfolio";
    id: string;
    safeLabel: string;
  } | null;
  dueAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};
```

## Recommended Dashboard 2.0 Consumption

Dashboard should consume the queue only as a summary:

- Portfolio Status: aggregate health and critical count.
- Decision Queue Preview: top critical and decision items only.
- Upcoming Actions: date-based items only.
- Financial Snapshot: rent/payment metrics, with delinquency count as a link into Operations/Payments.
- Activation Actions: onboarding and conversion prompts, separate from the decision queue.

Dashboard should not duplicate:

- Full Operations filters.
- Lease/tenant readiness panels.
- Long guidance text.
- Source-workspace workflow pages.

## Recommended Operations Consumption

Operations should become the landlord-facing full queue:

- All open critical, warning, needs-review, and upcoming items.
- Filters by severity, domain, owner, timing, assignment, and source.
- Saved views: Critical, Needs Review, Upcoming, Delinquency, Maintenance, Lease Readiness, Unassigned.
- Each item routes to its owning workspace, not a generic summary page unless no safer destination exists.

## Source Hierarchy

When surfaces disagree, resolve in this order:

1. Canonical source record and append event state.
2. Domain projection service.
3. Decision queue normalization layer.
4. Dashboard/Operations display adaptation.
5. Frontend local labels.

Display labels should never override the source record or projection service.

## Priority A: Data Integrity / Workflow Integrity

1. Promote lease state coherence conflicts into canonical queue items.
2. Promote maintenance submitted/blocked/cost-review states into queue items.
3. Promote property action requests into queue items.
4. Promote notice/no-response deadlines into Upcoming/Warning queue lanes.
5. Normalize payment readiness versus delinquency to avoid false critical states.
6. Ensure tenant move-in readiness only creates landlord queue items when landlord action is required.

## Priority B: Navigation / Workspace Improvements

1. Make Operations the canonical full Decision Queue route.
2. Decide whether `/decision-inbox` remains hidden engine/detail or redirects into Operations.
3. Separate Dashboard Activation Actions from Decision Queue count.
4. Route each queue item to a focused owning workspace.
5. Add source generator labels internally for debugging without showing raw IDs.

## Priority C: Visual Polish

1. Dashboard 2.0 should show fewer queue items with stronger hierarchy.
2. Operations should support dense scanning without long copy.
3. Lease and tenant profiles should display local readiness without competing with global queue severity.
4. Mobile should prioritize Critical, Today, and Upcoming before full filters.

## Recommended Next Implementation Sprint

Recommended next sprint:

`feat/landlord-decision-queue-normalization-v1`

Mission objective:

Create a backend normalization layer that adapts existing decision inbox items, lease state coherence, payment readiness, lease lifecycle/notice timing, maintenance readiness, property action requests, and actionable messaging/unified-inbox signals into one landlord decision queue response for Operations and Dashboard 2.0.

Suggested first implementation boundaries:

1. Backend read-only route/service only.
2. No UI redesign.
3. No new collection.
4. No mutation workflow.
5. Preserve existing Decision Inbox route while adding normalized response.
6. Include messaging source types such as `message_thread`, `message_unread_priority`, `message_notice_relevance`, `message_maintenance_follow_up`, `message_support_escalation`, and `unified_inbox_event`.
7. Add tests for severity normalization, duplicate suppression, source routing, messaging noise suppression, and no raw ID labels.

## Non-Goals

- No code changes in this audit.
- No dashboard redesign.
- No UI implementation.
- No queue persistence decision.
- No autonomous workflow execution.
- No legal/compliance certification language.
