# Move-In Readiness Engine v1

## Purpose
Move-In Readiness v1 gives landlords a compact operational view of what still needs to happen before move-in. It summarizes current lease and onboarding evidence without requiring full payment, e-sign, insurance, or utility integrations.

## Surface
- Landlord tenant detail view
- Shown alongside current lease and credibility context

## Tracked items
- Lease signed
- Tenant portal invite sent
- Tenant portal activated
- Deposit required / received
- Insurance required / received
- Utility setup required / confirmed
- Inspection scheduled / completed
- Keys release readiness

## Status logic
- `completed`: keys released or move-in already recorded
- `ready`: all known required pre-move-in items are complete and keys are not yet released
- `in-progress`: some known required items are complete and some remain
- `not-started`: known required items exist but none are complete
- `unknown`: too little evidence exists to compute a reliable readiness state

## Progress logic
- `readinessPercent` is based on completed known required items divided by total known required items
- Unknown items do not count as completed
- If there are no known required items, readiness remains `unknown`

## What v1 does not do
- No tenant-facing workflow controls
- No payment processor integration
- No e-sign vendor integration changes
- No insurance or utility ingestion automation
- No inspection scheduling engine

## Future extensions
- Tenant-facing completion actions
- Deposit and insurance collection integrations
- Utility confirmation ingestion
- Inspection scheduling and key-release gating
- Property-level move-in readiness rollups
