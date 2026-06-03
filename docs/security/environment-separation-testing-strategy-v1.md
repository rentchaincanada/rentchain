# Environment Separation Testing Strategy v1

## Scope

This document defines verification methods for environment separation. It does not add automated tests, monitoring, or deployment changes.

## Separation Verification Definition

Environment separation is verified when:

- Production frontend routes to production backend only.
- Preview routing is known and reviewed.
- Local development and tests use Firestore emulator or mocks.
- Production backend does not initialize emulator mode.
- Preview or local credentials cannot mutate production data unexpectedly.
- Auth tokens from one environment do not authorize unintended access in another.

## Required Verification Checks

### Source Checks

- `git diff --check`
- Search for committed credential-shaped values in changed docs.
- Verify no production secret values or service account emails are documented.
- Verify Vercel rewrites and CSP are reviewed when API routing is mentioned.
- Verify Firestore guard behavior is not weakened.

### Backend Checks

- Run backend build for documentation missions when requested.
- For runtime missions, verify health endpoint reports expected Firebase initialization mode.
- For auth changes, verify scope mismatch failures remain closed.
- For Firestore changes, verify non-production startup fails without emulator configuration.

### Frontend Checks

- Confirm `VITE_API_BASE_URL` is absolute for each deployed environment.
- Confirm preview browser network requests hit expected API host.
- Confirm CSP permits intended host and blocks unexpected host.
- Confirm Firebase Auth public config points to expected project/domain.

### Operational Checks

- Review Cloud Run logs for unexpected preview traffic to production backend.
- Review Firestore writes during preview QA windows.
- Review Vercel deployment env values after project setting changes.
- Review Cloud Run runtime identity and secret access after deploy pipeline changes.

## Suggested Manual Test Matrix

| Scenario | Expected Result |
| --- | --- |
| Local backend starts without `FIRESTORE_EMULATOR_HOST` | Startup fails |
| Local backend starts with `GOOGLE_APPLICATION_CREDENTIALS` and no override | Startup fails |
| Local backend starts with emulator env | Startup succeeds in emulator mode |
| Vercel preview opens `/api` route | Host matches approved routing |
| Production frontend opens `/api` route | Host is production backend |
| Preview user attempts unrelated tenant access | Backend rejects by scope |
| Tenant token attempts admin route | Backend rejects |

## Monitoring Signals

- Unexpected service identity writing production Firestore.
- Preview deployment causing production write spikes.
- Cloud Run health mode mismatch.
- Firebase auth domain mismatch warnings during development.
- Repeated API base misconfiguration warnings.
- Firestore index/query errors after environment routing changes.

## Review Cadence

- Run separation review after each deployment configuration change.
- Run Vercel env review after any frontend environment variable change.
- Run Cloud Run identity review after any backend deployment pipeline change.
- Run Firestore separation review after any Firebase initialization or rules change.

## Related Documents

- `docs/environment/preview-staging-separation-strategy-v1.md`
- `docs/governance/environment-separation-policy-v1.md`
- `docs/runbooks/environment-separation-incident-response-v1.md`
- `docs/security/environment-separation-operational-dashboard-v1.md`
