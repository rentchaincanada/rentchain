# Export Integrity and Signature Foundations v1

## Executive summary

This report establishes RentChain's first export-integrity and signature-readiness governance foundation for evidence packs, institutional exports, tenant trust exports, document exports, and governed review artifacts.

This mission does not introduce production cryptographic signing, public verification APIs, blockchain anchoring, export visibility changes, or new export access paths. It defines deterministic metadata terminology and a small helper contract that future signed-export workflows can build on after separate security review.

## Scope and non-goals

In scope:

- Export integrity terminology.
- Signature-readiness metadata semantics.
- Deterministic source lineage expectations.
- Reproducibility expectations for governed exports.
- Metadata-only helper and regression tests.

Out of scope:

- Production cryptographic signing.
- Cryptographic verification.
- Public verification endpoints.
- Blockchain, tokenization, or on-chain anchoring.
- Export payload expansion.
- Tenant-visible internal verification metadata.
- Auth, Firestore rules, schema, or route changes.

## Export integrity philosophy

RentChain exports should be reproducible from deterministic, authority-scoped projection inputs. Export integrity metadata should describe how an artifact was derived, which projection profile governed it, and which source references informed it without copying raw source payloads into secondary surfaces.

Integrity metadata is not a substitute for access control. It must remain downstream of server-side authority checks, projection allowlists, sensitivity classification, and scoped source derivation.

## Metadata concepts

| Concept | Meaning |
| --- | --- |
| `exportIntegrityVersion` | Version of the integrity metadata contract. |
| `exportProfile` | Export profile or package profile that produced the artifact. |
| `exportVersion` | Export package/profile version. |
| `exportGeneratedAt` | Deterministic timestamp field supplied by the caller or normalized to a safe default. |
| `exportGeneratedBy` | Internal actor reference when already safely available. |
| `integrityScope` | Artifact family, such as evidence pack, institutional export, tenant trust export, review artifact, or document export. |
| `sourceCollections` | Sorted collection names represented by source references. |
| `sourceRefs` | Internal source references containing collection/id only. |
| `lineageSummary` | Metadata summary of source reference count and lineage policy. |
| `projectionProfile` | Projection profile that shaped the export when known. |
| `exportHashPlaceholder` | Explicit non-computed hash placeholder. |
| `signatureStatus` | Metadata status such as `not_signed` or `signature_ready`; not a production signing guarantee. |
| `verificationStatus` | Metadata readiness status; this phase does not claim cryptographic verification. |
| `sensitivityClass` | Export sensitivity classification inherited from the governed projection surface. |
| `reproducibilityExpectation` | Statement that deterministic projection inputs are required for repeatable exports. |

## Source lineage and reproducibility

Source lineage should remain reference-based. A source reference may include:

- `sourceCollection`
- `sourceId`
- `internalReference: true`

Source references must not include raw provider payloads, raw CSV rows, private message bodies, payment credentials, full document contents, debug payloads, stack traces, secrets, or route diagnostics.

Reproducibility requires:

- stable projection profiles,
- stable source reference sets,
- stable timestamp semantics,
- server-side authority context,
- deterministic sorting of source references,
- whitelist projection over blacklist stripping.

## Signature-readiness terminology

`signature_ready` means an export has enough metadata structure to be evaluated by a future signing workflow. It does not mean:

- an artifact was cryptographically signed,
- a cryptographic digest was computed,
- an external institution can verify the artifact,
- a public verification endpoint exists,
- a blockchain anchor exists.

`exportHashPlaceholder` is intentionally `not_computed` in this phase. The placeholder exists to make future checksum semantics explicit without implying a production hash.

## Verification metadata

This phase recognizes metadata readiness only:

- `metadata_only`: no sufficient source lineage/profile is present.
- `ready_for_review`: source lineage and projection profile are present for future manual or implementation review.
- `unavailable`: input status is unsupported or cannot be interpreted safely.

This phase does not claim `verified` status for exports because no production cryptographic verification system exists yet.

## Relationship to governed export surfaces

Evidence packs:

- should continue using evidence projection profiles and restricted-field exclusion.
- may use integrity metadata later to describe evidence lineage without duplicating evidence payloads.

Institutional exports:

- should continue using institutional allowlist profiles.
- should treat source refs as internal lineage metadata, not display labels.

Tenant trust exports:

- must only expose tenant-safe, authority-scoped projections.
- should not expose internal verification metadata unless a tenant-safe projection explicitly allows it in a future mission.

Review artifacts:

- should reference evidence and related resources through scoped metadata refs.
- must not duplicate raw provider, payment, message, or document payloads.

## Governance risks

Do not ignore:

- Export signatures without projection allowlists can certify unsafe data exposure.
- Hashes over unstable payloads are not reproducible.
- Public verification endpoints can accidentally widen export visibility.
- Internal source refs can become user-facing raw IDs if UI labels are not normalized.
- Provider raw payloads must never be treated as routine export material.
- Signature readiness is not the same as legal or institutional acceptance.

## Known limitations

- No production signing exists.
- No cryptographic verification exists.
- No public verification endpoint exists.
- No blockchain or on-chain anchoring exists.
- No distributed signing key management exists.
- No export replay framework exists.
- Integrity metadata is helper-level only and is not globally attached to all export routes yet.

## Future roadmap

Recommended future missions:

1. Define export checksum canonicalization rules for selected export artifacts.
2. Add signed-export dry-run tests against deterministic fixture payloads.
3. Define signing key custody and rotation governance before any production signing.
4. Add authority-scoped export replay metadata for review workspaces.
5. Add tenant-safe verification summaries only after projection review.
6. Add institutional verification workflows only after export allowlists and consent governance are complete.

## Runtime behavior confirmation

This mission does not change runtime export access, route visibility, auth behavior, Firestore rules, Firestore schema, export payload access scope, or tenant-visible export behavior. The helper and tests are metadata-only governance foundations.
