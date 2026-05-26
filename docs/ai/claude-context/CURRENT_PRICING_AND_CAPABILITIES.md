# Current Pricing and Capabilities

## Canonical Sources Audited

Backend:

- `rentchain-api/src/services/entitlements/planCapabilities.ts`
- `rentchain-api/src/config/capabilities.ts`
- `rentchain-api/src/config/planMatrix.ts`

Frontend:

- `rentchain-frontend/src/constants/pricingPlans.ts`
- `rentchain-frontend/src/lib/entitlements.ts`

No duplicate historical versions of these exact source files were found. `rentchain-api/src/middleware/entitlements.ts` is a middleware file, not a duplicate of the canonical frontend entitlement library.

## Plans and Prices

Confirmed from current code:

- Free: `$0`
- Starter: `$29/month`, `$290/year`
- Pro: `$49/month`, `$490/year`
- Elite: `$79/month`, `$790/year`

Backend billing amounts are represented in cents:

- Starter: `2900` monthly, `29000` yearly
- Pro: `4900` monthly, `49000` yearly
- Elite: `7900` monthly, `79000` yearly

## Legacy Plan Mapping

Confirmed in backend plan normalization:

- `business` maps to `elite`
- `enterprise` maps to `elite`
- `core` maps to `starter`
- `screening` maps to `free`

Do not introduce a separate Business tier unless the backend canonical mapping changes.

## Capability Model

Backend source of truth is `planCapabilities.ts`.

Current cumulative plan order:

1. `free`
2. `starter`
3. `pro`
4. `elite`

Each higher tier includes lower-tier capabilities. Unknown plans resolve to `free`.

Examples by tier:

- Free: properties, units, manual tenants/applications, screening/pay-per-use screening history, portfolio health summary.
- Starter: tenant invites, applications, messaging, ledger, leases, maintenance, notices, tenant portal, move-in readiness, work orders.
- Pro: verified ledger, basic exports, PDF export, review summaries, compliance reports, marketplace directory, portfolio dashboard/score, team invites, registry filing/history.
- Elite: AI summaries, advanced exports, audit logs, marketplace contractor assignment, portfolio analytics, portfolio action recommendations.

## Frontend Consumption Pattern

The frontend consumes capabilities from `/capabilities` and caches them through `rentchain-frontend/src/lib/entitlements.ts`. UI pricing copy uses `pricingPlans.ts`, which comments that it mirrors backend billing prices and entitlement gating.

Frontend should not hardcode inconsistent pricing or capability logic. New capability gates should be added backend-first and consumed through the frontend entitlement path.

## Guardrail

When Claude recommends pricing, capability, or entitlement changes, it must first ask for an audit of the backend canonical files and relevant frontend consumers. Do not infer commercial truth from stale docs or marketing copy.
