MISSION: Agent Decision Engine v1

BRANCH:
feat/agent-decision-engine-v1

## Objective
Build Agent Decision Engine v1 for RentChain as a deterministic recommendation layer that converts existing analytics signals into prioritized landlord-facing actions.

This mission must produce structured, explainable recommendations derived from:
- analytics snapshot
- alerts
- portfolio benchmarking
- trend deltas
- predictive metrics

The goal is to answer:
- what should the landlord do next?
- which issues require immediate attention?
- which properties or workflows should be prioritized?

This system must be deterministic, transparent, and additive. No autonomous actions or AI-driven reasoning is allowed in this version.

## Context
The system already includes:

- landlord analytics snapshot:
  rentchain-api/src/lib/analytics/deriveLandlordAnalyticsSnapshot.ts

- alerts:
  rentchain-api/src/lib/analytics/deriveAnalyticsAlerts.ts

- benchmarking:
  rentchain-api/src/lib/analytics/derivePortfolioBenchmarking.ts

- trend deltas:
  rentchain-api/src/lib/analytics/deriveAnalyticsDeltas.ts

- predictive metrics:
  rentchain-api/src/lib/analytics/derivePredictiveMetrics.ts

Frontend analytics surface:
- rentchain-frontend/src/pages/landlord/LandlordAnalyticsPage.tsx

This mission must extend these systems, not replace or duplicate them.

## In scope

### Backend
- create a new helper:
  rentchain-api/src/lib/analytics/deriveAgentDecisions.ts

- decision helper must:
  - consume outputs from:
    - alerts
    - predictive metrics
    - benchmarking
    - deltas
  - NOT re-read raw leases, units, or work orders unless absolutely necessary
  - produce deterministic decision objects

- extend:
  deriveLandlordAnalyticsSnapshot.ts
  to include:
  - decisions payload

- update:
  analyticsTypes.ts
  to include decision types

### Decision model
Each decision must include:
- decisionType (string enum)
- priority (low, medium, high)
- explanation (human-readable)
- supportingSignals (array of metric references)
- recommendedAction (short label)
- optional href or navigation hint

### Example decision types
- review_lease_renewals
- reduce_vacancy_risk
- improve_application_conversion
- address_maintenance_backlog
- review_revenue_pressure
- focus_highest_risk_property

### Frontend
- add:
  PredictiveMetricsPanel.tsx → already exists (reference only)
- add new component:
  AgentDecisionPanel.tsx

- update:
  LandlordAnalyticsPage.tsx
  to render:
  - decisions panel above or near predictive metrics

- UI requirements:
  - explanation-first wording
  - no "AI" or speculative language
  - clean empty state
  - clear priority indicators

### Tests
- backend:
  - deriveAgentDecisions.test.ts
  - snapshot integration tests

- frontend:
  - AgentDecisionPanel.test.tsx
  - page integration tests

## Out of scope
- autonomous actions
- background jobs
- scheduling or automation
- LLM-based reasoning
- external data sources
- notifications or emails
- modifying existing analytics logic

## Acceptance criteria
- decision helper exists and is reusable
- decisions appear in landlord analytics response
- decisions are deterministic and explainable
- UI renders decisions cleanly
- no duplication of analytics logic
- no regression to existing analytics, alerts, or predictive metrics
- tests pass
- builds pass

## Verification
- run backend tests
- run frontend tests
- run builds
- verify decisions appear on /analytics
- verify property filter behavior remains correct
