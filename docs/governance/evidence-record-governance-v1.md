# Evidence Record Governance v1

## Governance Philosophy

Evidence records are immutable metadata records that describe what evidence exists, where it came from, under what authority it was captured, and how it may be projected safely.

They are not raw evidence payloads. They are not external certifications. They do not create new access rights. They provide a governed reference layer for future evidence pack, export, and trust workflows.

## Classification Taxonomy

| Evidence class | Mapping rule | Governance note |
| --- | --- | --- |
| `ApplicationEvidence` | Application and applicant workflow metadata. | Must not include raw identity documents or unrelated applicant context. |
| `ScreeningEvidence` | Screening order/status/consent metadata. | Restricted by default; raw reports and provider payloads remain excluded. |
| `DecisionEvidence` | Decision workflow, operator review, and manual outcome metadata. | Must preserve manual-review posture and avoid hidden remediation. |
| `PaymentEvidence` | Payment, ledger, obligation, and reconciliation metadata. | Must exclude banking details, raw processor payloads, and raw CSV values. |
| `MaintenanceEvidence` | Work order and maintenance lifecycle metadata. | Must exclude private message bodies and unrelated tenant contact data. |
| `AuditEvidence` | Canonical event, tenant event, lease workflow event, and append-safe audit metadata. | Must stay metadata-only and append-safe. |

Evidence class assignment is conservative. If a source crosses classes, use the most sensitive applicable class and document the mapping in the emitting service.

## Provenance Capture Rules

Every evidence record requires:

- creation timestamp in UTC
- actor role and safe actor reference
- authority role and safe scope references
- source collection
- safe source reference key
- source observation timestamp where known
- creation reason
- redaction summary

Source IDs may be used internally to generate hashes and perform server-side joins. They must not appear in external evidence identifiers, user-facing labels, or export references.

## Authority Rules

Evidence record creation must be performed by deterministic service logic under explicit request or governed operational event. It must not be autonomous or hidden.

Authority requirements:

- Landlord-scoped evidence requires server-side landlord authority.
- Tenant-safe evidence requires tenant ownership or current tenancy/application context.
- Support/admin evidence requires role-gated purpose and auditability.
- Ambiguous authority fails closed.

This mission creates the model only. It does not implement creation authority enforcement.

## Sensitivity and Redaction Rules

Evidence records are Sensitive by default. Screening, reporting, document, provider, export, and raw-origin evidence is Restricted by default. Critical data is excluded unless a future reviewed policy explicitly permits it.

Excluded by default:

- raw Firestore IDs as visible labels
- raw tenant, landlord, lease, unit, and storage identifiers
- raw provider payloads
- raw screening or credit reports
- payment account details
- bank/card/routing values
- raw CSV values
- identity documents
- message bodies
- tokens, credentials, secrets, and webhook signatures
- debug dumps, stack traces, request bodies, and response bodies

Projection must use allowlists. Blacklist stripping is not sufficient.

## Safe Identifier Policy

Evidence identifiers use deterministic hashes over source and governance metadata:

```text
evr_v1_<normalized-evidence-type>_<source-hash>_<governance-hash>
```

The identifier must:

- be deterministic for the same source and governance inputs
- be non-sequential
- avoid embedding internal IDs or provider IDs
- expose only evidence type and opaque hashes
- be safe for audit references and future export package references

Parsing an evidence ID may reveal the evidence type and hashes only. It must not reveal raw source identifiers or sensitive metadata.

## Scope and Access Control

Evidence records do not bypass existing access control.

Required boundaries:

- landlord-scoped evidence must remain within that landlord's authority
- tenant-safe projections must include only the tenant's own context
- admin/support projections must be role-gated and purpose-limited
- institutional export projections require a future export profile, recipient purpose, redaction policy, and audit trail
- cross-landlord, cross-tenant, and broad collection reads are prohibited

## Append-Safe Semantics

Evidence records are immutable after creation.

Allowed lifecycle patterns:

- new record for a new evidence variant
- new record to supersede a prior record
- future append-only lifecycle event to document archival or redaction state

Prohibited lifecycle patterns:

- mutating source references in place
- rewriting provenance after creation
- deleting records to hide prior evidence
- storing raw source payloads for convenience
- using evidence records to mutate source workflow state

## Relationship to Audit Events

Evidence records and canonical audit events are separate concerns.

Canonical audit events document operational actions, outcomes, and timeline history. Evidence records document evidence metadata, provenance, sensitivity, and lifecycle references. Future emitting services may create both, but evidence records must not replace append-safe audit trails.

## Deferred Decisions

Phase 4 follow-up missions must decide:

- evidence emission service implementation
- exact creation authority gates
- evidence record persistence and indexing deployment
- evidence pack derivation from persisted evidence records
- institutional export package schemas
- consent and recipient policy integration
- evidence verification, signing, and attestation
- archival, retention, deletion, and legal hold workflows
