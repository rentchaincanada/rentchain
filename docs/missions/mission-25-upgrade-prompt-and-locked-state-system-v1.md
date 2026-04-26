# Mission

MISSION: Upgrade Prompt and Locked-State System v1

# Branch

BRANCH:
feat/upgrade-prompt-and-locked-state-system-v1

# Base

BASE:
Start from latest `origin/main` only after Mission 24 (`Subscription / Tier System v2`) is merged and the canonical plan semantics documented there are present on base.

# Objective

OBJECTIVE:
Standardize RentChain’s upgrade prompt and locked-state behavior so landlord-facing gated surfaces use one consistent upgrade UX system, one required-plan messaging pattern, and one plan-aware routing approach across frontend and backend-compatible flows.

# Why This Matters

Mission 24 normalizes plan semantics and entitlement foundations. The next risk is fragmented upgrade UX:
- multiple pages manually trigger upgrade prompts
- locked states can drift in wording, required plan, or CTA behavior
- users may receive inconsistent nudges for the same entitlement boundary

This mission should consolidate and standardize that experience without rebuilding the existing upgrade infrastructure.

# Strict Requirements

- Reuse the current upgrade prompt / nudge infrastructure.
- Do not create a second locked-state system.
- Do not create page-local plan logic where shared helper logic should be used.
- Keep changes additive and incremental.
- Preserve current pricing and billing route behavior.
- Preserve current role boundaries and auth semantics.
- Prefer soft-gating and clear upgrade messaging over destructive blocking unless an existing route already requires hard enforcement.

# Non-Goals

- Do not redesign billing architecture.
- Do not redefine canonical plans established by Mission 24.
- Do not introduce a new modal framework.
- Do not perform broad visual redesign unrelated to locked-state or upgrade UX consistency.

# Primary Files / File Families To Inspect First

- `rentchain-frontend/src/lib/upgradePrompt.ts`
- `rentchain-frontend/src/context/UpgradeContext.tsx`
- `rentchain-frontend/src/features/upgradeNudges/UpgradeNudgeHost.tsx`
- `rentchain-frontend/src/billing/openUpgradeFlow.ts`
- `rentchain-frontend/src/lib/entitlements.ts`
- `rentchain-frontend/src/hooks/useEntitlements.ts`
- `rentchain-frontend/src/billing/requireTier.ts`
- `rentchain-frontend/src/pages/PricingPage.tsx`
- `rentchain-frontend/src/pages/BillingPage.tsx`

Representative prompt triggers:
- `rentchain-frontend/src/pages/ApplicationsPage.tsx`
- `rentchain-frontend/src/pages/landlord/InvitesPage.tsx`
- `rentchain-frontend/src/components/tenants/InviteTenantModal.tsx`
- `rentchain-frontend/src/components/properties/PropertyDetailPanel.tsx`
- `rentchain-frontend/src/pages/landlord/WorkOrdersPage.tsx`
- `rentchain-frontend/src/pages/ApplicationReviewSummaryPage.tsx`

# Pre-Implementation Audit

Before coding, inspect and summarize:
1. current reusable upgrade prompt entry points
2. current required-plan message patterns
3. current CTA destinations (`/pricing`, `/billing`, modal flows, route flows)
4. duplicated page-local locked-state logic
5. any prompt payload shapes or event contracts that already serve as the canonical upgrade UX pathway

Required implementation rule:
- extend and normalize the current infrastructure
- do not replace it blindly
- do not add a second prompt event system

# Implementation Tasks

1. audit and summarize existing prompt / locked-state behavior before coding
2. define one canonical upgrade prompt message pattern for touched surfaces
3. define one canonical required-plan label strategy for touched surfaces
4. normalize selected landlord-facing locked states to shared helper usage
5. ensure prompt CTA behavior routes consistently to pricing/billing flows as intended
6. reduce duplicated page-local upgrade wording where safe
7. update tests for touched prompt and locked-state behavior

# API Surfaces

Primary frontend mission. Backend changes are only allowed if needed to preserve or clarify compatible upgrade payload semantics already in use.

# Frontend Integration Targets

Primary:
- upgrade prompt host and context
- required-plan helpers
- pricing / billing navigation entry points

Representative page targets:
- applications
- invites
- work orders
- property detail
- review summary
- any touched gated landlord-facing surfaces

# Tests Required

Frontend:
- upgrade prompt rendering tests
- locked-state rendering tests
- required-plan helper tests if touched
- CTA routing / action tests where relevant

Backend:
- only if a backend upgrade payload or compatibility response is touched

# Manual QA

1. verify touched locked states use consistent wording
2. verify required-plan labels match canonical Mission 24 semantics
3. verify upgrade CTA paths are consistent
4. verify prompts still appear in the correct contexts without blocking baseline workflows unexpectedly

# Acceptance Criteria

- one consistent upgrade prompt / locked-state pattern exists across touched surfaces
- no second locked-state system is introduced
- required-plan messaging is more consistent after the mission
- upgrade CTAs route consistently
- touched tests pass
- no billing or entitlement regression is introduced

# Deliverable Summary

- upgrade prompt normalization across touched surfaces
- locked-state consistency improvements
- required-plan message normalization
- tests for touched prompt flows

# Commit

COMMIT:
feat: add upgrade prompt and locked-state system v1
