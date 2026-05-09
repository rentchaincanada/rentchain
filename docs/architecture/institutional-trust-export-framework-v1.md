# Institutional Trust Export Framework v1

Status: implemented foundation
Branch: `feat/institutional-trust-export-framework-v1`
Scope: institution-safe portable trust export composition, no public exposure or institution integration

## Implementation Audit Summary

RentChain already had several export and trust foundations:

- `portableAttestations` defines metadata-only portable trust claims.
- `attestationPolicyGate` deterministically answers whether a portable attestation is exportable or shareable for a requested audience and purpose.
- `institutionExports` produces manual-only, read-only institution export previews.
- `identityAssurance`, `propertyTrust`, and `accountTrust` provide source trust metadata without storing raw identity, property, screening, banking, or provider payloads.
- support/admin summaries remain separate from portable summaries.

The remaining gap was institution-safe trust export composition: a package-level layer that groups only policy-approved portable attestation summaries into an institution-readable, minimized, auditable export object.

## Export Model

The framework introduces `rentchain-api/src/lib/institutionTrustExports` with:

- `InstitutionalTrustExportPackage`
- `InstitutionalTrustExportAudience`
- `InstitutionalTrustExportPurpose`
- `InstitutionalTrustExportStatus`
- `InstitutionalTrustExportLifecycle`
- `InstitutionalTrustExportAuditMetadata`
- `InstitutionalTrustExportProvenance`
- `deriveInstitutionalTrustExportPackage`
- `institutionalTrustExportMappingForPackageType`

Institutional trust export packages are:

- metadata-only
- consent-scoped
- policy-gated
- manual-only
- non-public
- external-submission disabled
- source-provenance aware
- audit-metadata backed

## Audience And Purpose Model

Supported export audiences include:

- `insurer`
- `lender`
- `institutional_landlord`
- `subsidy_program`
- `government_review`
- `tenant_portability`
- `auditor`
- `internal_review`

The package layer maps audience and purpose to portable attestation policy contexts. Internal-review contexts are intentionally not treated as portable external exports.

## Policy Gate Integration

Every portable trust summary in an institutional trust export is produced by `buildPolicySafeExportSummary`.

The export package blocks:

- missing or insufficient consent
- audience mismatch
- purpose mismatch
- expired attestations
- revoked attestations
- superseded attestations
- reverification-required attestations
- internal-only retention
- unsafe sensitivity
- unsupported claims
- raw provider payloads
- raw evidence
- support/internal metadata
- public exposure
- external submission flags
- source mismatch

The package carries the underlying policy decisions and machine-readable blocked reasons for auditability.

## Export Minimization

Exports include only `PortableAttestationExportSummary` objects approved by the policy gate.

Exports exclude:

- raw identity documents
- raw title or registry payloads
- raw provider payloads
- support-console notes
- internal reference ids
- provider reference ids
- unpublished governance metadata
- public profile controls
- external submission behavior
- unsupported ownership, creditworthiness, subsidy, identity, or approval conclusions

## Existing Institution Export Alignment

`deriveInstitutionExportPackage` can now attach a `trustExport` and `portable_trust_summary` section only when portable attestations are explicitly supplied by the caller.

Current routes do not load or pass portable attestations. This preserves existing institution export preview behavior and avoids share-package or public exposure changes.

## Auditability

Each institutional trust export package includes:

- export id
- generated timestamp
- audience
- purpose
- consent-scoped flag
- policy-gated flag
- manual-only flag
- public/external-submission disabled flags
- portable attestation count
- exportable attestation count
- blocked attestation count
- policy decision count

This is metadata-only auditability. It is not an institution submission record and does not imply external delivery.

## Guardrails Preserved

This framework does not:

- expose trust metadata publicly
- widen tenant share packages
- add institution APIs
- add provider APIs
- create public trust profiles
- create reputation scores
- automate institutional decisions
- create credit reports
- add blockchain, tokenization, or verifiable credential behavior
- submit data to insurers, lenders, subsidy programs, or governments

## Regression Risks

- Future routes must explicitly prove they call this package layer and the attestation policy gate before any external projection.
- Existing institution export previews are still operational summaries; trust metadata is included only when supplied by a guarded future caller.
- Institution-specific schemas, packet signing, recipient delivery, consent UX, and revocation notifications remain future work.

## Verification

Tests cover:

- export audience restrictions
- policy gate enforcement
- revoked, expired, and reverification-required blocking
- export minimization and raw/internal metadata exclusion
- unsupported claim blocking
- support/internal metadata blocking
- export audit metadata
- optional guarded attachment to institution export previews
