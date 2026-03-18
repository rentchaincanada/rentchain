# Lease Risk Timeline v1

## Purpose
Lease Risk Timeline v1 keeps a historical record of lease risk snapshots so RentChain can explain how a lease's risk profile changed over time.

## Data Model
Each lease can now store:
- latest fields:
  - `risk`
  - `riskScore`
  - `riskGrade`
  - `riskConfidence`
- additive history:
  - `riskTimeline: LeaseRiskTimelineEntry[]`

Each timeline entry stores:
- `generatedAt`
- `version`
- `score`
- `grade`
- `confidence`
- `trigger`
- `source`
- `flags`
- `recommendations`

## Supported Triggers
- `lease_create`
- `draft_activate`
- `recompute`
- `backfill`
- `unknown`

## Append Rules
- initial lease risk generation appends the first entry
- draft activation appends the first entry for activated leases
- recompute appends only when the snapshot meaningfully changes or when the lease has no timeline yet
- backfill appends when a historical lease receives timeline history for the first time or when risk meaningfully changes
- unchanged no-op recomputes do not append duplicate timeline entries

## Current Limitations
- timeline is stored inline on the lease document
- v1 does not cap array growth
- compact summary routes may not expose the full timeline yet

## Future Extensions
- landlord risk trend views
- tenant progress views
- risk change explanations
- subcollection or archival model if timelines grow large
