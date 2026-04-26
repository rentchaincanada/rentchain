# Subscription Tier System v2 Audit

## Purpose

This document identifies the current source-of-truth files and extension points that Mission 24 must inspect before implementing Subscription / Tier System v2. It exists to reduce ambiguity, prevent duplicate systems, and force normalization of current plan/capability/pricing semantics instead of adding a second stack.

## Executive Summary

The repository already contains multiple plan and entitlement layers:

- backend billing price config
- backend canonical capability accumulation
- backend legacy entitlement middleware
- frontend canonical pricing matrix
- frontend cached/default capability assumptions
- frontend upgrade prompt and nudge infrastructure

The main implementation risk for Mission 24 is not missing infrastructure. It is parallel system drift:

- multiple plan aliases normalize differently in different files
- plan labels are derived in more than one place
- pricing truth lives in both backend pricing responses and frontend display config
- upgrade behavior is centralized, but many pages manually trigger it

Mission 24 should extend and normalize these current files. It should not create a new subscription config layer beside them.

## Current Source-of-Truth Files

### 1. Plan matrix / billing price config

Primary backend source:
- `rentchain-api/src/config/planMatrix.ts`

What it currently owns:
- billable plan keys for recurring subscription checkout:
  - `starter`
  - `pro`
  - `elite`
- display labels
- monthly/yearly amount cents
- Stripe price-id resolution and environment fallback logic

Why it matters:
- `/api/billing/pricing` reads from this file
- checkout route price resolution depends on it

Important caveat:
- this file does not include `free` in the matrix even though many other layers reason about `free`

### 2. Canonical backend plan-to-capability accumulation

Primary backend source:
- `rentchain-api/src/services/entitlements/planCapabilities.ts`

What it currently owns:
- canonical backend plan order:
  - `free`
  - `starter`
  - `pro`
  - `elite`
- accumulated capabilities by plan tier
- canonical plan normalization for aliases:
  - `screening -> free`
  - `core -> starter`
  - `business/enterprise -> elite`

Why it matters:
- `rentchain-api/src/config/capabilities.ts` is derived from it
- it is the cleanest current backend source for canonical plan progression

### 3. Backend capabilities response shaping

Primary backend source:
- `rentchain-api/src/config/capabilities.ts`
- `rentchain-api/src/routes/capabilitiesRoutes.ts`

What they currently own:
- `/api/capabilities` response shape
- feature derivation sent to the frontend
- admin override behavior

Why they matter:
- frontend `useCapabilities()` depends on this route shape
- frontend entitlement assumptions are built on its feature names

Important caveat:
- `capabilitiesRoutes.ts` adds compatibility booleans and synthetic keys on top of `CAPABILITIES`
- some frontend assumptions are satisfied here rather than in a single shared schema

### 4. Legacy entitlement / capability middleware

Relevant backend files:
- `rentchain-api/src/entitlements/plans.ts`
- `rentchain-api/src/entitlements/entitlements.middleware.ts`
- `rentchain-api/src/entitlements/planResolver.middleware.ts`
- `rentchain-api/src/middleware/entitlements.ts`

What they currently own:
- legacy capability checks
- alternate plan normalization
- upgrade-required API responses for some guarded routes

Why they matter:
- these are existing live guardrails
- Mission 24 must not unknowingly fork them with a new entitlement stack

Important caveats:
- `entitlements/plans.ts` includes plan values not present in `planMatrix.ts`, including:
  - `screening`
  - `core`
- `resolvePlan()` there collapses `starter/core -> starter`, `business/enterprise/elite -> elite`, and `free/screening -> free`
- this means plan naming is already partially normalized, but not from one single file

### 5. `/api/me`

Current route sources:
- `rentchain-api/src/app.build.ts` for `/api/me`
- `rentchain-api/src/routes/authMeRoutes.ts` for `/api/auth/me`

Frontend consumer:
- `rentchain-frontend/src/api/meApi.ts`

Why it matters:
- frontend user plan and role assumptions are still influenced by `/api/me`
- Mission 24 must preserve or deliberately normalize this shape, not silently diverge from it

Important caveat:
- the active `/api/me` implementation is mounted directly in `app.build.ts`, not only in a dedicated route file

### 6. `/api/billing/pricing`

Primary backend source:
- `rentchain-api/src/routes/billingRoutes.ts`

What it currently owns:
- response shape for subscription plan pricing
- screening monetization summary block
- registry pricing/capability summary block

Why it matters:
- frontend pricing and billing pages read this route
- Mission 24 should extend this route shape carefully if needed rather than creating a parallel pricing endpoint

Important caveat:
- route pricing plans are based on backend `planMatrix.ts`
- frontend page copy and tier summaries are separately defined in frontend `pricingPlans.ts`

### 7. Frontend pricing / billing display matrix

Primary frontend source:
- `rentchain-frontend/src/constants/pricingPlans.ts`

Related helpers:
- `rentchain-frontend/src/billing/planVisibility.ts`
- `rentchain-frontend/src/billing/planLabel.ts`
- `rentchain-frontend/src/billing/requireTier.ts`

What they currently own:
- in-app pricing card structure
- capability summaries by area
- current display labels and CTA copy
- visible paid plans
- frontend-only plan/tier normalization helpers

Why they matter:
- `/pricing` and `/billing` depend on them
- if Mission 24 changes plan semantics, this file family is a primary extension point

Important caveats:
- this is effectively a second canonical layer for display semantics
- several helpers normalize plan names independently

### 8. Frontend capability / entitlement consumption

Primary frontend files:
- `rentchain-frontend/src/lib/entitlements.ts`
- `rentchain-frontend/src/hooks/useCapabilities.ts`
- `rentchain-frontend/src/hooks/useEntitlements.ts`

What they currently own:
- cached/default `/api/capabilities` response assumptions
- derived frontend entitlements and convenience booleans
- required-plan helper usage for upgrade prompts

Why they matter:
- many gated landlord features use `useEntitlements()`
- Mission 24 must preserve and normalize these semantics rather than bypassing them

Important caveat:
- `DEFAULT_CAPABILITIES` includes compatibility keys and assumptions that may not map one-to-one to backend canonical names

### 9. Upgrade prompt / locked-state infrastructure

Primary frontend files:
- `rentchain-frontend/src/lib/upgradePrompt.ts`
- `rentchain-frontend/src/context/UpgradeContext.tsx`
- `rentchain-frontend/src/features/upgradeNudges/UpgradeNudgeHost.tsx`
- `rentchain-frontend/src/billing/openUpgradeFlow.ts`

Representative page/component triggers:
- `rentchain-frontend/src/pages/ApplicationsPage.tsx`
- `rentchain-frontend/src/pages/landlord/InvitesPage.tsx`
- `rentchain-frontend/src/components/tenants/InviteTenantModal.tsx`
- `rentchain-frontend/src/components/properties/PropertyDetailPanel.tsx`
- `rentchain-frontend/src/pages/landlord/WorkOrdersPage.tsx`
- `rentchain-frontend/src/pages/ApplicationReviewSummaryPage.tsx`

Why they matter:
- upgrade prompting is already centralized around event dispatch and modal/nudge handling
- Mission 24 should reuse this infrastructure rather than inventing a new upgrade UX layer

## Current Naming Drift and Duplication Risks

### Plan aliases are normalized in multiple places

Observed aliases across files:
- `screening`
- `core`
- `business`
- `enterprise`

Current risk:
- backend and frontend could continue accepting aliases without sharing one canonical normalization source

### There is no single universal plan source today

Current split:
- pricing amounts: backend `planMatrix.ts`
- canonical capability progression: backend `planCapabilities.ts`
- display matrix and plan marketing copy: frontend `pricingPlans.ts`
- legacy entitlement checks: backend `entitlements/plans.ts`

Current risk:
- Mission 24 could accidentally add a fourth or fifth plan-definition layer instead of consolidating by extension

### `/api/capabilities` is both canonical and compatibility-oriented

Current risk:
- adding new capability semantics without auditing its compatibility booleans could break frontend gating silently

### Upgrade-required semantics are partially standardized, partially ad hoc

Current patterns:
- backend returns `upgrade_required` or limit errors with `upgradePath`
- frontend central prompt logic parses those payloads
- several pages also dispatch upgrade prompts directly

Current risk:
- Mission 24 could widen prompt duplication instead of standardizing existing patterns

## Recommended Extension Points For Mission 24

If Mission 24 proceeds, start here first:

1. Backend canonical plan/capability normalization:
   - `rentchain-api/src/services/entitlements/planCapabilities.ts`
   - `rentchain-api/src/config/capabilities.ts`
2. Backend subscription pricing/config:
   - `rentchain-api/src/config/planMatrix.ts`
   - `rentchain-api/src/routes/billingRoutes.ts`
3. Frontend canonical plan presentation:
   - `rentchain-frontend/src/constants/pricingPlans.ts`
   - `rentchain-frontend/src/pages/PricingPage.tsx`
   - `rentchain-frontend/src/pages/BillingPage.tsx`
4. Frontend entitlement/gating:
   - `rentchain-frontend/src/lib/entitlements.ts`
   - `rentchain-frontend/src/hooks/useCapabilities.ts`
   - `rentchain-frontend/src/hooks/useEntitlements.ts`
5. Upgrade prompting:
   - `rentchain-frontend/src/lib/upgradePrompt.ts`
   - `rentchain-frontend/src/context/UpgradeContext.tsx`
   - `rentchain-frontend/src/features/upgradeNudges/UpgradeNudgeHost.tsx`

## Required Pre-Implementation Audit Checklist For Mission 24

Before coding Subscription / Tier System v2, the operator must summarize:

- current canonical plan keys
- current aliases that still resolve into canonical plans
- plan labels used in pricing and billing UI
- `/api/capabilities` response keys and compatibility booleans
- `/api/billing/pricing` response shape
- `/api/me` plan semantics
- existing pages/components that surface upgrade prompts or locked states

Implementation rule:
- extend the current source-of-truth files above
- do not create parallel naming or shadow config
- do not create a new subscription schema unless the current one is proven unusable and the migration path is explicit
