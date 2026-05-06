# Automated Workflows v1

Automated Workflows v1 adds deterministic internal workflow orchestration metadata on top of the existing Decision Inbox, workflow routing, operator review, evidence, audit readiness, and canonical timeline layers.

This layer is not autonomous platform execution. It is an internal review-state preview that explains how existing decision workflow metadata can be normalized for human review.

## Scope

Automated Workflows v1 supports:

- workflow-state normalization
- review-required visibility
- blocked-state visibility
- escalation flag visibility
- policy/manual-review flags
- deterministic canonical workflow event descriptors

Automated Workflows v1 does not:

- send emails, messages, reports, or notifications
- communicate with tenants, landlords, institutions, regulators, insurers, or lenders
- trigger payment collection or alter payment balances
- initiate legal notices, eviction workflows, or enforcement
- submit institution exports
- certify audit/compliance readiness
- call external APIs or live integrations
- add background jobs, queues, cron, Pub/Sub, workers, or scheduled reporting
- mutate lease, tenant, property, payment, screening, export, evidence, or decision source-of-truth records

## Model

Each preview contains:

- `automationId`
- `decisionId`
- `workflowType`
- `status`
- `queue`
- `escalationLevel`
- `manualReviewRequired: true`
- `policyGuarded: true`
- `externalExecutionEnabled: false`
- `requiresHumanAcknowledgement: true`
- `transition`
- `reasons`
- `blockedReasons`
- `canonicalEvents`
- `generatedAt`

## Deterministic Transitions

Current workflow state derives the preview transition:

- `new` or `triaged` -> `under_review`
- `under_review` -> `under_review`
- `waiting_context` -> `waiting_context` with blocked reason
- `escalated` -> `escalated`
- `resolved` or `archived` -> unchanged and completed

The derivation is rule-based. It does not use AI classification, probabilistic scoring, autonomous prioritization, or hidden state changes.

## Policy Guards

Every preview remains:

- manual-review required
- policy guarded
- human-acknowledgement required
- external execution disabled

Admin-owned workflow metadata is blocked from landlord automation previews. Executable automation is not enabled through this layer.

## Canonical Event Descriptors

V1 emits deterministic event descriptors for review and timeline context:

- `automated_workflow_transition_derived`
- `automated_workflow_blocked`
- `automated_workflow_escalation_flagged`
- `automated_workflow_review_required`
- `automated_workflow_sync_completed`

These descriptors are preview metadata in V1. They are not background jobs and do not trigger external behavior.

## API

The landlord-scoped preview endpoint is:

```text
GET /api/landlord/automated-workflows/preview
```

Supported filters:

- `workflowType`
- `status`
- `queue`
- `escalationLevel`

Decision Inbox responses also include `automatedWorkflow` per item and `automationSummary` counts.

## Deferred

- workflow metadata sync persistence
- operator assignment persistence
- supervised workflow execution
- policy-gated agent actions
- notification delivery
- tenant or landlord communications
- payment actions
- export submission
- compliance certification
