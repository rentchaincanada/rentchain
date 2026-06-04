# Export Governance v1

## Governance Philosophy

Institutional exports are controlled evidence workflows. They must be landlord-scoped, recipient-validated, purpose-bound, minimized, and audit-ready before any future assembly or delivery occurs.

This policy governs the framework layer only. It does not authorize live export delivery, evidence assembly, external submission, signing, recipient portals, or background workers.

## Authorization Boundaries

Exports may be requested only by server-resolved landlord or admin/support authority.

Required boundaries:

- landlord roles must have matching landlord scope
- admin/support roles require explicit purpose
- system roles may prepare framework entities only for governed service operations
- tenant-initiated institutional exports are out of scope
- cross-landlord and cross-tenant export scope is prohibited

The authorization layer must fail closed when actor, purpose, recipient, scope, or policy information is missing or ambiguous.

## Recipient Types And Purposes

Recipient types are enumerated:

- `ThirdPartyPropertyManager`
- `InsuranceAdjuster`
- `LegalRepresentative`
- `Regulator`
- `Arbitrator`
- `SelfArchive`

Purposes are enumerated:

- `LitigationDiscovery`
- `InsuranceClaim`
- `RegulatoryCompliance`
- `AuditReview`
- `ArbitrationEvidence`
- `SelfReview`

Purpose mappings:

| Purpose | Allowed recipient types |
| --- | --- |
| `LitigationDiscovery` | `LegalRepresentative` |
| `InsuranceClaim` | `InsuranceAdjuster` |
| `RegulatoryCompliance` | `Regulator` |
| `AuditReview` | `ThirdPartyPropertyManager`, `Regulator` |
| `ArbitrationEvidence` | `Arbitrator`, `LegalRepresentative` |
| `SelfReview` | `SelfArchive` |

Freeform recipient or purpose values are not permitted.

## Evidence Scope Rules

Export profiles must define approved evidence classes. Absence of approved evidence classes means no evidence is exportable.

Export requests may narrow scope by:

- date range
- evidence class filters
- unit safe references
- redaction policy override

Export requests may not widen beyond the profile's approved evidence classes or loosen the profile's data minimization level.

## Redaction And Data Minimization

Data minimization levels are:

- `Full`
- `Redacted`
- `RedactedSensitive`

Overrides may only tighten the level. For example, a `Redacted` profile may be tightened to `RedactedSensitive`, but it may not be loosened to `Full`.

Export framework entities must not include:

- raw Firestore IDs
- raw tenant, landlord, lease, or unit IDs
- storage paths
- tokens, credentials, or secrets
- raw provider payloads
- raw screening reports
- identity documents
- payment account values
- unrestricted message bodies

## Audit Accountability

Every profile, request, package, and future lifecycle transition must carry an audit trail reference.

The framework defines export audit event schema for future append-only persistence. This mission does not emit or persist audit events.

## Tenant Privacy

Institutional landlord exports are landlord-scoped operational workflows. Tenants are not granted visibility into landlord export profiles, recipient details, legal hold status, system authorization decisions, or export audit internals by this framework.

Tenant-facing export or self-archive behavior requires a separate mission with explicit consent, projection, and privacy rules.

## Deferred Enforcement

Future missions must implement:

- route authorization
- persistence
- evidence package assembly
- export delivery
- audit trail storage
- signing and attestation
- recipient access controls
- external integrations

No future mission may bypass the recipient-purpose mapping, landlord scope validation, redaction tightening rule, or evidence projection allowlists.
