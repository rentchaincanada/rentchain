# Incident Detection Procedures v1

## Scope

This document gives manual detection procedures for Phase 3 incident categories. It is documentation only and does not add monitoring, alerting, storage, routes, or automation.

All detection notes must use safe references. Do not copy raw IDs, bearer values, credentials, provider payloads, raw documents, storage paths, stack traces, or unrestricted debug payloads into incident notes.

## Safe Reference Procedure

1. Identify the affected surface using route name, collection family, deployment label, workflow type, or support-safe resource label.
2. Convert raw resource details to safe labels before sharing outside the immediate authorized operator context.
3. Prefer existing safe references:
   - `audit_source:<hash>`
   - `operator:<hash>`
   - `recovery:<hash>`
   - `recovery_intent:<hash>`
   - support console resource labels
   - deployment SHA or build ID
4. Record audience and visibility:
   - `admin_support_internal`
   - `metadataOnly: true`
   - `tenantVisible: false`
   - `rawIdsIncluded: false`
5. If a raw value is necessary for a live console lookup, keep it in the approved operator console only. Do not paste it into the incident summary.

## Detection Checklist Template

Use this shape for every manual detection note:

```text
Incident candidate:
Category:
Severity estimate:
Detected at:
Detected by:
Affected surface:
Affected scope safe refs:
Observed signal:
Immediate risk:
Evidence refs:
Raw payload copied: no
Tenant visible: no
Recommended escalation:
```

## Recovery Workflow Incidents

Signals:

- Recovery inspection unexpectedly returns `FORBIDDEN`, `RECOVERY_ROUTE_FAILED`, or inconsistent degraded state.
- Reconciliation decision fails with `RECOVERY_ALREADY_LOGGED`, `RECOVERY_NOT_REQUIRED`, or repeated unexpected `RECOVERY_REQUEST_INVALID`.
- Gate validation returns `intent_missing`, `authorization_invalid`, or `intent_stale` during an approved manual recovery window.
- `operatorRecoveryLogs` and `canonicalRecoveryTimelineEntries` disagree on workflow instance key or timestamp.
- Recovery audit events are absent for intent or gate validation.

Detection procedure:

1. Confirm route path and method from `docs/security/recovery-workflow-security-audit-v1.md`.
2. Confirm caller role was admin or support through server-verified session context.
3. Review `operatorRecoveryIntents`, `operatorRecoveryLogs`, `canonicalRecoveryTimelineEntries`, and `canonicalEvents`.
4. Record only safe recovery refs and workflow type.
5. If the signal could affect production recovery decisions, mark `recovery_workflow` and escalate to ops lead.

Checklist:

- [ ] Workflow type recorded.
- [ ] Recovery safe ref recorded.
- [ ] Intent or gate status recorded.
- [ ] Canonical audit linkage checked.
- [ ] No raw workflow ID copied.

## Environment Separation Incidents

Signals:

- Preview or staging frontend reaches production API.
- Production frontend routes to preview backend.
- Backend starts against unexpected Firestore target.
- Vercel, Cloud Run, or Terraform status indicates environment mismatch.
- Secret, service account, or runtime config appears in output where it should not.

Detection procedure:

1. Identify frontend deployment, backend revision, and environment label.
2. Compare expected API host and actual API host.
3. Check Cloud Run revision metadata and Firestore guard output.
4. Preserve deployment logs before changing config.
5. Classify as `infrastructure_deployment`; add `credential_secret` if secrets are involved.

Checklist:

- [ ] Deployment SHA recorded.
- [ ] Frontend environment recorded.
- [ ] Backend revision recorded.
- [ ] Firestore target verified.
- [ ] Credential exposure assessed.

## Auth Session Incidents

Signals:

- Unusual login failures or suspicious session reports.
- Logout concern where access appears to persist.
- Trusted-device or 2FA anomaly.
- Scope mismatch from `requireAuth` hydration.
- Admin/support account suspected of misuse.

Detection procedure:

1. Follow `docs/security/auth-incident-response-runbook-v1.md`.
2. Review admin audit and support-console timeline.
3. Confirm user, landlord, and tenant scope using safe internal references.
4. Do not assume logout revoked outstanding JWTs.
5. Escalate to security lead for privileged accounts, multi-user scope, or tenant data risk.

Checklist:

- [ ] Account scope safe ref recorded.
- [ ] Token value not copied.
- [ ] Logout limitation considered.
- [ ] Admin/support privilege checked.
- [ ] Manual mitigation identified.

## Support Escalation Incidents

Signals:

- Support console opened without clear support reason.
- Support-scoped diagnostics used without landlord scope.
- Support runbook category indicates `projection_safety`, `credential_secret`, `tenant_data_exposure`, or `admin_support_access`.
- Repeated wrong-recipient or lifecycle confusion in institution review operations.

Detection procedure:

1. Review support console canonical event and security telemetry summary.
2. Confirm actor role and `system.admin` permission.
3. Validate the support scope against `adminSupportAccessGovernance`.
4. Classify severity by tenant data, credential, and projection impact.
5. Escalate to security lead when access appears unauthorized or cross-scope.

Checklist:

- [ ] Actor role verified.
- [ ] Access mode documented.
- [ ] Resource refs scoped.
- [ ] Sensitive payload excluded.
- [ ] Approval requirement noted.

## Audit Integrity Incidents

Signals:

- Expected `canonicalEvents` record missing after recovery intent or gate validation.
- Canonical audit record lacks `metadataOnly`, `appendOnly`, `immutable`, or `rawIdsIncluded: false`.
- Older event collection record appears overwritten or patched.
- Audit read returns broader payload than expected.

Detection procedure:

1. Compare writer path to `docs/security/audit-immutability-contract-v1.md`.
2. Identify whether record came from `appendCanonicalAuditEvent`, `writeCanonicalEvent`, or older event writer.
3. Preserve current event state and related route/action context.
4. Do not attempt deletion or correction before review.
5. Escalate high if audit integrity affects recovery, export, evidence, or tenant data investigation.

Checklist:

- [ ] Collection family recorded.
- [ ] Writer path identified.
- [ ] Append markers checked.
- [ ] Existing record preserved.
- [ ] Remediation deferred until authorized.

## Projection And Evidence Incidents

Signals:

- Restricted field appears in tenant, landlord, export, dashboard, or timeline surface.
- Evidence or export package includes unrelated resource linkage.
- Support/admin internals appear in user-safe payload.
- Provider payload, raw report, token, secret, credential, storage path, stack, or authorization detail appears in response.

Detection procedure:

1. Identify audience: tenant, landlord, admin/support, export public, export user safe, or internal debug.
2. Review projection helper or allowlist used by the surface.
3. Capture only field names and safe surface labels.
4. Freeze export/evidence delivery if user-facing leakage is plausible.
5. Escalate to security lead for tenant, landlord, or external recipient exposure.

Checklist:

- [ ] Audience classified.
- [ ] Restricted field class recorded.
- [ ] Payload not copied.
- [ ] Delivery freeze considered.
- [ ] Projection owner identified.

## Credential And Secret Incidents

Signals:

- Secret appears in code, docs, logs, deployment output, or support notes.
- Webhook signature concern.
- Service account, Firebase credential, JWT signing secret, provider credential, or API key exposure.

Detection procedure:

1. Record credential family and affected system only.
2. Do not copy the secret value.
3. Preserve where exposure was found using safe file/log/deployment reference.
4. Notify security lead immediately.
5. Follow containment procedures for manual rotation and redeploy.

Checklist:

- [ ] Credential family recorded.
- [ ] Secret value not copied.
- [ ] Exposure location safe ref recorded.
- [ ] Rotation owner identified.
- [ ] Post-rotation verification needed.
