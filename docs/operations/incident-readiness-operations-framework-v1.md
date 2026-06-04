# Incident Readiness Operations Framework v1

## Scope

This framework centralizes Phase 3 operational incident readiness. It is documentation only. It does not add routes, Firestore collections, alerting, automation, token revocation, credential rotation, account locking, deployment configuration, dependencies, or production data changes.

Incident response remains manual, supervised, metadata-only, and internal to authorized operators.

## Source Documents

This framework consolidates:

- `docs/reports/security-audit-and-incident-response-foundations-v1.md`
- `docs/security/auth-incident-response-runbook-v1.md`
- `docs/runbooks/environment-separation-incident-response-v1.md`
- `docs/reports/support-escalation-runbooks-v1.md`
- `docs/security/recovery-workflow-security-audit-v1.md`
- `docs/security/audit-immutability-contract-v1.md`
- `docs/security/session-revocation-incident-scenarios-v1.md`
- `docs/operations/pilot-institution-operations-runbooks-v1.md`
- `docs/architecture/operational-risk-layer-v1.md`

## Incident Readiness Lifecycle

| Phase | Operator goal | Required posture |
| --- | --- | --- |
| Detection | Identify a signal that may indicate operational, security, projection, or recovery risk. | Use logs, admin review surfaces, support reports, canonical audit, and support-safe diagnostics only. |
| Triage | Classify category, severity, scope, and authority. | Use safe references and avoid raw IDs, tokens, provider payloads, storage paths, stack traces, or unrestricted debug data. |
| Containment | Stop additional impact while preserving evidence. | Prefer freeze, disablement, rollback, routing correction, or manual gate hold only after authority verification. |
| Remediation | Apply a reviewed manual correction or documented follow-up. | Do not perform destructive data changes without explicit authorization and append-safe audit linkage. |
| Closure | Confirm containment, remediation, evidence, and lessons learned. | Preserve post-incident summary and follow-up control validation. |

## Category Matrix

| Category | Examples | Primary authority | First response |
| --- | --- | --- | --- |
| `auth_session` | Login anomaly, suspected copied bearer value, session conflict. | Security lead with admin operator support. | Review auth/support timelines, validate scope, consider password reset or account disablement. |
| `credential_secret` | Signing secret, webhook secret, service account, provider credential concern. | Security lead, ops lead, founder for critical exposure. | Stop exposure, rotate manually through approved console, redeploy if needed, record credential family only. |
| `api_abuse` | Rate-limit triggers, public token probing, diagnostics scraping. | Ops lead or support lead. | Validate affected route, preserve request metadata, throttle through existing controls where available. |
| `document_upload` | Unsafe upload, oversized file, misleading extension. | Support lead with security review if sensitive. | Preserve metadata, block further handling, avoid copying raw document text. |
| `malware_suspected` | Suspicious attachment metadata or future scanner signal. | Security lead. | Quarantine through manual storage procedure if available; no scanner automation exists in Phase 3. |
| `export_projection` | Restricted field in export candidate, wrong audience projection. | Security lead and product owner. | Freeze export/review flow, inspect projection helpers, preserve affected safe refs. |
| `evidence_access` | Evidence link mismatch or unauthorized evidence request. | Support lead and security lead. | Stop evidence delivery, review consent/scope, preserve lineage metadata. |
| `tenant_data_exposure` | Cross-tenant or cross-landlord data visibility concern. | Founder and security lead. | Treat as critical, freeze affected surface, preserve evidence, avoid tenant-visible details until approved. |
| `admin_support_access` | Unexpected support console review or privileged access concern. | Security lead. | Review admin audit/support console events, remove privilege or disable account if warranted. |
| `webhook_provider` | Signature mismatch, provider retry anomaly, callback abuse. | Ops lead and security lead. | Preserve webhook metadata, verify signature posture, avoid provider payload copying. |
| `dependency_supply_chain` | Advisory, lockfile anomaly, package compromise concern. | Engineering lead and security lead. | Freeze dependency changes, review lockfile and CI evidence. |
| `infrastructure_deployment` | Wrong backend host, preview/prod mismatch, Terraform or Cloud Run drift. | Ops lead. | Follow environment separation response, preserve deployment metadata, roll back if active traffic is affected. |
| `suspicious_activity` | Incomplete or unknown anomaly. | Initial detector then support lead. | Record observed state and escalate for categorization. |
| `recovery_workflow` | Reconciliation failure, recovery gate anomaly, recovery log mismatch. | Ops lead with security lead for data risk. | Freeze recovery decisions, validate gate state, preserve `operatorRecovery*` and `canonicalEvents` evidence. |
| `audit_integrity` | Missing canonical event, append-only violation concern, timeline gap. | Security lead. | Preserve current records, stop dependent review decisions, investigate collection writer path. |

## Severity Classification

| Severity | Use when | Target initial response |
| --- | --- | --- |
| `informational` | Signal is useful context with no known active risk. | Next standard review cycle. |
| `low` | Limited or unconfirmed concern requiring tracking. | Same or next business day. |
| `medium` | Meaningful operational concern without confirmed exposure. | Same business day. |
| `high` | Sensitive data, privileged access, malware, evidence, or production-impact risk is plausible. | Immediate triage. |
| `critical` | Confirmed credential exposure, tenant data exposure, cross-landlord exposure, or severe active production risk. | Immediate containment and founder notification. |

## Manual Response States

Use the Phase 3 manual states consistently:

- `observed`
- `triaged`
- `investigating`
- `contained`
- `remediated`
- `closed`
- `false_positive`

These states are governance labels. They do not trigger automated action.

## Detection Signals

Operators may use:

- Admin security incident review at `/api/admin/security/incidents`.
- Observability incident readiness at `/api/admin/observability-incident-readiness`.
- Support console resource diagnostics.
- Canonical audit events in `canonicalEvents`.
- Recovery records in `operatorRecoveryLogs`, `operatorRecoveryIntents`, and `canonicalRecoveryTimelineEntries`.
- Deployment metadata from Vercel, Cloud Run, Terraform, and GitHub Actions.
- Manual support reports from tenants, landlords, internal operators, or institution recipients.

## Operator Roles

| Role | Responsibility | Limits |
| --- | --- | --- |
| Initial detector | Records signal and safe scope. | Does not contain or remediate without authority. |
| Support operator | Performs support-safe diagnostics and intake. | No cross-landlord browsing, raw payload copying, or hidden remediation. |
| Support lead | Owns support escalation and communication coordination. | Does not approve critical security containment alone. |
| Security lead | Owns security classification, privileged access review, credential and exposure response. | Must preserve audit lineage and redaction boundaries. |
| Ops lead | Owns deployment, environment separation, and recovery coordination. | Does not mutate production data without explicit authorization. |
| Founder | Receives critical notifications and approves exceptional containment where required. | Does not replace technical verification. |

## Multi-System Coordination

When an incident spans systems, classify the highest-risk category first, then attach secondary categories. Examples:

- Preview/staging separation plus recovery impact: `infrastructure_deployment` primary, `recovery_workflow` secondary.
- Support console misuse plus tenant data visibility: `tenant_data_exposure` primary, `admin_support_access` secondary.
- Credential exposure plus auth-session concern: `credential_secret` primary, `auth_session` secondary.
- Audit timeline gap plus recovery decision: `audit_integrity` primary, `recovery_workflow` secondary.

Contain the surface that can create additional impact first. Preserve evidence before changing settings or rotating credentials.

## Communication Chain

1. Initial detector notifies support lead or ops lead using safe incident summary.
2. Support or ops lead confirms category, severity, and affected scope.
3. Security lead is added for high, critical, access, credential, projection, evidence, or tenant-data incidents.
4. Founder is notified for critical incidents or any incident with confirmed tenant data exposure, confirmed credential exposure, or production write risk.
5. Product/engineering is assigned only after containment and evidence preservation.

## Post-Incident Analysis

Every high or critical incident requires:

- Timeline reconstruction from canonical audit, admin audit, support telemetry, deployment logs, and recovery records where relevant.
- Root cause classification: failed control, process gap, implementation gap, configuration drift, or unclear ownership.
- Remediation owner and deadline.
- Verification evidence.
- Runbook update if the procedure was unclear or incomplete.

## Phase 3 Boundaries

Phase 3 incident readiness does not include:

- Automated incident detection.
- Automated alerting.
- Automated token revocation.
- Automated credential rotation.
- Account locking automation.
- Incident persistence schema.
- Tenant-facing incident disclosure.
- External SIEM or ticketing integration.
- Autonomous remediation.
