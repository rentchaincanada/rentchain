# Policy-Gated Agent Actions v1

Policy-Gated Agent Actions v1 adds deterministic, operator-visible action suggestions on top of Decision Inbox, workflow routing, automated workflow previews, operator reviews, evidence packs, and review timelines.

This layer is not autonomous agent execution. It is a supervised recommendation surface for human operators.

## Scope

V1 supports:

- suggested actions
- suggested next steps
- suggested workflow transitions
- suggested evidence requests
- suggested review escalation
- suggested follow-up review
- canonical agent-action event descriptors

V1 does not:

- execute actions automatically
- contact tenants, landlords, vendors, lenders, insurers, regulators, or institutions
- send email, SMS, push notifications, reports, or notices
- trigger payment collection or financial movement
- generate legal notices or eviction actions
- approve workflows or certify compliance
- submit exports externally
- add background workers, queues, cron, Pub/Sub, schedulers, or autonomous agents
- mutate lease, property, tenant, payment, screening, decision, export, evidence, or audit readiness records

## Model

Each suggestion contains:

- `agentActionId`
- `actionType`
- `status`
- `manualReviewRequired: true`
- `policyGuarded: true`
- `externalExecutionEnabled: false`
- `requiresHumanApproval: true`
- `explanation`
- `relatedScope`
- `queue`
- `escalationLevel`
- `canonicalEvents`
- `generatedAt`

## Action Types

Supported V1 action types:

- `request_evidence`
- `recommend_review`
- `suggest_escalation`
- `suggest_follow_up`
- `suggest_workflow_transition`
- `suggest_export_review`

These are recommendations only. They never execute operational changes.

## Policy Guards

Suggestions require:

- manual workflow routing
- non-executable Decision Inbox items
- external workflow execution disabled
- landlord-safe ownership metadata

Admin-owned decisions are blocked from landlord action suggestions. Blocked suggestions include deterministic blocked reasons.

## Canonical Event Descriptors

V1 emits deterministic event descriptors:

- `policy_gated_agent_action_suggested`
- `policy_gated_agent_action_blocked`
- `policy_gated_agent_action_acknowledged`
- `policy_gated_agent_action_review_required`

These descriptors support audit and timeline context. They do not write events or trigger side effects in V1.

## API

The landlord-scoped suggestion endpoint is:

```text
GET /api/landlord/agent-actions/suggestions
```

Supported filters:

- `actionType`
- `status`
- `queue`
- `escalationLevel`

Decision Inbox responses include `agentActions` per item and `agentActionSummary`.

## Deferred

- acknowledgement persistence
- full agent supervision console
- policy-gated execution requests
- operator assignment workflows
- notification delivery
- external submissions
- payment actions
- legal notice workflows
