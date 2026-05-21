# Operational Read Model Foundation v1

## Executive summary

This mission establishes RentChain's first operational read-model foundation as a deterministic projection layer for operational coordination.

It does not rewrite Firestore schemas, replace canonical source-of-truth collections, add routes, add writes, change authorization, broaden visibility, or introduce autonomous orchestration.

The foundation is intentionally narrow:

- define operational read-model terminology
- define source-of-truth vs derived-read boundaries
- add lightweight deterministic helper contracts
- preserve source lineage through internal references
- protect restricted/raw/provider data from projection payloads
- prepare future operational command center, review queue, evidence linkage, and institutional workflow scaling

## Read-model philosophy

Operational read models are derived, rebuildable projections. They help operators scan and coordinate work, but they are not the legal, financial, operational, or workflow source of truth.

A RentChain operational read model should answer:

- what operational item needs attention
- what source workflow produced it
- which landlord/resource scope applies
- whether it is reviewable
- what evidence/resource references are linked
- when the projection was generated
- which source references would allow rebuild or audit

Read models must not answer:

- whether a financial record is valid
- whether an action is legally enforceable
- whether a workflow should auto-progress
- whether a tenant, landlord, or admin gains new visibility
- whether an autonomous agent may execute an action

## Source of truth vs derived read

Canonical source-of-truth collections remain authoritative:

- `leases`
- `tenants`
- `properties`
- `units`
- `payments`
- `ledgerEntries`
- `workOrders`
- `maintenanceRequests`
- `operatorReviewSessions`
- `landlordDecisionStates`
- `decisionActions`
- evidence/export source collections

Operational read models are derived from these source records and related projection helpers. They may include:

- source collection names
- source IDs as internal references
- operational labels
- deterministic summary status
- deterministic priority
- counts
- evidence linkage summaries
- routing summaries

They must not include:

- raw provider payloads
- raw CSV values
- payment credentials
- private message bodies
- unrestricted document bodies
- stack traces
- debug payloads
- route-source diagnostics
- tokens or secrets
- unrelated landlord/tenant/resource records

## Operational coordination use cases

The first read-model concepts are designed for:

- operational command center summaries
- operational review queue summaries
- work-order operational summaries
- review workspace summaries
- evidence linkage summaries
- future consent/routing readiness summaries
- future institutional coordination dashboards

V1 adds helper-level concepts only. It does not persist an operational read-model collection.

## V1 helper contract

The helper contract introduces:

- `readModelVersion`
- `readModelType`
- `generatedAt`
- `staleAt`
- `sourceRefs`
- `sourceCollections`
- `operationalCounts`
- `summaries`
- `routingSummary`
- `evidenceLinkageSummary`
- `canonicalSourceOfTruth: false`
- `projectionOnly: true`
- `autonomousActionsEnabled: false`
- `permissionWideningRequired: false`

Source references are internal metadata and are not primary human-facing labels.

## Summary concepts

Supported summary types:

| Summary type | Purpose |
| --- | --- |
| `operational_signal` | Generic operational command center signal projection. |
| `review_queue` | Manual operational review queue summary. |
| `review_workspace` | Governed review workspace summary. |
| `work_order` | Work-order operational summary. |
| `evidence_linkage` | Evidence/source reference summary. |
| `consent_routing` | Future consent/routing readiness summary. |

Supported read-model priorities:

- `critical`
- `warning`
- `needs_review`
- `upcoming`
- `info`

Supported read-model statuses:

- `open`
- `needs_review`
- `in_review`
- `blocked`
- `resolved`
- `closed`
- `informational`

## Projection and update expectations

Operational read models should be:

- deterministic
- reproducible from source records
- authority-scoped
- projection-safe
- explicitly versioned
- clearly non-authoritative

Future persisted read models should include:

- `generatedAt`
- `staleAt`
- `sourceRefs`
- `readModelVersion`
- projection profile or sensitivity metadata where applicable
- a documented rebuild path

They should be refreshed from source changes or events, not hand-edited as workflow truth.

## Consistency expectations

V1 makes no distributed consistency guarantee. It establishes the terminology and helper contract that future persisted read-model jobs should follow.

Expected consistency posture:

- source-of-truth records remain canonical
- read models may lag source records
- stale read models must be marked stale or regenerated
- workflow mutation must always write to canonical sources, not read-model outputs
- financial truth must remain in payment/ledger source collections

## Relationship to review and evidence systems

Operational read models may summarize:

- operational review routing decisions
- review workspace metadata
- evidence references
- scoped related-resource references

They must remain reference-based. Evidence payloads, raw provider material, unrestricted message bodies, and sensitive document contents must remain in their governed source/projection systems.

## Relationship to operational command center

The current `/operations` command center already derives visible signals and review queue items from existing source payloads. V1 does not replace that UI behavior.

The helper contract provides a future backend-safe projection vocabulary for:

- moving expensive joins out of UI-only aggregation
- reusing routing/review/evidence summaries consistently
- introducing rebuildable operational summaries
- preparing for larger review queues

## Known limitations

- No persisted operational read-model collection exists yet.
- No event adapter or distributed projection job exists yet.
- No Firestore index strategy is implemented in this PR.
- No operational command center route is migrated to read from the helper yet.
- No distributed stale/read repair workflow exists yet.
- No autonomous orchestration exists.
- No canonical workflow source is replaced.

## Future scaling roadmap

Recommended sequencing:

1. Inventory current `/operations` aggregation costs and query patterns.
2. Define a persisted landlord-scoped operational read-model collection only after authority and projection rules are reviewed.
3. Add rebuild jobs or event adapters that write projection summaries from canonical source records.
4. Add stale/read freshness metadata and safe fallback behavior.
5. Add operational read-model tests for command center, review queue, evidence linkage, and consent timelines.
6. Introduce governance-safe pagination and query budgets for large landlords.
7. Keep financial and operational read models separate.

## Governance guardrails

This mission preserves:

- no schema rewrites
- no auth changes
- no Firestore rules changes
- no visibility widening
- no autonomous behavior
- no financial mutation changes
- no source-of-truth replacement
- no hidden derived truth

## DO NOT IGNORE

- Operational read models must never become canonical workflow state.
- Payment and ledger read models must not replace financial source-of-truth collections.
- Evidence linkage must remain metadata/reference-based unless an explicit projection profile permits more.
- Internal IDs are lineage metadata, not primary UI labels.
- Tenant-safe projections must remain whitelist-based.
- Future persisted read models need rebuild semantics before institutional workflows depend on them.
