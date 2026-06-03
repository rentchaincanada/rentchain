# Firestore Separation Governance v1

## Scope

This document defines Firestore environment separation governance for production, preview, development, and test workflows. It does not change Firestore rules, indexes, database assignments, or runtime code.

## Current Controls

- `rentchain-api/src/config/firestoreEnvironmentGuard.ts` blocks local/development/test startup unless `FIRESTORE_EMULATOR_HOST` is present.
- The same guard blocks `GOOGLE_APPLICATION_CREDENTIALS` outside production unless `ALLOW_LOCAL_PROD_FIRESTORE=true`.
- `rentchain-api/src/firebase/admin.ts` calls the guard before Firebase Admin initialization.
- Backend test scripts set emulator variables.
- Local environment template uses fake placeholders and emulator defaults.
- `rentchain-api/firestore.rules` is fail-closed for API-local rules.
- Root emulator rules are documented as local-only and must not be treated as production policy.

## Environment Assignment Policy

| Environment | Firestore Assignment | Governance Requirement |
| --- | --- | --- |
| Production | Production Firestore project/database | Access only through production backend runtime identity and route authorization |
| Preview | Currently reaches production backend unless routing is changed | Treat as production-adjacent; do not run uncontrolled preview writes |
| Development | Emulator | Must use emulator scripts and local fake placeholders |
| Test | Emulator or mocked Firestore | Must not depend on production Firestore |

## Preview Policy

If preview continues to route to the production backend, preview testing must use production-safe accounts and must not mutate live tenant data outside an approved QA scenario. If a separate preview backend or database is introduced, it must have:

- Separate runtime identity.
- Separate secrets.
- Separate Firestore database or project assignment.
- Separate Firebase Auth project or documented token issuer boundary.
- Explicit Vercel routing.
- Rollback plan.

## Rules Review Checklist

For any future Firestore rules change:

1. Verify tenant reads use tenant scope.
2. Verify landlord reads use landlord scope.
3. Verify admin/support routes remain backend-authorized.
4. Verify preview identities do not gain production data access by rule accident.
5. Verify emulator rules are not deployed as production rules without review.
6. Verify indexes support queries without creating data access authority.

## Monitoring Signals

- Unexpected writes to production collections during preview QA windows.
- Writes from unexpected service accounts.
- Firestore query errors after deployment indicating missing or wrong environment indexes.
- Health metadata showing non-production initialization mode in production.
- Audit events showing actor/environment mismatch.

## Recovery Policy

If preview or test code writes to production Firestore unexpectedly:

1. Freeze affected deployment.
2. Identify write window and affected collections.
3. Preserve audit and Cloud Run logs.
4. Determine whether writes are reversible without breaking audit continuity.
5. Use append-safe correction workflows where possible.
6. Document affected tenants/landlords and required notification path.
7. Add preventive guardrails before reopening preview workflow.

## Related Baselines

- `docs/security/local-firestore-safety-model-v1.md`
- `docs/runbooks/local-firestore-emulator.md`
- `docs/governance/firestore-index-governance-v1.md`
- `docs/governance/firestore-query-index-mapping-v1.md`
- `docs/security/firestore-projection-query-safety-v1.md`
