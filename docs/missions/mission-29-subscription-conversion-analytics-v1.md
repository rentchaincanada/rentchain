# Mission

MISSION: Subscription Conversion Analytics v1

# Branch

BRANCH:
feat/subscription-conversion-analytics-v1

# Base

BASE:
Start from latest `origin/main` only after Mission 24, Mission 25, and Mission 28 are merged.

# Objective

OBJECTIVE:
Add subscription conversion analytics for RentChain’s pricing, upgrade prompt, and billing entry surfaces so the team can measure engagement, upgrade intent, and conversion flow performance across the normalized subscription system.

# Why This Matters

Once plan semantics, upgrade UX, and billing reliability are in place, RentChain needs visibility into what actually converts:
- pricing page engagement
- locked-state CTA engagement
- upgrade prompt interactions
- billing surface upgrade intent
- conversion pathway drop-offs

This mission should add analytics instrumentation in a disciplined way without bloating product logic.

# Strict Requirements

- Keep analytics additive and lightweight.
- Do not block user flows on analytics delivery.
- Reuse existing event/logging conventions where present.
- Do not embed sensitive billing data in client events.
- Preserve current auth and privacy expectations.
- Do not create a second analytics framework if one already exists.

# Non-Goals

- Do not build a full analytics warehouse.
- Do not redesign pricing or billing UX.
- Do not add heavy dashboarding unless a minimal internal summary already exists and can be extended safely.
- Do not log raw payment or sensitive personal data.

# Primary Files / File Families To Inspect First

Frontend:
- pricing page
- billing page
- upgrade prompt / nudge infrastructure
- locked-state CTA surfaces introduced or normalized by Mission 25
- any existing analytics helper or event utility already in repo

Backend:
- any existing analytics/event logging routes or telemetry helpers
- structured logging/event conventions already used by the app

# Pre-Implementation Audit

Before coding, inspect and summarize:
1. existing analytics/event patterns in frontend and backend
2. pricing / billing / upgrade prompt entry points worth instrumenting
3. any current event naming conventions
4. safe event payload boundaries to avoid sensitive data leakage

Required implementation rule:
- extend existing telemetry/event patterns if present
- do not add a parallel analytics stack for this mission

# Implementation Tasks

1. audit current analytics/event instrumentation patterns
2. define canonical subscription-conversion event names for touched flows
3. instrument selected pricing, billing, and upgrade-prompt interactions
4. preserve privacy boundaries and avoid sensitive payloads
5. optionally add lightweight internal logging or event sink integration if a compatible pattern already exists
6. update tests for touched analytics helpers/components where relevant

# API Surfaces

Only if existing analytics/event routes or logging helpers are extended. Frontend-only instrumentation is preferred unless backend support is already standard.

# Frontend Integration Targets

Primary:
- pricing page
- billing page
- upgrade prompt / nudge host
- representative locked-state CTA surfaces

# Tests Required

Frontend:
- analytics helper tests if added or touched
- event dispatch tests for touched pricing / upgrade flows where practical

Backend:
- only if an existing event/logging helper or route is extended

# Manual QA

1. verify upgrade CTA events fire in touched contexts
2. verify pricing and billing engagement events fire as intended
3. verify analytics does not block or visibly degrade UX
4. verify no sensitive billing or personal data is emitted in touched payloads

# Acceptance Criteria

- key subscription conversion touchpoints are instrumented
- no second analytics framework is introduced
- instrumentation is lightweight and non-blocking
- touched tests pass
- no privacy or UX regression is introduced

# Deliverable Summary

- subscription conversion event instrumentation
- canonical event naming for touched upgrade/pricing/billing flows
- lightweight, privacy-aware analytics additions
- tests for touched instrumentation

# Commit

COMMIT:
feat: add subscription conversion analytics v1
