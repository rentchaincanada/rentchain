# Operator Review Session v1

Operator Review Session v1 adds a deterministic, permissioned review envelope for human review of decisions, workflows, delinquency context, institution export previews, and audit/compliance readiness.

## Purpose

A review session is an auditable operational review envelope. It captures who opened a review, what scope was reviewed, which safe evidence references were attached, any bounded notes, and the final manual outcome.

## Scope

Supported review scopes:

- `decision`
- `workflow`
- `delinquency`
- `institution_export`
- `audit_compliance`

Supported outcomes:

- `reviewed`
- `needs_follow_up`
- `escalated`
- `blocked`
- `unresolved`

## Persistence

Review sessions are stored separately in `operatorReviewSessions`.

Review sessions do not mutate:

- leases
- payments
- tenants
- properties
- screening records
- institution export previews
- audit/compliance readiness records
- decision derivation source records

## Audit Events

Review session changes create additive canonical events:

- `operator_review_session_opened`
- `operator_review_note_added`
- `operator_review_outcome_recorded`
- `operator_review_session_closed`

These events are audit visibility only. They do not trigger automation or workflow execution.

## Safety

V1 remains manual only:

- `manualOnly: true`
- `systemGenerated: false`
- no autonomous review
- no auto-resolution
- no legal certification
- no external filing
- no notification sending
- no background jobs or queues

Notes are length-limited and sanitized before persistence.

## Deferred

- Evidence pack generation
- Canonical review timeline views
- Supervised automation
- Policy-gated agent actions
- Agent supervision console
