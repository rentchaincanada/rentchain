# Tenant Score Foundation V1

## Purpose
Tenant Score Foundation V1 creates a backend-only tenant credibility score derived from linked lease risk, lease history, and available payment behavior signals. It is decision-support infrastructure only and is intended to support later tenant views, landlord trust surfaces, and underwriting exports.

## Persistence Model
Tenant score is stored additively on the tenant document:

- `tenantScore`
- `tenantScoreValue`
- `tenantScoreGrade`
- `tenantScoreConfidence`
- `tenantScoreTimeline`

`tenantScore` shape:

- `version`
- `score`
- `grade`
- `confidence`
- `factors`
- `signals`
- `recommendations`
- `derivedFrom`
- `generatedAt`

`tenantScoreTimeline` stores compact history entries with:

- `generatedAt`
- `version`
- `score`
- `grade`
- `confidence`
- `trigger`
- `source`
- `signals`

## Current Inputs
V1 uses only existing internal data:

- latest linked lease risk score
- average linked lease risk score
- active lease count
- completed lease count
- ledger-derived tenant payment signals
- lightweight payment count evidence
- lease history depth

Linked leases are resolved through both legacy `tenantId` and canonical `tenantIds`.

## Confidence Rules
Missing evidence reduces confidence more than score.

- strong lease and payment history increases confidence
- thin history or missing payment evidence reduces confidence
- score still computes with partial data when at least one linked lease exists

## Triggers
Supported trigger values:

- `tenant_recompute`
- `lease_recompute`
- `lease_create`
- `backfill`
- `unknown`

V1 adds a protected internal recompute endpoint:

- `POST /api/internal/tenants/:tenantId/recompute-score`

Auth uses the existing internal job token pattern.

## No-op Behavior
Recompute does not write or append a duplicate timeline entry when the persisted tenant score is unchanged.

## Current Limitations
- V1 does not add tenant score UI.
- V1 does not automatically recompute tenant score on every lease risk recompute yet.
- V1 does not include a broad tenant score backfill script yet.
- Payment behavior is only as strong as the current ledger/payment evidence available in the tenant history.

## Future Extensions
- landlord trust and screening surfaces
- tenant progress views
- recompute hooks from lease risk updates
- dedicated tenant score backfill tooling
- subcollection/event archival if tenant score timeline grows materially
