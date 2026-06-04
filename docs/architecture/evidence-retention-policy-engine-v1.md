# Evidence Retention Policy Engine v1

## Purpose

Evidence Retention Policy Engine v1 defines server-side retention policy evaluation for `evidenceRecords`.

The engine is deterministic and code-versioned. It does not add routes, workers, Firestore rules, indexes, retention UI, legal hold management, archival execution, deletion execution, export generation, signing, attestation, or external sharing.

## Policy Model

Retention policies are defined in code as immutable rules tagged with `evidence_retention_policy_v1`.

Each rule includes:

- evidence class
- retention period and unit
- archive eligibility period and unit
- deletion eligibility period and unit
- legal hold override support
- audit event capture requirement
- immutability flag
- non-retroactivity flag

Policies do not embed raw Firestore IDs, tenant IDs, landlord IDs, unit IDs, lease IDs, storage paths, or source payload references.

## Default Schedules

| Evidence class | Archive eligibility | Deletion eligibility | Governance note |
| --- | --- | --- | --- |
| `ApplicationEvidence` | 3 years | Indefinite until future deletion policy | Common lease-cycle review window. |
| `ScreeningEvidence` | 2 years | Indefinite until future deletion policy | Restricted-data minimization posture. |
| `DecisionEvidence` | 2 years | Indefinite until future deletion policy | Manual-review and outcome history. |
| `PaymentEvidence` | 7 years | Indefinite until future deletion policy | Accounting and tax review horizon. |
| `MaintenanceEvidence` | 2 years | Indefinite until future deletion policy | Work order and tenant request history. |
| `AuditEvidence` | Indefinite | Indefinite | Append-safe audit evidence is retained unless future legal process governs otherwise. |

Landlord override input may adjust schedule periods inside service evaluation, but the applied rule remains derived from the immutable code registry and must be audit-traced with a reason. Runtime database configuration does not apply retention schedules retroactively.

## Evaluation Algorithm

`EvidenceRecordService.evaluateRetentionPolicy(record, context)`:

1. Validates policy version.
2. Fails closed when legal hold status is ambiguous.
3. Validates evaluator role, purpose, and raw-ID exclusion.
4. Resolves the immutable policy rule by evidence class.
5. Applies validated landlord override periods when supplied.
6. Calculates archive and deletion eligibility from the evidence record creation timestamp.
7. Blocks archive and deletion eligibility while legal hold status is active.
8. Returns metadata-only evaluation output with `rawIdsIncluded: false`.

The method is pure. It does not mutate Firestore or source collections.

## Lifecycle State Machine

Evidence lifecycle state is represented by `EvidenceRecord.status` and append-only lifecycle events inside retention metadata.

Valid transitions:

| Prior status | Allowed next statuses |
| --- | --- |
| `active` | `superseded`, `archived`, `redacted` |
| `superseded` | `archived`, `redacted` |
| `archived` | `redacted` |
| `redacted` | none |

Invalid transitions fail closed. For example, `archived` cannot transition back to `active`.

`createLifecycleTransitionEvent()` produces a metadata-only transition event. `appendLifecycleTransitionEvent()` returns a new record copy with the event appended and the new status applied. The original record object remains unchanged; future persistence must use an append-safe lifecycle store or reviewed update path, not broad evidence record mutation.

## Legal Hold Semantics

Legal hold management is deferred. This mission only prepares evaluation behavior:

- `legalHoldStatus: active` blocks archival and deletion eligibility.
- Ambiguous or missing legal hold status fails closed.
- Tenant projections do not expose legal hold details.
- Landlord projections omit legal hold details unless a future governed hold workflow authorizes that disclosure.
- Admin and audit projections may include legal hold status for governed review.

## Projection Rules

Retention metadata projections are allowlisted by audience.

| Audience | Retention visibility |
| --- | --- |
| Tenant | Status only: active or archived/redacted. No policy details. |
| Landlord | Retention policy summary, archive eligibility timestamp, lifecycle event timestamps and reasons. No legal hold details. |
| Admin | Full retention metadata, including legal hold status and lifecycle events. |
| Audit | Applied policy rule, evaluation timestamp, legal hold status, lifecycle transitions, and audit references. |

No projection includes raw source IDs, raw landlord IDs, raw tenant IDs, unit IDs, lease IDs, storage paths, tokens, credentials, provider payloads, or raw evidence payloads.

## Audit Requirements

Every lifecycle transition event includes:

- evidence ID
- prior status
- new status
- transition reason
- evaluated policy rule summary
- evaluated actor context
- timestamp
- audit trail reference
- legal hold status
- `rawIdsIncluded: false`
- `payloadIncluded: false`

Future archival and deletion workers must emit canonical audit events and use these transition events as reviewable lifecycle evidence.

## Deferred Work

- archival worker implementation
- deletion worker implementation
- legal hold creation, release, and enforcement workflow
- retention status query routes
- retention policy UI or operator dashboard
- evidence pack derivation using retention state
- Firestore rules or index deployment
