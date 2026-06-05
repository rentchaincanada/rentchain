# Export Audit Trail v1

## Purpose

Export Audit Trail v1 adds append-only audit accountability for institutional export operations.

The audit trail records metadata-only lifecycle events for export profiles, export requests, and export packages. Events are written to the existing `canonicalEvents` collection using create semantics, safe references, immutable flags, and landlord-scoped query helpers.

This mission does not add routes, dashboards, signing, delivery, recipient notification, external integrations, Firestore rules, background jobs, or production data migrations.

## Canonical Event Storage

Export audit events use the existing `canonicalEvents` collection. Each event is an immutable metadata-only envelope with:

- `eventId`
- `eventType`
- `timestamp`
- `actor`
- `authority`
- `sourceReferenceId`
- `targetType`
- `targetReferenceId`
- `landlordReferenceId`
- `metadata`
- `sourceCollection: "canonicalEvents"`
- `metadataOnly: true`
- `appendOnly: true`
- `immutable: true`
- `rawIdsIncluded: false`
- `payloadIncluded: false`

The write path uses Firestore `create()` when available. If a Firestore-like test adapter does not expose `create()`, the service checks for an existing document and writes with `merge: false`. Existing audit events are not overwritten.

## Event Types

The service supports the export lifecycle event types defined by `export-audit-types.ts`:

- `ExportProfileCreated`
- `ExportProfileModified`
- `ExportProfileArchived`
- `ExportRequestInitiated`
- `ExportRequestAuthorized`
- `ExportRequestDenied`
- `ExportRequestCancelled`
- `ExportPackageAssembled`
- `ExportPackageSigned`
- `ExportPackageDelivered`
- `ExportPackageArchived`
- `ExportPackageRevoked`

Signing, delivery, archiving, and revocation events are supported as service contracts only. The operations themselves remain deferred.

## Safe References

Actors, landlords, profiles, requests, packages, and event sources are represented by deterministic hash-based safe references.

Audit events do not include:

- raw Firestore IDs
- raw landlord IDs
- raw tenant IDs
- unit IDs
- lease IDs
- storage paths
- tokens
- secrets
- credentials
- provider payloads
- raw evidence payloads
- unrestricted request or response bodies

Details metadata is allowlisted to simple strings, numbers, booleans, and null values. Unsafe detail content is rejected before writing.

## Query Contract

The internal query helpers are:

- `getAuditTrailForPackage(landlordId, exportPackageId)`
- `getAuditTrailForRequest(landlordId, exportRequestId)`
- `getAuditTrailForProfile(landlordId, exportProfileId)`
- `getExportAuditTrail(query)`

Every query requires landlord scope. The service converts the supplied landlord scope to a safe landlord reference and filters by that reference before returning projected audit trail responses. Returned data is an allowlist projection containing safe actor reference, target reference, event type, timestamp, reason, summary, and metadata flags.

## Integration Points

`buildEvidencePackage()` emits `ExportPackageAssembled` when an `auditTrailFirestore` adapter is supplied in the assembly context. The pure `assembleEvidencePackage()` helper remains side-effect free.

The audit service also provides lifecycle helpers:

- `appendExportProfileAuditEvent()`
- `appendExportRequestAuthorizationAuditEvent()`
- `appendExportPackageLifecycleAuditEvent()`

These helpers let future service-layer callers emit profile, request, signing, delivery, archive, and revocation audit events without widening API routes or adding background workers.

## Non-Blocking Append

`appendAuditEventSafely()` catches append failures and returns `null`. This preserves the existing canonical audit posture where audit storage failures can be logged without breaking the export workflow. Direct `appendAuditEvent()` remains available for tests and callers that require a hard failure.

## Projection Safety

`projectExportAuditEvent()` and `projectExportAuditTrailResponse()` return allowlisted views only. They do not return the full canonical event envelope, raw target IDs, raw actor IDs, raw landlord IDs, or raw metadata internals.

## Deferred Work

Future missions may add:

- route handlers for landlord/admin audit retrieval
- export audit dashboard views
- signing operations
- delivery operations
- recipient consent workflows
- recipient notification
- compliance report generation
- external integrations
- Firestore rules changes when route access is introduced

Those capabilities are not implemented in this mission.
