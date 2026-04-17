# Mission

MISSION: Marketplace Premium Access Controls v1

# Branch

BRANCH:
feat/marketplace-premium-access-controls-v1

# Base

BASE:
Start from latest `origin/main` only after Mission 24 and Mission 25 are merged, and after any marketplace-layer-v1 dependencies are present on base.

# Objective

OBJECTIVE:
Apply canonical subscription-aware access controls, visibility rules, and upgrade handling to RentChain’s marketplace / contractor workflow surfaces so premium marketplace value can be packaged cleanly without breaking baseline marketplace behavior.

# Why This Matters

Marketplace value is one of the clearest premium subscription surfaces. After canonical plan normalization and upgrade UX normalization, marketplace access should become plan-aware in a disciplined way:
- baseline access where intended
- premium visibility or workflow advantages for higher tiers
- consistent upgrade messaging for gated marketplace features

# Strict Requirements

- Reuse canonical plan semantics from Mission 24.
- Reuse upgrade prompt infrastructure from Mission 25.
- Keep marketplace access semantics additive.
- Preserve baseline marketplace or contractor directory behavior where already intended.
- Do not invent a second marketplace access-control system.
- Do not widen public or contractor-facing permissions.

# Non-Goals

- Do not redesign the marketplace data model from scratch.
- Do not change contractor-side auth boundaries.
- Do not rebuild ranking or recommendation systems unrelated to access control.
- Do not perform unrelated marketplace UI redesign.

# Primary Files / File Families To Inspect First

Backend / capabilities / routing:
- `rentchain-api/src/services/entitlements/planCapabilities.ts`
- `rentchain-api/src/config/capabilities.ts`
- marketplace-related routes and service files already introduced by marketplace-layer-v1

Frontend entitlement / upgrade helpers:
- `rentchain-frontend/src/lib/entitlements.ts`
- `rentchain-frontend/src/hooks/useCapabilities.ts`
- `rentchain-frontend/src/hooks/useEntitlements.ts`
- `rentchain-frontend/src/lib/upgradePrompt.ts`

Representative marketplace surfaces:
- contractor directory pages
- marketplace landlord workflow pages
- premium placement / premium workflow surfaces if already present
- any touched marketplace cards, filters, or CTA surfaces

# Pre-Implementation Audit

Before coding, inspect and summarize:
1. what marketplace surfaces currently exist
2. which capabilities or plan checks currently influence them
3. what should remain baseline vs premium in touched areas
4. which upgrade flows already exist or should be reused

Required implementation rule:
- normalize touched marketplace gating around canonical capabilities
- preserve existing working marketplace flows unless explicitly changing them

# Implementation Tasks

1. audit current marketplace access and entitlement semantics
2. define touched baseline vs premium marketplace surfaces
3. wire touched surfaces to canonical capability and upgrade helpers
4. apply clear locked/teaser states where premium access is introduced or normalized
5. preserve contractor and landlord auth boundaries
6. update tests for touched marketplace routes/pages/helpers

# API Surfaces

- marketplace-related capability / access surfaces already in repo
- `/api/capabilities` if touched
- relevant marketplace routes if access control behavior is normalized

# Frontend Integration Targets

- contractor directory / marketplace pages
- premium marketplace workflow surfaces
- touched marketplace upgrade prompts
- landlord-facing marketplace cards or entry points

# Tests Required

Frontend:
- marketplace locked-state / teaser tests
- upgrade prompt tests for touched marketplace flows

Backend:
- selected marketplace access-control tests if touched
- capability derivation tests if touched

# Manual QA

1. baseline marketplace flows still work where intended
2. premium marketplace areas clearly communicate upgrade value
3. touched marketplace surfaces use consistent plan naming and upgrade messaging
4. no contractor auth or visibility regressions are introduced

# Acceptance Criteria

- touched marketplace surfaces follow canonical entitlement semantics
- premium access controls are clear and additive
- no second marketplace gating system is introduced
- touched tests pass
- no auth boundary regression is introduced

# Deliverable Summary

- marketplace premium access normalization
- clear locked/teaser behavior for touched marketplace surfaces
- shared entitlement / upgrade helper usage
- tests for touched marketplace behavior

# Commit

COMMIT:
feat: add marketplace premium access controls v1
