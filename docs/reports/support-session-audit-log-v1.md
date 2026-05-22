# Support Session Audit Log Foundation v1

## Summary

This report establishes RentChain's first support-session audit continuity model. It defines deterministic metadata for future privileged support sessions without adding support powers, impersonation powers, routes, persistence, tenant-visible surfaces, or autonomous escalation.

The implementation is metadata-only. The helper in `rentchain-api/src/lib/supportSessionAudit/supportSessionAudit.ts` prepares append-compatible audit references that can later be written by an explicitly reviewed audit/event adapter.

## Philosophy

Support-session audit records should answer who accessed privileged operational context, why the access was needed, what scoped resources were referenced, and which manual review expectations apply. They must not become permission grants.

The audit model is:

- scoped to landlord and tenant context where present
- internal to admin/support governance
- append-compatible for future immutable audit/event logs
- metadata/reference-based only
- safe for incident, evidence, export, review, and diagnostics linkage
- explicit that no impersonation or autonomous support behavior is enabled

## Lifecycle States

| State | Meaning |
| --- | --- |
| `requested` | A support session or privileged review request has been proposed but is not active. |
| `active` | A manually authorized support context is active. This state is descriptive only in this foundation. |
| `paused` | A support context is temporarily paused. |
| `ended` | A support context completed normally. |
| `expired` | A support context is no longer valid because its time window elapsed. |
| `revoked` | A support context was manually revoked. |
| `denied` | A support request was rejected. |

Unknown or unsupported states normalize to `requested` so future callers fail into a non-granting default.

## Reason Categories

| Reason | Expected Use |
| --- | --- |
| `customer_support` | Customer-requested operational help. |
| `incident_review` | Security or operational incident investigation. |
| `evidence_review` | Evidence pack or evidence-linkage review. |
| `export_review` | Tenant trust or institutional export review. |
| `screening_review` | Screening workflow investigation without raw provider payload exposure. |
| `billing_support` | Billing or account support context. |
| `technical_diagnostics` | Deployment, route, or diagnostic investigation. |
| `security_investigation` | Credential, abuse, access, or suspicious activity investigation. |
| `compliance_review` | Governance or compliance review context. |
| `other` | Explicit fallback for unsupported reasons. |

Unsupported reasons normalize to `other` instead of broadening semantics.

## Scoped Resource References

Support-session resource references are internal lineage metadata. They are not user-facing labels and do not authorize access.

Allowed reference metadata is intentionally narrow:

- `resourceType`
- `resourceId`
- `label`
- `landlordId`
- `tenantId`
- `internalReference: true`

Supported resource types include landlord, tenant, lease, property, unit, payment, ledger entry, evidence pack, export package, review workspace, incident, API route, document, screening order, and support diagnostic references.

References are filtered to the provided landlord scope. When a tenant scope is provided, references with a conflicting tenant are excluded. The helper does not include raw storage paths, provider payloads, report bodies, export contents, evidence payloads, debug payloads, tokens, secrets, or route-source internals.

## Audit Metadata Contract

`SupportSessionAuditRef` includes:

- `supportSessionAuditVersion`
- deterministic `supportSessionAuditId`
- `sessionId`
- normalized lifecycle state
- normalized access reason
- actor and approver references
- landlord and optional tenant scope
- start/end/occurrence timestamps
- scoped resource/evidence/export/incident/review references
- concise summary
- `auditExpectation: manual_append_only`
- `visibilityClass: admin_support_internal`
- explicit non-granting flags

The non-granting flags are required:

- `tenantVisible: false`
- `metadataOnly: true`
- `appendCompatible: true`
- `supportPowersGranted: false`
- `impersonationEnabled: false`
- `autonomousEscalationEnabled: false`
- `financialMutationEnabled: false`

The payload safety summary is required to remain exclusion/reference-only metadata:

- `sensitiveData: excluded`
- `restrictedData: excluded`
- `providerData: reference_only`
- `evidenceData: reference_only`
- `exportData: reference_only`
- `credentialData: excluded`
- `diagnosticData: metadata_only`

## Tenant Visibility Rules

No tenant-visible support-session audit surface is introduced in this phase.

Support-session metadata remains admin/support internal. Future tenant-facing transparency features would require a separate projection contract and review to avoid exposing privileged operational internals, incident details, or support diagnostics.

## Incident, Evidence, Export, and Review Linkage

Support-session audit metadata may reference incident, evidence, export, and review resources only by scoped metadata references. It must not duplicate:

- raw evidence payloads
- raw provider or screening reports
- export package contents
- unrestricted message bodies
- payment credentials
- tokens or secrets
- stack traces or debug payloads

Future incident or review surfaces should treat support-session references as lineage context, not as access grants.

## Current Implementation

Added helper:

- `normalizeSupportSessionState()`
- `normalizeSupportAccessReason()`
- `normalizeSupportSessionResourceRefs()`
- `buildSupportSessionAuditRef()`

Added tests confirming:

- lifecycle states normalize deterministically
- reason categories normalize deterministically
- unrelated landlord and tenant references are excluded
- restricted/raw/provider/token/debug fields are not carried into audit metadata
- tenant visibility remains false by default
- metadata does not imply support powers, impersonation, autonomous escalation, or financial mutation
- invalid actor roles normalize to `unknown`
- audit refs remain append-compatible

## Known Limitations

This phase does not implement:

- live support-session persistence
- a Firestore support session collection
- support-session start/end routes
- an impersonation framework
- support access powers
- tenant-visible support audit views
- autonomous escalation
- external alerting or SIEM integration

The helper is a contract foundation only. Runtime writes and operational controls must be introduced in later scoped missions with explicit authority checks and append-only audit semantics.

## Future Roadmap

Recommended follow-ups:

1. Define an append-only support-session audit writer after persistence and retention requirements are reviewed.
2. Add impersonation governance and audit semantics without adding implicit impersonation powers.
3. Add admin/support projection safety regression tests for future privileged surfaces.
4. Link support-session refs to security incident review surfaces.
5. Add support escalation runbooks with manual approval expectations.
6. Define retention, exportability, and incident response expectations for support-session audit records.

## Guardrail Confirmation

This mission does not change auth behavior, JWT format, Firestore rules, route visibility, Firestore schema, document visibility, export visibility, or tenant projections. It does not introduce new support/admin powers, impersonation, autonomous escalation, financial mutation, or tenant-visible support internals.
