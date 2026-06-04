# Export Framework v1

## Purpose

Export Framework v1 establishes the schema, validation, authorization, and projection foundation for future institutional evidence exports.

Exports are explicit, scoped, authorized, metadata-first, and auditable. This framework does not assemble evidence, persist export records, add routes, deliver packages, sign packages, notify recipients, or integrate with external systems.

## Entity Relationships

The framework models four governed layers:

1. `ExportProfile`: approved recipient, purpose, evidence class scope, minimization level, and audit reference.
2. `ExportRequest`: explicit export intent, scope parameters, redaction override, status, and authorization status.
3. `ExportPackage`: package skeleton and manifest shape for future assembly.
4. `ExportAuditEvent`: event schema for future append-only audit trails.

The relationship is:

```text
ExportProfile -> ExportRequest -> ExportPackage -> ExportAuditEvent
```

Each entity has deterministic `_v1_` identifiers based on hashes. The identifiers do not expose raw Firestore IDs, landlord IDs, tenant IDs, unit IDs, lease IDs, storage paths, tokens, credentials, provider payloads, or evidence payloads.

## Authorization Model

A valid export requires:

- server-resolved actor context
- landlord scope matching the export profile
- enumerated recipient type
- enumerated export purpose
- recipient-purpose mapping approval
- non-empty approved evidence class scope
- valid date range when scope dates are supplied
- redaction override that tightens, not loosens, the profile minimization level

Authorization functions are pure. They return decisions and do not mutate Firestore, evidence records, source records, or audit trails.

## Recipient and Purpose Mapping

Supported recipient types:

- `ThirdPartyPropertyManager`
- `InsuranceAdjuster`
- `LegalRepresentative`
- `Regulator`
- `Arbitrator`
- `SelfArchive`
- reserved future institution type

Supported purposes:

- `LitigationDiscovery`
- `InsuranceClaim`
- `RegulatoryCompliance`
- `AuditReview`
- `ArbitrationEvidence`
- `SelfReview`
- reserved future purpose

Purpose-to-recipient mappings are explicit. Freeform recipient purpose strings are not permitted.

## Projection Rules

Projection helpers are allowlist-based.

Landlord projections include operational export state and scope metadata, but omit internal actor details, system decision details, checksum values, and audit internals.

Admin projections include full metadata-safe entities for governed review. Raw IDs and payloads remain excluded by schema and validation.

## Relationship To Evidence Foundations

The framework references evidence classes and retention policy versioning from the evidence record foundation. It does not implement evidence record retrieval, evidence package assembly, or retention enforcement.

Future package assembly must use landlord-scoped evidence queries and evidence projection allowlists. Export profiles and requests do not grant broader evidence visibility than the landlord already has.

## Deferred Work

- route handlers
- Firestore persistence
- evidence package assembly
- export delivery
- audit trail persistence
- signing and attestation
- recipient consent workflows
- external webhooks or direct integrations
- tenant-facing export UI
- scheduled exports, queues, workers, or Pub/Sub
