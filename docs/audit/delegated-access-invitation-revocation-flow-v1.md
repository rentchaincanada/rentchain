# Delegated Access Invitation and Revocation Flow V1

## Scope

This document defines the V1 invitation, acceptance, role/scope change, and revocation workflow for delegated access.

This is documentation-only. It does not implement invitation APIs, email sending, UI, backend authorization, Firestore schema, security rules, or session invalidation.

## Flow Principles

1. Landlords must never share login credentials.
2. Delegates must use their own accounts.
3. Landlord owner controls invitation, scope, role, and revocation.
4. Authorization must be enforced server-side.
5. Every lifecycle step must be audit logged.
6. Billing/settings access remains landlord-owner only in V1.
7. Contractor and property manager organization models should inherit this flow rather than bypass it.

## Invitation Flow

### 1. Landlord Owner Starts Invitation

The landlord owner opens delegate management and selects `Invite delegate`.

Required inputs:

- Delegate email.
- Delegated role.
- Property scope.
- Workspace scope.
- Optional expiration window.
- Optional note/reason.

The system should not create active access until the invitation is accepted.

### 2. Role Selection

V1 roles:

- Property Manager.
- Assistant / Office Admin.
- Maintenance Coordinator.
- Contractor.
- Contractor Admin.
- Read-only Auditor.

The landlord owner role is not inviteable. It is account ownership.

Role selection should show concise operational impact, not a long permission builder. Detailed permission matrices can be linked or exposed in a review view later.

### 3. Property and Workspace Scoping

The invitation must define scope before sending.

Scope examples:

| Scope type | Examples |
| --- | --- |
| Property scope | All properties, selected properties, selected units where needed. |
| Workspace scope | Dashboard, Operations, Properties, Tenants, Leases, Payments, Unified Inbox, Scheduling, Work Orders, Evidence/Exports. |
| Resource scope | Assigned work orders, contractor jobs, evidence package, export package. |

V1 should avoid unscoped full-account delegation except for roles that truly require it and only when explicitly selected by the landlord owner.

### 4. Email Invitation

The invitation email should:

- Identify the landlord/workspace inviting the delegate.
- Identify the selected role at a high level.
- Require the recipient to sign in or create their own account.
- Use an expiring token.
- Never include landlord credentials.
- Avoid exposing sensitive tenant/payment/lease details.

### 5. Acceptance

On acceptance:

1. Recipient authenticates or creates their own account.
2. System verifies invitation token is valid, unexpired, and not cancelled.
3. System links the authenticated user as a delegate for the landlord.
4. System records role, scope, inviter, acceptance timestamp, and accepted user.
5. System creates an immutable audit event.
6. Delegate sees only scoped landlord workspace access.

Acceptance should fail closed if the invitation is expired, cancelled, already accepted by another user, or mismatched to an unexpected account policy.

### 6. MFA Recommendation

V1 should recommend MFA for delegates and strongly recommend MFA for:

- Property Managers.
- Assistants with message access.
- Any role with payment visibility.
- Any role with evidence/export visibility.
- Contractor Admins.

Future phases may require MFA for high-risk roles.

## Active Session Behavior

Authorization must evaluate current delegated grant state server-side.

If a role or scope changes:

- New requests should use the new permission scope.
- Stale frontend state should not preserve old access.
- High-risk changes may require session refresh or reauthentication.
- Audit should record the role/scope change.

If access is revoked:

- New requests must fail closed.
- Active sessions should no longer authorize landlord-scoped delegated access.
- Pending UI should show access revoked or redirect to the delegate's own account context.
- Revocation should not delete historical audit events.

## Revocation Flow

### 1. Landlord Owner Revokes Delegate

The landlord owner selects a delegate and chooses `Revoke access`.

Recommended inputs:

- Optional reason.
- Confirmation for high-impact roles.

### 2. Server Revokes Grant

The backend should:

- Mark grant revoked.
- Record revoked timestamp.
- Record revoking actor.
- Preserve historical grant data.
- Invalidate pending invites for the same grant if applicable.
- Trigger session invalidation or force permission refresh where supported.

### 3. Audit Trail

Revocation audit event should include:

- `actorUserId` of revoking landlord owner.
- `actingForLandlordId`.
- Delegate user/account reference.
- Previous role.
- Previous property/workspace scope.
- Timestamp.
- Optional reason.
- Outcome.

### 4. Post-Revocation UX

Delegate should no longer see or access the landlord workspace. If they still have their own tenant/contractor/other account context, that context remains separate.

Landlord owner should see the delegate listed as revoked in history, not silently removed.

## Expired Invites

Pending invitations should expire.

Expired invite behavior:

- Token cannot be accepted.
- Invite status becomes expired.
- Landlord owner can resend a new invitation.
- Expiration is audit logged.
- Expired invite does not grant access.

V1 should avoid indefinite pending access artifacts.

## Role Change History

Role and scope changes should be preserved as history.

Each change should record:

- Actor making the change.
- Delegate affected.
- Previous role/scope.
- New role/scope.
- Timestamp.
- Reason if provided.

The system should not overwrite a delegate's access history in a way that obscures prior authority.

## Property Manager Company Considerations

V1 may support individual property manager delegates. Property manager company accounts should be deferred unless explicitly implemented.

Future company support should add:

- Company account.
- Company admin.
- Staff membership.
- Landlord-to-company grant.
- Company staff assignment.
- Company turnover controls.
- Landlord visibility into which company staff accessed the account.

Company access must still preserve individual actor attribution.

## Contractor Organization Considerations

Contractor organization access should inherit the delegated access model.

Future contractor organization support should add:

- Contractor organization admin.
- Assigned technicians.
- Job-scoped access.
- Evidence upload boundaries.
- Tenant contact limitations.
- Landlord visibility into contractor staff activity.

Contractor access should never imply broad landlord account access.

## Failure and Edge Cases

| Case | Expected behavior |
| --- | --- |
| Invite token expired | Reject acceptance and show expired state. |
| Invite cancelled | Reject acceptance and show cancelled state. |
| Delegate already has account | Link authenticated user after validation. |
| Delegate uses wrong email/account | Fail closed or require owner-approved remap. |
| Role changed during active session | New requests evaluate new role; high-risk surfaces refresh. |
| Access revoked during active session | New requests denied; frontend exits landlord context. |
| Landlord subscription changes | Existing delegate access may need reevaluation, but billing remains owner-only. |
| Property removed from scope | Delegate loses access to that property immediately on next authorization check. |

## V1 Non-Goals

- No delegated billing access.
- No custom permission builder.
- No property manager company hierarchy.
- No contractor organization implementation.
- No SSO/SCIM.
- No mandatory MFA enforcement.
- No automated AI action delegation.
- No legal chain-of-custody implementation.
