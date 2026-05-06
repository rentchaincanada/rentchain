# Institutional Sharing Room v1

## Purpose

Institutional Sharing Room v1 introduces controlled, revocable operational review spaces for institutional actors such as lenders, insurers, auditors, regulators, and operational partners.

The layer organizes safe references to existing RentChain evidence, export previews, review timelines, audit readiness, and identity lineage without creating public portals or external integrations.

## Core Model

Sharing rooms include:

- room type
- access-control state
- expiration metadata
- shared scope references
- redaction metadata
- audit references
- evidence and timeline references

Every room is landlord-scoped and manually governed.

## Required Safety Flags

Every room enforces:

- `manualReviewRequired: true`
- `publiclyAccessible: false`
- `externalExecutionEnabled: false`
- `tokenizationEnabled: false`

Access controls enforce:

- `accessType: view_only`
- `publicAccess: false`
- `downloadEnabled: false`
- `externalSubmissionEnabled: false`
- `manualApprovalRequired: true`

## Redaction Rules

Sharing rooms never include raw sensitive payloads. The read model excludes:

- raw government identity numbers
- raw screening, credit bureau, and provider payloads
- payment account, card, bank, processor, and provider details
- private tenant documents
- unrestricted tenant communications

Redaction metadata is visible so operators can explain what was excluded.

## Lifecycle Events

Sharing rooms use additive canonical event descriptors:

- `institutional_sharing_room_created`
- `institutional_sharing_room_review_required`
- `institutional_sharing_room_access_granted`
- `institutional_sharing_room_access_expired`
- `institutional_sharing_room_access_revoked`
- `institutional_sharing_room_redaction_applied`

Events remain deterministic and traceable. They do not submit, share, or certify anything externally.

## Non-Goals

Institutional Sharing Room v1 does not add:

- public links
- anonymous access
- unrestricted downloads
- live lender, insurer, regulator, or government integrations
- autonomous sharing
- legal certification
- blockchain or tokenized identity sharing
- financial rails
- external API submission

## Future Work

Future missions may introduce verified rental history ledgers, settlement rail readiness, regulatory profile layers, and controlled institutional sharing workflows. Those extensions should preserve this permissioned, redaction-aware room model.
