MISSION: Predictive Metrics v1

BRANCH:
feat/predictive-metrics-v1

## Objective
Build Predictive Metrics v1 for RentChain on top of the existing analytics, alerts, benchmarking, and trend-delta stack.

This mission should add a deterministic, landlord-safe predictive layer that estimates near-term portfolio outcomes using current and historical analytics signals already available in the platform.

The goal is to introduce simple, explainable forward-looking metrics without adding speculative AI logic or external market dependencies.

## Required read order
1. AGENTS.md
2. PROCESS.md
3. codex.md
4. docs/execution/CURRENT_MISSION.md if present
5. Relevant mission examples in docs/missions/
6. Then inspect the code directly relevant to this mission

## Context
The repo already has:
- Analytics Layer v1
- Landlord Analytics Dashboard v1
- Analytics Alerts Engine v1
- Portfolio Benchmarking v1
- Trend Deltas / Prior-Period Comparisons v1

This mission must build on that existing stack rather than introducing a second predictive system.

## In scope
- backend predictive metrics derivation layer
- landlord-safe predictive metrics contract
- reuse of current analytics and delta helpers
- landlord UI predictive metrics panel or section
- deterministic and explainable prediction rules
- targeted tests

## Out of scope
- machine learning models
- external market data
- automated actions
- autonomous agent decisions

## Suggested predictive metrics for v1
- projected vacancy risk
- projected lease expiry concentration
- projected maintenance burden risk
- projected application slowdown risk
- projected revenue pressure signal

## Acceptance criteria
- predictive metrics layer exists
- landlord-safe route or extension exposes predictive metrics
- logic is deterministic and explainable
- UI displays predictive metrics cleanly
- tests pass
- builds pass
