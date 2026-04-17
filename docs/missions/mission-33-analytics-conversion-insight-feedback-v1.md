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
Build a lightweight, Firestore-backed feedback engine that converts conversion analytics into structured insights and feeds them back into the optimization loop, enabling repeatable improvement cycles.

This mission closes the loop:

Measure → Analyze → Improve → Learn → Repeat

# Why This Matters

Mission 30 produces funnel metrics.
Mission 31–32 introduce changes.

Mission 33:
- explains WHY changes worked or failed
- identifies which features drive upgrades
- produces structured insights for the next iteration

This turns RentChain into a **data-driven optimization system**.

# Strict Requirements

- Reuse existing Firestore collections:
  - `events`
  - `telemetry_counters`
- Reuse Mission 30 analysis layer
- Do NOT introduce:
  - new analytics pipeline
  - new storage system
  - dashboards
  - heavy ML/statistical modeling
- Keep everything:
  - aggregate
  - privacy-safe
  - query-based
- No PII
- No user-level data exposure

# Non-Goals

- No dashboards
- No visualization layer
- No A/B testing framework
- No billing system changes
- No analytics ingestion changes

# Primary Files / File Families To Inspect First

Backend analysis layer:
- Mission 30 analysis service and route

Event ingestion:
- `rentchain-api/src/routes/eventsRoutes.ts`
- `rentchain-api/src/services/telemetryService.ts`

Frontend usage context (read-only):
- upgrade flows
- pricing pages
- billing page

# Firestore Data Model Focus

Continue using:

## `events` collection
- `eventName`
- `createdAt`
- `source`
- `surface`
- `featureKey`
- `requiredPlan`
- `currentPlan`
- `targetPlan`
- `interval`
- `presentation`

## `telemetry_counters` collection
- aggregated counts
- event frequency
- time-based summaries

DO NOT modify schema unless strictly additive.

# Insight Scope

Produce structured insights such as:

1. Feature → Upgrade correlation
- Which `featureKey` events precede upgrade actions

2. Surface effectiveness
- Which surfaces convert best:
  - pricing
  - billing
  - locked features
  - upgrade prompts

3. Plan targeting effectiveness
- Which `targetPlan` converts best
- where users hesitate

4. Funnel anomaly detection (simple)
- sudden drop-offs
- unusually low/high conversion segments

5. Conversion bottleneck identification
- identify weakest funnel step

# Required Output Shape

Expose a lightweight feedback output, example:

```json
{
  "window": { "days": 30 },
  "topConversionDrivers": [
    { "featureKey": "portfolio_score", "conversionImpact": 0.32 },
    { "featureKey": "marketplace_assignment", "conversionImpact": 0.21 }
  ],
  "surfacePerformance": {
    "pricing_page": 0.18,
    "billing_page": 0.27,
    "locked_feature": 0.34
  },
  "planPerformance": {
    "starter": 0.12,
    "pro": 0.28,
    "elite": 0.19
  },
  "bottlenecks": [
    {
      "step": "upgrade_prompt_checkout_clicked",
      "dropOff": 0.68
    }
  ],
  "recommendations": [
    "Improve checkout clarity",
    "Increase CTA visibility on pricing page",
    "Strengthen value messaging for Pro tier"
  ]
}

Keep it:
	•	simple
	•	deterministic
	•	explainable

Pre-Implementation Audit

Before coding, inspect and summarize:
	1.	What Mission 30 outputs already provide
	2.	What additional aggregation is needed
	3.	Which event fields are reliable for correlation
	4.	Whether indexing is needed for:
	•	eventName
	•	createdAt
	•	targetPlan
	•	featureKey

Required rule:
	•	extend, do not rebuild

Implementation Tasks
	1.	Build insight aggregation layer

	•	extend Mission 30 service
	•	compute correlations:
	•	feature → upgrade
	•	surface → conversion
	•	plan → conversion

	2.	Add simple scoring logic

	•	rank features by conversion influence
	•	rank surfaces by effectiveness
	•	rank plans by conversion success

	3.	Generate recommendations (lightweight)

	•	rule-based suggestions (NOT AI model)
	•	based on:
	•	bottlenecks
	•	weak surfaces
	•	low-performing plans

	4.	Expose feedback route

Example:
	•	/api/admin/analytics/conversion-insights

Characteristics:
	•	read-only
	•	JSON only
	•	admin/internal use

	5.	Keep output privacy-safe

	•	aggregate only
	•	no raw events
	•	no user data

	6.	Add targeted tests

	•	aggregation correctness
	•	empty dataset handling
	•	recommendation generation logic

API Surfaces

Add one new backend route:

Example:
	•	/api/admin/analytics/conversion-insights

Do NOT expose publicly.

Tests Required

Backend:
	•	aggregation tests
	•	correlation tests
	•	recommendation logic tests
	•	route tests
	•	build must pass

Frontend:
	•	none required

Manual QA
	1.	Verify insight output is consistent
	2.	Verify no PII appears
	3.	Verify recommendation logic is stable
	4.	Verify insights align with known funnel behavior
	5.	Verify route performance is acceptable

Acceptance Criteria
	•	insights generated from real event data
	•	correlations between features, surfaces, and upgrades identified
	•	bottlenecks detected
	•	recommendations produced
	•	no new analytics system introduced
	•	backend tests pass
	•	backend build passes

Deliverable Summary
	•	conversion insight engine
	•	feedback loop output tied to Mission 30 data
	•	correlation + recommendation layer
	•	lightweight admin endpoint

Commit

COMMIT:
feat: add conversion insight feedback engine v1
