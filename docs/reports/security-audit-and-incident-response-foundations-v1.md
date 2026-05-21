# Security Audit and Incident Response Foundations v1

## Executive Summary

This mission establishes RentChain's first security incident-response governance language and metadata foundation. It defines incident categories, severity levels, manual response states, affected-resource linkage expectations, and evidence/audit linkage guidance.

The implementation adds a metadata-only helper and deterministic tests. It does not write incidents to Firestore, create alerts, rotate credentials, revoke tokens, disable users, lock accounts, expose tenant-visible incident internals, or integrate external SIEM/alerting vendors.

## Incident Taxonomy

| Category | Meaning | Example signals | First response posture |
| --- | --- | --- | --- |
| `auth_session` | Login/session/token behavior requiring review. | unusual login failures, suspected session issue, logout/token handling concern | manual auth/session review |
| `credential_secret` | Credential, API key, token, signing secret, or service account risk. | leaked key, suspicious secret access, webhook secret exposure | manual containment and rotation runbook review |
| `api_abuse` | Request-rate, probing, scraping, or abuse signal. | rate-limit triggers, public token probing, diagnostics scraping | manual abuse triage |
| `document_upload` | Unsafe or suspicious file/document handling. | unsupported MIME, oversized file, misleading extension, expired signed URL issue | manual document governance review |
| `malware_suspected` | Potential malware or unsafe attachment signal. | future scanner finding, suspicious upload metadata | manual containment; no scanner automation exists yet |
| `export_projection` | Evidence/export/projection safety concern. | restricted field discovered in export candidate, unrelated resource linkage | manual projection review |
| `evidence_access` | Evidence pack or source-lineage access issue. | wrong scope ref, evidence link mismatch, unauthorized evidence request signal | manual evidence access review |
| `tenant_data_exposure` | Possible tenant data visibility or projection leak. | cross-tenant record inclusion, tenant-safe projection failure | critical manual investigation |
| `admin_support_access` | Admin/support access governance concern. | support console review, impersonation/delegation concern | admin-only manual review |
| `webhook_provider` | Provider callback/signature/idempotency concern. | webhook signature mismatch, provider retry anomaly | manual provider-webhook review |
| `dependency_supply_chain` | Dependency, build, package, or supply-chain concern. | advisory, lockfile concern, unexpected package behavior | manual dependency review |
| `infrastructure_deployment` | Deployment, env, Vercel/Cloud Run, or Terraform drift concern. | preview/prod env mismatch, deployment security header issue | manual platform review |
| `suspicious_activity` | General suspicious activity not yet categorized. | incomplete signal, unknown operational anomaly | manual triage |

## Severity Definitions

| Severity | Meaning | Example |
| --- | --- | --- |
| `informational` | Useful security context, no active risk known. | closed false-positive review note |
| `low` | Limited or unconfirmed concern requiring tracking. | suspicious but low-impact deployment metadata mismatch |
| `medium` | Operationally meaningful security concern without confirmed exposure. | API abuse signal, webhook anomaly, document validation concern |
| `high` | Significant risk, production impact, or sensitive data involvement. | malware suspected, tenant evidence access concern, admin/support access concern |
| `critical` | Confirmed credential/tenant-data exposure or severe active risk. | confirmed secret exposure, confirmed tenant data leak |

Severity is a review classification. It does not trigger automatic locking, revocation, rotation, or remediation.

## Manual Response States

| State | Meaning |
| --- | --- |
| `observed` | Signal recorded or metadata prepared for review. |
| `triaged` | Reviewed enough to classify category/severity. |
| `investigating` | Manual investigation is active. |
| `contained` | Manual containment has occurred, but remediation is incomplete. |
| `remediated` | Manual remediation completed. |
| `closed` | Incident review closed. |
| `false_positive` | Signal reviewed and found non-incident. |

These are manual states only. They do not imply an automated workflow engine.

## Incident Metadata Contract

The first-pass helper defines metadata concepts:

- `incidentGovernanceVersion`
- `incidentId`
- `category`
- `severity`
- `responseState`
- `title`
- `summary`
- `detectedAt`
- `updatedAt`
- `affectedResources`
- `evidenceLinks`
- `auditExpectation`
- `visibilityClass`
- `sensitivityClass`
- manual-only safety flags
- `redactionSummary`

This is not a Firestore schema. It is a governance contract for future incident records, review workspaces, and audit/event adapters.

## Affected-Resource Linkage

Affected resources should remain reference-based and scoped:

- resource type
- resource ID as internal reference
- safe label
- landlord ID if applicable
- tenant ID only when scoped and necessary
- `internalReference: true`

Allowed first-pass resource types:

- landlord
- tenant
- lease
- property
- unit
- payment
- ledger entry
- evidence pack
- document
- export package
- webhook
- API route
- credential
- deployment
- dependency
- review workspace

Affected-resource refs must not include raw documents, raw provider payloads, unrestricted message bodies, tokens, stack traces, or debug payloads.

## Evidence and Export Linkage

Incident metadata may reference evidence packs and source lineage, but it must not duplicate restricted payloads. Evidence links should carry:

- evidence ID
- safe label
- source collection
- source ID
- sensitivity class
- `internalReference: true`

Evidence and export incidents should align with:

- evidence projection profiles
- institutional export allowlist profiles
- tenant-safe projection contracts
- canonical event taxonomy
- structured logging redaction

## Credential, Document, and Access Incident Handling Notes

Credential incidents:

- Never store exposed secret values in incident metadata.
- Record credential family and affected system as labels/references only.
- Use a separate approved manual rotation runbook for live rotation.

Document incidents:

- Do not duplicate uploaded file bytes or extracted raw document text.
- Record document metadata and storage reference lineage only.
- Malware status should be reviewed manually until scanner infrastructure exists.

Access incidents:

- Do not expose incident internals to tenants.
- Keep admin/support concerns in internal security or admin-support visibility.
- Preserve server-side authority and landlord/tenant scoping.

## Relationship to Existing Foundations

This incident-response foundation builds on:

- `frontend-security-headers-and-csp-v1`
- `session-and-token-governance-hardening-v1`
- `api-rate-limit-and-abuse-protection-v1`
- `document-upload-and-malware-governance-v1`
- `secret-rotation-and-env-governance-v1`
- structured logging redaction
- projection safety tests
- evidence projection profiles
- institutional export allowlists
- review workspace governance
- canonical event taxonomy

## Known Limitations

- No live incident response automation exists.
- No external alerting integration exists.
- No token revocation automation exists.
- No credential rotation automation exists.
- No account locking automation exists.
- No malware scanner integration exists.
- No SIEM integration exists.
- No Firestore incident collection is introduced in this mission.
- No tenant-visible incident projection is introduced.

## Future Incident-Response Roadmap

Recommended future missions:

1. `docs/security-incident-runbooks-v1`
2. `fix/security-incident-event-adapter-v1`
3. `feat/admin-security-incident-review-surface-v1`
4. `fix/webhook-verification-and-idempotency-hardening-v1`
5. `fix/secret-rotation-runbook-execution-controls-v1`
6. `fix/document-malware-scanning-integration-v1`
7. `feat/security-abuse-telemetry-dashboard-v1`
8. `fix/admin-support-access-governance-v1`
9. `fix/dependency-supply-chain-governance-v1`

## Do Not Ignore

- Confirmed credential or tenant-data exposure must be treated as `critical`.
- Raw secrets, provider payloads, raw documents, raw CSV, unrestricted message bodies, stack traces, and debug payloads must never be copied into incident metadata.
- Future incident records must remain permission-scoped and internal/admin-only unless a later tenant-safe incident notification model is explicitly designed.
- Incident classification must not become autonomous remediation.
- Any actual credential rotation must happen through a controlled manual runbook, not a metadata helper.

## Confirmation

This mission does not:

- add autonomous remediation;
- auto-disable users;
- auto-revoke tokens;
- rotate credentials;
- change auth behavior;
- change Firestore rules;
- broaden route visibility;
- expose incident details to tenants;
- create external alerting integrations;
- add SIEM/vendor dependencies;
- mutate financial records.
