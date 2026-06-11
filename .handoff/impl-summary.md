PR: #1138
PR URL: https://github.com/rentchaincanada/rentchain/pull/1138
Branch: fix/unified-inbox-projection-regression-v1

# Implementation Summary

Mission: Apply Projection Safety to Legacy landlordInboxRoutes Endpoint

## Summary

- Exported and reused the unified inbox public projection helper.
- Applied `toPublicInboxRecord()` to the legacy landlord inbox response before returning items.
- Applied the same public projection to tenant and contractor legacy inbox routes after audit found they also returned raw inbox events.
- Updated landlord and tenant response types to use `UnifiedInboxPublicRecord`.
- Updated landlord, tenant, contractor, and shared unified inbox route tests to assert the allowlisted public record shape and absence of internal fields.

## Files Changed

- `rentchain-api/src/services/unifiedInbox/unifiedInboxService.ts`
- `rentchain-api/src/routes/landlordInboxRoutes.ts`
- `rentchain-api/src/routes/tenantInboxRoutes.ts`
- `rentchain-api/src/routes/contractorPortalRoutes.ts`
- `rentchain-api/src/routes/landlord.test.ts`
- `rentchain-api/src/routes/tenant.test.ts`
- `rentchain-api/src/routes/contractor.test.ts`
- `.handoff/impl-summary.md`

## Validation

- `source ~/.nvm/nvm.sh && nvm use 20.20.2 && npm run test -- src/routes/landlord.test.ts src/routes/tenant.test.ts src/routes/contractor.test.ts src/tests/unifiedInbox/unifiedInboxRoute.test.ts`
- `source ~/.nvm/nvm.sh && nvm use 20.20.2 && npm run test -- src/tests/unifiedInbox/unifiedInboxService.test.ts`
- `source ~/.nvm/nvm.sh && nvm use 20.20.2 && npm run build` in `rentchain-api`
- `source ~/.nvm/nvm.sh && nvm use 20.20.2 && npm run build` in `rentchain-frontend`
- `git diff --check`

## Manual QA

- Not run locally. Preview/manual QA should verify `GET /api/landlord/inbox`, `GET /api/tenant/inbox`, and `GET /api/contractor/inbox` responses contain only the public inbox fields: `id`, `sourceKind`, `audienceRole`, `title`, `body`, `priority`, `status`, `occurredAt`, and `readAt`.
- Network responses should not include `sourceId`, `sourceRef`, `audienceScopeKey`, safety flags, tokens, storage paths, provider payloads, or private notes.

## Known Limitations

- No auth, Firestore rules, source derivation, or route registration logic was changed.
- Frontend build still reports the existing large chunk warning; the build completed successfully.
- Pre-existing unrelated local handoff/workflow-rule edits were preserved in a local stash before final validation.
