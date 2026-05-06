# Agent Supervision Console v1

## Purpose

Agent Supervision Console v1 adds a deterministic, landlord-scoped supervision surface for RentChain's controlled agentic infrastructure.

The console centralizes visibility into:

- automated workflow previews
- policy-gated agent suggestions
- blocked policy guards
- escalation indicators
- workflow synchronization issues
- review, evidence, timeline, and readiness references

## Read-Only Scope

This layer is read-only and supervision-oriented. It does not execute actions, communicate externally, submit exports, certify compliance, trigger payment movement, or mutate source-of-truth records.

Required flags remain:

- `manualReviewRequired: true`
- `policyGuarded: true`
- `requiresHumanApproval: true`
- `externalExecutionEnabled: false`
- `autonomousExecutionEnabled: false`

## Derivation

The backend derives an `AgentSupervisionSnapshot` from the existing Decision Inbox read model. It reuses:

- decision workflow routing
- automated workflow previews
- policy-gated agent action suggestions
- escalation metadata
- existing evidence and timeline routes

No new decision engine, workflow engine, queue infrastructure, worker, or autonomous agent is introduced.

## Endpoint

`GET /api/landlord/agent-supervision/snapshot`

The endpoint is landlord-scoped through existing authentication and landlord middleware. It returns a deterministic snapshot with summary counts and grouped supervision items.

## Canonical Events

V1 exposes additive event descriptors only:

- `agent_supervision_snapshot_generated`
- `agent_supervision_escalation_visible`
- `agent_supervision_review_required`
- `agent_supervision_policy_guard_visible`
- `agent_supervision_acknowledgement_visible`

These are traceability descriptors in the snapshot. V1 does not persist or execute event side effects.

## UI

The frontend adds `/agent-supervision`, a read-only console showing:

- supervision summary cards
- suggested action visibility
- workflow synchronization visibility
- blocked policy guards
- escalation indicators
- review, evidence, and timeline references

The UI intentionally contains no execution, approval, communication, payment, legal, export, certification, or autonomous-mode controls.

## Deferred

- acknowledgement persistence
- centralized agent supervision inbox filters
- admin-only supervision surfaces
- agent supervision audit timeline persistence
- policy-gated agent action execution
- supervised automation controls
