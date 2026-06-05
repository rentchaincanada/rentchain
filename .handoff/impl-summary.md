Audit Branch: audit/product-readiness-v1
Audit Date: 2026-06-05
Status: Complete
Key Findings:
- Production Firestore rules are emulator-only and allow all reads/writes.
- Screening defaults to mock/provider placeholders unless production provider setup is explicitly configured.
- Lease execution supports drafts, PDFs, and tenant signing state, but no provider-backed e-signature completion is evident.
- Billing checkout/status has a frontend-backend route mismatch and does not prove active Stripe subscription lifecycle.
- Tenant portal and application paths depend on frontend environment flags that are not documented by a frontend `.env.example`.

## Blockers (Revenue-Preventing)

- Firestore production enforcement is not represented in the root rules file.
- Screening integration is not market-ready for advertised provider breadth.
- Lease execution lacks provider-backed signing or explicit launch-safe in-app signing scope.
- Billing subscription status and checkout route alignment are insufficient for paying landlord activation.
- Landlord payout and statement lifecycle is not closed.

## Critical (User-Visible Failures)

- Tenant portal routes can resolve to coming-soon behavior when `VITE_TENANT_PORTAL_ENABLED` is absent or false.
- Frontend `createCheckoutSession()` calls `/billing/create-checkout-session`, while backend exposes `/billing/checkout`, `/billing/subscribe`, and `/billing/upgrade`.
- Application routes are split across legacy and newer route families, increasing QA/support ambiguity.
- Frontend API base requirements are not documented by a frontend `.env.example`.

## High-Priority (Adoption Friction)

- Property publish does not prove tenant discoverability through a canonical search workflow.
- Property geocoding/maps readiness is not evident in the create/publish path.
- Tenant payment readiness is honest but blocked unless payment rails are explicitly enabled.
- Governance/readiness pages outnumber completed revenue workflow surfaces.

## Recommendations for v0.9 Sequencing

1. Firestore production rules and cross-role denial tests.
2. Billing checkout/status alignment and Stripe subscription verification.
3. Screening provider completion for the selected v0.9 provider, with mock provider blocked outside approved test modes.
4. Lease execution end-to-end decision and implementation: provider-backed signing or explicitly scoped in-app signing.
5. Tenant portal configuration, frontend env example, and tenant application/discovery hardening.
6. Landlord payout, statement, and rent payment reconciliation lifecycle.

See `.handoff/audit-product-readiness-findings.md` for the full detailed audit report.

## Validation

Validation commands were run after the audit files were written.

- Backend `npm test -- --coverage`: FAIL. Existing full-suite baseline failures remain: 7 test files failed, 20 tests failed, 446 files passed, 2183 tests passed. Failing areas include lease draft routes, recipient trust review routes, support console routes, analytics decision mapping, and landlord analytics snapshot coverage.
- Backend `npm run build`: PASS.
- Backend `npm run lint`: FAIL. `rentchain-api` does not define a `lint` script.
- Frontend `npm test -- --coverage`: FAIL. Vitest coverage could not start because `@vitest/coverage-v8` is missing.
- Frontend `npm run build`: PASS. Vite emitted a Node version warning for Node 20.11.1 and a large chunk warning, but the production build completed.
- Frontend `npm run lint`: PASS.
- `git diff --check`: PASS.
- Handoff artifact restricted-term scan: PASS.

## Manual QA

Manual QA was not completed in a running local or staging environment because this audit turn did not include seeded accounts, credentials, or a running deployment. The audit provides code-reference reproduction steps and a required manual QA checklist for pre-launch validation.
