PR: #1162
PR URL: https://github.com/rentchaincanada/rentchain/pull/1162
Branch: feat/signing-provider-real-dispatch-v1

WHAT WAS DONE:
- Converted the Dropbox Sign provider from stub-only behavior to a real SDK-backed dispatch path.
- Kept the provider-agnostic signing adapter and preserved mock signing as the default local/dev/test provider.
- Added Dropbox Sign test-mode dispatch metadata and safe real/sandbox UI messaging.
- Added a `failed` signing state so provider failures can be visible and retryable without claiming a request is pending or signed.
- Repaired signing webhook raw-body handling for provider callbacks and widened signing webhook raw parsing to support non-JSON callback payloads.
- Preserved existing signing collections:
  - `leaseSigningRequests`
  - `leaseSigningEvents`
  - `leaseSigningWebhookDeadLetters`
  - `canonicalEvents`

KEY DECISIONS:
- Dropbox Sign is the first real provider because `@dropbox/sign` is already a backend dependency and the existing registry already supports `dropbox_sign`.
- V1 uses provider-readable HTTP(S) lease document URLs through Dropbox Sign `fileUrls`.
- Raw provider request IDs are stored internally only and are not projected to UI/API or canonical event metadata.
- Webhook payloads and provider payloads are not stored.
- No provider selection UI, DocuSign work, public verification portal, legal certificate generation, blockchain anchoring, or broad document-management work was added.

CURRENT STATE:
- Branch: feat/signing-provider-real-dispatch-v1
- PR: #1162
- PR URL: https://github.com/rentchaincanada/rentchain/pull/1162
- Draft PR opened for review.
- Branch pushed to origin.

VALIDATION:
- Backend targeted tests passed:
  - `source ~/.nvm/nvm.sh && nvm use 20.11.1 && npm run test:single -- src/services/signing/providers/__tests__/dropboxSignProvider.test.ts src/services/signing/providers/__tests__/mockSigningProvider.test.ts src/services/__tests__/leaseSigningService.test.ts src/routes/__tests__/leaseRoutes.active.test.ts`
- Backend route smoke test passed with local bind permission:
  - `source ~/.nvm/nvm.sh && nvm use 20.11.1 && npm run test:single -- src/routes/__tests__/routeMountSmoke.test.ts`
- Backend build passed:
  - `source ~/.nvm/nvm.sh && nvm use 20.11.1 && npm run build`
- Frontend targeted test passed:
  - `npm run test:single -- LeaseSigningDashboard.test.tsx`
- Frontend build passed:
  - `source ~/.nvm/nvm.sh && nvm use 20.11.1 && npm run build`
- `git diff --check` passed.

FILES CHANGED:
- `rentchain-api/src/app.build.ts`
- `rentchain-api/src/routes/webhooks/signingWebhookRoutes.ts`
- `rentchain-api/src/services/__tests__/leaseSigningService.test.ts`
- `rentchain-api/src/services/leaseStateHelper.ts`
- `rentchain-api/src/services/signing/leaseSigningService.ts`
- `rentchain-api/src/services/signing/providers/dropboxSignProvider.ts`
- `rentchain-api/src/services/signing/providers/mockSigningProvider.ts`
- `rentchain-api/src/services/signing/providers/types.ts`
- `rentchain-api/src/services/signing/providers/__tests__/dropboxSignProvider.test.ts`
- `rentchain-frontend/src/api/leasesApi.ts`
- `rentchain-frontend/src/api/tenantPortal.ts`
- `rentchain-frontend/src/components/LeaseSigningDashboard.tsx`
- `rentchain-frontend/src/components/LeaseSigningDashboard.test.tsx`

KNOWN LIMITATIONS:
- Provider-readable URL support is implemented through Dropbox Sign `fileUrls`, but preview must confirm Dropbox Sign can fetch the current lease document URL. If Dropbox Sign rejects the URL, file upload support should be a follow-up and not bundled into this PR.
- Real Dropbox Sign dispatch requires preview/runtime config:
  - `SIGNING_PROVIDER=dropbox_sign`
  - `SIGNING_PROVIDER_API_KEY`
  - `SIGNING_PROVIDER_WEBHOOK_SECRET` set to the Dropbox Sign API key/callback verification key used to validate callback `event_hash`
  - `SIGNING_PROVIDER_CALLBACK_URL`
  - `SIGNING_PROVIDER_TEST_MODE=true`
- `npm ci` was run for `rentchain-api` to restore the declared `@dropbox/sign` dependency locally; no manifest changes were made.

NEXT STEP:
- Wait for PR checks.
- Deploy PR backend after checks are green.
- Preview QA mock mode unchanged, then Dropbox Sign test mode dispatch, webhook lifecycle, safe UI projection, and canonical event metadata.
