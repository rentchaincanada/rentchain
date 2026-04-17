# Mission

MISSION: Conversion Analysis Layer v1

# Branch

BRANCH:
feat/conversion-analysis-layer-v1

# Base

BASE:
Start from latest `origin/main` only after Mission 29 (`Subscription Conversion Analytics v1`) is merged and the event families introduced there are present on base.

# Objective

OBJECTIVE:
Build a lightweight Firestore-backed conversion analysis layer that reads the existing subscription conversion events and summarizes the pricing → upgrade → checkout funnel so RentChain can identify drop-offs and prioritize optimization work.

This mission is analysis-focused.
It should reuse the existing analytics/event model already present in the repo.

# Why This Matters

Mission 29 added conversion instrumentation.
Mission 30 turns that raw event stream into usable signal.

This creates the first analysis layer for:
- where users drop off
- which surfaces drive upgrade intent
- which plans receive the strongest interest
- which upgrade prompts convert best

This mission should produce actionable funnel summaries without introducing a new analytics system, heavy dashboarding, or wide infrastructure changes.

# Strict Requirements

- Reuse the existing Firestore analytics/event storage already in the repo.
- Do NOT create a second analytics pipeline.
- Do NOT redesign analytics ingestion.
- Do NOT introduce a dashboard framework.
- Keep the analysis layer lightweight, query-based, and additive.
- No PII in outputs.
- No user-level reporting.
- No tenant-level or landlord-level personal summaries.
- Preserve existing event-writing paths:
  - frontend `track(...)`
  - backend `/api/events/track`
  - backend event persistence to `events`
  - backend counter updates to `telemetry_counters`

# Non-Goals

- Do not build charts or dashboards.
- Do not create a data warehouse.
- Do not redesign `/api/events/track`.
- Do not change Mission 29 event names unless a compatibility-safe bug fix is absolutely required.
- Do not build billing revenue reporting.
- Do not add experiment infrastructure in this mission.
- Do not add A/B testing in this mission.

# Primary Files / File Families To Inspect First

Backend event/telemetry path:
- `rentchain-api/src/routes/eventsRoutes.ts`
- `rentchain-api/src/routes/__tests__/eventsRoutes.test.ts`
- `rentchain-api/src/services/telemetryService.ts`

Likely Firestore/service helpers:
- any backend Firestore service/helper used to read/write:
  - `events`
  - `telemetry_counters`

Potential admin/internal routes:
- admin analytics/reporting routes already in repo, if any
- read-only internal route patterns already used by admin pages

Frontend analytics context to inspect, but not necessarily modify:
- `rentchain-frontend/src/lib/analytics.ts`
- `rentchain-frontend/src/pages/PricingPage.tsx`
- `rentchain-frontend/src/pages/marketing/PricingPage.tsx`
- `rentchain-frontend/src/pages/BillingPage.tsx`
- `rentchain-frontend/src/components/billing/UpgradeCTA.tsx`
- `rentchain-frontend/src/components/billing/UpgradePromptModal.tsx`
- `rentchain-frontend/src/context/UpgradeContext.tsx`

# Firestore Data Model Focus

This mission should assume the current analytics data model already includes:

## Collection: `events`
Event-style documents written by `/api/events/track`

Expected useful fields to inspect and standardize around if already present:
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
- `route` or `pathname`

Do not add user identifiers to support this mission.

## Collection: `telemetry_counters`
Aggregated counters already updated by backend analytics handling

Expected useful dimensions to inspect if already present:
- event family / event name
- count
- period or last-updated marker
- lightweight grouping dimensions if already supported

Do not redesign this collection in this mission.
Only extend it if a very small additive compatibility-safe improvement is needed.

# Analysis Scope

Compute a lightweight subscription conversion funnel using the Mission 29 event set:

Core funnel events:
- `pricing_page_viewed`
- `pricing_plan_cta_clicked`
- `upgrade_cta_clicked`
- `upgrade_prompt_viewed`
- `upgrade_prompt_checkout_clicked`
- `billing_page_opened`
- `billing_upgrade_clicked`

The analysis layer should support:
1. event counts
2. ordered funnel step counts
3. step-to-step drop-off percentages
4. plan-interest breakdown where safe and available
5. surface/source breakdown where safe and available

# Required Output Shape

Produce a lightweight analysis output, preferably via one of these:
- a backend read-only JSON route
- a backend internal/admin service + route
- a simple internal report endpoint

Preferred shape:

```json
{
  "window": {
    "days": 30
  },
  "funnel": [
    { "step": "pricing_page_viewed", "count": 1200 },
    { "step": "pricing_plan_cta_clicked", "count": 260, "conversionFromPrevious": 0.217 },
    { "step": "upgrade_prompt_viewed", "count": 210, "conversionFromPrevious": 0.808 },
    { "step": "upgrade_prompt_checkout_clicked", "count": 74, "conversionFromPrevious": 0.352 }
  ],
  "breakdowns": {
    "targetPlan": {
      "starter": 20,
      "pro": 38,
      "elite": 16
    },
    "surface": {
      "pricing_page": 40,
      "billing_page": 12,
      "locked_feature": 22
    }
  }
}

This is an example shape, not a rigid schema.
Keep it simple and stable.

Pre-Implementation Audit

Before coding, inspect and summarize:
	1.	How events documents are currently written
	•	actual fields persisted
	•	event name storage pattern
	•	timestamp shape
	•	any relevant indexes already implied by usage
	2.	How telemetry_counters is currently updated
	•	whether it can support this mission directly
	•	whether event-level reads from events are required for the funnel
	3.	Which event names from Mission 29 are already present and queryable
	•	especially:
	•	pricing_*
	•	billing_*
	•	upgrade_cta_*
	•	upgrade_prompt_*
	4.	What route pattern is best for exposing read-only analysis
	•	admin/internal analytics route if available
	•	otherwise a small new read-only route consistent with repo patterns
	5.	Whether Firestore indexes will be needed for:
	•	event name filtering
	•	date-range filtering
	•	grouped reads where relevant

Required implementation rule:
	•	extend the existing event model and route patterns
	•	do not invent a parallel analytics read model unless absolutely necessary

Implementation Tasks
	1.	Audit the existing Firestore analytics shape

	•	inspect event documents and counters
	•	determine whether the funnel should be computed from events, telemetry_counters, or both

	2.	Build a lightweight conversion-analysis service

	•	read relevant event families
	•	support a bounded time window (recommended default: 30 days)
	•	compute:
	•	step counts
	•	step conversion rates
	•	top-level breakdowns by targetPlan, surface, or source where available

	3.	Expose the analysis through a lightweight backend route
Preferred characteristics:

	•	read-only
	•	internal/admin-safe
	•	JSON output only
	•	no dashboard UI required

	4.	Keep output privacy-safe

	•	aggregate only
	•	no raw user-level event dumps
	•	no personal identifiers

	5.	Add targeted backend tests

	•	analysis service tests
	•	route tests
	•	time-window handling tests
	•	empty-data handling tests

	6.	Build only if needed on frontend
Frontend changes are optional and should be avoided unless a tiny internal consumer is required.

API Surfaces

Preferred:
	•	one new backend read-only route for conversion analysis

Examples of acceptable direction:
	•	/api/admin/analytics/conversion-funnel
	•	/api/admin/analytics/subscription-conversion
	•	another repo-consistent internal/admin route

Do not expose this as a public route.
Keep auth and role boundaries consistent with existing admin/internal route patterns.

Query / Aggregation Guidance

Preferred default window:
	•	last 30 days

Useful optional query params if easy to support:
	•	days
	•	targetPlan
	•	surface

But keep v1 minimal.
A single 30-day summary is enough if that is cleaner.

Tests Required

Backend:
	•	event query / aggregation tests
	•	funnel computation tests
	•	route response tests
	•	empty dataset behavior
	•	malformed/unknown event filtering if relevant

Build:
	•	backend build required

Frontend:
	•	not required unless a frontend consumer is added, which is not preferred for v1

Manual QA
	1.	Verify the analysis route returns a valid funnel summary
	2.	Verify step counts are stable and non-negative
	3.	Verify conversion rates are computed correctly
	4.	Verify empty/low-data cases return safe output
	5.	Verify no personal identifiers appear in the response
	6.	Verify auth protection matches internal/admin expectations

Acceptance Criteria
	•	Mission 29 events are queryable through a lightweight analysis layer
	•	funnel counts and step conversions are available
	•	output is aggregate-only and privacy-safe
	•	no new analytics framework is introduced
	•	no dashboard system is introduced
	•	backend tests pass
	•	backend build passes

Deliverable Summary
	•	Firestore-backed conversion analysis service
	•	lightweight read-only conversion funnel route
	•	aggregate funnel output for subscription conversion
	•	targeted backend tests
	•	no heavy analytics infrastructure added

Commit

COMMIT:
feat: add conversion analysis layer v1
