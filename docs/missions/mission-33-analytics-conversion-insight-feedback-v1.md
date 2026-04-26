
# Mission

MISSION: Conversion Insight Feedback Engine v1

# Branch

BRANCH:
feat/conversion-insight-feedback-v1

# Base

BASE:
Start from latest `origin/main` only after:
- Mission 30 (Conversion Analysis Layer)
- Mission 31 (Upgrade UX Optimization)
- Mission 32 (Pricing + Funnel Optimization)

are merged and stable.

# Objective

OBJECTIVE:
Build a lightweight, backend-only, Firestore-backed conversion insight layer that extends Mission 30 funnel analysis into structured optimization feedback for the next loop.

This mission closes the loop:

Measure → Analyze → Improve → Learn → Repeat

# Why This Matters

Mission 30 provides aggregate funnel counts and breakdowns.
Mission 31 and Mission 32 changed upgrade UX and pricing-to-billing handoff behavior.

Mission 33 should:
- explain which surfaces are producing upgrade intent
- identify which plans and paths are seeing the strongest interest
- identify bottlenecks and weak segments
- generate lightweight, deterministic recommendations for the next optimization cycle

This turns RentChain into a data-driven optimization system without introducing a new analytics stack.

# Strict Requirements

- Reuse existing Firestore collections already used by Mission 29 and Mission 30:
  - `events`
  - `telemetry_counters` only if a small supporting use is genuinely helpful
- Reuse and extend the Mission 30 analysis layer
- Do NOT introduce:
  - a new analytics pipeline
  - a new storage system
  - dashboards
  - frontend consumers
  - heavy ML/statistical modeling
  - user-journey stitching
- Keep everything:
  - aggregate
  - privacy-safe
  - deterministic
  - query-based
  - explainable
- No PII
- No user-level or session-level output

# Non-Goals

- No dashboards
- No visualization layer
- No A/B testing framework
- No billing system changes
- No analytics ingestion changes
- No event schema redesign
- No causal inference engine
- No experiment platform

# Primary Files / File Families To Inspect First

Mission 30 analysis layer:
- `rentchain-api/src/services/admin/adminSubscriptionConversionView.ts`
- `rentchain-api/src/routes/adminRoutes.ts`
- Mission 30 route/tests

Event ingestion context (read-only):
- `rentchain-api/src/routes/eventsRoutes.ts`
- `rentchain-api/src/services/telemetryService.ts`

Frontend usage context (read-only only, no frontend changes expected):
- pricing pages
- billing page
- upgrade CTA / prompt surfaces

# Firestore Data Model Focus

Continue using the actual Mission 29 / Mission 30 event read model.

## `events` collection

Mission 29-style analytics events are expected to use:
- `name`
- `ts`
- `props`
- `createdAt`
- optional `userId`
- optional `sessionId`

Important:
- this is a mixed-schema collection
- the insight engine must only analyze Mission 29-style analytics events
- other event documents in `events` must be ignored safely

## `telemetry_counters` collection

Current usage is coarse and event-name based.
It may help with sanity-check totals only if useful, but it is not the primary source for breakdowns or insights.

Do NOT redesign either schema in this mission.

# Insight Scope

Produce lightweight aggregate insights such as:

1. Surface effectiveness
- which surfaces are producing the strongest upgrade intent
- examples:
  - `marketing_pricing`
  - `billing_page`
  - locked/teaser surfaces where present

2. Plan-interest distribution
- which `targetPlan` values are receiving the most upgrade interest
- where plan selection appears concentrated or weak

3. Funnel bottlenecks
- identify weakest steps from the Mission 30 funnel
- examples:
  - pricing page view → plan CTA
  - billing page open → billing upgrade click

4. Feature or prompt relevance only where supported by data
- use `props.featureKey` or related fields only if enough Mission 29-style events actually populate them
- do NOT fabricate insights where data is sparse or absent

5. Recommendation generation
- simple rule-based output derived from:
  - weak step conversions
  - weak surface performance
  - concentrated or imbalanced plan-interest patterns

# Required Output Shape

Expose one lightweight admin-only feedback output.

Preferred example shape:

```json
{
  "ok": true,
  "window": {
    "days": 30,
    "from": "2026-03-19T00:00:00.000Z",
    "to": "2026-04-18T00:00:00.000Z"
  },
  "funnel": [
    { "step": "pricing_page_viewed", "count": 12 },
    { "step": "pricing_plan_cta_clicked", "count": 8, "conversionFromPrevious": 0.667 },
    { "step": "billing_page_opened", "count": 24 },
    { "step": "billing_upgrade_clicked", "count": 15, "conversionFromPrevious": 0.625 }
  ],
  "insights": {
    "strongestSurface": {
      "surface": "billing_page",
      "count": 39
    },
    "strongestPlanInterest": {
      "targetPlan": "starter",
      "count": 9
    },
    "weakestFunnelStep": {
      "step": "pricing_page_viewed -> pricing_plan_cta_clicked",
      "conversion": 0.667
    }
  },
  "recommendations": [
    "Strengthen Pro and Elite differentiation on pricing surfaces",
    "Preserve billing as the primary upgrade hub",
    "Monitor whether prompt-driven upgrade flows become meaningful before optimizing them"
  ]
}

Keep it:
	•	simple
	•	deterministic
	•	aggregate-only
	•	explainable

Pre-Implementation Audit

Before coding, inspect and summarize:
	1.	What Mission 30 already computes and returns
	2.	What additional aggregation is actually needed for v1 insights
	3.	Which props fields are reliably populated in Mission 29-style events:
	•	targetPlan
	•	surface
	•	source
	•	featureKey if present
	4.	Whether current event volume supports meaningful insight output without overfitting
	5.	Whether any additional indexing is needed, or whether Mission 30’s bounded ts query strategy is still sufficient

Required rule:
	•	extend, do not rebuild
	•	do not overclaim insights beyond what current data volume and event shape support

Implementation Tasks
	1.	Extend the Mission 30 analysis layer

	•	build a dedicated backend insight service on top of the existing bounded-window event read model
	•	reuse Mission 30 funnel output where helpful

	2.	Compute aggregate insight summaries

	•	strongest upgrade-intent surfaces
	•	target-plan interest distribution
	•	weakest funnel step(s)
	•	optional feature-level signals only where reliable data exists

	3.	Add simple deterministic recommendation logic

	•	rule-based only
	•	examples:
	•	if billing outperforms pricing, preserve billing-centered routing
	•	if Starter dominates interest heavily, improve Pro/Elite differentiation
	•	if prompt usage is near zero, deprioritize prompt optimization

	4.	Expose one admin-only read route
Preferred example:

	•	/api/admin/analytics/conversion-insights

Characteristics:
	•	read-only
	•	JSON only
	•	admin/internal only

	5.	Keep output privacy-safe

	•	aggregate only
	•	no raw event dumps
	•	no userId
	•	no sessionId
	•	no personal data

	6.	Add targeted backend tests

	•	aggregation correctness
	•	empty dataset handling
	•	mixed-schema event filtering
	•	recommendation generation logic
	•	route auth/response tests

API Surfaces

Add one new backend route:

Preferred:
	•	/api/admin/analytics/conversion-insights

Do NOT expose publicly.

Tests Required

Backend:
	•	insight aggregation tests
	•	recommendation logic tests
	•	route tests
	•	empty dataset behavior
	•	mixed-schema filtering tests
	•	backend build must pass

Frontend:
	•	none required

Manual QA
	1.	Verify insight output is consistent with Mission 30 funnel data
	2.	Verify no PII appears
	3.	Verify recommendation logic is stable and deterministic
	4.	Verify low-volume data still returns safe, explainable output
	5.	Verify route performance is acceptable for bounded windows

Acceptance Criteria
	•	insights are generated from real Mission 29 / Mission 30 event data
	•	strongest surfaces and plan-interest patterns are identified
	•	bottlenecks are identified
	•	deterministic recommendations are produced
	•	no new analytics system is introduced
	•	no frontend or dashboard work is introduced
	•	backend tests pass
	•	backend build passes

Deliverable Summary
	•	backend conversion insight engine
	•	admin-only feedback route
	•	aggregate insight and recommendation layer tied to Mission 30 data
	•	targeted backend tests

Commit

COMMIT:
feat: add conversion insight feedback engine v1
