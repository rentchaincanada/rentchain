# Escalation Review Workspace Linking v1

## Summary

This mission adds metadata-only cross-workflow linkage between the admin security incident review surface and the admin support escalation review surface.

It does not add workflow mutation, approval, resolution, dismissal, remediation, escalation execution, tenant/landlord visibility, new permissions, new public routes, or raw payload access.

## Audit Findings

Reviewed foundations:

- `adminSecurityIncidents` provides metadata-only security incident summaries and details.
- `supportEscalationRunbooks` provides deterministic runbook templates, approval expectations, and prohibited action language.
- `supportEscalationHistory` provides append-only history and review note contracts.
- `adminSupportEscalations` provides metadata-only support escalation list/detail projections.
- Existing admin pages already expose safe detail panels for incidents and escalations.
- No approved persistent cross-workflow link store exists.

The safest first step is a derived read-model helper that can build links from already-safe incident, escalation, runbook, history, note, and evidence references.

## Relationship Types Added

Supported relationship types:

- `incident_to_escalation`
- `escalation_to_runbook`
- `escalation_to_history`
- `escalation_to_note`
- `escalation_to_evidence`
- `incident_to_evidence`
- `incident_to_review_workspace`

Unsupported relationship types fail closed and do not produce links.

## Link Metadata Contract

Each link includes:

- `linkId`
- `linkType`
- `sourceSummary`
- `targetSummary`
- `workflowFamily`
- `createdAt`
- `derivedAt`
- `metadataOnly: true`
- `visibilityClass: admin_support_internal`
- `tenantVisible: false`
- `landlordVisible: false`
- `appendCompatible: true`

Safety flags also explicitly state that support powers, impersonation, autonomous remediation, autonomous escalation, financial mutation, route visibility changes, and mutation controls are disabled.

## Surfaces Updated

Backend detail projections now include `relatedWorkspaceLinks`:

- admin security incident detail
- admin support escalation detail

Frontend detail panels now render these safe links in:

- `/admin/security/incidents`
- `/admin/support/escalations`

No new routes were added.
No mutation controls were added.

## Redaction and Projection Safety

Workspace links are built from safe summaries only.

They do not expose:

- raw notes
- raw tenant/landlord/user IDs as labels
- raw documents
- raw provider payloads
- screening reports
- storage paths
- tokens
- secrets
- credentials
- authorization headers
- cookies
- request/response bodies
- stack traces
- debug payloads
- unrestricted policy internals
- impersonation session IDs as visible labels

Labels that look like raw IDs, storage paths, credentials, or tokens are replaced with safe fallback labels.

## Persistence Decision

Persistence is not added in this mission.

Links are derived from existing metadata-only incident and escalation projections. A persistent append-only workspace link store should be a future mission after collection ownership, retention, and write authorization rules are explicitly approved.

## Known Limitations

- Cross-workflow links are derived from available safe references only.
- Incident-to-escalation links require an explicit safe incident reference on the escalation side.
- No workflow state transition, assignment, approval, dismissal, or remediation is implemented.
- No tenant/landlord-facing visibility is introduced.

## Future Roadmap

Recommended follow-ups:

1. Add append-only persisted workspace link records after storage governance is approved.
2. Add admin-only filtered views by linked workflow family.
3. Link security incident review suggestions to runbook templates without automated execution.
4. Add exportable admin-only workspace audit summaries with projection-safety tests.
5. Add manual note creation only after append-only write governance and sanitization rules are approved.

## Guardrail Confirmation

This mission does not widen permissions, change auth, change Firestore rules, add public routes, expose tenant/landlord escalation visibility, add raw payload exploration, create workflow mutation controls, enable impersonation, or introduce autonomous remediation/escalation.
