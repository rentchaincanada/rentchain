PR: #1372
PR URL: https://github.com/rentchaincanada/rentchain/pull/1372
Branch: feat/ledger-credit-allocation-records-service-v1

WHAT WAS DONE:
- Added an internal backend lease credit allocation service.
- Added an explicit leaseCreditAllocationRecords model for operator-reviewed credit-to-obligation allocation records.
- Added deterministic obligation keys for derived payment obligation rows.
- Added preview logic for aggregate available credit, eligible outstanding obligations, suggested allocation amounts, before/after values, and preview fingerprints.
- Added internal apply logic with stale-preview validation, amount validation, idempotent replay handling, landlord/lease scoping, and append-safe record creation through injected Firestore.
- Added reversal support by marking allocation records reversed while preserving original allocation details.
- Added focused service tests for preview, apply, reversal, idempotency, landlord scoping, active/reversed allocations, and stale fingerprint behavior.

AUDIT FINDINGS:
- Aggregate lease credit remains derived from signed ledgerEntries.
- Obligation outstanding remains derived from payment obligation rows built from lease lifecycle, payment intents, rent payments, canonical payment evidence, ledger-derived payment evidence, and paymentReconciliationRecords.
- Current allocation-review decision behavior is signal and copy only; it does not create allocation state or resolve decisions.
- paymentReconciliationRecords are provider/payment evidence records and are not the right source of truth for lease credit allocations.
- Existing canonical audit event types are limited to current review and recovery workflows, so allocation audit event wiring is deferred to the API phase rather than broadening audit types in this foundation PR.

KEY DECISIONS:
- Kept this PR backend-service-only with no public route or UI.
- Kept ledgerEntries and payment records immutable for this workflow.
- Treated active allocation records as reducing both available lease credit and the selected obligation outstanding amount in derived preview state.
- Ignored reversed allocation records in current preview derivation while preserving reversal metadata on the record.
- Implemented preview fingerprints now so the future API can reject stale operator submissions with CREDIT_ALLOCATION_STATE_STALE.
- Deferred public operator allocation, decision resolution, and canonical audit event emission to a follow-up API mission.

CURRENT STATE:
- Draft PR #1372 is open.
- Branch is pushed to origin.
- Head commit is c6f37fee2528edf89b8d208b3e9938324da8b5b8.
- Changed files are limited to:
  - rentchain-api/src/services/leaseCreditAllocationService.ts
  - rentchain-api/src/services/__tests__/leaseCreditAllocationService.test.ts
- npm run test -- leaseCreditAllocationService passed under Node 20.20.2.
- npm run test -- paymentObligationLedger landlordDecisionInboxRoutes landlordDecisionQueueRoutes passed under Node 20.20.2.
- npm run build passed under Node 20.20.2.
- git diff --check passed.
- git diff --cached --check passed before the PR was opened.
- GitHub PR checks after the handoff commit: merge-gate passed; backend, frontend, Terraform Cloud, and Vercel checks were pending; review comment/status jobs were skipped.

KNOWN LIMITATIONS:
- No public API route was added.
- No frontend or operator allocation button was added.
- No auto-allocation was added.
- No ledgerEntries, payment records, payment amounts, lease lifecycle state, collection state, legal state, compliance state, or decision state are mutated.
- Canonical audit event emission is intentionally deferred because adding the allocation event family is broader than the service foundation.
- The internal apply helper writes records when a Firestore dependency is provided; route-level transaction boundaries remain for the future API mission.

NEXT STEP:
- Recommended next implementation mission: feat/ledger-credit-allocation-api-v1.
- Add guarded backend preview/apply/reversal endpoints.
- Re-derive allocation state inside API transaction or critical section.
- Add allocation audit event types if approved.
- Wire the future UI only after the API mission is complete and reviewed.
