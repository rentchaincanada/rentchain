# Attestation Framework v1

Status: implemented service foundation
Scope: metadata-only signature and evidence attestation lifecycle contracts

## Purpose

Attestation Framework v1 establishes service-layer contracts for package signing metadata, certificate references, evidence links, and attestation chain verification. It connects institutional export packages to canonical export audit events while preserving the portable attestation taxonomy already defined for metadata-only trust claims.

The framework does not perform signing operations. It records lifecycle metadata, safe references, and immutable chain state so future signing and recipient verification missions can build on audited foundations.

## Components

The implementation adds:

- `rentchain-api/src/types/attestation-types.ts`
- `rentchain-api/src/services/attestation-service.ts`
- `rentchain-api/src/services/attestation-certificate-manager.ts`
- `rentchain-api/src/services/evidence-attestation-linker.ts`

The export audit event contract now includes:

- `ExportPackageSignatureRequested`
- `ExportPackageSignatureGenerated`
- `ExportPackageSignatureVerified`
- `ExportPackageAttestationLinked`
- `ExportPackageAttestationRevoked`

These events are written through the existing `canonicalEvents` export audit path and inherit append-only, immutable, metadata-only flags.

## Audit Event Semantics

Attestation events target `ExportPackage` and are landlord-scoped through the same safe landlord and package references used by Export Audit Trail v1. Event details contain only:

- attestation safe reference
- signature safe reference
- certificate safe reference
- supported algorithm label
- lifecycle state
- linked evidence safe reference
- metadata-only flags

Events do not include raw package ids, raw evidence ids, raw landlord ids, certificates, signatures, key material, authentication material, provider source material, or storage paths.

## Certificate References

`attestation-certificate-manager.ts` registers deterministic certificate references from issuer metadata, algorithm, and validity window. The supported algorithms are:

- `RSA-SHA256`
- `ECDSA-SHA256`

Certificate references are metadata records only. The service never stores, retrieves, projects, or validates raw certificates or key material.

## Evidence Links

`evidence-attestation-linker.ts` creates immutable links between evidence/package safe references and attestation safe references. Link creation returns a new metadata record and does not mutate evidence records or export packages.

Landlord-scoped query helpers filter by safe landlord and package references. `buildEvidenceAttestationMap()` maps safe evidence references to attestation chain events for internal service use.

## Chain Verification

`buildAttestationChain()` reconstructs package attestation lifecycle from canonical export audit events. `verifyAttestationChainIntegrity()` validates:

- non-empty chains
- monotonic timestamps
- consistent attestation references
- metadata-only and projection-safe flags
- valid lifecycle states
- no state regression
- required request, generation, verification, and link ordering

`projectAttestationForLandlord()` returns an allowlisted landlord projection with only safe references, lifecycle state, timestamps, and algorithm labels.

## Portable Attestation Alignment

This framework does not replace portable attestations. It complements them by adding package-level lifecycle evidence for future institutional export signing and trust-chain review.

Portable attestation types remain claim-level and consent-scoped. The attestation framework records package-level signing and linkage metadata that can later be associated with portable trust summaries without widening export surfaces.

## Boundaries

This framework does not add:

- HTTP routes
- dashboard surfaces
- signing execution
- delivery mechanisms
- recipient verification portals
- external PKI, KMS, HSM, blockchain, distributed-ledger, or verified-identity integrations
- Firestore rule changes
- background workers
- production data migrations
- tenant-initiated signing or consent flows

## Validation

Tests cover:

- attestation schema flags and constrained enums
- deterministic certificate references
- algorithm rejection for unsupported values
- certificate metadata projection safety
- immutable evidence/package attestation links
- landlord-scoped link queries
- non-blocking audit append behavior
- canonical event chain reconstruction
- chain integrity failures for missing lifecycle steps
- landlord-scoped attestation projections
- export audit trail integration for signature event types
