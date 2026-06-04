# Incident Response Communication Templates v1

## Scope

These templates standardize internal incident communications. They are documentation only and do not create notification systems, tenant-facing notices, ticketing integrations, or external communications.

Templates must preserve audience boundaries. Do not include raw IDs, tokens, secrets, credentials, provider payloads, storage paths, stack traces, raw documents, raw reports, private messages, or unrestricted debug data.

## Audience Rules

| Audience | Safe content | Prohibited content |
| --- | --- | --- |
| Operators | Category, severity, safe refs, route labels, deployment labels, containment status, evidence refs. | Secrets, bearer values, raw provider payloads, raw documents, stack traces. |
| Support team | User-facing impact summary, support procedure, safe workflow labels, approved wording. | Admin-only internals, raw telemetry, IP addresses, full user agents, tenant-private rationale. |
| Founder | Critical summary, business impact, containment status, timeline, owner, next decision. | Secret values, raw payloads, unnecessary raw identifiers. |
| Product/engineering | Repro steps using safe refs, affected route/service labels, expected vs observed behavior. | Production data extracts, credentials, unrestricted debug dumps. |

## Internal Operator Incident Report

```text
Incident report:
Incident ID:
Detected at:
Detected by:
Category:
Severity:
Response state:
Affected systems:
Affected scope safe refs:
Tenant visible: no
Landlord visible: no
Raw IDs included: no
Secret or token included: no
Provider payload included: no

Observed signal:
Initial risk:
Immediate containment:
Authority:
Evidence refs:
Next review time:
Owner:
```

## Founder Critical Notification

```text
Founder notification:
Severity: critical
Category:
Detected at:
Current response state:
Affected system summary:
Affected scope safe refs:
Confirmed impact:
Potential impact:
Containment completed:
Containment pending:
Decision needed:
Next update by:
Owner:

Redaction note:
This summary excludes raw identifiers, secrets, tokens, provider payloads, raw documents, and internal debug output.
```

Use only when founder notification criteria in `docs/operations/incident-escalation-authority-v1.md` are met.

## Support Team Notification

```text
Support notification:
Category:
Severity:
Affected support procedure:
User-facing impact summary:
Approved support response:
Do not disclose:
Current status:
Escalation owner:
Next update:
Safe resource labels:
```

Example approved wording for auth/access issues:

```text
Access is under manual review. Continue using the standard authenticated flow. Do not request or share credentials, tokens, private documents, or screenshots of restricted account data.
```

## Recovery Workflow Incident Update

```text
Recovery workflow incident update:
Workflow family:
Recovery safe ref:
Gate or intent status:
Affected endpoint label:
Containment:
Canonical audit linkage checked:
Operator recovery records preserved:
Next action:
Owner:
```

Do not include raw workflow IDs, raw lease IDs, raw user IDs, raw state payloads, or private reasons.

## Environment Separation Incident Update

```text
Environment incident update:
Deployment SHA:
Frontend environment:
Backend revision:
Expected API host label:
Observed API host label:
Firestore target verified:
Credential exposure suspected:
Containment:
Rollback status:
Next verification:
Owner:
```

Do not include environment secret values, service account material, or raw credential paths.

## Credential Incident Update

```text
Credential incident update:
Credential family:
Affected system:
Exposure location safe ref:
Rotation required:
Rotation owner:
Runtime reload required:
Old value verification planned:
Current status:
Next update:
```

Never paste credential material into this template.

## Post-Incident Summary

```text
Post-incident summary:
Incident ID:
Category:
Severity:
Opened at:
Closed at:
Owner:
Affected systems:
Affected scope safe refs:

Timeline:
- observed:
- triaged:
- investigating:
- contained:
- remediated:
- closed:

Root cause:
Failed control:
Containment actions:
Remediation:
Verification:
Follow-up actions:
Runbook updates:
Residual risk:

Redaction confirmation:
- raw IDs excluded
- tokens/secrets excluded
- provider payloads excluded
- raw documents excluded
- stack traces excluded
```

## Redaction Procedure

Before sending any incident communication:

1. Search for bearer-like values, secret-like keys, provider payload labels, storage URLs, and stack trace fragments.
2. Replace raw account, tenant, landlord, lease, unit, payment, evidence, export, and workflow IDs with safe refs or labels.
3. Remove screenshots that show private payloads.
4. Confirm audience is allowed to see the incident category and scope.
5. Keep tenant-visible and landlord-visible fields out of internal incident communications unless an approved external notification model exists.

## Communication Update Cadence

| Severity | Update cadence |
| --- | --- |
| `informational` | At closure or next review. |
| `low` | At triage and closure. |
| `medium` | At triage, containment, and closure. |
| `high` | At triage, containment, every material change, and closure. |
| `critical` | Immediate initial notification, frequent updates during containment, closure summary, and post-incident review. |
