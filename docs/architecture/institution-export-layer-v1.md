# Institution Export Layer v1

## Purpose

Institution Export Layer v1 prepares read-only preview packages for future institutional review workflows. It is scaffolding for lenders, insurers, government programs, auditors, and internal administrative review without submitting data externally.

The layer exists to answer:

- which landlord-scoped sections are available
- which sections are blocked or unavailable
- which sensitive data categories are excluded or redacted
- whether the preview is ready for manual review

## Scope

V1 is preview-only and deterministic.

Allowed:

- landlord-scoped preview JSON
- aggregate section summaries
- deterministic readiness and blocking reasons
- redaction metadata
- manual review safety copy

Not allowed:

- external submission
- live lender, insurer, government, or auditor integrations
- scheduled report generation
- background workers, queues, cron, or Pub/Sub
- emails, uploads, or institution sharing
- legal, financial, or compliance certification
- mutation of lease, tenant, property, screening, payment, delinquency, maintenance, or decision records

## Package Types

Supported package types:

- `lender_due_diligence`
- `insurance_review`
- `government_program_review`
- `auditor_review`
- `internal_admin_review`

Supported audiences:

- `lender`
- `insurer`
- `government`
- `auditor`
- `internal`

Every package includes:

- `manualOnly: true`
- `externalSubmissionEnabled: false`

## Sections

Initial sections:

- `property_summary`
- `lease_summary`
- `occupancy_summary`
- `decision_summary`
- `delinquency_summary`
- `maintenance_summary`
- `audit_event_summary`

Each section is marked as:

- `included`
- `blocked`
- `unavailable`

Blocking and unavailable reasons are explicit and deterministic.

## Redactions

V1 preview payloads exclude sensitive or high-risk categories:

- tenant contact details
- identity documents
- raw screening, credit bureau, and provider payloads
- bank account, card, payment account, and processor details
- unrestricted private message contents

Preview payloads are aggregate summaries only. They do not include tenant private documents, raw screening internals, unredacted identity documents, full bank/payment account details, or unrestricted message bodies.

## Endpoint

Landlord-scoped preview endpoint:

`GET /api/landlord/institution-exports/preview?packageType=lender_due_diligence`

The endpoint uses existing authentication and landlord scoping. It returns preview JSON only and does not persist generated packages.

## UI

The frontend preview page is available at:

`/institution-exports`

It displays:

- package type selector
- readiness status
- included, blocked, and unavailable sections
- blocked reasons
- redaction notes
- aggregate preview payload summary

Required safety copy makes clear that no data is submitted externally and that manual review is required before sharing with any institution.

## Deferred

Future missions may add:

1. Export file generation after explicit review.
2. Admin-only institutional package review.
3. Audit/compliance layer checks.
4. Institution-specific schemas.
5. Signed audit packets.
6. External submission workflows, only after explicit permission and compliance review.
