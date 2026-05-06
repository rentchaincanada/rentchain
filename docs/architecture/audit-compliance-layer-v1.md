# Audit Compliance Layer v1

## Purpose

Audit Compliance Layer v1 summarizes whether landlord-scoped records are complete, traceable, and ready for manual review. It sits on top of the Decision Inbox, workflow routing, delinquency action scaffolding, and institution export preview.

This layer is readiness visibility only.

## Guardrails

V1 does not provide legal compliance certification. It does not file, submit, send, schedule, or report anything externally.

Every readiness response includes:

- `manualOnly: true`
- `certificationIssued: false`
- `externalFilingEnabled: false`
- `automatedReportingEnabled: false`

Allowed wording:

- readiness
- review-ready
- manual review required
- evidence available
- missing evidence
- blocked reason

Avoided wording:

- certified compliant
- legally compliant
- approved
- filed
- submitted

## Readiness Checks

Initial deterministic checks:

- `property_identity_present`
- `lease_traceability`
- `occupancy_summary_available`
- `payment_summary_available`
- `decision_workflow_reviewable`
- `delinquency_actions_manual_only`
- `institution_export_preview_only`
- `audit_event_coverage`
- `policy_evaluation_available`
- `sensitive_data_redacted`
- `external_submission_disabled`
- `automated_reporting_disabled`

Each check includes:

- status
- severity
- evidence
- missing evidence
- blocked reasons
- `manualReviewRequired: true`

## Status Rules

Overall readiness status is deterministic:

- `blocked`: at least one critical check is blocked
- `needs_attention`: at least one check needs attention and no critical check is blocked
- `ready_for_review`: no blocked critical checks and no needs-attention checks
- `unavailable`: insufficient source context exists for a meaningful readiness summary

No AI scoring or probabilistic judgment is used.

## Endpoint

Landlord-scoped readiness endpoint:

`GET /api/landlord/audit-compliance/readiness`

Optional query parameters:

- `scope`
- `propertyId`
- `leaseId`
- `packageType`

The endpoint uses existing authentication and landlord scoping. It returns readiness JSON only and does not persist generated readiness records.

## UI

Frontend readiness page:

`/audit-compliance`

The page displays:

- readiness status
- summary counts
- checks
- evidence
- missing evidence
- blocked reasons
- redaction metadata
- disclaimers

Required copy makes clear that readiness is not legal certification, no external filing or automated reporting is performed, and manual review is required before relying on the package.

## Sensitive Data

The readiness layer relies on institution export redaction metadata and does not expose:

- raw bureau or credit reports
- private tenant documents
- identity documents
- payment account data
- private message contents
- admin-only records through landlord routes

## Deferred

Future missions may add:

1. Audit packet review workflows.
2. Admin-only readiness views.
3. Institution-specific readiness schemas.
4. Signed audit packets.
5. External filings or reports only after explicit legal/compliance review and mission approval.
