# Canonical Review Timeline V1

## Purpose

Canonical Review Timeline V1 introduces a deterministic, read-only operational history surface for RentChain review workflows. It aggregates landlord-scoped review artifacts into one chronological view so operators can understand what happened, when it happened, who reviewed it, what evidence existed, and what readiness/export/workflow state was visible at review time.

The timeline is an operational system-of-record view. It does not replace canonical events, decision derivation, evidence packs, export previews, audit/compliance readiness, or operator review sessions.

## Scope

Supported timeline scopes:

- `decision`
- `workflow`
- `operator_review`
- `evidence_pack`
- `institution_export`
- `audit_compliance`
- `lease`
- `property`
- `delinquency`
- `maintenance`
- `admin_review`

The V1 endpoint is landlord-scoped. Admin-only data must not be exposed through landlord routes.

## Model

Each timeline includes:

- deterministic `timelineId`
- `scope` and `scopeId`
- `generatedAt`
- `manualReviewRequired: true`
- `externalSharingEnabled: false`
- `certificationIssued: false`
- filtered `entries`
- available filter values
- summary counts

Timeline entries include:

- entry type
- timestamp
- label and description
- status
- actor attribution
- source attribution
- source ID
- safe internal destination
- redaction reason
- blocked reason
- `manualOnly: true`

## Entry Types

V1 derives these entry types from existing read models:

- `canonical_event`
- `decision`
- `workflow_transition`
- `operator_review`
- `evidence_reference`
- `export_preview`
- `readiness_check`
- `delinquency_review`
- `maintenance_review`
- `redaction_note`

No autonomous execution entries are created.

## Ordering

Timeline ordering is deterministic:

1. chronological timestamp order
2. source order for identical timestamps
3. timeline entry ID order for identical timestamp/source pairs

The timeline is derived at request time. Source records are not mutated.

## Endpoint

Landlord-scoped read endpoint:

```text
GET /api/landlord/review-timeline?scope=...&scopeId=...
```

Optional filters:

- `entryType`
- `status`
- `source`

Allowed behavior:

- read-only timeline derivation
- safe internal context links
- redaction metadata
- blocked reason visibility
- actor/source attribution

Not allowed:

- timeline editing
- timeline deletion
- approval/certification
- external submission or sharing
- scheduled generation
- background workers
- notification sending
- source-record mutation

## UI

The frontend exposes the timeline at:

```text
/review-timeline
```

Safe entry points may link from:

- Decision Inbox
- Operator Review Session panels
- Evidence Pack preview
- Institution Export preview
- Audit Compliance readiness

Required copy:

- “Read-only operational review timeline.”
- “Timeline entries are audit oriented and manually reviewable.”
- “No automated approval or certification occurs.”

## Deferred

- Workflow automation
- AI review summarization
- legal certification
- external filing/submission
- public sharing
- timeline editing/deletion
- audit signing
- evidence scoring
- live integrations
