# API Rate Limit and Abuse Protection v1

## Executive Summary

This mission audits RentChain API abuse surfaces and adds a conservative first-pass rate-limit foundation without rewriting authentication, changing permissions, changing route visibility, or introducing new infrastructure.

The implementation reuses the existing `express-rate-limit` dependency and the existing `rentchain-api/src/middleware/rateLimit.ts` pattern. It adds named, documented route-category profiles and mounts them only where the risk/retry tradeoff is clear.

This is not the final distributed production abuse-control architecture. In-memory rate limiting provides process-local protection only; horizontally scaled Cloud Run instances require a future shared or edge-enforced strategy.

## Files Inspected

- `rentchain-api/src/app.build.ts`
- `rentchain-api/src/middleware/rateLimit.ts`
- `rentchain-api/src/middleware/authMiddleware.ts`
- `rentchain-api/src/middleware/requireAuth.ts`
- `rentchain-api/src/routes/authRoutes.ts`
- `rentchain-api/src/routes/publicApplicationLinksRoutes.ts`
- `rentchain-api/src/routes/invitesRoutes.ts`
- `rentchain-api/src/routes/accessRoutes.ts`
- `rentchain-api/src/routes/tenantPortalRoutes.ts`
- `rentchain-api/src/routes/tenantInvitesRoutes.ts`
- `rentchain-api/src/routes/landlordEvidencePackRoutes.ts`
- `rentchain-api/src/routes/landlordInstitutionExportsRoutes.ts`
- `rentchain-api/src/routes/landlordOperatorReviewRoutes.ts`
- `rentchain-api/src/routes/internalReportsRoutes.ts`
- `rentchain-api/src/routes/identityOracleInternalRoutes.ts`
- `rentchain-api/src/routes/applicationReminderInternalRoutes.ts`
- `rentchain-api/src/routes/stripeScreeningOrdersWebhookRoutes.ts`
- `rentchain-api/src/routes/transunionWebhookRoutes.ts`
- `docs/reports/api-route-ownership-and-exposure-inventory-v1.md`
- `docs/reports/session-and-token-governance-hardening-v1.md`

## Route Categories Audited

| Category | Example routes | Risk | First-pass treatment |
| --- | --- | --- | --- |
| Auth-sensitive | `/api/auth/login`, `/api/auth/signup`, `/api/auth/login/demo`, password reset confirmation | brute-force login/signup/password attempts | existing auth limiter retained and formalized as `auth-sensitive` |
| Public token-scoped | `/api/public/application-links/*`, `/api/public/landlord-invites/*`, `/api/invites/*`, `/api/access/*` | invite/token probing and public intake abuse | conservative IP-based profile added |
| Tenant workspace entry | `/api/tenant-invites/*`, `/api/tenant/invite/*` | tenant invite redemption/session-entry probing | actor-or-IP profile added on entry prefixes |
| Evidence/export/review | `/api/landlord/evidence-packs/*`, `/api/landlord/institution-exports/*`, `/api/landlord/operator-reviews/*`, `/api/landlord/review-timeline/*` | expensive reads, evidence/export preview abuse, review-surface scraping | actor-or-IP profile added after auth decode and before route handlers |
| Internal job-token | `/api/internal/*` | public network surface protected by internal job token | lenient IP-based profile added to avoid breaking legitimate retries |
| Diagnostics/status | `/api/status/*`, `/api/__routes`, `/api/__probe/*`, `/api/__debug/*`, `/api/_build`, `/api/_echo` | public diagnostic metadata abuse | conservative IP-based profile added |
| Webhooks | `/api/webhooks/stripe`, `/api/stripe/webhook`, `/api/webhooks/transunion` | provider callback retry safety | intentionally not rate-limited in this pass; signature/token validation remains route responsibility |

## Applied Limits

| Profile | Window | Max | Key strategy | Notes |
| --- | --- | --- | --- | --- |
| `auth-sensitive` | 15 minutes | 20 | IP | Existing auth behavior preserved; profile made explicit. |
| `public-token` | 15 minutes | 60 | IP | Protects public invite/access/application-link surfaces without blocking normal user flow. |
| `tenant-workspace-entry` | 15 minutes | 90 | actor-or-IP | Applies to tenant invite/session entry prefixes only, not broad tenant workspace browsing. |
| `evidence-export-review` | 15 minutes | 120 | actor-or-IP | Applies after auth decode, so authenticated landlord/admin actors do not collide on IP alone. |
| `internal-job` | 15 minutes | 300 | IP | Deliberately lenient to preserve internal job retries. |
| `diagnostics` | 5 minutes | 120 | IP | Protects public diagnostics without changing visibility. |

Existing route-specific limiters remain:

- `public-apply` for public rental application submission
- `leads` for landlord inquiry lead submission
- `screening-user` and `screening-ip` for screening checkout/status surfaces
- `tenant-invites-user` for landlord-created tenant invites
- `referrals-user` for referrals
- local 2FA rate limiting inside `authRoutes.ts`

## Exemptions and Deferred Routes

### Provider Webhooks

Stripe and TransUnion webhook routes remain unmounted from category rate limiting. They are mounted before the JSON parser and must continue to support legitimate provider retry behavior. Abuse controls for these routes should focus on provider signature/token verification, idempotency, and provider-specific monitoring before rate limiting is introduced.

### General Authenticated App Browsing

Broad authenticated routes such as `/api/dashboard`, `/api/leases`, `/api/tenants`, `/api/properties`, and `/api/payments` are not globally rate-limited in this pass. Overly broad limits could block normal landlord workflows. Future production-grade controls should use shared counters, route-specific cost budgets, and observability-informed thresholds.

### Broad Tenant Workspace Browsing

Only tenant invite/session entry prefixes are limited. General tenant workspace routes are not broadly limited in this pass to avoid breaking normal tenant document/message/lease viewing behavior.

## Response Semantics

Rate-limited requests return:

- HTTP `429`
- `ok: false`
- `code: "RATE_LIMITED"`
- `error: "rate_limited"`
- safe generic detail text
- standard rate-limit headers and `Retry-After` where provided by the middleware

The response intentionally does not expose internal counter state, actor identifiers, tokens, or route internals.

## Logging and Redaction

Rate-limit logs use `safeOperationalLog()` and include only:

- profile name
- route
- method
- retry-after seconds
- whether an auth header was present

Authorization header values, tokens, cookies, provider payloads, secrets, and raw request bodies are not logged. Regression tests assert that token material is absent from rate-limit log output.

## Cloud Run and Proxy Considerations

The Express app already sets `trust proxy` to `1`. This allows `req.ip` and `X-Forwarded-For` handling behind Cloud Run/Vercel proxying. Rate-limit key generation uses a safe IP helper and actor-or-IP fallback where authenticated user context is available.

Because the limiter is in-memory, counters are local to each Cloud Run container instance. Under horizontal scaling, a single client can distribute requests across instances. This is acceptable only as a foundation and should be supplemented with a distributed or edge-level control.

## Known Limitations

- In-memory counters are not globally consistent across Cloud Run instances.
- Limits reset on instance restart.
- Existing route-local limiters remain split across route modules.
- General authenticated app browsing is not globally limited yet.
- Webhook abuse protection remains verification/idempotency based, not rate-limit based.
- Public diagnostics are still reachable; this mission limits request rate but does not change exposure.
- No abuse telemetry dashboard exists yet.

## Future Production-Grade Path

Recommended follow-up options:

1. `fix/cloud-armor-api-abuse-policy-v1`
2. `fix/shared-rate-limit-counter-store-v1`
3. `fix/webhook-verification-and-idempotency-hardening-v1`
4. `fix/debug-probe-production-gating-v1`
5. `feat/api-abuse-telemetry-dashboard-v1`
6. `fix/document-upload-governance-v1`
7. `fix/admin-support-access-governance-v1`

Production-grade controls may use:

- Google Cloud Armor
- API Gateway or Load Balancer policies
- Redis or a managed shared counter store
- Firebase/App Check where appropriate
- provider-specific webhook verification hardening
- abuse telemetry and incident-response dashboards

## Behavior Preservation

This mission does not change:

- Firebase Auth behavior
- JWT format
- Firestore rules
- user roles
- landlord/tenant/admin permissions
- route visibility
- payment, screening, review, export, or tenant workspace business logic

The goal is conservative request-rate governance, not a product behavior change.

## Verification Expectations

Required local verification:

- rate-limit middleware tests
- route ownership regression tests where mount/order behavior is relevant
- backend build
- `git diff --check`

Preview QA:

1. Log in normally once.
2. Open `/dashboard`.
3. Open `/operations`.
4. Confirm normal authenticated app flow is not blocked.
5. Confirm no new console/security errors.
6. Confirm no token or Authorization values appear in logs or console output.
