# Mission

MISSION: Pricing + Funnel Optimization v1

# Branch

BRANCH:
feat/pricing-funnel-optimization-v1

# Base

BASE:
Start from latest `origin/main` only after:
- Mission 30 (Conversion Analysis Layer)
- Mission 31 (Upgrade UX Optimization)

are merged and stable.

# Objective

OBJECTIVE:
Reduce friction in the pricing → upgrade → checkout funnel by improving pricing clarity, plan differentiation, and upgrade flow efficiency using insights from Mission 30 and UX improvements from Mission 31.

This mission focuses on **funnel efficiency**, not system redesign.

# Why This Matters

Mission 30 identified:
- drop-off points in the conversion funnel

Mission 31 improved:
- messaging
- CTA clarity

Mission 32 focuses on:
- removing friction between steps
- improving plan comprehension
- making upgrade decisions easier and faster

This is the **funnel optimization layer**.

# Strict Requirements

- Reuse:
  - existing pricing pages
  - existing billing flows
  - existing upgrade prompt system
- Do NOT redesign pricing architecture
- Do NOT change plan definitions or entitlements
- Do NOT modify billing or checkout backend logic
- Keep changes:
  - additive
  - minimal
  - reversible
- No heavy UI redesign

# Non-Goals

- No Stripe or billing system changes
- No pricing model changes (prices, tiers, features)
- No analytics system changes
- No experiment platform
- No major layout redesign

# Primary Files / File Families To Inspect First

Pricing surfaces:
- `rentchain-frontend/src/pages/PricingPage.tsx`
- `rentchain-frontend/src/pages/marketing/PricingPage.tsx`

Billing surfaces:
- `rentchain-frontend/src/pages/BillingPage.tsx`
- `rentchain-frontend/src/components/billing/BillingPlansPanel.tsx`

Upgrade flow:
- `rentchain-frontend/src/lib/upgradePrompt.ts`
- `rentchain-frontend/src/components/billing/UpgradeCTA.tsx`
- `rentchain-frontend/src/components/billing/UpgradePromptModal.tsx`

Analytics context (read-only):
- Mission 30 funnel output
- Mission 29 events:
  - `pricing_*`
  - `upgrade_*`
  - `billing_*`

# Pre-Implementation Audit

Before coding, inspect and summarize:

1. Funnel drop-off points:
   - pricing → CTA
   - CTA → prompt
   - prompt → checkout

2. Pricing clarity issues:
   - unclear differences between plans
   - weak value ladder

3. Flow friction:
   - too many steps to upgrade
   - unclear next action
   - inconsistent CTA placement

4. Billing page friction:
   - unclear current plan
   - unclear upgrade path

Required rule:
- improvements must be based on observed funnel issues
- do not introduce speculative redesigns

# Implementation Tasks

1. Improve pricing clarity
- make plan differences more obvious
- emphasize value ladder:
  - what unlocks at each tier
- ensure feature grouping is easy to scan

2. Improve CTA flow efficiency
- reduce clicks from pricing → upgrade → checkout
- ensure CTAs lead directly to next step
- remove unnecessary intermediate steps if present

3. Improve upgrade flow consistency
- ensure pricing page, billing page, and prompts behave consistently
- align CTA behavior across:
  - pricing
  - billing
  - locked/teaser surfaces

4. Improve billing page usability
- make current plan clearer
- make next upgrade option clearer
- ensure upgrade path is obvious

5. Reduce hesitation points
- remove ambiguity in upgrade decisions
- ensure clear “what happens next” after click

# UX Optimization Targets

Focus on:
- clarity
- speed
- consistency

Avoid:
- redesigning layouts
- adding new flows
- adding complexity

# API Surfaces

No backend changes required.

Frontend-only improvements preferred.

# Tests Required

Frontend:
- pricing page rendering tests
- billing page behavior tests
- CTA flow tests where applicable

Build:
- frontend build must pass

# Manual QA

1. Verify pricing page is easier to understand
2. Verify plan differences are clear
3. Verify upgrade path is direct and consistent
4. Verify billing page clearly shows:
   - current plan
   - next upgrade
5. Verify no regression in:
   - upgrade prompts
   - routing
   - checkout flow

# Acceptance Criteria

- pricing clarity improved
- funnel friction reduced
- upgrade path simplified
- consistent behavior across pricing, billing, and prompts
- no change to pricing or plan structure
- frontend tests pass
- frontend build passes

# Deliverable Summary

- improved pricing clarity
- optimized upgrade funnel
- reduced friction between funnel steps
- consistent CTA behavior
- targeted frontend tests

# Commit

COMMIT:
feat: add pricing and funnel optimization v1
