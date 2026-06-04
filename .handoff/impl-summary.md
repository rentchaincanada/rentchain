PR: #1095
PR URL: https://github.com/rentchaincanada/rentchain/pull/1095
Branch: feat/institutional-export-framework-v1
Mission: Phase 4 Mission 4 - Institutional Export Framework

## Summary
Established the institutional export framework schema, validation, authorization, projection, and governance layer for future evidence export workflows.

The implementation is schema and pure service only. It does not add routes, persistence, evidence package assembly, export delivery, signing, external integrations, background jobs, Firestore rules, deployment changes, or production data mutation.

## Files Changed
- docs/architecture/export-framework-v1.md
- docs/governance/export-governance-v1.md
- rentchain-api/src/types/export-recipient-types.ts
- rentchain-api/src/types/export-profile-types.ts
- rentchain-api/src/types/export-request-types.ts
- rentchain-api/src/types/export-package-types.ts
- rentchain-api/src/types/export-authorization-types.ts
- rentchain-api/src/types/export-audit-types.ts
- rentchain-api/src/types/export-projections.ts
- rentchain-api/src/services/export-service.ts
- rentchain-api/src/__tests__/export-types.test.ts
- rentchain-api/src/__tests__/export-projections.test.ts
- rentchain-api/src/__tests__/export-authorization.test.ts

## Implementation Details
- Added governed export recipient and purpose enumerations with explicit recipient-purpose mapping.
- Added export profile, request, package, authorization, audit, and projection type contracts.
- Implemented deterministic export profile, request, and package ID generation using hash-based `_v1_` identifiers.
- Implemented pure validation helpers for export profiles, requests, and package skeletons.
- Implemented pure entity constructors for export profiles, export requests, and export package skeletons with no Firestore persistence.
- Implemented authorization validation for actor context, landlord scope, recipient-purpose mapping, request scope, and redaction override tightening.
- Implemented allowlist landlord/admin projections for profiles, requests, and packages.
- Added focused tests for ID determinism, schema validation, authorization rules, redaction tightening, projection safety, and purity.
- Added export architecture and governance documentation with entity relationships, scope boundaries, recipient mapping, data minimization, audit accountability, and deferred work.

## Scope Boundaries
- No routes added.
- No existing route behavior changed.
- No Firestore reads, writes, rules, indexes, or migrations added.
- No export persistence added.
- No package assembly logic added.
- No delivery mechanics added.
- No signing, attestation, webhook, external API, or recipient portal added.
- No frontend changes.
- No protected areas touched.

## Validation
- Passed: `npm --prefix rentchain-api run test:single -- src/__tests__/export-types.test.ts src/__tests__/export-projections.test.ts src/__tests__/export-authorization.test.ts`
- Passed: `npm --prefix rentchain-api test -- export`
- Passed: `npm --prefix rentchain-api run build`
- Passed: `git diff --check`
- Checked: changed-file unsafe-marker scan found governance prohibition text, validation regexes, and test sentinel values only.

## Manual QA
- Manual preview QA was not required because this mission adds backend schema, pure service helpers, docs, and tests only.
- Schema, authorization, projection, service helper, documentation, and type-safety checks are covered by focused tests and backend build.

## Known Limitations
- No API routes or route authorization are implemented in this mission.
- No export persistence is implemented in this mission.
- Evidence package assembly is deferred.
- Export delivery and delivery audit trails are deferred.
- Signing, attestation, and external sharing are deferred.
- Recipient consent and legal signature workflows are deferred.
- UI/dashboard workflows are deferred.

## Recommended Next Mission
Phase 4 Mission 5 - Evidence Package Builder using the institutional export profile and request framework.
