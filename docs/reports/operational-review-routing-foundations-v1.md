# Operational Review Routing Foundations v1

## Executive Summary

Operational Review Routing Foundations v1 introduces deterministic, manual-only routing metadata that connects operational command center style signals to governed review workspace concepts.

This mission does not create review workspaces automatically, mutate source workflows, change permissions, alter Firestore rules, broaden visibility, or introduce autonomous workflow behavior.

## Purpose

The routing foundation answers:

- Is this operational item reviewable?
- Why is it reviewable?
- Which review workspace type would be appropriate if an operator manually starts review?
- What priority should the review carry?
- Which source workflow link and scoped resource references should travel with the handoff?

## Contract

Routing metadata includes:

- `routingId`
- `routingVersion`
- `itemId`
- `landlordId`
- `reviewEligible`
- `reviewReasonKey`
- `reviewReasonLabel`
- `reviewPriority`
- `priorityLabel`
- `workspaceType`
- `workspaceScopeId`
- `sourceDestination`
- `relatedResourceRefs`

Safety flags:

- `manualOnly: true`
- `autoCreateWorkspace: false`
- `autonomousActionsEnabled: false`
- `permissionWideningRequired: false`

Version:

- `operational_review_routing_v1`

## Review Reason Taxonomy

V1 reason keys:

- `delinquency_review`
- `payment_evidence_review`
- `screening_review`
- `lease_execution_review`
- `document_review`
- `occupancy_review`
- `evidence_review`
- `operational_anomaly_review`
- `informational_not_reviewable`

## Workspace Compatibility

Routing decisions map to the review workspace foundation contract:

- delinquency review -> delinquency review workspace
- payment evidence review -> payment/ledger review workspace
- screening review -> screening review workspace
- document or lease execution review -> document review workspace
- evidence review -> evidence review workspace
- occupancy and general operational anomalies -> operational anomaly review workspace

The helper can produce `BuildReviewWorkspaceInput` for a later manual action. It returns `null` for non-reviewable items.

## Scope Safety

Related resource refs are filtered by:

- landlord scope
- tenant scope when provided

Cross-landlord and unrelated-tenant resource refs are excluded before handoff metadata is returned.

## Non-Goals

This mission does not:

- create routes
- persist routing decisions
- create review workspaces automatically
- auto-assign reviewers
- resolve decisions
- mutate payments, leases, ledger entries, or screening records
- expose tenant review internals
- expand institutional exports
- introduce AI or agent behavior

## Future Follow-Ups

Recommended next missions:

1. `feat/operations-review-handoff-ui-v1`
2. `test/operational-review-routing-route-scoping-v1`
3. `feat/manual-review-workspace-creation-v1`
4. `fix/operations-review-routing-label-normalization-v1`
5. `docs/review-routing-event-taxonomy-v1`

## DO NOT IGNORE

- Routing metadata is not authorization.
- Review eligibility is not auto-execution.
- Manual-only handoff must remain explicit.
- Tenant-visible projections must not include review internals.
- Cross-landlord and unrelated-tenant resource refs must remain excluded.
