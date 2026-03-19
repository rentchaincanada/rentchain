# Tenant Score Backfill Runbook V1

## Purpose
Use this tooling to seed or repair tenant score fields on historical tenant records without changing unrelated tenant data.

## When to Use Single-Tenant Recompute
Use the internal route when one tenant needs repair after lease, payment, or ledger history changes.

- `POST /api/internal/tenants/:tenantId/recompute-score`
- header: `X-Internal-Job-Token: <INTERNAL_JOB_TOKEN>`

## When to Use Backfill
Use the backfill script when many historical tenants are missing one or more of:

- `tenantScore`
- `tenantScoreValue`
- `tenantScoreGrade`
- `tenantScoreConfidence`
- `tenantScoreTimeline`

## Dry-Run First
Always start with dry-run.

Examples:

- `cd rentchain-api && npx tsx src/scripts/backfillTenantScore.ts --dry-run`
- `cd rentchain-api && npx tsx src/scripts/backfillTenantScore.ts --dry-run --tenant-id=<tenantId>`
- `cd rentchain-api && npx tsx src/scripts/backfillTenantScore.ts --dry-run --property-id=<propertyId> --landlord-id=<landlordId> --limit=25`
- `cd rentchain-api && npx tsx src/scripts/backfillTenantScore.ts --dry-run --start-after=<tenantId> --limit=25`

Real run examples:

- `cd rentchain-api && npx tsx src/scripts/backfillTenantScore.ts --tenant-id=<tenantId>`
- `cd rentchain-api && npx tsx src/scripts/backfillTenantScore.ts --recompute-all --landlord-id=<landlordId> --limit=50`

## Result Interpretation
The script prints:

- `scanned`
- `updated`
- `skipped`
- `errors`
- `processedTenantIds`
- `skippedTenantIds` with reasons
- `erroredTenantIds` with errors

Common skip reasons include:

- `tenant_not_found`
- `missing_landlord_context`
- `missing_linked_leases`
- `tenant_score_unchanged`
- `property_filter_no_match`
- `landlord_filter_no_match`

## Rollback Mindset
This tooling is additive only. If a result looks wrong:

1. stop the batch
2. inspect one tenant with the single-tenant recompute route
3. compare tenant score fields and timeline history
4. use Git + PR workflow for any code correction before broader reruns

## Warnings
- Manual/operator-driven only
- No scheduler or auto-run
- Do not run `--recompute-all` broadly without a dry-run review first
