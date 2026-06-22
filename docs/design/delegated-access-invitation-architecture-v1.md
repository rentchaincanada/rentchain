# Delegated Access Invitation Architecture V1

## Scope

This document defines the implementation-ready invitation architecture for Delegated Access V1.

This is design-only. It does not implement invitation routes, email sending, token storage, UI, Firestore schema, security rules, or MFA enforcement.

## Invitation Principles

- Landlord owner initiates invitation.
- Delegate uses their own account.
- Invitation does not grant access until accepted.
- Role, property scope, workspace scope, and resource scope are selected before send.
- Token acceptance fails closed.
- Every lifecycle step is audited.
- Billing/settings access remains owner-only in V1.

## Invite Creation

Required actor:

- Landlord Owner only in V1.

Required inputs:

| Input | Purpose |
| --- | --- |
| `inviteeEmail` | Recipient email. |
| `role` | Predefined delegate role. |
| `propertyScope` | All current properties, selected properties, resource-only, or none. |
| `workspaceScope` | Allowed workspaces. |
| `resourceScope` | Assigned resources where applicable. |
| `expiresAt` | Expiration timestamp. |
| `note` | Optional sanitized owner note. |

Creation behavior:

1. Validate actor is landlord owner.
2. Validate role is inviteable.
3. Validate scope is compatible with role.
4. Reject billing/settings scope in V1.
5. Create pending invitation.
6. Store hashed token only.
7. Queue invitation email.
8. Emit `delegated_invite_created`.
9. Emit `delegated_invite_sent` when email is queued/sent.

## Email Flow

Invitation email should:

- Identify RentChain and the inviting landlord workspace.
- Show the role at a concise level.
- Link to acceptance with expiring token.
- Require sign in or account creation.
- Avoid exposing tenant, lease, payment, evidence, or private message details.
- Never include landlord credentials.

If email delivery fails, invitation should remain pending only if resend/retry behavior is explicit and visible to the owner.

## Acceptance

Acceptance behavior:

1. Recipient opens invite link.
2. Recipient signs in or creates their own account.
3. Backend validates token hash.
4. Backend validates invitation status is pending.
5. Backend validates invitation has not expired.
6. Backend validates invitation has not been cancelled.
7. Backend validates account/email policy.
8. Backend creates delegated access grant.
9. Backend marks invitation accepted.
10. Backend emits `delegated_invite_accepted`.
11. Delegate enters only scoped landlord workspace access.

The exact email matching policy should be decided during implementation. Conservative default: accepting account email should match the invited email unless owner-approved remap exists.

## Expiration

Invitations should expire.

Recommended behavior:

- Expired token cannot be accepted.
- Status becomes `expired`.
- Owner may send a new invitation.
- Expiration is audit logged.
- Expired invitation does not create a grant.

Expiration can be processed lazily at acceptance time or through scheduled cleanup. Authorization must treat expired invites as inactive either way.

## Cancellation

Landlord owner may cancel pending invitations.

Cancellation behavior:

- Mark invitation `cancelled`.
- Record cancelling actor and timestamp.
- Prevent token acceptance.
- Emit `delegated_invite_cancelled`.

Cancellation is not the same as revocation because no grant exists yet.

## Revocation

Revocation applies to an accepted grant.

Revocation behavior:

1. Landlord owner selects active delegate.
2. Backend marks grant revoked.
3. Backend records revoking actor, timestamp, previous role, previous scope, and optional reason.
4. Backend prevents future delegated requests under that grant.
5. Backend invalidates stale authorization assumptions where supported.
6. Backend emits `delegated_access_revoked`.
7. Delegate no longer sees landlord workspace access.

Revocation must preserve historical grant and audit data.

## Role Changes

Role changes should be owner-controlled.

Recommended behavior:

- Validate actor is landlord owner.
- Validate new role is inviteable/delegatable.
- Validate new scope is compatible.
- Preserve previous role/scope in grant history.
- Update active grant.
- Require permission refresh on new requests.
- Emit `delegated_role_changed` and/or `delegated_scope_changed`.

High-risk role upgrades may require delegate reauthentication or re-acceptance in later phases.

## Active Session Behavior

Delegated authorization must evaluate current grant state on each sensitive request.

If grant changes:

- New requests evaluate updated scope.
- Stale frontend state must not preserve old access.
- High-risk surfaces may require refresh or reauthentication.

If grant is revoked:

- New requests are denied.
- Delegate exits landlord context or sees revoked access state.
- Pending local UI should not continue to submit landlord-scoped changes.

## MFA Considerations

V1 should recommend MFA for delegates.

MFA should be strongly recommended for:

- Property Managers.
- Assistants with message access.
- Any role with payment visibility.
- Any role with evidence/export visibility.
- Contractor Admins.

Future phases may require MFA for high-risk roles before acceptance or before sensitive workspaces open.

## Resend Behavior

Resend should:

- Be owner-only.
- Create a fresh token or fresh invitation event.
- Preserve prior invitation history.
- Avoid indefinite token reuse.
- Audit resend activity.

## Duplicate Invitation Behavior

Recommended behavior:

- If an active grant already exists for the same user and landlord, prevent duplicate active access.
- If a pending invite exists for the same email, allow resend or replace only through explicit owner action.
- If a revoked grant exists, require a fresh invitation or explicit reactivation flow with audit.

## Failure Cases

| Failure | Behavior |
| --- | --- |
| Invalid token | Reject and show safe invalid invite state. |
| Expired token | Reject and show expired invite state. |
| Cancelled token | Reject and show cancelled invite state. |
| Already accepted | Reject or route existing delegate to appropriate context. |
| Wrong account/email | Fail closed or require owner-approved remap. |
| Grant creation fails | Do not mark invite accepted. |
| Audit write fails for acceptance | Fail closed for grant creation unless implementation explicitly classifies it safe. |

## Non-Goals

- No custom role builder.
- No delegated billing access.
- No mandatory MFA enforcement in V1.
- No property manager company invitation model.
- No contractor organization invitation model.
- No automated AI action delegation.
