# Incident Containment Procedures v1

## Scope

This document defines manual containment procedures for Phase 3 incident categories. It does not implement containment, revocation, rotation, alerting, storage, routes, infrastructure changes, or production data mutation.

Containment must preserve evidence first unless active harm requires immediate action.

## Containment Decision Tree

1. Is there active production data exposure or credential exposure?
   - Yes: classify `critical`, notify founder, preserve evidence, stop active surface, then rotate or disable manually.
   - No: continue.
2. Can additional impact occur if the workflow continues?
   - Yes: freeze the affected workflow or deployment route.
   - No: continue with audit-only investigation.
3. Is the incident caused by wrong environment or deployment?
   - Yes: follow environment containment and rollback verification.
   - No: continue.
4. Is authorization ambiguous?
   - Yes: fail closed and escalate.
   - No: continue.
5. Is correction destructive or data-mutating?
   - Yes: require explicit operator authorization and append-safe audit linkage.
   - No: proceed with documented manual remediation.

## Recovery Workflow Containment

Use for `recovery_workflow`, recovery-impacting environment incidents, or recovery audit concerns.

Immediate steps:

1. Stop new manual recovery decisions for affected workflow type.
2. Put reconciliation decisions on manual hold.
3. Preserve `operatorRecoveryIntents`, `operatorRecoveryLogs`, `canonicalRecoveryTimelineEntries`, and `canonicalEvents`.
4. Validate gate status for any in-flight recovery action.
5. Confirm admin/support authority and affected workflow safe refs.
6. Do not delete recovery logs or timeline entries.
7. Do not rewrite source snapshots as rollback.

Containment choices:

| Choice | Use when | Authority |
| --- | --- | --- |
| Freeze new recovery actions | Gate mismatch, audit uncertainty, access ambiguity. | Ops lead. |
| Hold reconciliation decision | Divergence classification is questionable. | Ops lead with security review if data risk exists. |
| Audit-only monitoring | Signal is informational and no action is pending. | Support lead or ops lead. |
| Rollback authorization review | Accepted reconciliation decision appears wrong. | Founder plus ops and security leads. |

Rollback authorization is procedural only. It requires a separate reviewed mission or explicit data operation approval.

## Environment Separation Containment

Use for preview/staging/production routing, Firestore target, wrong auth project, or deployment drift incidents.

Immediate steps:

1. Stop new deployments.
2. Identify deployment SHA, backend revision, and runtime environment.
3. Preserve Vercel, Cloud Run, Firestore, Auth, and GitHub Actions evidence.
4. Disable or roll back the active deployment if production traffic is affected.
5. Verify `/api` route target and backend revision after rollback.
6. If credentials may be exposed, escalate to credential containment.
7. Document affected write/read window with safe refs only.

Do not change CI/CD, Terraform, or deployment configuration in this mission. Live environment changes require operator approval outside this document.

## Auth Session Containment

Use for login/session/token incidents.

Current manual options:

- Password reset or password credential change where supported.
- Manual account disablement where authority exists.
- Admin permission removal for privileged users.
- Support console timeline review.

Steps:

1. Confirm affected account safe ref and role.
2. Review auth and support timeline.
3. Remember logout does not revoke outstanding JWTs.
4. Choose least broad manual mitigation.
5. Record action and reason in append-safe audit metadata.
6. Escalate to security lead for privileged, multi-user, or tenant data risk.

Phase 3 does not include automated token revocation, active session lists, trusted-device revocation tables, or account locking automation.

## Support Escalation Containment

Use for privileged diagnostic or support-console access concerns.

Steps:

1. Review support console canonical event and admin audit timeline.
2. Confirm actor, role, permission, and requested scope.
3. Stop additional support diagnostic access for the affected resource until reviewed.
4. Remove admin/support permission or disable account if unauthorized access is suspected and authority approves.
5. Preserve telemetry as internal, metadata-only, and non-exportable.
6. Keep tenant and landlord communications free of admin/support internals.

## Credential Incident Containment

Use for `credential_secret` incidents.

Steps:

1. Record credential family and affected system only.
2. Do not copy or quote the exposed value.
3. Remove accidental exposure from active surfaces where possible.
4. Rotate or revoke in the owning provider console through approved manual procedure.
5. Redeploy or restart affected runtime if required to load replacement value.
6. Verify old value fails where safe to test.
7. Review whether auth sessions remain trusted after signing-secret concern.

Credential containment may require downtime or dual-token sequencing. Do not improvise rotation for production secrets without security and ops authority.

## Data Exposure Containment

Use for tenant, landlord, evidence, export, projection, or provider payload exposure.

Steps:

1. Freeze affected user-facing surface or export delivery.
2. Preserve the exact response route, timestamp, audience, and safe refs.
3. Do not copy the exposed payload into incident notes.
4. Identify audience mismatch and projection helper or allowlist path.
5. Notify security lead immediately.
6. Notify founder for confirmed or plausible tenant data exposure.
7. Prepare remediation plan with projection and test verification.

## Webhook Provider Containment

Steps:

1. Preserve event ID safe ref, provider family, route, timestamp, and signature verification result.
2. Do not copy provider payloads.
3. Disable endpoint or rotate webhook secret only with approved authority.
4. Review idempotency and retry behavior.
5. Confirm no duplicate financial or screening action occurred.

## Audit Integrity Containment

Steps:

1. Stop dependent recovery, export, evidence, or review decisions that require the questionable audit timeline.
2. Preserve current audit records and related writer context.
3. Identify writer path and collection family.
4. Do not update or delete audit records.
5. Reconstruct timeline from alternate append-safe sources where available.
6. Escalate to security lead for high or critical incident reconstruction needs.

## Communication During Containment

Every containment update should include:

- category
- severity
- response state
- affected scope safe refs
- containment action
- authority
- evidence refs
- next review time

Do not include raw IDs, tokens, secrets, credentials, provider payloads, raw documents, private messages, stack traces, storage paths, or unrestricted debug data.
