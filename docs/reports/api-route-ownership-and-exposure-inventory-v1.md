# API Route Ownership and Exposure Inventory v1

## Executive Summary

This inventory documents the API route families mounted by the Cloud Run Express build in `rentchain-api/src/app.build.ts`, their likely ownership domains, exposure category, route-source diagnostic coverage, and routing risks.

This is a documentation-only audit. It does not rewrite routing, change auth behavior, change route responses, modify Firestore rules, alter frontend behavior, or change infrastructure.

The highest-priority finding from `platform-foundation-risk-review-v1` is confirmed: route ownership and mount order are fragile because the production app assembly mixes public, webhook, internal, landlord, tenant, admin, debug/probe, compatibility, and broad `/api` routers in one large file.

The route system is functional, but institutional readiness requires an explicit route ownership registry and route-level tests before deeper review workspaces, evidence infrastructure, consent governance, institutional exports, or governed operational routing are layered on top.

## Files Inspected

- `rentchain-api/src/app.build.ts`
- `rentchain-api/src/index.build.ts`
- `rentchain-api/src/routes/**`
- `rentchain-api/src/middleware/**`
- `rentchain-api/firestore.rules`
- `rentchain-frontend/vercel.json`
- `cloudrun.tf`
- `.github/workflows/ci.yml`
- `.github/workflows/merge-gate.yml`

## Exposure Categories

| Category | Meaning |
| --- | --- |
| Public | No user auth required. May still validate token-like URL params or provider signatures. |
| Optional-auth | Auth decoded when provided, but route handler must enforce behavior itself. |
| Landlord | Requires authenticated landlord/admin context, usually `requireLandlord` or equivalent. |
| Tenant | Requires authenticated tenant context, usually `requireTenant`. |
| Admin | Requires admin role, `system.admin`, or allowlisted admin identity. |
| Internal | Requires `INTERNAL_JOB_TOKEN` or equivalent internal header. Public network surface but token-gated. |
| Webhook | Provider callback route. Public network surface, provider signature/token expected. |
| Debug/probe | Operational diagnostic route. May be public and should be intentionally reviewed. |
| Dev-only | Should not be available in production, either by env guard or unmounted status. |

## Route Ownership Inventory

| Route prefix / path | Mounted file/router | Auth category | Owner domain | Production exposure | Route-source coverage | Known risks |
| --- | --- | --- | --- | --- | --- | --- |
| `/health` | `healthRoutes.ts` | Public | health | production-safe | missing from mount, route-local only | public DB health route should be reviewed for detail level |
| `/api/health`, `/api/health/*` | `publicRoutes.ts` | Public | health/status | should be reviewed | present | exposes config health flags and pricing/provider status |
| `/api/status/public` | `statusRoutes.ts` | Public | status | production-safe | present at mount | public status surface |
| `/api/webhooks/stripe` | `stripeScreeningOrdersWebhookRoutes.ts` | Webhook | screening/billing | production-safe with signature | present | must remain before JSON parser |
| `/api/stripe/webhook` | `stripeScreeningOrdersWebhookRoutes.ts` | Webhook | screening/billing | production-safe with signature | present | duplicate Stripe webhook path is intentional compatibility but should be documented |
| `/api/webhooks/transunion` | `transunionWebhookRoutes.ts` | Webhook | screening | production-safe with provider validation | present | must remain before JSON parser |
| `/api/auth/*` | `authRoutes.ts` | Public/auth-required mix | auth | production-safe with review | present | large mixed auth router; includes dev-only demo login guard |
| `/api/auth/login/demo` | `authRoutes.ts` | Dev-only | auth/demo | production-safe because handler 404s in production | present via mount | should remain tested because it returns tokens outside production |
| `/api/auth/demo` | `authRoutes.ts` | Public | auth/demo | should be reviewed | present via mount | exposes demo email; low sensitivity but unnecessary in production |
| `/api/me` | inline in `app.build.ts` | Auth-required | auth/session | production-safe with auth | present | uses explicit authorization header check plus `requireAuth` |
| `/api/public/*` | `publicRoutes.ts`, public share/invite/application routers | Public | public/share/application | production-safe with token validation | mixed | multiple public routers share one prefix |
| `/api/application-links/*` | `landlordApplicationLinksRoutes.ts` | Landlord | applications | production-safe with auth | present | duplicated with `/api/landlord/application-links` |
| `/api/public/application-links/*` | `publicApplicationLinksRoutes.ts` | Public token | applications | production-safe with token validation | present | sensitive application intake; must stay token-scoped |
| `/api/invites/*` | `invitesRoutes.ts` | Public/auth mix | invites | should be reviewed | present | auth category must be route-specific |
| `/api/access/*` | `accessRoutes.ts` | Public/auth mix | access | should be reviewed | present | auth category must be route-specific |
| `/api/capabilities/*` | `capabilitiesRoutes.ts` | Public/auth mix | capabilities | production-safe with review | present | can influence UI entitlements perception |
| `/api/internal/*` | `internalReportsRoutes.ts`, `identityOracleInternalRoutes.ts`, `applicationReminderInternalRoutes.ts` | Internal token | internal jobs/reports | should be gated | present | Cloud Run is public; internal safety depends on token headers |
| `/api/events/*` | `eventsRoutes.ts` | Optional-auth/public telemetry mix | events/telemetry | should be reviewed | present | global `authenticateJwt` is non-blocking; route must enforce sensitive reads |
| `/api/telemetry` | `telemetryRoutes.ts` | Auth-required | telemetry | production-safe with auth | present | previously surfaced as missing; now mounted late |
| `/api/billing/*` | `billingRoutes.ts` | Auth/Stripe mix | billing | protected area | present | protected area; verify every endpoint explicitly enforces auth |
| `/api/payments`, `/api/payments/*` | `paymentsRoutes.ts`, `paymentsEditRouter`, inline payment edit handlers | Auth/permission | payments | production-safe with auth | present | multiple payment mounts; broad `/api` mount plus `/api/payments` fallback |
| `/api/ledger/*` | `ledgerRoutes.ts` | Auth-required | ledger/imports | production-safe with auth | present | broad route owns CSV preview/confirm; previous fallthrough issue makes route tests important |
| `/api/ledger-v2/*` | `ledgerV2Routes.ts` | Auth-required | ledger | production-safe with auth | present | legacy/new ledger split should remain documented |
| `/api/leases/*` | `leaseRoutes.ts` | Landlord/auth mix | leases/ledger/obligations | production-safe with auth review | present | very large router; some handlers rely on route-local auth assumptions |
| `/api/landlord/leases/*` | `leaseNoticeLandlordRoutes.ts` | Landlord | lease notices | production-safe with auth | present | mounted separately from core lease routes |
| `/api/tenant/lease-notices/*` | `tenantLeaseNoticeRoutes.ts` | Tenant | tenant lease notices | production-safe with auth | present | tenant projection surface |
| `/api/tenants/*` | `tenantsRoutes.ts` | Landlord | tenants | production-safe with auth | present | route-level `router.use(requireLandlord)` is strong |
| `/api/tenant/*` | `tenantPortalRoutes.ts`, tenant participation/onboarding routes | Tenant/auth mix | tenant workspace | production-safe with tenant auth | mixed | multiple routers share prefix; tenant projection safety is critical |
| `/api/properties/*` | `propertiesRoutes.ts`, `unitImportRoutes.ts` | Landlord/auth mix | properties/units | production-safe with auth | partial | nested `/api/properties/:propertyId/units` mount can overlap with properties router |
| `/api/units`, `/api/units/*` | `unitsRoutes.ts` | Landlord | units | production-safe with auth | present | broad `/api` mount; route prefix lives inside router |
| `/api/dashboard/*` | `dashboardRoutes.ts` | Auth/landlord | dashboard | production-safe with auth | present | mounted twice |
| `/api/landlord/messages/*`, `/api/tenant/messages/*` | `messagesRoutes.ts` | Landlord/Tenant | messaging | production-safe with auth | present | shared router prefix under broad `/api`; isolation must remain tested |
| `/api/decisions/*` | `decisionRoutes.ts` | Landlord/auth | decisions | production-safe with auth | present | decision actions affect workflow only; route ownership clear |
| `/api/action-requests/*` | `actionRequestsRoutes.ts`, `actionRequestsRecomputeRoutes.ts` | Auth/optional dev bypass risk | action requests | should be reviewed | present | two routers same prefix; auth decode has tenant portal dev bypass for POST action-requests |
| `/api/landlord/decision-inbox`, `/api/landlord/automated-workflows/*` | `landlordDecisionInboxRoutes.ts` | Landlord | decisions/automation | production-safe with auth | present | automation preview must stay non-mutating unless explicitly routed |
| `/api/landlord/operator-reviews/*` | `landlordOperatorReviewRoutes.ts` | Landlord | operator reviews | production-safe with auth | present | future review workspace dependency |
| `/api/landlord/evidence-packs/*` | `landlordEvidencePackRoutes.ts` | Landlord | evidence | production-safe with auth | present | loads multiple collections; evidence projection governance needed |
| `/api/landlord/review-timeline/*` | `landlordReviewTimelineRoutes.ts` | Landlord | review timeline | production-safe with auth | present | event lineage dependency |
| `/api/landlord/institution-exports/*` | `landlordInstitutionExportsRoutes.ts` | Landlord | exports | production-safe with auth, must be reviewed | present | export projection safety is critical |
| `/api/landlord/audit-compliance/*` | `landlordAuditComplianceRoutes.ts` | Landlord | audit/compliance | production-safe with auth | present | evidence/audit taxonomy dependency |
| `/api/landlord/* readiness/trust/risk routes` | landlord governance route family | Landlord | governance/readiness | production-safe with auth | present | many derived governance surfaces; exposure is auth-gated but broad |
| `/api/screening-*`, `/api/integrations/*`, `/api/screening/report` | screening route family | Mixed public/admin/tenant/provider | screening | should be reviewed | mixed | provider and admin routes have varying guards |
| `/api/admin/*` | many admin route families | Admin | admin/support/governance | production-safe with admin auth, should be reviewed | present | many admin routes use local role checks; some scan entire collections |
| `/api/admin/demo/*` | `adminDemoRoutes.ts` | Landlord + admin/dev flag | demo/admin | should be reviewed | present | mutating demo reset/seed route mounted in production tree |
| `/api/admin/screening-jobs/*` | `screeningJobsAdminRoutes.ts` | Internal token or admin | screening jobs | should be gated/reviewed | present | mounted broadly at `/api`; previous route-source confusion involved this router |
| `/api/reporting/*`, `/api/reports/*` | reporting route family | Auth | reports/exports | production-safe with auth review | partial | export surfaces need projection governance |
| `/api/tenant-report/*`, `/api/tenant-report-pdf/*` | tenant report routers | Landlord/auth | reports/PDF | production-safe with auth | present | PDF/export scaling and projection sensitivity |
| `/api/maintenance/*`, `/api/work-orders/*`, contractor jobs | `maintenanceRequestsRoutes.ts`, `workOrdersRoutes.ts` | Mixed landlord/tenant/contractor | maintenance/work-orders | should be reviewed | partial | large route family with multiple actor contexts |
| `/api/viewings/*` | `viewingRoutes.ts` | Public + landlord | viewings | production-safe with review | present | public request route plus landlord management routes |
| `/api/referrals/*` | `referralsRoutes.ts` | Auth | referrals | production-safe with auth | present | broad `/api` mount |
| `/api/onboarding/*`, `/api/__probe/onboarding` | `onboardingRoutes.ts` | Auth/probe | onboarding | should be reviewed | present | mounted both `/api/onboarding` and `/api` |
| `/api/account/*` | `accountRoutes.ts` | Auth/optional auth | account | production-safe with auth review | missing at mount | route-local auth must be verified |
| `/api/compliance/*` | `complianceRoutes.ts` | Auth | compliance | production-safe with auth | present | policy/compliance semantics should avoid legal claims |
| `/api/impersonation/*` | `impersonationRoutes.ts` | Auth/admin/support | impersonation | should be reviewed | present | authority-sensitive |
| `/api/__probe/*` | inline app probes | Debug/probe | diagnostics | should be reviewed | partial | public operational metadata exposed |
| `/api/__debug/*` | inline app debug | Debug/probe | diagnostics | should be gated/reviewed | present | public debug metadata exposed |
| `/api/_build`, `/api/_echo` | inline app diagnostics | Debug/probe | diagnostics | should be reviewed | present | `_echo` mounted twice; public echo endpoint should be removed or gated |
| `/api/*` 404 | inline not-found handler | Catchall | diagnostics | production-safe | present as `not-found` | catchall hides route fallthrough root causes unless route tests exist |

## Public Route Inventory

| Route family | Current exposure | Notes |
| --- | --- | --- |
| `/health` | Public | Legacy health surface. Includes `/ready` and `/db` inside health router. Review detail level for production. |
| `/api/health` | Public | Returns environment capability flags from `getEnvFlags()`. Useful for QA, but expose only intentional booleans. |
| `/api/health/stripe` | Public | Shows Stripe/pricing configuration status and optional deep check. Should be reviewed for public exposure. |
| `/api/health/pricing` | Public | Shows pricing config health. Useful but should be intentionally public. |
| `/api/health/screening-provider` | Public | Shows provider health/configuration state. Should be reviewed because screening provider readiness can be operationally sensitive. |
| `/api/status/public` | Public | Intended public status route. |
| Public invitation/application links | Public token-scoped | Correct category, but must remain token-hash scoped and rate-limited. |
| Public portfolio/tenant share routes | Public token-scoped | Correct category, but needs projection allowlists. |
| Viewing request creation | Public | Expected public intake route; landlord management routes in same router are auth-gated. |
| Screening tenant consent link | Public token-scoped | Correct route type; sensitive consent record writes require careful logging and event governance. |

## Auth-Required Route Inventory

| Route family | Auth category | Owner domain | Notes |
| --- | --- | --- | --- |
| `/api/me` | Auth-required | auth/session | Inline explicit auth enforcement. |
| `/api/billing/*` | Auth/permission | billing | Protected area; should remain outside broad fallback ambiguity. |
| `/api/payments/*` | Auth/permission | payments | Multiple mounts and fallback exist; route ownership tests are important. |
| `/api/ledger/*` | Auth | ledger/imports | CSV payment import preview/confirm live here; previous QA proved route registration must be tested. |
| `/api/leases/*` | Landlord/auth mix | leases | Very large router covering lease CRUD, ledger, exports, obligations, notes, archive/restore, rails, automation. |
| `/api/tenants/*` | Landlord | tenants | Strong route-level landlord guard. |
| `/api/properties/*`, `/api/units/*` | Landlord/auth | properties/units | Overlapping nested unit mount should be documented. |
| `/api/dashboard/*` | Auth/landlord | dashboard | Mounted twice. |
| `/api/landlord/messages/*` | Landlord | messaging | Shared router with tenant message routes. |
| `/api/tenant/messages/*` | Tenant | messaging | Tenant projection and isolation critical. |
| `/api/decisions/*` | Auth/landlord | decisions | Workflow actions only. |
| `/api/landlord/evidence-packs/*` | Landlord | evidence | Auth-gated but projection/sensitivity registry needed. |
| `/api/landlord/institution-exports/*` | Landlord | exports | Auth-gated but high governance risk. |
| `/api/maintenance`, `/api/work-orders` | Mixed actor auth | maintenance/work-orders | Large actor matrix; requires separate route ownership follow-up. |

## Admin and Internal Route Inventory

| Route family | Auth category | Production exposure | Notes |
| --- | --- | --- | --- |
| `/api/admin/*` general admin | Admin | production-safe with admin auth | Many route families mounted. Local guard style varies between `requireAdmin`, `requirePermission("system.admin")`, and route-local role normalization. |
| `/api/admin/notifications` | Admin | production-safe with admin auth | Full collection reads; scaling risk. |
| `/api/admin/triage`, `/api/admin/alerts`, `/api/admin/resolutions`, `/api/admin/assignments` | Admin | production-safe with admin auth | Governance/admin workflow surfaces. |
| `/api/admin/observability`, release, public exposure, commercial readiness, production integrations, ecosystem, platform credentialing | Admin | production-safe with admin auth | Many readiness surfaces. Ensure projections redact secrets consistently. |
| `/api/admin/demo/*` | Admin/dev override | should be reviewed | Mutating demo seed/reset route mounted in production route tree. |
| `/api/internal/reports/tu-referrals` | Internal token | should be gated | Public Cloud Run network surface protected by header token. |
| `/api/internal/leases/:leaseId/recompute-risk` | Internal token | should be gated | Mutates/recomputes risk state. |
| `/api/internal/tenants/:tenantId/recompute-score` | Internal token | should be gated | Mutates/recomputes tenant score. |
| `/api/internal/status/health-sync` | Internal token | should be gated | Internal status sync. |
| `/api/internal/reports/lease-overlaps` | Internal token | should be gated | Diagnostic/report surface. |
| `/api/admin/screening-jobs/*` | Internal token or admin | should be reviewed | Mounted at broad `/api`; route-source confusion has occurred around this file. |

## Webhook Route Inventory

| Route | Handler | Exposure | Notes |
| --- | --- | --- | --- |
| `POST /api/webhooks/stripe` | `stripeWebhookHandler` | Webhook | Mounted before JSON parser with raw body. |
| `POST /api/stripe/webhook` | `stripeWebhookHandler` | Webhook | Compatibility duplicate. |
| `POST /api/webhooks/transunion` | `transunionWebhookHandler` | Webhook | Mounted before JSON parser. |

Webhook routes are correctly mounted before the global JSON parser. They remain public network surfaces and must keep provider signature/token validation.

## Debug, Probe, and Dev Route Inventory

| Route / file | Current state | Risk |
| --- | --- | --- |
| `/api/__routes` | Public inline app route | Only reports partial mount list, which can become stale/misleading. |
| `/api/__probe/tenants-mount` | Public inline app route | Low-value production probe. |
| `/api/__probe/version` | Public inline app route | Public timestamp/build marker. |
| `/api/__probe/revision` | Public inline app route | Useful for QA; intentionally exposes Cloud Run revision/commit. |
| `/api/__probe/routes` | Public inline app route | Exposes Express route/mount metadata. Should be gated or removed after route inventory tooling exists. |
| `/api/__debug/build` | Public inline app route | Exposes Vercel/build metadata and route-check hints. Should be gated/reviewed. |
| `/api/__debug/ping-application-links` | Public inline app route | Low-value debug route. |
| `/api/_build` | Public inline app route | Exposes service/revision/time. Useful but should be intentional. |
| `/api/_echo` | Public inline POST route | Mounted twice. Echo route should be removed or gated unless actively needed for deployment diagnostics. |
| `devDiagnosticsRoutes.ts`, `devDiagRoutes.ts` | Route files present | Not mounted in `app.build.ts` based on audit scan; keep unmounted or delete after inventory. |
| `adminScreeningsRoutes.ts`, `adminFeatureFlagsRoutes.ts` | Dev-only middleware in files | Not mounted in `app.build.ts` based on audit scan; route files use `devOnly`. |
| `authRoutes.ts /login/demo` | Mounted but production 404 | Acceptable if tested; still should remain documented. |
| `adminDemoRoutes.ts` | Mounted under `/api/admin/demo` | Mutating demo route in production route tree; review/gate policy needed. |

## Duplicate and Broad Mount Findings

### Duplicate mounts

| Route family | Duplicate / overlapping mount |
| --- | --- |
| Dashboard | `dashboardRoutes` mounted at `/api/dashboard` twice. |
| Payments | Payment edit handlers mounted inline, `paymentsEditRouter` mounted at `/api/payments`, full `paymentsRoutes` mounted at `/api`, and a `/api/payments` fallback follows. |
| Public routes | `publicRoutes` mounted at both `/api` and `/api/public`. |
| Landlord application links | Mounted at `/api/application-links` and `/api/landlord/application-links`. |
| Onboarding | `onboardingRoutes` mounted at `/api/onboarding` and `/api`. |
| Action requests | `actionRequestsRoutes` and `actionRequestsRecomputeRoutes` both mounted at `/api/action-requests`. |
| Echo diagnostics | `POST /api/_echo` defined twice inline. |
| Applications | `applicationsRoutes` mounted at `/api`; `applicationsConversionRoutes` mounted at `/api/applications`. |

### Broad `/api` mounts

Many route families are mounted at `/api` and define their prefix internally. This is workable but increases shadow/fallthrough risk because route order becomes part of the API contract.

Broad-mounted examples:

- `paymentsRoutes.ts`
- `publicRoutes.ts`
- `viewingRoutes.ts`
- `expensesRoutes.ts`
- `financialTransactionsRoutes.ts`
- `workOrdersRoutes.ts`
- `timelineRoutes.ts`
- `insightRoutes.ts`
- `screeningReconciliationRoutes.ts`
- `landlordAnalyticsRoutes.ts`
- `landlordPortfolioScoreRoutes.ts`
- `tenantFeedbackRoutes.ts`
- `marketplaceContractorRoutes.ts`
- `tenanciesRoutes.ts`
- `unitsRoutes.ts`
- `referralsRoutes.ts`
- `tenantEventsRoutes.ts`
- `maintenanceRequestsRoutes.ts`
- `screeningOpsRoutes.ts`
- `riskAgentRoutes.ts`
- `rentalApplicationsRoutes.ts`
- `applicationsRoutes.ts`
- `authzRoutes`
- `reportsExportRoutes`
- `screeningJobsAdminRoutes.ts`
- `stubsRoutes`
- `screeningReportRoutes.ts`
- `messagesRoutes.ts`
- `telemetryRoutes.ts`

## Catchall and Fallthrough Findings

1. `/api/api` redirects to `/api`, which is useful compatibility behavior but should be documented as part of API routing.
2. `/api/payments` has a local 404 fallback after payment routes.
3. Global `/api` catchall returns `{ ok: false, code: "NOT_FOUND" }` with `x-route-source: not-found`.
4. Final `notFoundHandler` and `errorHandler` are still mounted after the API catchall.
5. Previous QA failures showed routes can fall through to unexpected route-source labels. The current route file still depends heavily on mount order.

## Route-Source Diagnostic Coverage Findings

Strong coverage:

- Most `app.use()` mounts in `app.build.ts` wrap routers with `routeSource(...)`.
- Webhooks, payments, many landlord/admin route families, and debug probes set route-source headers.

Missing or inconsistent coverage:

- Some mounted routers do not use `routeSource`, including `healthRoutes`, `tenantHistorySharePublicRouter`, `tenantInvitesRoutes`, `tenantPortalRoutes`, `propertiesRoutes`, `applicationsRoutes`, `authzRoutes`, `reportsExportRoutes`, `stubsRoutes`, `tenantOnboardRoutes`, `accountRoutes`, and `landlordMicroLiveRoutes`.
- Some routeSource names omit `.ts` while others include it.
- `/api/__routes` returns a static partial `mounted` list that does not reflect the full current app.
- Route-source middleware confirms which mounted router handled the request, but it does not prove endpoint ownership in tests.

## Production Exposure Risk Findings

| Finding | Severity | Why it matters |
| --- | --- | --- |
| Public debug/probe route set is larger than necessary | Critical | Exposes route/build metadata and creates institutional readiness concerns. |
| `/api/_echo` public POST exists twice | Critical | Echo endpoints are useful during deployment debugging but should not remain public by default. |
| Internal routes are token-gated but network-public | Critical | Cloud Run permits `allUsers`; safety depends entirely on header token enforcement. |
| Admin/demo mutating route is production-mounted | Critical | Even with guards, demo reset/seed behavior should have explicit production policy. |
| Broad `/api` mount order is the API contract | Critical | New route placement can cause shadowing or fallthrough. |
| Mixed optional-auth/global-auth decode pattern | Medium | Global `authenticateJwt` is non-blocking; routes must not assume it enforces auth. |
| Public health endpoints expose configuration state | Medium | Helpful for support, but should be deliberately public. |
| Route-source coverage inconsistent | Medium | Harder to debug future preview route mismatch. |

## Immediate Must-Fix List

Do not implement these in this inventory PR. Recommended next repairs:

1. Add a maintained or generated route ownership registry.
2. Add route ownership tests for high-risk paths:
   - `/api/ledger/imports/payment-csv/preview`
   - `/api/ledger/imports/payment-csv/confirm`
   - `/api/payments/:paymentId`
   - `/api/tenant/communication/summary` and tenant message routes
   - `/api/landlord/evidence-packs/preview`
   - `/api/internal/*`
   - `/api/__probe/*` and `/api/__debug/*`
3. Gate, remove, or explicitly document public debug/probe routes.
4. Remove or gate duplicate public `_echo` route.
5. Normalize route-source coverage and route-source naming.
6. Split or registry-control broad `/api` mounts before adding more governance routes.
7. Add an explicit production policy for `adminDemoRoutes`.
8. Document webhook validation expectations and keep raw-body route tests.

## Safe-to-Defer List

1. Full route architecture rewrite.
2. Shared authority resolver implementation.
3. Removing compatibility route aliases.
4. Consolidating all broad mounts.
5. Converting all admin routes to one guard style.
6. Replacing route-source headers with generated route registry middleware.
7. Reworking public health endpoints, as long as exposure is accepted and documented.

## Recommended Next Repair Mission

Recommended next mission:

`test/api-route-ownership-regression-v1`

Scope:

- Add route-level tests for critical endpoint ownership and fallthrough behavior.
- Assert route-source headers for high-risk routes.
- Assert debug/probe routes are intentionally reachable or intentionally gated.
- Assert webhooks remain mounted before JSON parser.
- Assert `/api/ledger/imports/payment-csv/preview` and `/confirm` cannot fall through to `screeningJobsAdminRoutes.ts`.
- Do not rewrite routing yet.

Follow-up after route tests:

`fix/production-debug-surface-hardening-v1`

Scope:

- Gate or remove unnecessary public debug/probe/echo routes.
- Keep `/api/__probe/revision` only if explicitly accepted as production-safe.
- Add documentation for any remaining public diagnostics.

## Acceptance Review

This report satisfies the audit mission by documenting:

- major mounted route families,
- public routes,
- auth-required routes,
- admin/internal routes,
- webhook routes,
- debug/probe/dev routes,
- duplicate and broad mount risks,
- catchall/fallthrough risks,
- route-source diagnostic coverage,
- production exposure risks,
- immediate must-fix list,
- safe-to-defer list,
- next repair mission.

No product behavior changed.

## Verification

Docs-only change. Recommended command:

- `git diff --check`
