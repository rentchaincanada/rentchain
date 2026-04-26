# Mission

MISSION: Subscription / Tier System v2

# Branch

BRANCH:
feat/subscription-tier-system-v2

# Base

BASE:
Start from latest `origin/main` only after confirming that the current plan, entitlement, capability, pricing, and upgrade-prompt source-of-truth files documented in `docs/execution/subscription-tier-system-v2-audit.md` are present on that base.

# Objective

OBJECTIVE:
Unify and extend RentChain's subscription / tier system by normalizing plan semantics, entitlement resolution, pricing responses, and upgrade surfaces around one canonical subscription model across backend and frontend, without breaking existing billing, gating, or upgrade flows.

# Why This Matters

Subscription / Tier System v2 is strategically broad. The repo already has multiple plan and capability layers with overlapping naming and normalization rules. This mission must extend and normalize the current system rather than introducing a second plan stack, otherwise the billing, entitlement, and upgrade surfaces will drift further apart and create avoidable regression risk.

# Strict Requirements

- Inspect the current system first. Do not start implementation before completing the required pre-implementation audit.
- Keep changes additive and incremental where possible.
- Do not create a second plan system.
- Do not create parallel entitlement semantics.
- Do not create alternate plan naming across frontend and backend.
- Use one canonical set of plan keys and labels everywhere touched by the mission.
- Prefer extension of existing source-of-truth files over introducing shadow config.
- Do not redesign Stripe billing architecture unless the mission explicitly requires a targeted extension.
- Do not break `/api/me`, `/api/capabilities`, `/api/billing/pricing`, pricing pages, billing pages, or existing upgrade prompt behavior during normalization.
- Preserve current auth and landlord scope semantics.

# Non-Goals

- Do not rebuild billing from scratch.
- Do not replace working pricing or entitlement routes with parallel versions.
- Do not ship unrelated monetization refactors outside the subscription/tier scope.
- Do not widen public access or change role boundaries.

# Primary Files / File Families To Inspect First

- `rentchain-api/src/config/planMatrix.ts`
- `rentchain-api/src/services/entitlements/planCapabilities.ts`
- `rentchain-api/src/config/capabilities.ts`
- `rentchain-api/src/entitlements/plans.ts`
- `rentchain-api/src/routes/capabilitiesRoutes.ts`
- `rentchain-api/src/routes/billingRoutes.ts`
- `rentchain-api/src/app.build.ts` (`/api/me`)
- `rentchain-frontend/src/constants/pricingPlans.ts`
- `rentchain-frontend/src/lib/entitlements.ts`
- `rentchain-frontend/src/hooks/useCapabilities.ts`
- `rentchain-frontend/src/hooks/useEntitlements.ts`
- `rentchain-frontend/src/lib/upgradePrompt.ts`
- `rentchain-frontend/src/context/UpgradeContext.tsx`
- `rentchain-frontend/src/features/upgradeNudges/UpgradeNudgeHost.tsx`
- `rentchain-frontend/src/pages/PricingPage.tsx`
- `rentchain-frontend/src/pages/BillingPage.tsx`
- `rentchain-frontend/src/components/billing/BillingPlansPanel.tsx`

# Pre-Implementation Audit

Before implementing Subscription / Tier System v2, inspect and summarize the current:

1. Plan keys and aliases:
   - canonical keys in backend and frontend
   - legacy aliases still normalized (`screening`, `core`, `business`, `enterprise`)
2. Plan labels:
   - current display labels used in billing and pricing surfaces
3. Entitlement helpers:
   - backend plan resolution
   - capability derivation
   - frontend entitlement resolution and required-plan helpers
4. Capability flags:
   - canonical backend capability generation
   - frontend cached/default capability assumptions
5. Pricing API response shapes:
   - `/api/billing/pricing`
   - any pricing helpers used by `/pricing` and `/billing`
6. Pages and components already showing upgrade prompts or locked states:
   - reusable prompt infrastructure
   - page-specific prompt triggers

Required implementation rule:
- Extend and normalize the existing patterns you find.
- Do not replace them blindly.
- Do not create shadow config, alternate response shapes, or duplicate plan-label systems to “simplify” the mission.

# Implementation Tasks

1. Complete the pre-implementation audit and summarize findings in the implementation notes before coding.
2. Choose one canonical set of plan keys, labels, and response semantics by extending the existing source-of-truth files already in the repo.
3. Normalize backend plan, capability, entitlement, and pricing semantics around those canonical keys.
4. Normalize frontend pricing, billing, entitlement, and upgrade prompt usage around the same canonical keys and labels.
5. Remove or reduce parallel naming drift only when it can be done safely without changing unrelated product behavior.
6. Update tests for any normalized plan/capability/pricing behavior.

# API Surfaces

- `/api/me`
- `/api/capabilities`
- `/api/billing/pricing`
- billing checkout / subscription-status routes if touched

All route changes must preserve backward-compatible semantics unless the mission explicitly redefines them.

# Frontend Integration Targets

- `/pricing`
- `/billing`
- `BillingPlansPanel`
- upgrade prompt / nudge infrastructure
- landlord-facing gated pages that rely on `useEntitlements` or capability flags

# Tests Required

Backend:
- tests covering plan normalization, capability derivation, and pricing route shape for any touched code

Frontend:
- tests covering pricing/billing rendering, entitlement resolution, and upgrade prompt behavior for any touched code

Verification:
- run relevant backend tests/build if backend files change
- run relevant frontend tests/build if frontend files change
- confirm that no duplicate plan system was introduced

# Manual QA

1. Verify `/pricing` and `/billing` show consistent plan names, labels, and prices.
2. Verify `/api/me`, `/api/capabilities`, and `/api/billing/pricing` remain internally consistent.
3. Verify existing upgrade prompts still route to the correct pricing or billing surfaces.
4. Verify gated landlord features still show the correct locked/unlocked behavior after normalization.

# Acceptance Criteria

- Subscription / Tier System v2 starts from documented existing source-of-truth files.
- The mission contains explicit audit instructions before coding.
- Parallel naming / parallel system guardrails are documented.
- The mission is self-contained and directly executable in a future Codex run.

# Deliverable Summary

- normalized subscription/tier execution plan based on existing repo truth
- no parallel plan or entitlement system
- consistent backend/frontend plan semantics

# Commit

COMMIT:
feat: implement subscription tier system v2
