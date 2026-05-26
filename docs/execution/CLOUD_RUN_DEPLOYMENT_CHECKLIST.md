# Cloud Run Deployment Checklist

## Purpose

This checklist prevents false QA failures caused by stale backend deployments. Vercel preview freshness does not prove Cloud Run is serving the expected backend commit.

Use this checklist for any mission that changes `rentchain-api`, backend routes, backend projections, service logic, or API payloads used by a preview.

## Required Evidence

Before declaring backend preview QA valid, confirm:

1. Cloud Run service name
2. active revision name
3. revision creation timestamp
4. container image tag or digest
5. expected PR or merge commit
6. traffic allocation is 100 percent to the expected revision
7. authenticated API payload reflects the expected code path

## Suggested Commands

Set these locally without committing them:

```bash
export CLOUD_RUN_SERVICE=rentchain-landlord-api
export CLOUD_RUN_REGION=<region>
export EXPECTED_COMMIT=<commit-sha>
```

Inspect the service:

```bash
gcloud run services describe "$CLOUD_RUN_SERVICE" \
  --region "$CLOUD_RUN_REGION" \
  --format "yaml(status.latestReadyRevisionName,status.traffic,spec.template.spec.containers[0].image)"
```

Inspect revisions:

```bash
gcloud run revisions list \
  --service "$CLOUD_RUN_SERVICE" \
  --region "$CLOUD_RUN_REGION" \
  --sort-by "~metadata.creationTimestamp" \
  --limit 5
```

Confirm traffic:

```bash
gcloud run services describe "$CLOUD_RUN_SERVICE" \
  --region "$CLOUD_RUN_REGION" \
  --format "table(status.traffic.revisionName,status.traffic.percent,status.traffic.tag)"
```

## Backend Freshness Rule

If Cloud Run still points to an older image or revision:

1. stop coding new backend fixes
2. report deployment drift
3. deploy or sync the expected backend revision only with operator authorization
4. confirm traffic is 100 percent to the new revision
5. retest authenticated API payloads after the revision is active

## Payload Verification

After revision alignment, verify the actual route payload relevant to the mission.

Examples:

- admin list/detail projections
- tenant-safe profile or document projections
- route-source headers
- audit/governance metadata summaries

Do not rely only on local service tests when the QA failure is in a deployed preview.

## Non-Goals

This checklist does not:

- authorize deployment by itself
- replace operator deployment approval
- store credentials or project IDs in the repo
- change Terraform or Cloud Run configuration
- prove frontend freshness
