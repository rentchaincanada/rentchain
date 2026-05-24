# Governed Review Workspace Foundations v1

## Summary

This mission adds a metadata-only governed review workspace summary model that can group security incidents, support escalations, runbooks, escalation history, review notes, evidence references, workspace links, and audit/export readiness context.

It does not add persistence, new routes, public routes, mutation controls, automation, remediation, approval/resolution/dismissal actions, tenant/landlord visibility, or raw payload access.

## Audit Findings

Reviewed foundations:

- `adminSecurityIncidents` provides admin-only, metadata-only incident list/detail projections.
- `supportEscalationRunbooks` provides deterministic runbook templates, severity, approval expectations, and prohibited action language.
- `supportEscalationHistory` provides append-compatible history entries and manual review note contracts.
- `adminSupportEscalations` provides admin-only, metadata-only escalation list/detail projections.
- `escalationReviewWorkspaceLinks` provides derived metadata-only links between incidents, escalations, runbooks, history, notes, and evidence references.

No approved governed review workspace persistence store exists yet, so this mission keeps workspace summaries derived from existing safe metadata.

## Helper / Read Model Added

Added:

- `rentchain-api/src/lib/governedReviewWorkspaces/governedReviewWorkspaces.ts`

The helper defines:

- workspace type normalization
- safe workspace summary construction
- incident-derived workspace summaries
- escalation-derived workspace summaries
- metadata-only flags
- safe evidence reference normalization
- safe workspace link inclusion

## Workspace Types

Supported workspace types:

- `security_review`
- `support_escalation_review`
- `export_governance_review`
- `evidence_review`
- `policy_failure_review`
- `projection_safety_review`
- `operational_readiness_review`
- `other`

Unknown workspace types normalize to `other`.

## Summary Fields

Each governed workspace summary includes:

- `workspaceId`
- `workspaceType`
- `title`
- `summary`
- `workflowFamily`
- `severitySummary`
- `reviewStateSummary`
- `relatedIncidentCount`
- `relatedEscalationCount`
- `relatedEvidenceCount`
- `relatedNoteCount`
- `approvalExpectationSummary`
- `safeEvidenceRefs`
- `relatedWorkspaceLinks`
- metadata-only/internal visibility flags

## Surfaces Changed

Existing admin detail projections now include a safe `governedReviewWorkspace` summary:

- admin security incident detail
- admin support escalation detail

Existing admin pages render the safe summary in their detail panels:

- `/admin/security/incidents`
- `/admin/support/escalations`

No new routes are added.
No mutation controls are added.

## Redaction and Projection Safety

Workspace summaries never expose:

- raw actor IDs as labels
- raw tenant/landlord IDs as labels
- raw documents
- raw provider payloads
- raw screening reports
- raw storage paths
- tokens
- secrets
- credentials
- request/response bodies
- stack traces
- debug payloads
- unrestricted policy internals
- impersonation session IDs as labels

Labels that look like raw IDs, storage paths, credentials, or tokens are replaced with safe fallback text. Evidence refs are internal, metadata-only, and stripped of landlord/tenant IDs in the workspace summary layer.

## Persistence Decision

Persistence is deferred.

The workspace summary model is derived from already-projected admin/support metadata. A persistent workspace store should be introduced only after collection ownership, append-only write semantics, retention, and admin/support route authorization are explicitly approved.

## Known Limitations

- Workspace summaries are derived from currently available safe metadata only.
- There is no workspace assignment, status mutation, note writing, approval, resolution, dismissal, or automation.
- Cross-workflow grouping remains read-model-only until an approved append-only workspace store exists.

## Future Roadmap

Recommended follow-ups:

1. Add append-only governed workspace records after storage governance is approved.
2. Add admin-only workspace list/detail routes after persistence is approved.
3. Add manual workspace notes only with strict sanitization and append-only writes.
4. Link governed workspaces to export/audit readiness summaries without exposing raw payloads.
5. Add institutional audit export summaries scoped to admin/support audiences only.

## Guardrail Confirmation

This mission does not widen permissions, change auth, change Firestore rules, add public routes, add tenant/landlord visibility, expose raw payloads, add mutation controls, enable impersonation, or introduce autonomous remediation/escalation.
