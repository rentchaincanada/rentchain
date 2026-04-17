# Mission

MISSION: Upgrade UX Optimization v1

# Branch

BRANCH:
feat/upgrade-ux-optimization-v1

# Base

BASE:
Start from latest `origin/main` only after:
- Mission 25 (Upgrade Prompt System)
- Mission 29 (Conversion Analytics)
- Mission 30 (Conversion Analysis Layer)

are merged and stable.

# Objective

OBJECTIVE:
Improve upgrade conversion rates by refining upgrade prompts, CTA messaging, and pricing surfaces using insights from the conversion analysis layer built in Mission 30.

This mission is focused on **UX optimization**, not system redesign.

# Why This Matters

Mission 30 gives visibility into:
- where users drop off
- which surfaces trigger upgrades
- which prompts are ignored

Mission 31 uses that data to:
- improve clarity
- reduce friction
- increase upgrade intent

This is the first **data-driven UX iteration loop**.

# Strict Requirements

- Reuse existing upgrade system:
  - `upgradePrompt.ts`
  - `UpgradeContext`
  - `UpgradeCTA`
  - `UpgradePromptModal`
- Do NOT create a new upgrade system
- Do NOT redesign routing or billing flows
- Do NOT introduce heavy A/B testing frameworks
- Keep all changes:
  - additive
  - reversible
  - isolated to UX and messaging
- Do NOT change plan logic or capability mapping

# Non-Goals

- No pricing architecture redesign
- No billing backend changes
- No analytics pipeline changes
- No experiment platform (only lightweight flags allowed)
- No UI framework overhaul

# Primary Files / File Families To Inspect First

Upgrade system:
- `rentchain-frontend/src/lib/upgradePrompt.ts`
- `rentchain-frontend/src/context/UpgradeContext.tsx`
- `rentchain-frontend/src/components/billing/UpgradeCTA.tsx`
- `rentchain-frontend/src/components/billing/UpgradePromptModal.tsx`

Conversion surfaces:
- `rentchain-frontend/src/pages/PricingPage.tsx`
- `rentchain-frontend/src/pages/marketing/PricingPage.tsx`
- `rentchain-frontend/src/pages/BillingPage.tsx`

Analytics context (read-only):
- Mission 30 conversion output route/service
- existing event names:
  - `pricing_*`
  - `upgrade_*`
  - `billing_*`

# Pre-Implementation Audit

Before coding, inspect and summarize:

1. Conversion funnel drop-offs from Mission 30
   - where users stop progressing
   - low conversion transitions

2. Current upgrade UX patterns:
   - messaging in prompts
   - CTA wording
   - CTA placement

3. Identify inconsistent messaging:
   - different required-plan wording
   - unclear feature/value explanation

4. Identify high-friction steps:
   - too many clicks
   - unclear upgrade path
   - ambiguous pricing differences

Required rule:
- Improvements must be based on observed funnel behavior
- Do not guess blindly

# Implementation Tasks

1. Improve upgrade prompt messaging
- clarify:
  - what user gets
  - why upgrade is valuable
- align required-plan language with canonical plan model

2. Improve CTA wording
- standardize across surfaces
- reduce vague language
- focus on value/action (e.g., “Unlock Recommendations” vs “Upgrade”)

3. Improve CTA placement (within existing surfaces only)
- ensure CTA is visible at decision points
- do NOT add new layouts or major UI changes

4. Introduce lightweight variant support (optional but recommended)
- simple variant flag pattern (no framework)
- example:
  - CTA text A vs B
- keep implementation minimal

5. Keep upgrade flow consistent
- do not change routing
- do not add new modal systems
- reuse `openUpgradeFlow(...)` and prompt system

6. Preserve additive UX
- no destructive gating changes
- no removal of existing access

# UX Improvement Targets

Focus on:
- upgrade prompt clarity
- CTA clarity
- pricing comprehension
- reducing hesitation points

Do NOT:
- redesign pages
- restructure layouts heavily

# API Surfaces

None required for this mission.

Frontend-only improvements preferred.

# Tests Required

Frontend:
- upgrade prompt rendering tests
- CTA behavior tests
- variant behavior tests (if introduced)

Build:
- frontend build must pass

# Manual QA

1. Verify upgrade prompts are clearer
2. Verify CTA text is consistent across pages
3. Verify upgrade flows still route correctly
4. Verify no regression in locked/teaser behavior
5. Verify variant toggles (if implemented) behave correctly

# Acceptance Criteria

- upgrade messaging is clearer and consistent
- CTA wording is standardized
- friction points are reduced
- no new upgrade system introduced
- all changes are additive and reversible
- frontend tests pass
- frontend build passes

# Deliverable Summary

- improved upgrade prompt messaging
- standardized CTA wording
- optional lightweight variant system
- targeted frontend tests

# Commit

COMMIT:
feat: add upgrade UX optimization v1
