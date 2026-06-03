# Auth Incident Response Runbook v1

## Scope

This runbook documents current manual auth incident response procedures and future revocation handoff points. It is documentation only. It does not add incident automation, token revocation, credential rotation, account locking, Firestore collections, Firestore rules, dependencies, infrastructure, or production data changes.

## Current State vs Future Design

Current state: incident governance is metadata-only and manual. Existing docs confirm no token revocation automation, credential rotation automation, account locking automation, SIEM integration, or external alerting integration. Logout does not revoke outstanding JWTs.

Future design: Phase 4 may add server-side revocation and stronger incident containment. Operators should use `docs/security/session-revocation-design-options-v1.md` when selecting an implementation path.

## Incident Categories

This runbook covers:

- `auth_session`: login, logout, token, or session behavior requiring review.
- `credential_secret`: signing secret, service account, webhook secret, or provider credential concern.
- `admin_support_access`: admin or support access governance concern.

## General Response Rules

- Preserve append-safe audit records.
- Do not copy bearer values, secret values, provider payloads, stack traces, or unrestricted debug output into incident notes.
- Keep incident metadata internal and admin/support only.
- Use safe references, hashed identifiers, or labels.
- Do not assume logout removed server-side access.
- Do not use destructive data mutations as a first response.
- Record actor, reason, timestamp, affected resource, and review state.

## Auth Session Incidents

### Current State vs Future Design

Current state: auth-session incidents can be reviewed through audit and support/admin views, but outstanding JWTs cannot be atomically revoked by current logout. Password reset or manual account disablement is the practical containment path.

Future design: session-record, deny-list, or token-version revocation could provide per-session, per-token, or account-wide containment.

### Triggers

- Unusual login failures.
- Suspected copied bearer value.
- User reports a logout concern.
- Suspicious access from an unexpected browser or location signal.
- Concurrent session behavior requiring review.

### Manual Response

1. Classify the incident as `auth_session`.
2. Determine severity using the Phase 3 incident taxonomy.
3. Review available admin audit and support-console timelines.
4. Confirm affected user, landlord, and tenant scope using safe internal references.
5. Check whether logout acknowledgement exists, while remembering it is not revocation.
6. Choose temporary mitigation: password reset, manual account disablement, or admin permission removal where applicable.
7. Record the response action in append-safe audit metadata.

### Current Capabilities

- Backend protected routes verify JWT signature and expiration.
- `requireAuth` can reject disabled accounts in database-backed hydration.
- Admin audit and support review surfaces are admin-only.
- Support access telemetry is metadata-only with hashed IP and browser-header signals.

### Current Limitations

- No server-side revocation of outstanding JWTs.
- No first-class active session list.
- No concurrent-session invalidation.
- No server-side trusted-device revocation table.
- Logout does not shorten token lifetime.

### Temporary Mitigations

- Password reset or password-credential change when applicable.
- Manual user disablement through existing admin-controlled data path, with audit linkage.
- Admin permission removal for privileged accounts.
- Support-console timeline review with metadata-only access.

### Escalation

Escalate to security leadership when suspected compromise spans multiple users, privileged accounts, credentials, or tenant data. Prepare Phase 4 revocation decision input using `docs/security/session-revocation-design-options-v1.md`.

## Credential Secret Incidents

### Current State vs Future Design

Current state: credential incidents are manually contained by disabling or rotating the affected credential in its management console and redeploying services where configuration reload is required.

Future design: key rotation and token revocation procedures may be paired so old tokens are denied after signing-secret rotation.

### Triggers

- Suspected `JWT_SECRET` exposure.
- Firebase service account concern.
- Webhook secret concern.
- OAuth/provider secret concern.
- Deployment environment credential drift.

### Manual Response

1. Classify the incident as `credential_secret`.
2. Disable or rotate the affected credential in its management console.
3. Remove the affected value from active configuration.
4. Restart or redeploy affected services through the approved pipeline.
5. Record the credential family, affected system, actor, reason, and timestamp without recording secret material.
6. Review whether existing JWTs remain trusted and whether emergency user disablement is required.

### Current Capabilities

- Environment secrets are not committed in the repo.
- Firestore guard blocks unsafe local use of production Firestore credentials unless explicitly overridden.
- Incident metadata can record credential family and affected system labels.

### Current Limitations

- No automatic credential rotation exists.
- No automatic token denial exists after signing-secret concern.
- No external alerting integration exists.
- Rotation may require deployment pipeline execution to reload runtime config.

### Temporary Mitigations

- Rotate credential in management console.
- Restart Cloud Run services through approved deployment process.
- Disable affected privileged user if an admin account is involved.
- Increase manual audit review for affected timeframe.

### Escalation

Treat confirmed credential or tenant-data exposure as critical. Prepare post-incident review and revocation implementation recommendation.

## Admin Support Access Incidents

### Current State vs Future Design

Current state: admin/support access is permission-gated, metadata-oriented, and audit-linked. It does not provide automated containment actions.

Future design: revocation could terminate active privileged sessions while preserving audit evidence.

### Triggers

- Unexpected support console review.
- Privilege escalation concern.
- Admin account misuse.
- Suspicious access to support diagnostics.

### Manual Response

1. Classify the incident as `admin_support_access`.
2. Review admin audit events and support-console timeline.
3. Confirm actor, permission, resource scope, and landlord/tenant boundaries.
4. Revoke admin permission or disable account if unauthorized access is suspected.
5. Record the action with resource=user, action=disabled or permission_removed, actor=admin, and reason=security_incident.
6. Keep incident visibility internal and admin/support only.

### Current Capabilities

- Admin audit routes require `system.admin`.
- Support console requires authenticated admin permission.
- Support telemetry uses hashed IP and browser-header values.
- Support access governance marks tenantVisible false and requires audit events.

### Current Limitations

- No server-side privileged-session termination exists.
- No automated alerting or account lock exists.
- Permission removal must be manual and audit-linked.

### Temporary Mitigations

- Remove `system.admin` permission or equivalent admin role assignment.
- Disable affected account when compromise is suspected.
- Review support-console access history.
- Preserve metadata-only evidence links.

### Escalation

Escalate to security leadership for any privileged access involving tenant data, cross-landlord scope, or confirmed unauthorized review.

## Audit Record Expectations

Each manual response should record:

- category
- severity
- responseState
- actor
- action
- affected resource reference
- reason
- timestamp
- audit expectation of manual_append_only
- tenantVisible false
- redaction summary

Manual disablement should record resource=user, action=disabled, actor=admin, reason=security_incident. Password reset actions should record intent and gate if a password-reset service exists. Support console review should remain metadata-only and non-exportable.

## Future Revocation Handoff

Use `docs/security/session-revocation-design-options-v1.md` to choose the containment model:

- Session-record model for per-device or per-session containment.
- JWT deny-list model for token or issued-at cutoff denial.
- Token-version model for account-wide invalidation.

Use `docs/security/session-revocation-incident-scenarios-v1.md` to test the choice against likely incidents.

## Cross-References

- `docs/security/auth-session-revocation-glossary-v1.md`
- `docs/security/session-revocation-design-options-v1.md`
- `docs/security/session-revocation-incident-scenarios-v1.md`
- `docs/reports/security-audit-and-incident-response-foundations-v1.md`
