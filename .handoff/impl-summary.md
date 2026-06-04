PR: #1093
PR URL: https://github.com/rentchaincanada/rentchain/pull/1093
Branch: feat/evidence-provenance-chain-v1
Mission: Phase 4A Mission 2 - Evidence Provenance Chain Implementation

## Summary
Implemented the evidence provenance creation contract for Phase 4A evidence records.

The service now validates provenance metadata, authority scope, safe source references, sensitivity metadata, immutable flags, and duplicate append writes before persisting metadata-only evidence records.

## Files Changed
- docs/architecture/evidence-provenance-emission-patterns-v1.md
- rentchain-api/src/types/evidence-record-types.ts
- rentchain-api/src/services/evidence-record-service.ts
- rentchain-api/src/__tests__/evidenceIdentifier.test.ts
- rentchain-api/src/__tests__/evidenceRecordService.test.ts

## Implementation Details
- Added `EvidenceCreationAuthorityContext` to capture server-side actor, landlord, tenant, support, and purpose context for evidence creation.
- Implemented deterministic safe source reference generation from source collection, resource type, and source resource ID.
- Implemented actor and authority resolution helpers that derive safe actor, landlord, and tenant references without exposing raw IDs in provenance metadata.
- Implemented `EvidenceRecordService.createEvidenceRecord()` with creation-only persistence through Firestore `create()` semantics.
- Enforced immutable, append-only, metadata-only evidence record creation.
- Enforced landlord, tenant, admin, and support authority boundaries.
- Required purpose for admin and support evidence creation.
- Rejected unsafe provenance markers, missing authority scope, duplicate evidence IDs, and raw/payload inclusion flags.
- Documented emission patterns for ApplicationEvidence, ScreeningEvidence, DecisionEvidence, PaymentEvidence, MaintenanceEvidence, and AuditEvidence.
- Covered supersession through new append-only records with `supersedesEvidenceId` and provenance-chain references.

## Scope Boundaries
- No routes added.
- No auth core changes.
- No Firestore rules changes.
- No deployment, CI, or infrastructure changes.
- No evidence retrieval implementation.
- No evidence pack derivation, export, signing, attestation, or sharing workflows.
- No production data mutation or source collection migration.

## Validation
- Passed: `npm --prefix rentchain-api run test:single -- src/__tests__/evidenceRecordService.test.ts src/__tests__/evidenceIdentifier.test.ts`
- Passed: targeted TypeScript compile for evidence record types, service, identifier utility, fixtures, and tests.
- Passed: `npm --prefix rentchain-api run build`
- Passed: `git diff --check`
- Checked: no `lint` script is defined in `rentchain-api/package.json`.
- Checked: changed-file unsafe-marker scan found only policy text, service rejection patterns, and test sentinel values.

## Full Test Suite
`npm --prefix rentchain-api run test` was run outside the local sandbox after the sandbox run hit an environment bind restriction.

The full backend suite still has unrelated existing failures outside this mission:
- `leaseDraftRoutes.test.ts`
- `recipientTrustReviewRoutes.test.ts`
- `supportConsoleRoutes.test.ts`
- `deriveDecisionExecutionMappings.test.ts`
- `landlordAnalyticsSnapshot.test.ts`

The focused evidence tests and backend build passed.

## Known Limitations
- Evidence retrieval routes remain deferred.
- Evidence pack derivation remains deferred.
- Retention, archival, deletion, legal hold, signing, attestation, and external sharing remain future work.
- Source-service emission integrations are documented but not wired into runtime service flows in this mission.

## Recommended Next Mission
Phase 4A Mission 3 - source-service evidence emission integration or evidence pack derivation planning.
