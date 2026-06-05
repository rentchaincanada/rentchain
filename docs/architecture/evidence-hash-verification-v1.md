# Evidence Hash Verification v1

Status: implemented service foundation
Scope: deterministic package/evidence hashing, signature reference generation, and attestation hash-chain verification

## Purpose

Evidence Hash Verification v1 adds a deterministic integrity layer for export packages and evidence records. It computes SHA-256 hashes over canonical metadata, generates safe signature references from those hashes, records package signing lifecycle through canonical export audit events, and verifies attestation chains fail closed when hashes or lifecycle steps do not match.

This mission remains service-layer only. It does not add routes, dashboards, delivery, recipient verification, external key infrastructure, Firestore rules, workers, migrations, or production signing integrations.

## Components

The implementation adds:

- `rentchain-api/src/lib/evidence-hash-service.ts`
- `rentchain-api/src/services/signature-generation-service.ts`
- `rentchain-api/src/services/hash-chain-validation-service.ts`

It also extends:

- `rentchain-api/src/services/attestation-service.ts`
- `rentchain-api/src/types/attestation-types.ts`
- `rentchain-api/src/types/export-audit-types.ts`

## Hash Computation

`computeEvidencePackageHash()` hashes a canonical package representation with stable sorted keys and explicit null handling. The package hash includes the package id, request id, landlord safe reference, recipient type, purpose, stable package metadata, evidence manifest scope, status, and metadata-only flags.

`computeEvidenceRecordHash()` hashes stable evidence metadata including evidence class, type, schema version, landlord scope, resource type, safe reference metadata, source collection/reference, sensitivity metadata, retention summary, lifecycle status, and immutable flags.

Hash inputs intentionally exclude volatile or internal fields such as audit trail references, delivery metadata, signature metadata, raw resource ids, lifecycle event arrays, and mutable timestamps that would make verification unstable.

All hashes must be 64-character lowercase SHA-256 hex strings.

## Signature References

`signature-generation-service.ts` creates deterministic metadata-only signature records:

- signature reference from content hash and algorithm
- algorithm allowlist: `RSA-SHA256`, `ECDSA-SHA256`
- certificate safe reference
- signer safe reference
- content hash
- metadata-only and raw-material exclusion flags

The service does not perform private-key operations. It produces signing metadata references only. External key management, certificate authorities, and signing execution remain future work.

## Attestation Integration

`attestation-service.ts` now includes:

- `requestSignatureForPackage()`
- `recordGeneratedSignature()`
- `recordVerifiedSignature()`

These helpers validate `ExportAuthorizationContext`, enforce landlord scope, generate deterministic attestation/signature references, and emit existing canonical export audit events. Generated and verified signature events include the package hash as metadata.

Evidence and package objects are never mutated. The only write path is the existing non-blocking canonical audit append helper.

## Hash Chain Verification

`hash-chain-validation-service.ts` reconstructs hash-chain state from an `AttestationChain`.

Validation checks:

- generated signature event exists
- verified signature event exists
- content hashes are valid SHA-256 hex
- generated and verified hashes match
- timestamps are monotonic
- metadata flags remain projection-safe

`verifyEvidenceHashAgainstChain()` fails closed. Any invalid hash, missing lifecycle step, generated/verified mismatch, or package hash mismatch returns `success: false` with explicit error codes and no partial acceptance.

## Data Flow

1. Export package is assembled.
2. `computeEvidencePackageHash()` produces a deterministic SHA-256 hash.
3. `requestSignatureForPackage()` appends `ExportPackageSignatureRequested`.
4. `recordGeneratedSignature()` creates a safe signature reference and appends `ExportPackageSignatureGenerated` with the package hash.
5. `recordVerifiedSignature()` validates the generated hash, appends `ExportPackageSignatureVerified`, and may create an immutable evidence-attestation link.
6. `buildAttestationChain()` reconstructs the canonical event chain.
7. `verifyEvidenceHashAgainstChain()` validates hash-chain integrity for the current package hash.

## Boundaries

This framework does not add:

- HTTP routes
- frontend surfaces
- recipient verification portals
- delivery mechanisms
- external KMS, HSM, PKI, certificate authority, notary, or timestamp integrations
- background signing workers
- Firestore rule changes
- production data migrations
- key rotation or revocation workflows
- signature material, key material, certificate content, or provider source material in projections

## Validation

Tests cover:

- canonical JSON normalization
- deterministic package and evidence hashes
- SHA-256 format validation
- read-only package/evidence behavior
- deterministic signature references
- algorithm rejection
- signing context validation
- hash-chain reconstruction and fail-closed verification
- request, generated, and verified signature workflow through canonical events
- landlord scope rejection
- non-blocking append behavior
