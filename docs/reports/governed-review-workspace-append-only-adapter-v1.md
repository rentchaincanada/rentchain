# Governed Review Workspace Append-Only Adapter v1

## Summary

This mission adds a narrowly scoped append-only adapter foundation for governed review workspace records.

It does not add API routes, frontend UI, Firestore collection writes, mutation controls, approve/resolve/dismiss actions, automation, tenant/landlord visibility, or raw payload access.

## Audit Findings

Reviewed foundations:

- `governedReviewWorkspacePersistence` provides contract-only workspace persistence records, append event references, redaction warnings, and metadata-only visibility flags.
- `governedReviewWorkspaces` provides safe workspace summaries for admin incident and support escalation detail surfaces.
- `escalationReviewWorkspaceLinks` provides metadata-only cross-workflow links.
- `supportEscalationRunbooks` and `supportEscalationHistory` provide append-compatible runbook, history, and review note contracts.
- Existing admin review surfaces remain read-only and do not expose mutation controls.

No approved Firestore collection ownership or route contract exists yet for live governed review workspace writes.

## Adapter Added

Added:

- `rentchain-api/src/lib/governedReviewWorkspaceAppendAdapter/governedReviewWorkspaceAppendAdapter.ts`

The adapter provides:

- `buildGovernedReviewWorkspaceAppendEnvelope`
- `createGovernedReviewWorkspaceAppendAdapter`
- an injected `GovernedReviewWorkspaceAppendStore` interface with a single `append` method
- admin/support actor validation
- metadata-only append envelopes
- reuse of PR #990 validation and sanitization
- explicit append-only flags

## Storage / Write Decision

Live Firestore writes remain deferred.

The adapter is a port over an injected append sink, not a production Firestore writer. This preserves a testable append-only service boundary without introducing collections, routes, frontend controls, or runtime workflow mutation.

Future Firestore implementation should add:

- explicit collection ownership
- admin/support-only authorization at the route/service boundary
- append-only write enforcement
- immutable audit event emission
- retention policy tests
- no update/delete/status mutation paths

## Append Envelope

Each append envelope includes:

- `appendEnvelopeId`
- `appendOperation: append_workspace_record`
- `storageTarget: governed_review_workspace_append_log`
- `storageWriteDecision: adapter_port_only_firestore_deferred`
- safe actor summary
- sanitized persistence record
- validation warnings
- metadata-only/internal visibility flags
- disabled mutation, route, raw payload, and automation flags

## Redaction and Projection Safety

The adapter reuses the PR #990 persistence validator and enforces safe actor summaries.

Append envelopes exclude or sanitize:

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
- raw actor IDs
- raw tenant/landlord IDs as labels
- unrestricted policy internals

## Authority Boundary

The adapter denies append attempts when the actor context is not admin/support-authorized.

Denied attempts return a metadata-only failure result and do not call the append store.

## Tests Added

Added:

- `rentchain-api/src/lib/governedReviewWorkspaceAppendAdapter/__tests__/governedReviewWorkspaceAppendAdapter.test.ts`

Coverage includes:

- admin/support-internal append envelopes
- non-admin/non-support denial without writes
- unsafe candidate sanitization before store append
- append-only store contract with no update/delete operations

## Known Limitations

- No live persisted governed review workspace records are written.
- No read routes or write routes exist for persisted workspace records.
- No admin UI mutation controls exist.
- No collection retention policy has been approved yet.
- The adapter is ready for a future storage implementation but intentionally remains dependency-injected in this mission.

## Future Roadmap

Recommended follow-ups:

1. Define Firestore collection ownership and retention policy for `governed_review_workspace_append_log`.
2. Add a Firestore-backed append store with immutable create-only semantics.
3. Add admin/support-only route adapter after authorization and route-source review.
4. Add read-only admin list/detail views for persisted workspace records.
5. Add audit export readiness summaries without raw payload access.

## Guardrail Confirmation

This mission does not widen permissions, change auth, change Firestore rules, add public routes, add tenant/landlord visibility, expose raw payloads, add frontend mutation controls, enable impersonation, create workflow status mutation, or introduce autonomous remediation/escalation.
