# Mission

MISSION: Billing Status and Access Reliability v1

# Branch

BRANCH:
feat/billing-status-and-access-reliability-v1

# Base

BASE:
Start from latest `origin/main` only after Mission 24 is merged.

# Objective

OBJECTIVE:
Harden RentChain’s subscription-status, access-resolution, and billing-state reliability so plan access, upgrade state, and billing-driven entitlement behavior remain consistent across backend and frontend after tier normalization.

# Why This Matters

Mission 24 normalizes plan semantics, but monetization reliability depends on billing state resolving correctly:
- current plan should display accurately
- access should remain consistent after billing changes
- route protection and upgrade UX should not drift due to stale or ambiguous subscription state

This mission should focus on access reliability, not on redesigning billing architecture.

# Strict Requirements

- Reuse the canonical plan model from Mission 24.
- Keep changes additive and reliability-focused.
- Do not redesign Stripe architecture.
- Do not create parallel subscription-state logic.
- Preserve current pricing, checkout, and screening monetization behavior.
- Prefer normalization and hardening of existing status/access pathways over new layers.

# Non-Goals

- Do not build new billing products.
- Do not redesign checkout UX.
- Do not introduce annual/monthly checkout architecture changes.
- Do not rewrite admin billing operations unrelated to access reliability.

# Primary Files / File Families To Inspect First

Backend:
- `rentchain-api/src/config/planMatrix.ts`
- `rentchain-api/src/routes/billingRoutes.ts`
- `/api/me` source in `rentchain-api/src/app.build.ts`
- capability and entitlement helpers touched by plan resolution
- billing/subscription-status routes if already present

Frontend:
- `rentchain-frontend/src/api/meApi.ts`
- `rentchain-frontend/src/hooks/useCapabilities.ts`
- `rentchain-frontend/src/hooks/useEntitlements.ts`
- billing page and any subscription-status display surfaces
- upgrade CTA / current plan display surfaces

# Pre-Implementation Audit

Before coding, inspect and summarize:
1. how current plan is resolved and surfaced backend-to-frontend
2. how billing/subscription status influences entitlements today
3. where stale or duplicated access resolution could occur
4. any touched route or UI surfaces that depend on billing state being current

Required implementation rule:
- strengthen existing status/access pathways
- do not add a second subscription-status source of truth

# Implementation Tasks

1. audit current billing-status and access-resolution flow
2. identify ambiguous or duplicated access-state logic in touched areas
3. normalize touched plan/access resolution paths
4. improve current plan display and access consistency where needed
5. preserve upgrade prompt behavior and screening compatibility
6. update tests for touched billing/access reliability behavior

# API Surfaces

- `/api/me`
- `/api/capabilities`
- `/api/billing/pricing`
- billing/subscription-status routes if touched

# Frontend Integration Targets

- billing page
- current plan display surfaces
- plan-aware access resolution hooks
- touched upgrade CTA entry points that depend on current plan status

# Tests Required

Backend:
- touched status/access resolution tests
- touched billing route tests
- plan normalization compatibility tests if touched

Frontend:
- current plan display tests
- entitlement/access reliability tests
- billing page rendering tests if touched

# Manual QA

1. verify current plan display is accurate in touched surfaces
2. verify access remains consistent after expected billing-state scenarios
3. verify upgrade prompts do not misfire due to stale plan assumptions
4. verify screening monetization behavior remains compatible

# Acceptance Criteria

- touched billing/access paths are more reliable after the mission
- no second subscription-state logic layer is introduced
- current plan display and access behavior are internally consistent
- touched tests pass
- no billing or screening regression is introduced

# Deliverable Summary

- billing/access reliability improvements
- normalized touched plan-status pathways
- current plan display consistency improvements
- tests for touched reliability behavior

# Commit

COMMIT:
feat: add billing status and access reliability v1
