PR: #1176
PR URL: https://github.com/rentchaincanada/rentchain/pull/1176
Branch: feat/ns-act-copy-and-signed-lease-delivery-tracking-v1

WHAT WAS DONE:
- Added structured Nova Scotia Form P readiness fields for signed lease copy delivery.
- Added structured Nova Scotia Form P readiness fields for Residential Tenancies Act copy/link delivery.
- Added safe Act copy/link metadata support for:
  - delivery status
  - delivery method
  - delivery timestamp
  - Act link included
  - Act copy provided
- Added safe signed lease copy metadata support for:
  - delivery status
  - delivery method
  - delivery timestamp
  - tenant delivery acknowledgement timestamp when available
- Added concise generated PDF wording for lease delivery readiness.
- Added a compact read-only Lease delivery readiness block in the lease signing panel.

KEY DECISIONS:
- This is operational tracking only. It does not provide legal advice, certification, compliance approval, or enforceability guarantees.
- Delivery readiness is derived from explicit lease/Form P metadata only. The implementation does not infer delivery from Dropbox signing success.
- Act access readiness requires an Act copy or Act link to be recorded; individual Act link/copy fields remain visible as tracked metadata.
- The signing lifecycle, Dropbox Sign dispatch, webhook, return route, signed document download, Form R workflow, deposit accounting, and counsel review flows were not modified.

CURRENT STATE:
- Branch: feat/ns-act-copy-and-signed-lease-delivery-tracking-v1
- PR: #1176
- PR URL: https://github.com/rentchaincanada/rentchain/pull/1176
- Draft PR opened for review.
- Branch pushed to origin.

VALIDATION:
- Backend targeted tests passed:
  - `source ~/.nvm/nvm.sh && nvm use 20.20.2 && npm run test:emulator -- src/services/leaseDocuments/__tests__/leaseFormPReadiness.test.ts src/services/leaseDocuments/jurisdictions/__tests__/caNsAdapter.test.ts src/services/leaseDocuments/__tests__/leaseDocumentService.test.ts`
- Frontend targeted test passed:
  - `source ~/.nvm/nvm.sh && nvm use 20.20.2 && npm run test -- LeaseSigningDashboard.test.tsx`
- Backend build passed:
  - `source ~/.nvm/nvm.sh && nvm use 20.20.2 && npm run build`
- Frontend build passed:
  - `source ~/.nvm/nvm.sh && nvm use 20.20.2 && npm run build`
- `git diff --check` passed.

FILES CHANGED:
- `rentchain-api/src/services/leaseDocuments/leaseFormPReadiness.ts`
- `rentchain-api/src/services/leaseDocuments/__tests__/leaseFormPReadiness.test.ts`
- `rentchain-api/src/services/leaseDocuments/jurisdictions/caNsAdapter.ts`
- `rentchain-api/src/services/leaseDocuments/jurisdictions/__tests__/caNsAdapter.test.ts`
- `rentchain-frontend/src/components/LeaseSigningDashboard.tsx`
- `rentchain-frontend/src/components/LeaseSigningDashboard.test.tsx`

KNOWN LIMITATIONS:
- This PR does not add UI controls to capture delivery status. It makes existing/explicit delivery metadata visible and readiness-aware.
- Delivery is not inferred from provider email activity or signed document availability.
- Manual preview QA is required because backend-generated readiness and frontend rendering are user-visible.

NEXT STEP:
- Wait for PR checks.
- Deploy Cloud Run for PR head after checks are green.
- Run manual preview QA for CA_NS lease generation, delivery readiness display, PDF rendering, signing regression, signed document download, workflow pages, lease summary, and ledger.
