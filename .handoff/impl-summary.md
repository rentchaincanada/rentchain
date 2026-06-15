PR: #1161
PR URL: https://github.com/rentchaincanada/rentchain/pull/1161
Branch: feat/trust-and-compliance-center-v1

WHAT WAS DONE:
- Added a read-only landlord Trust & Compliance Center backend endpoint:
  `GET /api/landlord/trust-compliance/summary`.
- Aggregated landlord-scoped governance visibility across evidence/export, consent, privacy, retention, screening, audit trail, and incident readiness sections.
- Added safe route/version header support:
  `x-route-source: landlordTrustComplianceRoutes.ts`
  `x-trust-compliance-route-version: trust-compliance-center-v1`
- Added a minimal read-only frontend page at `/trust-compliance`.
- Added frontend API types and focused route/page tests.

KEY DECISIONS:
- `canonicalEvents` is the primary source. Existing consent and screening collections are used only as safe supplemental posture sources.
- Dashboard access does not write canonical events.
- No new audit collection or compliance workflow collection was added.
- Event metadata is allowlisted; raw event metadata is not returned wholesale.
- The frontend also defensively redacts unsafe display values.

CURRENT STATE:
- Branch: feat/trust-and-compliance-center-v1
- PR: #1161
- PR URL: https://github.com/rentchaincanada/rentchain/pull/1161
- Draft PR opened for review.
- Branch pushed to origin.

VALIDATION:
- Backend targeted tests passed:
  - `source ~/.nvm/nvm.sh && nvm use 20.11.1 && npm run test:single -- src/services/trustCompliance/__tests__/trustComplianceSummaryService.test.ts src/routes/__tests__/landlordTrustComplianceRoutes.test.ts src/routes/__tests__/routeMountSmoke.test.ts`
- Backend build passed:
  - `source ~/.nvm/nvm.sh && nvm use 20.11.1 && npm run build`
- Frontend targeted tests passed under ambient Node v25.8.1:
  - `npm run test:single -- TrustComplianceCenterPage.test.tsx App.routes.test.tsx`
- Frontend build passed under repo-required Node 20.11.1:
  - `source ~/.nvm/nvm.sh && nvm use 20.11.1 && npm run build`
- `git diff --cached --check` passed.

FILES CHANGED:
- `rentchain-api/src/app.build.ts`
- `rentchain-api/src/routes/landlordTrustComplianceRoutes.ts`
- `rentchain-api/src/routes/__tests__/landlordTrustComplianceRoutes.test.ts`
- `rentchain-api/src/services/trustCompliance/trustComplianceSummaryService.ts`
- `rentchain-api/src/services/trustCompliance/trustComplianceTypes.ts`
- `rentchain-api/src/services/trustCompliance/__tests__/trustComplianceSummaryService.test.ts`
- `rentchain-frontend/src/App.tsx`
- `rentchain-frontend/src/App.routes.test.tsx`
- `rentchain-frontend/src/api/trustComplianceApi.ts`
- `rentchain-frontend/src/pages/TrustComplianceCenterPage.tsx`
- `rentchain-frontend/src/pages/TrustComplianceCenterPage.test.tsx`

KNOWN LIMITATIONS:
- Frontend Vitest under local Node 20.11.1 fails before importing tests because of a jsdom/html-encoding-sniffer ESM dependency issue. The same targeted frontend tests pass under ambient Node v25.8.1, and the frontend build passes under Node 20.11.1.
- No preview deployment or manual browser QA has been run yet.

NEXT STEP:
- Wait for PR checks.
- Deploy the PR backend for preview if checks pass.
- Verify route headers, landlord-scoped summary contents, and that dashboard access writes no canonical event.
