# Multi-System Incident Coordination v1

## Scope

This document defines manual coordination for incidents that span multiple Phase 3 systems. It does not implement orchestration, alerting, ticketing, storage, routes, or automated remediation.

## Multi-System Recognition

Treat an incident as multi-system when one signal affects more than one of:

- authentication/session;
- credential or secret;
- environment separation;
- deployment or infrastructure;
- recovery workflow;
- support/admin access;
- audit integrity;
- evidence/export/projection;
- institution review or support operations;
- security telemetry or observability.

## Common Multi-System Scenarios

| Scenario | Primary category | Secondary categories | First freeze |
| --- | --- | --- | --- |
| Preview code affected recovery workflow | `infrastructure_deployment` | `recovery_workflow`, `audit_integrity` | Freeze recovery decisions for affected workflow. |
| Production token used in staging recovery | `auth_session` | `infrastructure_deployment`, `recovery_workflow` | Freeze affected session/recovery path and inspect environment routing. |
| Support console misuse exposed tenant metadata | `tenant_data_exposure` | `admin_support_access`, `projection_safety` | Stop support access to affected scope. |
| Credential exposure affects webhook callbacks | `credential_secret` | `webhook_provider`, `infrastructure_deployment` | Rotate credential manually after evidence capture. |
| Export projection leak found during incident review | `export_projection` | `evidence_access`, `audit_integrity` | Freeze export/evidence delivery. |
| Canonical audit gap during recovery incident | `audit_integrity` | `recovery_workflow` | Hold reconciliation and preserve all audit sources. |

## Coordination Procedure

1. Assign one incident coordinator.
2. Identify primary category by highest impact.
3. Attach secondary categories.
4. Assign authority owners for each category.
5. Decide first freeze target.
6. Preserve evidence from all systems before making configuration changes.
7. Create one timeline with source-specific evidence refs.
8. Communicate through the shared incident template.
9. Close only after every system owner signs off.

## First Freeze Decision Tree

1. If tenant data or external recipient exposure is active, freeze user-facing projection/export/evidence surface first.
2. If wrong environment may write production data, freeze deployment or route first.
3. If recovery decisions may mutate or certify wrong state, freeze recovery workflow first.
4. If credential exposure is confirmed, stop active exposure first, then rotate manually.
5. If privileged access is suspicious, remove access or disable account after security lead approval.
6. If audit evidence is at risk, stop dependent decisions and preserve records first.

## Authority Coordination

| System | Authority owner |
| --- | --- |
| Auth/session | Security lead |
| Credential/secret | Security lead |
| Deployment/environment | Ops lead |
| Recovery workflow | Ops lead |
| Support/admin access | Security lead |
| Projection/evidence/export | Security lead with product owner |
| Audit integrity | Security lead |
| Institution operations | Support lead |

The incident coordinator tracks decisions but does not inherit all authorities.

## Timeline Reconciliation

Build one timeline with entries from:

- `canonicalEvents`;
- admin audit events;
- support console canonical events;
- support security telemetry summaries;
- recovery intents, logs, and timeline entries;
- deployment events from GitHub Actions, Vercel, Terraform, and Cloud Run;
- environment guard or runtime metadata;
- manually reported support timestamps.

Each timeline entry should include:

- occurred at;
- system;
- source ref;
- actor or system role;
- action summary;
- response state;
- raw IDs included: no.

## Evidence Collection

Allowed evidence:

- safe route labels;
- deployment SHA;
- backend revision;
- canonical audit safe ref;
- support diagnostic safe ref;
- recovery safe ref;
- incident category and severity;
- redacted screenshots that show no private payloads.

Prohibited evidence:

- bearer tokens;
- secret values;
- raw provider payloads;
- raw documents or reports;
- raw Firestore document IDs shared outside authorized console context;
- stack traces in shared incident notes;
- private messages or unrestricted debug payloads.

## Coordination Update Template

```text
Multi-system incident update:
Primary category:
Secondary categories:
Severity:
Coordinator:
Authority owners:
First freeze:
Affected systems:
Affected scope safe refs:
Timeline sources:
Containment status:
Open decisions:
Next update:
```

## Closure Criteria

Close a multi-system incident only when:

- primary and secondary category owners confirm containment;
- affected surface is verified safe;
- audit timeline is reconstructed or limitations are documented;
- communication obligations are complete;
- follow-up remediations have owners;
- no unresolved high or critical decision remains.
