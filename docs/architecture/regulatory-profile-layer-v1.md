# Regulatory Profile Layer v1

## Purpose

The Regulatory Profile Layer is a deterministic, landlord-scoped read model for jurisdiction-aware operational readiness. It normalizes registry, screening, privacy, institutional-sharing, settlement, export, audit, review, and evidence references into one profile per jurisdiction.

This layer is operational readiness only. It does not provide legal advice, legal certification, regulator filing, external submission, autonomous compliance approval, or live government integration.

## Model

Regulatory profiles include:

- jurisdiction: country, province, and municipality
- status: `ready_for_review`, `partially_ready`, `blocked`, or `unknown`
- required safety flags:
  - `manualReviewRequired: true`
  - `legalCertificationEnabled: false`
  - `externalRegulatorSubmissionEnabled: false`
- registry references
- screening readiness summaries
- privacy and consent readiness summaries
- institutional-sharing restrictions
- settlement-readiness restrictions
- export/shareability restrictions
- audit, review, and evidence lineage
- redaction notes and blocked reasons

## Deterministic Status Rules

- `unknown`: insufficient landlord-scoped source context exists.
- `blocked`: at least one required regulatory reference is blocked.
- `partially_ready`: at least one reference is partially verified or unavailable, with no blocked reference.
- `ready_for_review`: all available references are verified and no blocked reference exists.

No AI scoring, probabilistic compliance scoring, legal conclusions, or jurisdiction ranking is used.

## Restriction Rules

Regulatory restrictions are derived from existing landlord-scoped read models:

- missing consent lineage makes privacy readiness blocked
- blocked settlement readiness creates a settlement restriction
- blocked audit readiness creates an audit restriction
- blocked export preview creates an export/shareability restriction
- sharing room metadata that indicates public access, external execution, or blocked state creates a sharing restriction
- missing registry verification creates a registry readiness restriction

All restrictions include explicit reasons and preserve review/evidence lineage where safely available.

## Redaction Rules

Regulatory profiles expose summary references only. They exclude:

- legal opinions and legal advice
- government filing payloads
- raw screening and credit bureau payloads
- sensitive tenant and payment data
- unrestricted regulatory export payloads

## Canonical Event Descriptors

The layer emits descriptor-only canonical event metadata:

- `regulatory_profile_derived`
- `regulatory_restriction_detected`
- `regulatory_review_required`
- `regulatory_profile_blocked`
- `regulatory_redaction_applied`

These descriptors are additive, deterministic, explainable, and traceable. They do not mutate source records or submit anything externally.

## Non-Goals

This layer does not add:

- regulator integrations
- legal filing
- automated compliance certification
- legal advice generation
- government API submission
- PSP/MSB execution
- public compliance publishing
- hidden compliance side effects
