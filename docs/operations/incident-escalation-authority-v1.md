# Incident Escalation Authority v1

## Scope

This document defines manual escalation authority for Phase 3 incidents. It does not grant permissions, change roles, create routes, automate escalation, or mutate production data.

## Authority Principles

- Verify the operator's server-side role or permission before granting incident response authority.
- Use the least broad response authority needed for the incident.
- Treat missing, ambiguous, or cross-scope authority as denied until reviewed.
- Keep all incident internals `admin_support_internal`.
- Use safe references and metadata-only summaries in all escalation requests.

## Escalation Roles

| Role | May do | Must not do |
| --- | --- | --- |
| Initial detector | Report observed signal and safe scope. | Contain, rotate, disable, or modify production state without authority. |
| Support operator | Triage support-safe diagnostics and gather metadata. | Access raw payloads, widen scope, or disclose internal details to tenants/landlords. |
| Support lead | Approve support escalation, communication, and operational triage. | Approve credential or tenant-data critical containment alone. |
| Security lead | Classify security incidents, approve privileged containment, review credential/access/projection risk. | Skip audit preservation or perform unapproved destructive changes. |
| Ops lead | Coordinate deployment, environment, recovery workflow, and rollback procedure. | Change CI/CD or infrastructure outside approved runbook. |
| Founder | Receive critical notifications and authorize exceptional business-impact containment. | Replace required technical verification and audit review. |
| Product/engineering owner | Diagnose product defect and prepare controlled remediation. | Execute emergency response without incident authority. |

## Category Authority Matrix

| Category | Primary authority | Required escalation |
| --- | --- | --- |
| `auth_session` | Security lead | Founder for privileged, multi-user, or tenant data risk. |
| `credential_secret` | Security lead | Founder for confirmed exposure or production credential scope. |
| `api_abuse` | Ops lead | Security lead when authenticated or tenant-impacting. |
| `document_upload` | Support lead | Security lead for malware, sensitive document, or exposure risk. |
| `malware_suspected` | Security lead | Founder if production tenant document impact is plausible. |
| `export_projection` | Security lead | Founder for external recipient or tenant data exposure. |
| `evidence_access` | Security lead | Founder for cross-tenant, cross-landlord, or external exposure. |
| `tenant_data_exposure` | Security lead | Founder always. |
| `admin_support_access` | Security lead | Founder for confirmed unauthorized privileged access. |
| `webhook_provider` | Ops lead | Security lead for signature, credential, or provider payload concerns. |
| `dependency_supply_chain` | Engineering lead | Security lead for exploitable or production-impacting advisory. |
| `infrastructure_deployment` | Ops lead | Founder for production traffic, production data, or credential impact. |
| `recovery_workflow` | Ops lead | Security lead for authorization, audit, or projection risk. |
| `audit_integrity` | Security lead | Founder for incident reconstruction failure or compliance-impacting gap. |
| `suspicious_activity` | Support lead | Reclassify after triage. |

## Escalation Triggers

Escalate immediately when any of these are true:

- Severity estimate is `high` or `critical`.
- Tenant data, landlord data, evidence, export, credential, payment, screening, or privileged access is involved.
- Production environment, production Firestore, production Auth, Cloud Run, Vercel production, or Terraform state may be affected.
- Recovery decisions may have been accepted from wrong authority or without complete audit linkage.
- Audit records needed for incident reconstruction are missing or appear mutable.
- Support access crossed landlord, tenant, audience, or projection boundaries.

## Timeline Expectations

| Severity | Initial acknowledgement | Triage target | Containment target |
| --- | --- | --- | --- |
| `informational` | Next standard review cycle | Next standard review cycle | Not usually required. |
| `low` | 1 business day | 2 business days | As scheduled. |
| `medium` | Same business day | Same business day | Same or next business day. |
| `high` | Immediate during operating hours | Immediate | As soon as authority and evidence are verified. |
| `critical` | Immediate | Immediate | Immediate manual containment with founder notification. |

## Escalation Request Template

```text
Escalation request:
Category:
Severity:
Detected at:
Requested authority:
Affected scope safe refs:
Affected audience:
Observed signal:
Initial containment recommendation:
Evidence refs:
Raw IDs included: no
Secret or token included: no
Provider payload included: no
Tenant visible: no
Decision needed:
Requested response deadline:
```

## Authority Verification Procedure

1. Confirm the operator is authenticated through server-side session context.
2. Confirm relevant role or permission:
   - `system.admin` for admin security incident review.
   - Support lead assignment for support escalation review.
   - Ops lead assignment for deployment or environment containment.
   - Security lead assignment for credential, projection, tenant-data, audit, or privileged access incidents.
3. Confirm scope:
   - landlord scope where support-scoped diagnostic access is required.
   - tenant scope only when needed and authorized.
   - global review only for admin-global incidents.
4. Confirm the action is manual and documented.
5. Record actor, role, reason, timestamp, and safe affected refs.

## Founder Notification Criteria

Founder notification is required for:

- Confirmed or plausible tenant data exposure.
- Confirmed or plausible credential exposure in production.
- Production data write from wrong environment.
- Cross-landlord or cross-tenant exposure.
- Confirmed unauthorized admin/support access.
- Recovery workflow action with production-impacting state risk.
- Any `critical` incident.

## Operator Resolution Without Founder Notification

Support or ops lead may resolve without founder notification when all are true:

- Severity is `informational`, `low`, or routine `medium`.
- No tenant data, credential, production data, evidence/export, or privileged misuse risk exists.
- Affected scope is bounded and internal.
- The action is audit-only, communication-only, or metadata-only.
- No production data mutation is required.

## Prohibited Escalation Shortcuts

- Do not use client-side role claims as escalation authority.
- Do not grant support diagnostic scope from a tenant report alone.
- Do not disclose raw incident internals to tenants, landlords, recipients, or institutions.
- Do not perform credential rotation, account disablement, deployment rollback, or recovery freeze without approved authority.
- Do not skip audit linkage because the incident is urgent.
