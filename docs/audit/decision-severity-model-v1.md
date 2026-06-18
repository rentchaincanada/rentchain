# Decision Severity Model V1

## Scope

This document defines the canonical landlord-facing severity model for decision queue, dashboard, operations, tenant, lease, maintenance, payment, notice, and readiness surfaces.

It is a documentation-only model. It does not change code, routes, UI, database records, or queue behavior.

## Canonical Terms

| Term | Definition | User question answered | Canonical queue treatment |
| --- | --- | --- | --- |
| Critical Issue | A current condition that blocks a core workflow, indicates material risk, or requires prompt landlord review before the source workflow should progress. | What must I deal with now? | Queue item, top priority, owner required. |
| Warning | A non-blocking risk, inconsistency, or incomplete setup that may become material if ignored. | What should I review soon? | Queue item or source-workspace warning, depending on actionability. |
| Needs Review | A state where RentChain cannot safely classify the source as ready, complete, or coherent without landlord review. | What needs human judgment? | Queue item when actionable; source-workspace badge when contextual. |
| Upcoming Action | A time-based or sequence-based item that is not currently broken but has a future deadline or expected next step. | What is coming up? | Upcoming queue lane and dashboard preview. |
| Informational | Context that improves understanding but does not require action or review. | What should I know? | Workspace context, not primary decision queue. |

## Canonical Severity Levels

The platform should normalize all landlord-facing attention items into these levels before Dashboard 2.0 and Operations consume them.

| Severity | Meaning | Examples | Default treatment |
| --- | --- | --- | --- |
| Critical | Blocking, risky, overdue, failed, escalated, or materially conflicting. | Overdue rent, failed payment, blocked signing, active lease on vacant unit, occupied unit without executed active lease, invalid source-state conflict. | Show in portfolio status, decision queue, and owning workspace. |
| Warning | Important but not immediately blocking. | Missing rent terms, partial payment, pending signature, maintenance submitted but not reviewed, lease ending within a near window. | Show in decision queue if actionable; otherwise show in owning workspace. |
| Needs Review | Ambiguous or incomplete state requiring landlord judgment before treating it as ready. | State coherence review required, payment readiness not ready, move-in readiness pending, manual payment review required. | Route to owning workspace and optionally aggregate in operations. |
| Upcoming | Time-bound item that should be planned but is not broken. | Lease expiry window, notice timing, renewal follow-up, move-out prep. | Show in upcoming lane, not mixed with urgent critical items. |
| Informational | Visibility only. | Recent screening completed, generated evidence package, completed maintenance, signed lease already downloaded. | Show as activity/history or detail context. |

## Mapping From Current Code Vocabulary

| Current vocabulary | Observed source | Canonical mapping | Notes |
| --- | --- | --- | --- |
| `critical` | Decision inbox, delinquency signals, operations command center | Critical | Already close to canonical. |
| `high` | Analytics decision priority, decision inbox | Critical or Warning | Use Critical when blocked/escalated/financially material; Warning otherwise. |
| `medium` | Decision inbox mapped from `warning` | Warning | Should remain non-critical unless blocked. |
| `warning` | Decision engine, operations, maintenance, payments | Warning | Current use is broad; normalize by blocking/actionability. |
| `needs_review` | Operations filters, screening/app statuses, readiness surfaces | Needs Review | Should not automatically mean Critical. |
| `review_required` | State coherence, maintenance, compliance | Needs Review or Critical | Critical only when workflow is blocked or state conflict is material. |
| `blocked` | Decision inbox, payment readiness, lease execution | Critical | Blocked items should surface above ordinary review states. |
| `upcoming` | Operations priority group, lease expiry/notice timing | Upcoming | Should not be presented as a warning unless the deadline is near or missed. |
| `info` / `informational` | Dashboard, operations, decision inbox | Informational | Keep out of the primary decision queue unless there is a clear next action. |

## Decision Versus Warning Versus Action

| Concept | Canonical definition | Examples that qualify | Examples that do not qualify |
| --- | --- | --- | --- |
| Decision | A landlord must choose, approve, dismiss, assign, resolve, or take an explicit workflow step. | Approve screening outcome, review overdue rent, resolve occupancy conflict, choose renewal/move-out path. | Passive KPI, completed signing event, general portfolio summary. |
| Warning | The system detects risk or incompleteness but the next step may simply be review. | Due day missing, tenant email missing, payment setup not enabled. | Completed lease signing, signed document available. |
| Needs Review | The system lacks enough confidence to treat the source as coherent or complete. | State coherence conflict, manual payment issue, unresolved source projection mismatch. | Low-priority upcoming lease expiry with known dates. |
| Upcoming Action | A known future date or workflow sequence requires planning. | Lease expiring in 90 days, notice due, renewal response deadline. | Already overdue payment or failed dispatch. |
| Critical Issue | The system is blocked, overdue, failed, materially inconsistent, or at risk of landlord harm if ignored. | Overdue rent, failed provider payment, lease active before execution, invalid authorization/source mismatch. | Generic informational guidance. |

## Severity Rules

1. Blocked beats incomplete.
   If a workflow cannot proceed safely, map to Critical unless it is an intentional empty state.

2. Overdue beats upcoming.
   A missed due date or expired deadline is Critical or Warning, not Upcoming.

3. Needs Review is not a severity by itself.
   It is a review state. It must be paired with Critical, Warning, or Informational based on risk and blocking status.

4. Onboarding prompts are not decisions.
   Add property, add unit, track applicant, invite tenant, and run first screening are Upcoming Actions or Activation Actions, not Critical Issues.

5. Readiness gaps are warnings until they block a workflow.
   Missing Form P fields, missing payment setup, or missing delivery tracking are Warnings unless signing, rent collection, delivery, or export is blocked.

6. Source-state conflicts should be queueable.
   State coherence conflicts should become Decision Queue items because they represent conflicting source records, not simple page copy.

7. Completed states should leave the queue.
   Signed leases, completed maintenance, delivered documents, resolved decisions, and dismissed items should move to history/activity.

## Recommended Normalization Contract

Future generators should emit or adapt into this shape before display:

```ts
type DecisionSeverity = "critical" | "warning" | "needs_review" | "upcoming" | "informational";

type DecisionIntent =
  | "decide"
  | "review"
  | "complete_setup"
  | "resolve_conflict"
  | "plan_deadline"
  | "observe";
```

Recommended user-facing labels:

| Canonical severity | Label |
| --- | --- |
| `critical` | Critical |
| `warning` | Warning |
| `needs_review` | Needs review |
| `upcoming` | Upcoming |
| `informational` | Informational |

## Non-Goals

- This model does not add queue persistence.
- This model does not change the existing `DecisionInboxSeverity` TypeScript types.
- This model does not remove source-workspace readiness panels.
- This model does not redesign Dashboard or Operations UI.

