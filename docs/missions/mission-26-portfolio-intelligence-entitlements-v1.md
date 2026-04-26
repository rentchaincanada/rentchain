# Mission

MISSION: Portfolio Intelligence Entitlements v1

# Branch

BRANCH:
feat/portfolio-intelligence-entitlements-v1

# Base

BASE:
Start from latest `origin/main` only after Mission 24 and Mission 25 are merged.

# Objective

OBJECTIVE:
Apply canonical, plan-aware entitlement behavior to RentChain’s portfolio intelligence surfaces so advanced intelligence value is clearly packaged, consistently gated, and upgrade-aware without breaking baseline landlord workflows.

# Why This Matters

After Subscription / Tier System v2 and upgrade UX normalization, RentChain should expose a clean value ladder for intelligence:
- baseline portfolio visibility for lower tiers
- stronger operational intelligence for higher tiers
- clear teaser/locked states for upgrade conversion

This mission should turn portfolio intelligence into a disciplined monetization surface without creating duplicate gating logic.

# Strict Requirements

- Reuse canonical plan semantics from Mission 24.
- Reuse upgrade prompt / locked-state patterns from Mission 25.
- Do not create page-local plan naming drift.
- Preserve baseline landlord workflows.
- Keep changes additive and deterministic.
- Prefer capability-driven gating over scattered direct plan checks.

# Non-Goals

- Do not redesign the underlying portfolio score model.
- Do not rebuild recommendations or trend engines from scratch.
- Do not change unrelated dashboard or reporting behavior.
- Do not create a second intelligence capability system.

# Primary Files / File Families To Inspect First

Backend / capabilities:
- `rentchain-api/src/services/entitlements/planCapabilities.ts`
- `rentchain-api/src/config/capabilities.ts`
- `rentchain-api/src/routes/capabilitiesRoutes.ts`

Frontend entitlement / upgrade helpers:
- `rentchain-frontend/src/lib/entitlements.ts`
- `rentchain-frontend/src/hooks/useCapabilities.ts`
- `rentchain-frontend/src/hooks/useEntitlements.ts`
- `rentchain-frontend/src/lib/upgradePrompt.ts`

Representative intelligence surfaces:
- `rentchain-frontend/src/pages/landlord/PortfolioScorePage.tsx`
- `rentchain-frontend/src/pages/landlord/ActionRecommendationsPage.tsx`
- portfolio health summary surfaces
- score trend/history surfaces if present
- related landlord dashboard intelligence cards if present

# Pre-Implementation Audit

Before coding, inspect and summarize:
1. which intelligence surfaces already exist
2. what capability keys currently drive them
3. which pages already use upgrade prompts or partial teaser states
4. what the intended tier ladder should be across touched intelligence features

Required implementation rule:
- normalize touched intelligence surfaces around canonical capabilities
- do not bypass shared entitlement helpers with ad hoc plan checks

# Implementation Tasks

1. audit touched intelligence pages and current capability usage
2. identify canonical capability boundaries for baseline vs advanced intelligence
3. apply consistent locked / teaser / unlocked behavior to touched surfaces
4. wire touched surfaces to shared entitlement and upgrade helpers
5. ensure higher-tier value is visible without destructively blocking baseline users
6. update tests for touched intelligence pages and helpers

# API Surfaces

- `/api/capabilities`
- `/api/me` only if required for compatibility or display semantics already in use

# Frontend Integration Targets

Primary:
- portfolio score page
- action recommendations page
- portfolio health summary surfaces
- relevant dashboard intelligence cards

# Tests Required

Frontend:
- intelligence page locked-state tests
- upgrade prompt tests for touched surfaces
- entitlement behavior tests for touched helpers

Backend:
- only if capability semantics are changed for touched intelligence features

# Manual QA

1. free/starter accounts should retain baseline visibility as intended
2. pro/elite accounts should unlock intended advanced intelligence value
3. teaser or locked states should clearly communicate upgrade value
4. touched pages should remain internally consistent with `/api/capabilities`

# Acceptance Criteria

- touched intelligence surfaces follow canonical entitlement semantics
- locked/teaser states are consistent and upgrade-aware
- no duplicate intelligence gating system is introduced
- touched tests pass
- no baseline workflow regression is introduced

# Deliverable Summary

- portfolio intelligence gating normalization
- consistent teaser / locked-state behavior
- shared entitlement helper usage across touched intelligence surfaces
- tests for touched intelligence flows

# Commit

COMMIT:
feat: add portfolio intelligence entitlements v1
