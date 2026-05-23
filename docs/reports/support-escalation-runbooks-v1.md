# Support Escalation Runbooks v1

## Summary

This mission establishes RentChain's first governed support escalation runbook foundation. It defines metadata-only escalation categories, manual review states, severity handling, approval expectations, safe references, and runbook templates for future support/security operations.

No escalation persistence, routes, UI, support powers, impersonation powers, autonomous remediation, enforcement actions, Firestore rule changes, or tenant/landlord-facing support internals are introduced.

## Audit Findings

Existing foundations reviewed:

- `supportSessionAudit` defines support-session lifecycle metadata and scoped append-compatible audit refs.
- `impersonationGovernance` records support/admin impersonation lifecycle metadata and actor-chain attribution without adding persistence or revocation.
- `adminSupportProjectionSafety` strips support/admin internals from landlord, tenant, public export, user-safe export, dashboard, timeline, and analytics projections.
- `adminSecurityIncidents` provides an admin-only metadata review surface for security-relevant signals.
- `security-audit-and-incident-response-foundations-v1` defines incident categories, manual response states, and affected-resource linkage expectations.

No existing support escalation runbook helper, persistence model, or route family was found.

## Runbook Philosophy

Support escalation runbooks should provide deterministic manual-review guidance. They should answer:

- what kind of escalation is being reviewed
- how severe the escalation is
- which manual state it is in
- which scoped resources are relevant
- what approval level is expected before manual action
- what actions are explicitly prohibited

Runbooks are governance metadata. They are not permission grants, workflow engines, or action executors.

## Escalation Categories

Implemented categories:

- `security_incident`
- `impersonation_review`
- `policy_failure`
- `projection_safety`
- `document_access`
- `export_governance`
- `credential_secret`
- `api_abuse`
- `tenant_data_exposure`
- `screening_provider`
- `billing_support`
- `technical_diagnostics`
- `compliance_review`
- `other`

Unknown categories normalize to `other`.

## Severity Model

Implemented severities:

- `informational`
- `low`
- `medium`
- `high`
- `critical`

Unknown severities normalize to `low`.

## Manual States

Implemented states:

- `draft`
- `queued`
- `triage_required`
- `reviewing`
- `awaiting_approval`
- `approved_for_manual_action`
- `resolved`
- `dismissed`

Unsupported states normalize to `triage_required`. This avoids interpreting unknown or autonomous-looking states as valid workflow progress.

## Approval Expectations

Approval requirements are deterministic:

- Credential/secret and tenant data exposure escalations require `security_review`.
- Critical escalations require `security_review`.
- High severity escalations require `admin_review`.
- Impersonation, policy failure, and projection safety escalations require `admin_review`.
- Security incident, API abuse, and export governance escalations require `support_lead_review`.
- Low-risk metadata-only review defaults to `none_for_metadata_review`.

These requirements are descriptive metadata only. They do not grant access, mutate state, or execute actions.

## Safe References

Runbooks may include scoped internal references for:

- incidents
- support sessions
- impersonation sessions
- evidence packs
- export packages
- review workspaces
- API routes
- documents
- screening orders
- landlord, tenant, lease, property, and unit refs
- support diagnostics

References are filtered by landlord and tenant scope where provided. They are marked `internalReference: true` and `metadataOnly: true`.

Runbook references must not include raw documents, provider payloads, raw reports, request/response bodies, storage paths, tokens, secrets, credentials, stack traces, debug payloads, or unrestricted policy internals.

## Safety Contract

Every generated runbook ref includes:

- `visibilityClass: admin_support_internal`
- `tenantVisible: false`
- `landlordVisible: false`
- `metadataOnly: true`
- `appendCompatible: true`
- `supportPowersGranted: false`
- `impersonationEnabled: false`
- `autonomousRemediationEnabled: false`
- `autonomousEscalationEnabled: false`
- `financialMutationEnabled: false`
- `routeVisibilityChanged: false`

Payload safety is explicit:

- raw payloads are excluded
- provider, evidence, export, and document data are reference-only
- credential data is excluded
- diagnostic data is metadata-only
- internal policy data is summary-only

## Current Implementation

Added helper:

- `normalizeSupportEscalationCategory()`
- `normalizeSupportEscalationSeverity()`
- `normalizeSupportEscalationState()`
- `approvalRequirementForEscalation()`
- `buildSupportEscalationRunbookTemplate()`
- `normalizeSupportEscalationRefs()`
- `buildSupportEscalationRunbookRef()`

Added deterministic tests confirming:

- category, severity, and state normalization
- approval requirement derivation
- metadata-only template generation
- scoped safe reference filtering
- raw/restricted fields are not carried into refs
- runbook refs do not imply support powers, impersonation, autonomous remediation, autonomous escalation, route visibility change, or financial mutation
- unsupported inputs fail into safe defaults

## Known Limitations

This mission does not add:

- escalation persistence
- Firestore collections
- routes
- frontend UI
- status mutation
- automated escalation
- external alerting or SIEM integration
- support/admin permission changes
- tenant or landlord visible escalation surfaces
- incident status writes

Runbook refs are deterministic helper outputs only. A future mission must explicitly review persistence, retention, route authorization, and audit append semantics before storing or mutating escalation records.

## Future Roadmap

Recommended follow-ups:

1. Add append-only support escalation history after persistence and retention requirements are approved.
2. Link admin security incident review records to runbook template suggestions without enabling automated remediation.
3. Add admin-only escalation review UI once projection and route authorization are reviewed.
4. Define manual escalation status transitions with audit lineage.
5. Add incident/export/evidence-specific runbook detail pages that remain metadata-only.

## Guardrail Confirmation

This mission does not widen permissions, change auth, change Firestore rules, expose support internals to landlords or tenants, create routes, create public endpoints, mutate financial records, alter screening/provider/payment/lease flows, add dependencies, or introduce autonomous remediation.
