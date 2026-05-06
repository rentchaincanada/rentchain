# Evidence Pack Layer V1

## Purpose

Evidence Pack Layer V1 introduces deterministic, read-only evidence previews for landlord-scoped operational review. An evidence pack is a review envelope that summarizes which supporting records, events, decisions, review sessions, export readiness checks, and audit/compliance readiness checks are available for a given scope.

Evidence packs are for internal review and context discovery only. They do not share data externally, issue certification, file reports, send communications, or mutate source records.

## Scope

Supported preview scopes:

- `decision`
- `workflow`
- `delinquency`
- `institution_export`
- `audit_compliance`
- `lease`
- `property`
- `tenant`
- `maintenance`
- `admin_review`

The V1 landlord endpoint is permission-scoped and must not expose admin-only evidence through landlord routes.

## Model

Each evidence pack includes:

- deterministic `evidencePackId`
- `scope` and `scopeId`
- readiness `status`
- `manualReviewRequired: true`
- `externalSharingEnabled: false`
- `certificationIssued: false`
- summary counts
- evidence sections
- redaction metadata
- blocked reasons
- disclaimers

The pack is a derived read model. It is not persisted as a new source of truth.

## Sections

V1 derives these sections when source data is available:

- Decision lineage
- Workflow routing
- Operator review sessions
- Audit events
- Export readiness
- Audit and compliance readiness
- Lease context
- Property context
- Maintenance context
- Delinquency context
- Redaction summary

Sections may be marked `included`, `incomplete`, `blocked`, or `unavailable`.

## Status Rules

Evidence pack status is deterministic:

- `ready_for_review`: required context is present, no blocked sections, and redaction metadata is available.
- `incomplete`: one or more non-critical sections are missing or unavailable.
- `blocked`: a required or safety-sensitive section is blocked.
- `unavailable`: scope, scope identifier, or landlord context is missing.

No AI scoring, probabilistic ranking, legal conclusion, or compliance certification is produced.

## Redactions

Evidence packs must exclude or redact sensitive payloads, including:

- tenant contact details when not required for the review summary
- private tenant documents
- identity documents
- screening or credit payloads
- payment provider details
- private message contents

Redaction metadata is shown as review context. Missing redaction metadata blocks review-ready status.

## Endpoint

Landlord-scoped preview endpoint:

```text
GET /api/landlord/evidence-packs/preview?scope=...&scopeId=...
```

Allowed behavior:

- read-only derivation
- safe internal context links
- redaction metadata
- missing evidence and blocked reason reporting

Not allowed:

- external sharing
- public links
- file generation for external use
- certification
- scheduled generation
- background workers
- external API calls
- mutation of leases, tenants, properties, payments, applications, screening, maintenance, decisions, exports, audit readiness, or operator reviews

## UI

The frontend exposes an internal evidence pack preview surface at:

```text
/evidence-packs
```

Supported entry points may link from Decision Inbox, operator review sessions, institution export previews, and audit/compliance readiness surfaces.

Required safety copy:

- “Preview only. Evidence is not shared externally.”
- “Manual review is required before relying on or sharing this evidence.”
- “Sensitive data may be excluded or redacted.”

## Deferred

- External sharing rooms
- Public evidence package links
- Lender, insurer, government, or auditor submission
- Report/email sending
- Legal certification
- Audit signing
- Evidence notarization
- Tenant document export
- Raw credit/bureau export
- Payment account export
- Live integrations
