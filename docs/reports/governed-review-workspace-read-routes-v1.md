# Governed Review Workspace Read Routes v1

## Summary

This mission adds tightly scoped admin-only GET routes for governed review workspace records.

It does not add public routes, tenant/landlord visibility, create/update/delete routes, approve/resolve/dismiss actions, mutation controls, automation, impersonation enablement, or raw payload access.

## Audit Findings

Reviewed foundations:

- `governedReviewWorkspaces` provides metadata-only workspace summaries.
- `governedReviewWorkspacePersistence` provides persistence-readiness validation and sanitization.
- `governedReviewWorkspaceAppendAdapter` provides an append-only adapter envelope over an injected append sink.
- `adminSecurityIncidentRoutes` and `adminSupportEscalationRoutes` provide the existing admin-only route pattern and `system.admin` authorization convention.
- `app.build.ts` mounts privileged admin review routes before broad admin/screening fallback routes.

No frontend mutation controls or public read surfaces exist for governed review workspaces.

## Routes Added

Added:

- `GET /api/admin/review-workspaces`
- `GET /api/admin/review-workspaces/:workspaceId`

Expected route source:

- `x-route-source: governedReviewWorkspaceRoutes.ts`

Both routes require:

- authenticated request
- `system.admin` permission

No POST, PATCH, PUT, or DELETE routes were added.

## Projection Behavior

The read service loads from the narrow append-log collection name:

- `governedReviewWorkspaceAppendLog`

Every loaded candidate is re-sanitized through the PR #990 persistence validator before response projection.

List responses include only metadata summaries:

- workspace id and type
- safe title and summary
- workflow family
- severity, review state, and approval expectation summaries
- related counts
- append event count
- retention metadata
- metadata-only/internal visibility flags

Detail responses add only safe metadata:

- safe evidence refs
- related workspace links
- append event summaries
- payload safety summary
- redaction summary
- persistence decision

## Empty-State Behavior

If no append records exist, the list route returns:

- `ok: true`
- empty `workspaces`
- metadata-only schema
- safe empty-state message

No fake workspace data is generated.

## Redaction and Safety

The routes never expose:

- raw notes
- raw documents
- provider payloads
- screening reports
- storage paths
- tokens
- secrets
- credentials
- request bodies
- response bodies
- stack traces
- debug payloads
- raw actor IDs as labels
- raw tenant/landlord IDs as labels
- unrestricted policy internals
- impersonation session IDs as labels

All responses preserve:

- `metadataOnly: true`
- `visibilityClass: admin_support_internal`
- `tenantVisible: false`
- `landlordVisible: false`
- `appendOnly: true`
- `mutationControlsEnabled: false`
- `rawPayloadAccessEnabled: false`

## Persistence / Read Decision

This mission adds read-only access to metadata records if the approved append log is populated.

It does not add:

- Firestore write adapters
- route-based creation
- status mutation
- update/delete behavior
- frontend mutation controls
- tenant/landlord projections

## Tests Added

Added route tests covering:

- admin access succeeds
- non-admin access is denied
- route-source attribution is correct
- empty state is safe
- unsafe stored inputs are re-sanitized before response
- POST route remains unavailable

Updated route ownership regression coverage to pin the governed review workspace routes before broad admin/screening fallback routes.

## Known Limitations

- No persisted workspace records exist unless the append log is populated by an approved future writer.
- No frontend page was added in this mission.
- No create/update/delete/approve/resolve/dismiss route exists.
- Retention policy and collection ownership remain governance concerns for a future storage mission.

## Future Roadmap

Recommended follow-ups:

1. Add a read-only admin frontend page for governed review workspaces.
2. Add Firestore-backed append store after collection ownership and retention policy are approved.
3. Add immutable audit event emission for append operations.
4. Add export/audit readiness summaries for admin/support audiences only.

## Guardrail Confirmation

This mission does not widen permissions, change auth, change Firestore rules, add public routes, add tenant/landlord visibility, expose raw payloads, add mutation controls, enable impersonation, or introduce autonomous remediation/escalation.
