# Lease Risk Backfill Runbook v1

## Purpose
Use this runbook to safely recompute or backfill lease risk snapshots for historical leases.

## When To Use Recompute
- A single lease is missing risk data.
- New tenant, screening, or payment information changed the risk inputs.
- An operator needs to repair one lease after reviewing data quality.

## When To Use Backfill
- Historical leases are missing risk, riskScore, riskGrade, or riskConfidence.
- A controlled batch refresh is needed after a model-input improvement.

## Dry-Run First
Always start with dry-run mode before any write:
- `npx tsx src/scripts/backfillLeaseRisk.ts --dry-run`
- `npx tsx src/scripts/backfillLeaseRisk.ts --dry-run --property-id=<propertyId>`
- `npx tsx src/scripts/backfillLeaseRisk.ts --dry-run --lease-id=<leaseId>`

## Internal Recompute Endpoint
Protected internal route:
- `POST /api/internal/leases/:leaseId/recompute-risk`

Required header:
- `X-Internal-Job-Token: <INTERNAL_JOB_TOKEN>`

## Batch Examples
- only missing risk fields, dry run:
  - `npx tsx src/scripts/backfillLeaseRisk.ts --dry-run --only-missing`
- apply to one property:
  - `npx tsx src/scripts/backfillLeaseRisk.ts --property-id=<propertyId> --limit=50`
- resume after a known lease id:
  - `npx tsx src/scripts/backfillLeaseRisk.ts --dry-run --start-after=<leaseId>`
- force recompute for all matched leases:
  - `npx tsx src/scripts/backfillLeaseRisk.ts --recompute-all --limit=25`

## Interpreting Results
- scanned: matched leases evaluated this run
- updated: leases written, or dry-run candidates when `--dry-run` is used
- skipped: leases ignored because they were unchanged, malformed, or not eligible
- errors: leases that failed and require manual review

## Rollback Mindset
This workflow only updates risk fields. If a batch needs to be rolled back, use Git-reviewed code changes and a follow-up repair run rather than ad hoc data edits.

## Warnings
- Manual operator workflow only. No scheduler or auto-run is configured.
- Prefer targeted runs for the first production backfill.
- Review skipped and error lease ids before expanding batch size.
