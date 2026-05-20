# Review Workspace Foundations v1

## Executive Summary

Review Workspace Foundations v1 introduces the first governed operational review workspace contract for RentChain. It is intentionally narrow: it defines deterministic review workspace metadata, scoped evidence linkage, related resource references, assignment state, review state, and future audit/event compatibility without adding autonomous workflows, broad route changes, cross-tenant visibility, institutional sharing, or external collaboration.

This mission extends the existing `operatorReviewSessions` direction rather than replacing it. Operator review sessions remain the current manual review envelope. Review workspaces provide a higher-level operational coordination contract that can bridge into existing operator review session requests.

## Scope

Allowed v1 workspace types:

- evidence review
- payment/ledger review
- screening review
- operational anomaly review
- document review
- delinquency review

Not in scope:

- autonomous AI action
- auto-decisioning
- cross-landlord or cross-tenant review
- public sharing
- tenant-visible review internals
- institutional review sharing
- export expansion
- Firestore rule changes
- route visibility changes

## Contract Summary

The v1 workspace contract includes:

- `workspaceId`
- `workspaceContractVersion`
- `workspaceType`
- `workspaceScope`
- `workspaceScopeId`
- `landlordId`
- `assignedReviewer`
- `reviewStatus`
- `reviewPriority`
- `evidenceRefs`
- `relatedResourceRefs`
- `createdFromEvent`
- `createdBy`
- `createdAt`
- `updatedAt`
- `reviewSummary`
- `reviewNotes`
- `reviewTags`
- `auditRefs`
- `sensitivityClass`
- `visibilityClass`
- manual and safety flags

Version:

- `review_workspace_foundation_v1`

## Safety Flags

Every v1 review workspace is explicit about non-automation:

- `manualOnly: true`
- `autonomousActionsEnabled: false`
- `externalSharingEnabled: false`
- `institutionalSharingEnabled: false`
- `financialMutationEnabled: false`

These flags are not permission enforcement by themselves. They are contract metadata for review, tests, and future routing compatibility.

## Evidence Linkage

Workspace evidence references are metadata-only references to evidence packs/items and source collection IDs where practical. They do not duplicate raw evidence payloads.

Evidence refs may include:

- evidence pack ID
- evidence item ID
- safe label
- source collection
- source ID
- sensitivity class

Evidence refs must not include:

- raw provider payloads
- raw CSV values
- payment credentials
- raw screening reports
- debug payloads
- private message bodies

## Relationship Linkage

Related resource references are scoped by landlord and, when provided, tenant. References outside the workspace landlord/tenant scope are excluded during normalization.

Supported resource types:

- lease
- tenant
- property
- unit
- payment
- ledger entry
- screening order
- document
- decision
- canonical event
- evidence pack

Resource references are for relationship continuity and routing. They are not a license to expose raw source records.

## Audit and Event Compatibility

Review workspaces are compatible with the canonical event taxonomy direction. The v1 contract includes:

- `createdFromEvent`
- `auditRefs`
- `reviewStatus`
- `reviewPriority`
- `sensitivityClass`
- `visibilityClass`

This PR does not implement a runtime canonical event adapter or event bus. Future adapters should treat review workspace creation and state transitions as append-oriented operational workflow events.

## Operator Review Session Compatibility

Review workspaces can be converted into the existing `OperatorReviewOpenRequest` shape for compatibility with current manual review session infrastructure.

Mapping is intentionally conservative:

- `delinquency_review` -> `delinquency`
- `evidence_review` and `document_review` -> `audit_compliance`
- other workspace types -> `workflow`

## Governance Risks Found

Current review infrastructure already has useful manual-only operator review session helpers, but review concepts are distributed across decisions, evidence packs, readiness profiles, institutional docs, and operational routes.

Risks before this foundation:

- no shared higher-level workspace contract
- review routing metadata spread across multiple domains
- evidence/review linkage represented inconsistently
- future review workspaces could accidentally duplicate sensitive payloads without an explicit contract

## Remaining Follow-Ups

Recommended next missions:

1. `feat/review-workspace-route-preview-v1`
2. `test/review-workspace-route-scoping-v1`
3. `feat/operator-review-session-workspaces-v1`
4. `fix/review-workspace-evidence-pack-linking-v1`
5. `docs/review-workspace-event-adapter-plan-v1`

## DO NOT IGNORE

- Review workspaces must remain landlord/admin scoped.
- Review workspace metadata must not mutate financial truth, ledger entries, decision derivation, or evidence source records.
- Evidence refs and resource refs are lineage metadata, not raw payload copies.
- Future institutional sharing requires separate export/profile governance.
- Future agent or automation routing must remain supervised and policy-gated; this foundation does not authorize autonomous actions.
