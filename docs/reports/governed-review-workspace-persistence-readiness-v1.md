# Governed Review Workspace Persistence Readiness v1

## Summary

This mission adds append-only persistence-readiness contracts for governed review workspaces.

It does not add Firestore writes, routes, frontend UI, mutation controls, automation, tenant/landlord visibility, public access, or raw payload access.

## Audit Findings

Reviewed foundations:

- `governedReviewWorkspaces` now provides metadata-only workspace summaries for admin security incident and support escalation detail views.
- `escalationReviewWorkspaceLinks` provides append-compatible metadata-only relationship links between incidents, escalations, runbooks, history, notes, evidence, and review workspaces.
- `supportEscalationRunbooks` provides deterministic category, severity, state, approval, and safe reference contracts.
- `supportEscalationHistory` provides append-only history and review note helper contracts.
- Admin security incident and support escalation review routes already expose safe read-only metadata surfaces.

No approved governed review workspace persistence store exists yet. Persistence remains deferred until collection ownership, retention, write authorization, and append-only audit semantics are explicitly approved.

## Helper / Contract Added

Added:

- `rentchain-api/src/lib/governedReviewWorkspacePersistence/governedReviewWorkspacePersistence.ts`

The helper defines:

- governed review workspace persistence versioning
- retention class normalization
- append event type normalization
- contract-only persistence records
- append-compatible event references
- candidate validation with warnings for unsafe inputs
- safe metadata-only visibility flags
- explicit disabled flags for Firestore writes, routes, status mutation, automation, and tenant/landlord projections

## Persistence Contract

Each persistence-readiness record includes:

- `persistenceContractId`
- `workspaceId`
- `workspaceType`
- `title`
- `summary`
- `workflowFamily`
- `retentionClass`
- `retentionReason`
- `retentionReviewAt`
- `createdAt`
- `lastAppendedAt`
- `workspaceSummary`
- `appendEventRefs`
- `safeEvidenceRefs`
- `relatedWorkspaceLinks`
- `payloadSafety`
- `redactionSummary`
- `persistenceDecision`

All records are:

- metadata-only
- admin/support-internal
- append-compatible
- append-only
- tenant-invisible
- landlord-invisible
- non-mutating
- non-automated

## Retention Classes

Supported retention classes:

- `standard_review`
- `security_review`
- `export_governance`
- `legal_hold_candidate`
- `short_lived_diagnostic`
- `other`

Unknown values normalize to `other`.

## Append Event Types

Supported append event reference types:

- `workspace_candidate_created`
- `workspace_link_added`
- `workspace_evidence_ref_added`
- `workspace_note_ref_added`
- `workspace_export_readiness_assessed`
- `workspace_retention_reviewed`

Unknown values normalize to `workspace_candidate_created`.

## Redaction and Projection Safety

Persistence-readiness records exclude or sanitize:

- raw notes
- raw documents
- provider payloads
- screening reports
- storage paths
- tokens
- secrets
- credentials
- authorization headers
- cookies
- request bodies
- response bodies
- stack traces
- debug payloads
- raw IDs as labels
- unrestricted policy internals

Unsafe labels are replaced with safe fallback text. Safe evidence references remain internal metadata references and strip tenant/landlord scoped identifiers at the workspace persistence layer.

## Visibility and Mutation Flags

Every record and append event reference includes:

- `metadataOnly: true`
- `visibilityClass: admin_support_internal`
- `tenantVisible: false`
- `landlordVisible: false`
- `appendCompatible: true`
- `appendOnly: true`
- `supportPowersGranted: false`
- `impersonationEnabled: false`
- `autonomousRemediationEnabled: false`
- `autonomousEscalationEnabled: false`
- `financialMutationEnabled: false`
- `routeVisibilityChanged: false`
- `mutationControlsEnabled: false`
- `rawPayloadAccessEnabled: false`
- `firestoreWriteEnabled: false`
- `createRouteEnabled: false`
- `updateRouteEnabled: false`
- `deleteRouteEnabled: false`
- `statusMutationEnabled: false`
- `tenantLandlordProjectionEnabled: false`

## Persistence Decision

Persistence is still deferred.

This mission only defines storage-readiness contracts, validators, and sanitizers. It does not create collections, write paths, read routes, admin UI mutation controls, or workflow execution.

## Known Limitations

- No live persisted workspace records exist yet.
- No collection ownership or retention schedule has been approved.
- No admin route exists to create, update, resolve, dismiss, approve, or delete workspaces.
- Validation is contract-oriented and sanitizing; future Firestore writes will need server-side authorization, append-only enforcement, and collection-specific tests.

## Future Roadmap

Recommended follow-ups:

1. Define Firestore collection ownership and retention policy for governed review workspace records.
2. Add append-only write adapter behind admin/support-only authorization.
3. Add immutable audit event emission for workspace append events.
4. Add admin-only read routes for persisted workspace records.
5. Add export/audit readiness summaries without raw payload access.
6. Add manual review note append flows only after note sanitization and projection rules are reviewed.

## Guardrail Confirmation

This mission does not widen permissions, change auth, change Firestore rules, add public routes, add tenant/landlord visibility, expose raw payloads, add mutation controls, enable impersonation, create workflow execution, or introduce autonomous remediation/escalation.
