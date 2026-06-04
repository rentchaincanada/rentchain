# Evidence Provenance Emission Patterns v1

## Purpose

Evidence Provenance Emission Patterns v1 documents how platform services should create immutable `evidenceRecords` through `EvidenceRecordService.createEvidenceRecord()`.

This mission implements the creation contract and validation helpers only. It does not add route handlers, background emission loops, evidence pack derivation, institutional export packages, external sharing, signing, verification, retention enforcement, Firestore rule changes, or Firestore index deployment.

## Pre-Implementation Audit Findings

The current codebase already has compatible append-safe patterns:

- Canonical audit events use deterministic safe references and `create()` semantics through `appendCanonicalAuditEvent()`.
- Recovery and transition provenance storage use append-only document writes and metadata-only safe references.
- Request authority is carried through authenticated `req.user` fields including role, landlord scope, tenant scope, and actor role.
- Existing evidence pack previews are derived read models and do not persist evidence as source of truth.
- Evidence record model v1 already defines immutable metadata-only records, safe identifiers, redaction metadata, and future projection categories.

The missing implementation layer was a creation service that validates provenance metadata and writes evidence records through creation-only storage.

## Creation Contract

`EvidenceRecordService.createEvidenceRecord(input)` must:

- validate the evidence class and type
- validate UTC timestamps
- validate actor role and authority role
- validate landlord, tenant, admin, and support authority boundaries
- require purpose for admin and support evidence creation
- validate source collection and deterministic safe source reference key
- validate redaction and sensitivity metadata
- generate deterministic `evidenceId` values through `generateEvidenceId()`
- populate immutable, append-only, metadata-only flags
- write to `evidenceRecords` with `create()` semantics only
- fail closed on ambiguous authority, unsafe payload markers, duplicate evidence IDs, or missing scope

The service may use internal `landlordId` and `resourceId` fields for server-side joins. External-facing fields use safe references and must not expose raw IDs.

## Safe Source References

Source references are generated as:

```text
<sourceCollection>:<resourceType>:<hash>
```

The hash is deterministic from source collection, resource type, and raw source ID. Raw Firestore document IDs, tenant IDs, landlord IDs, unit IDs, lease IDs, provider IDs, storage paths, tokens, credentials, and payload values are not embedded in the reference key.

## Actor and Authority Resolution

Evidence creation uses `EvidenceCreationAuthorityContext`:

| Field | Purpose |
| --- | --- |
| `actorRole` | `tenant`, `landlord`, `admin`, `support`, or `system`. |
| `actorId` | Internal actor ID used only to derive `actorRef`. |
| `landlordId` | Internal landlord scope used only to derive `landlordRef` and validate scope. |
| `tenantId` | Internal tenant scope used only to derive `tenantRef` and validate tenant context. |
| `supportAllowed` | Required for support evidence creation. |
| `purpose` | Required for admin and support evidence creation. |

The helper produces safe actor, landlord, and tenant references. It does not expose raw IDs in provenance metadata.

## Emission Patterns by Evidence Class

### ApplicationEvidence

Typical sources:

- `rentalApplications`
- legacy `applications`

Emission moments:

- application submitted
- application status becomes review-ready
- applicant-to-tenant continuity is established

Required metadata:

- actor role: tenant, landlord, or system depending on initiating service
- authority: landlord scope and tenant scope when tenant-initiated
- source collection: `rentalApplications`
- reason examples: `application_submitted`, `application_review_ready`
- sensitivity: Sensitive
- excluded fields: applicant contact values, identity documents, raw screening payloads

### ScreeningEvidence

Typical sources:

- `screeningOrders`
- `screeningResults`
- `screeningEvents`

Emission moments:

- screening order created
- consent captured
- screening workflow completed or failed

Required metadata:

- actor role: tenant, landlord, support, or system depending on service path
- authority: landlord scope and tenant scope where applicant consent is involved
- source collection: `screeningOrders` or `screeningEvents`
- reason examples: `screening_order_created`, `screening_consent_captured`, `screening_completed`
- sensitivity: Restricted
- excluded fields: raw report, provider payload, identity values, provider credentials

### DecisionEvidence

Typical sources:

- `landlordDecisionStates`
- `decisionActions`
- `operatorReviewSessions`

Emission moments:

- landlord decision appears
- decision outcome is manually reviewed
- operator review session records an outcome

Required metadata:

- actor role: landlord, admin, support, or system
- authority: landlord scope; admin/support purpose when applicable
- source collection: `decisionActions`
- reason examples: `decision_workflow_created`, `manual_decision_reviewed`, `operator_review_outcome_recorded`
- sensitivity: Sensitive
- excluded fields: operator internal notes, raw workflow serialization, unrelated financial records

### PaymentEvidence

Typical sources:

- `payments`
- `ledgerEntries`
- `rentPayments`
- `paymentReconciliationRecords`

Emission moments:

- payment record created
- ledger entry appended
- reconciliation record created

Required metadata:

- actor role: landlord, tenant, system, admin, or support depending on source service
- authority: landlord scope; tenant scope for tenant-initiated payment evidence
- source collection: `ledgerEntries` or `paymentReconciliationRecords`
- reason examples: `payment_record_created`, `ledger_entry_appended`, `payment_reconciled`
- sensitivity: Sensitive or Restricted depending on source
- excluded fields: bank account values, card details, raw processor payloads, raw CSV values

### MaintenanceEvidence

Typical sources:

- `workOrders`
- `maintenanceRequests`
- `workOrderUpdates`

Emission moments:

- maintenance request created
- work order assigned or scheduled
- completion evidence recorded

Required metadata:

- actor role: tenant, landlord, support, contractor-adjacent service as system, or admin
- authority: landlord scope and tenant scope for tenant-created requests
- source collection: `workOrders` or `maintenanceRequests`
- reason examples: `maintenance_request_created`, `work_order_completed`, `maintenance_update_recorded`
- sensitivity: Sensitive
- excluded fields: private message bodies, tenant contact values, attachment payloads

### AuditEvidence

Typical sources:

- `canonicalEvents`
- `events`
- `tenantEvents`
- `leaseWorkflowEvents`

Emission moments:

- canonical audit event appended
- lease workflow event appended
- recovery or review timeline event captured

Required metadata:

- actor role: system, admin, support, landlord, or tenant depending on event source
- authority: same safe scope as the source audit event
- source collection: `canonicalEvents`
- reason examples: `canonical_audit_event_captured`, `lease_workflow_event_captured`
- sensitivity: Sensitive
- excluded fields: raw payload, raw actor ID, debug context, request bodies, response bodies

## Supersession Pattern

Evidence corrections use new records.

Allowed:

- create a new evidence record with `supersedesEvidenceId`
- include the prior record's safe reference in `provenanceChain`
- leave the original record intact

Not allowed:

- updating the prior record to rewrite source metadata
- deleting prior evidence
- mutating source collections to force evidence continuity

The `supersededByEvidenceId` field remains `null` at creation time unless a later append-only lifecycle model is explicitly introduced.

## Integration Guidance

Future source-service integration should call evidence creation only from explicit service actions:

- application service: after submission or review-ready status change
- screening service: after order, consent, or status event
- decision service: after manual decision action or review outcome
- payment service: after ledger append or reconciliation event
- maintenance service: after request, work order update, or completion
- canonical audit layer: after canonical audit event append

Services must resolve authority before calling evidence creation. If authority is ambiguous, evidence creation should be skipped or rejected with an internal error code; it should not infer cross-tenant or cross-landlord access.

## Deferred Work

- source-service integrations
- evidence retrieval and projection routes
- evidence pack derivation from persisted evidence records
- retention, archival, deletion, and legal hold lifecycle services
- external export package builders
- signing, verification, attestation, and trust workspaces
