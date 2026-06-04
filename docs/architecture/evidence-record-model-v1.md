# Evidence Record Model v1

## Purpose

Evidence Record Model v1 establishes `evidenceRecords` as the canonical metadata collection for platform evidence provenance, lifecycle, sensitivity, and projection governance.

The model is additive. It does not migrate existing events, replace canonical audit trails, create export packages, sign evidence, expose new routes, or change runtime authorization. Existing source collections remain the operational source of truth. Evidence records provide immutable references that future export and trust layers can use without exposing raw Firestore identifiers or sensitive payloads.

## Collection

Collection name:

```text
evidenceRecords
```

Record identity:

- Firestore document ID: canonical internal ID for server-side joins only.
- `evidenceId`: deterministic safe evidence identifier for audit and future export references.
- `safeReference.safeReferenceKey`: metadata-only source reference that does not expose raw source IDs.

`evidenceId` must not embed Firestore document IDs, tenant IDs, landlord IDs, unit IDs, lease IDs, storage paths, provider IDs, tokens, credentials, or raw payload values.

## Schema

The TypeScript contract lives in `rentchain-api/src/types/evidence-record-types.ts`.

Required root fields:

| Field | Purpose |
| --- | --- |
| `evidenceId` | Deterministic safe evidence identifier. |
| `evidenceClass` | High-level evidence class such as `ApplicationEvidence` or `PaymentEvidence`. |
| `evidenceType` | More specific type used by emitting services. |
| `schemaVersion` | Current schema marker, `evidence_record_v1`. |
| `landlordId` | Internal server-side scope field. Not a user-facing label. |
| `resourceType` | Source resource family. |
| `resourceId` | Internal server-side join field. Not exported as a primary reference. |
| `safeReference` | External-safe evidence reference. |
| `provenanceMetadata` | Actor, authority, source, timestamp, and provenance chain metadata. |
| `sensitivityMetadata` | Sensitivity, redaction, and projection rules. |
| `retentionMetadata` | Placeholder retention and lifecycle metadata for future missions. |
| `status` | `active`, `superseded`, `archived`, or `redacted`. |
| `createdAt` | UTC creation timestamp. |
| `immutable` | Always `true`. |
| `appendOnly` | Always `true`. |
| `metadataOnly` | Always `true` for this foundational model. |
| `rawIdsIncluded` | Always `false` for external-facing metadata. |
| `redactionSummary` | Human-readable minimization statement. |

## Immutability Contract

Evidence records are creation-only records.

Allowed:

- Create a new evidence record with `create()` semantics.
- Link a new record to a prior record through `supersedesEvidenceId`.
- Mark lifecycle intent through a future append-only follow-up record.

Not allowed:

- Updating an existing evidence record in place.
- Replacing source references after creation.
- Deleting and recreating records to alter provenance.
- Copying raw source payloads into evidence records.
- Treating evidence records as a substitute for canonical audit events.

Corrections, redactions, and supersession are represented by new records or future governed lifecycle records. Existing records remain intact for audit continuity.

## Provenance Chain

`provenanceMetadata` captures:

- `createdAt`: UTC creation timestamp.
- `createdBy`: actor role and safe actor reference.
- `authority`: authority role, safe landlord/tenant references, and support allowance.
- `source`: source collection, safe source reference key, source observation timestamp, and source version.
- `reason`: why this evidence was captured.
- `provenanceChain`: related evidence references that informed the record.

Provenance metadata is metadata-only. It excludes request bodies, response bodies, provider payloads, report contents, storage paths, credentials, and raw document IDs.

## Evidence Classes

Supported foundational classes:

| Class | Typical source collections | Purpose |
| --- | --- | --- |
| `ApplicationEvidence` | `rentalApplications`, `applications` | Applicant workflow metadata and submission readiness. |
| `ScreeningEvidence` | `screeningOrders`, `screeningResults`, `screeningEvents` | Screening workflow status and consent metadata. |
| `DecisionEvidence` | `landlordDecisionStates`, `decisionActions`, `operatorReviewSessions` | Manual decision and review workflow lineage. |
| `PaymentEvidence` | `payments`, `ledgerEntries`, `rentPayments`, `paymentReconciliationRecords` | Payment, ledger, and reconciliation evidence metadata. |
| `MaintenanceEvidence` | `workOrders`, `maintenanceRequests`, `workOrderUpdates` | Maintenance lifecycle and completion evidence metadata. |
| `AuditEvidence` | `canonicalEvents`, `events`, `tenantEvents`, `leaseWorkflowEvents` | Append-safe audit and timeline evidence metadata. |

These classes do not grant access. They classify evidence so future projection and export services can make governed allowlist decisions.

## Sensitivity and Redaction

Evidence records align with the Firestore Sensitivity and Projection Registry v1.

Default rules:

- Evidence records are Sensitive by default.
- Screening/reporting/document/provider-related evidence is Restricted by default.
- Critical data is prohibited from evidence records unless a future reviewed system explicitly governs it.
- Raw provider payloads, raw reports, raw CSV values, payment account details, identity documents, message bodies, debug payloads, tokens, credentials, and storage paths are excluded by default.

Projection requires explicit allowlists by audience:

- Landlord operational: status, safe labels, timestamps, and redaction summary.
- Tenant-safe: tenant's own context only, with stricter allowlist.
- Admin/support: role-gated diagnostics with redacted payloads.
- Audit-only: actor, authority, timestamp, source, outcome, and redaction metadata.
- Institutional export: future profile only, with purpose, consent, retention, and audit trail.

## Safe Evidence Identifiers

The helper in `rentchain-api/src/utils/evidence-identifier.ts` creates identifiers with this format:

```text
evr_v1_<normalized-evidence-type>_<source-hash>_<governance-hash>
```

Generation inputs:

- evidence type
- internal source ID
- governance metadata such as evidence class, schema version, source collection, and projection profile

Only hashes appear in the identifier. Parsing returns the normalized evidence type and hashes, not raw source identifiers.

## Scoping Rules

Evidence records are landlord-scoped for future landlord evidence packs and institutional exports. Server-side code may use internal `landlordId` and `resourceId` fields for joins, but those fields are not user-facing labels.

Projection rules:

- Landlord access must filter by landlord authority.
- Tenant access must filter to the tenant's own resource context and use tenant-safe projections.
- Admin/support access must be role-gated and purpose-limited.
- Cross-landlord and cross-tenant reads are prohibited.
- Evidence pack and export derivation must use explicit projection profiles.

## Lifecycle and Retention

The foundational status field supports:

- `active`: current evidence record.
- `superseded`: a newer evidence record represents a correction or newer variant.
- `archived`: retained but no longer used for active package derivation.
- `redacted`: future governed redaction state; original record remains part of audit continuity unless a later legal process requires separate handling.

Retention enforcement, archival workers, deletion workflows, and legal hold tooling are deferred to later Phase 4 missions.

## Query and Index Requirements

Future evidence pack derivation and export workflows should use landlord-scoped queries only.

Documented index needs:

- `landlordId + resourceType + createdAt desc`
- `landlordId + status + createdAt desc`
- `landlordId + resourceId + createdAt desc`
- `landlordId + evidenceClass + createdAt desc`

These indexes are governance requirements only in this mission. No Firestore index deployment is performed here.

## Deferred Work

- Evidence emission services.
- Evidence retrieval routes.
- Evidence pack persistence.
- Institutional export packages.
- External sharing rooms.
- Evidence verification, signing, notarization, or attestation.
- Retention enforcement, archival, deletion, and legal hold workflows.
- Firestore rule or deployment configuration changes.
