# Delegated Access Governance Audit V1

## Scope

This audit defines the governance architecture required before implementing delegated access for landlord workspaces.

This is documentation-only. It does not implement code, backend routes, UI, Firestore schema changes, security rules, invitations, billing changes, or enforcement logic.

## Executive Summary

RentChain is now ready to move from single-operator landlord workflows toward multi-operator account governance. Delegated access is required because real rental operations are often handled by multiple people: owners, property managers, office staff, maintenance coordinators, contractors, auditors, and external management companies.

The platform should not support shared landlord credentials as an operational pattern. Delegates must have their own accounts, their own authentication sessions, and explicit role/scope grants controlled by the landlord owner. Every delegated action must preserve actor attribution: who acted, for which landlord, under which role, against which resource, at what time, and from which available session/device context.

V1 should be narrow: landlord-owner controlled invitations, role assignment, property/workspace scoping, revocation, and immutable audit capture. Billing/settings access should remain landlord-owner only in V1 unless a later explicit delegation model is approved.

## Why Delegated Access Is Needed

Delegated access is needed for:

- Landlords who use office staff for applications, messaging, scheduling, payments follow-up, and document collection.
- Property managers who operate on behalf of a landlord across some or all properties.
- Maintenance coordinators who need work order and scheduling visibility without payment or lease authority.
- Contractors and contractor organizations who need job-specific access without broad tenant, lease, payment, or evidence access.
- Auditors, lenders, accountants, or legal reviewers who need limited read/export access with defensible activity history.

Without delegated access, users are pushed toward shared logins, screenshots, forwarded emails, or external spreadsheets. Those patterns weaken privacy, audit defensibility, evidence integrity, and revocation control.

## Landlord-Owned Account Model

The landlord owner remains the account authority for V1.

The landlord owner should own:

- The landlord workspace.
- Billing and plan settings.
- Delegate invitations and revocations.
- Role and permission assignment.
- Property and workspace scoping.
- Access review history.
- Final approval of high-risk actions unless explicitly delegated later.

Delegates should own:

- Their own user account.
- Their own credentials and MFA state.
- Their own session/device footprint.
- Their own activity trail.

The access relationship is a grant from the landlord owner to the delegate, not a transfer of landlord identity.

## Shared Login Risks

Shared landlord credentials create unacceptable risk:

| Risk | Impact |
| --- | --- |
| Loss of actor attribution | The platform cannot prove who opened records, sent messages, changed leases, approved payments, or exported evidence. |
| Weak revocation | Password changes disrupt everyone and do not reliably terminate active sessions or copied credentials. |
| Privacy exposure | Staff or contractors may see tenants, payments, messages, documents, or evidence beyond their operational need. |
| Evidence integrity risk | Review history and exports can be challenged because actions are indistinguishable from owner actions. |
| Payment risk | Shared users can view or alter payment workflows without clear authorization boundaries. |
| Device risk | Shared credentials persist on unmanaged devices and browsers. |
| Company turnover risk | External property manager staff may retain access after leaving their employer. |

Delegated access must be designed to make shared logins unnecessary and operationally worse than proper delegation.

## Actor Attribution Requirements

Every delegated action must distinguish:

- The authenticated user: `actorUserId`.
- The landlord being represented: `actingForLandlordId`.
- The relationship grant: delegated role and scope.
- The operational action: action type, target resource, and outcome.
- The session context: session ID and available IP/device metadata.

Delegates should never appear in audit or operational history as if they are the landlord owner. UI labels and audit records should clearly represent:

`Delegate acted for Landlord`

not:

`Landlord acted`

## Landlord Control Requirements

The landlord owner must be able to:

- Invite a delegate.
- Select a role.
- Limit access by property, workspace, or both.
- See active delegates.
- See pending and expired invites.
- Change role/scope.
- Revoke access.
- See recent delegated activity.
- Require re-acceptance or reauthentication after material scope changes when appropriate.

V1 should favor simple control over complex policy. A small set of clear roles is safer than a broad custom permission builder.

## Revocation Requirements

Revocation must be fail-closed.

Minimum revocation behavior:

- Revoked delegates cannot access landlord workspace data after revocation.
- Active sessions should stop being authorized for the landlord scope after revocation.
- Pending invites should become unusable.
- Role changes should invalidate stale permission assumptions.
- Revocation should be audit logged with actor, target delegate, scope, timestamp, and reason if provided.

The platform should not rely on frontend hiding alone. Authorization must be enforced server-side.

## Audit and Event Requirements

Delegated access requires immutable, append-safe activity capture.

Audit should cover:

- Invitation created.
- Invitation accepted.
- Invitation expired.
- Role changed.
- Scope changed.
- Access revoked.
- Delegate session used for landlord workspace access.
- High-risk actions performed by delegate.
- Exports generated by delegate.
- Messages sent by delegate.
- Evidence viewed/exported by delegate.
- Payment-affecting actions attempted or completed.

Audit records should be metadata-first and projection-safe. Raw provider payloads, credentials, tokens, private message bodies, full payment details, and unrestricted document contents should not be copied into audit metadata.

## Minimum Viable V1 Scope

V1 should include:

| Capability | V1 Recommendation |
| --- | --- |
| Delegate accounts | Required. Each delegate uses their own user account. |
| Invitation flow | Required. Landlord owner invites by email. |
| Role selection | Required. Use predefined roles. |
| Property scoping | Required for property managers, assistants, maintenance coordinators, contractors, and auditors. |
| Workspace scoping | Required for maintenance, scheduling, inbox, payments, evidence/export boundaries. |
| Revocation | Required. Landlord owner can revoke access. |
| Activity audit | Required. Immutable delegated activity events. |
| Billing/settings access | Owner-only in V1. |
| Contractor organization access | Model-aligned but deferred unless explicitly implemented. |
| Custom permission builder | Deferred. |
| Enterprise org hierarchy | Deferred. |

## Deferred Enterprise Scope

The following should be deferred until V1 proves the access model:

- Property manager company accounts with multiple staff.
- Contractor organizations with admins and assigned technicians.
- Multi-landlord portfolio management console.
- Custom role builder.
- Approval workflows for sensitive actions.
- SCIM/SAML/SSO.
- Device trust policies.
- Mandatory MFA enforcement by role.
- Access certification campaigns.
- Legal hold and evidence chain-of-custody workflows.
- Cross-organization audit exports.
- Delegate-to-delegate assignment rules.

## Risk Review

### Privacy

Delegates should receive the minimum tenant, lease, payment, message, and evidence visibility needed for their role. Tenant-facing data must remain projection-safe.

### Payments

Payments access should be conservative. Viewing payment status may be allowed for operational roles, but payment edits, refunds, reconciliation, exports, and bank-related settings should require owner authority or future explicit approval delegation.

### Evidence Integrity

Evidence/export access must be strongly audited. Delegates should not be able to alter immutable history. Export generation should record the actor and scope.

### Impersonation

Delegated access must not become impersonation. Delegates act as themselves, for the landlord. Owner-only actions should remain owner-only unless later explicitly delegated.

### Shared Devices

Session metadata and revocation should assume shared or unmanaged devices exist. Server-side permission checks must evaluate current grant state on each sensitive request.

### Contractor Over-Access

Contractors should be job-scoped or organization-scoped only where needed. They should not receive portfolio-wide tenant, payment, lease, inbox, or evidence access by default.

### Property Manager Company Turnover

Future property manager company accounts need staff lifecycle controls. V1 can support individual property manager delegates, but company-level delegation should be modeled as a future layer, not improvised through shared accounts.

### Audit Defensibility

Delegated activity must be queryable and exportable later without changing the meaning of the original records. Event names, actor fields, landlord scope, target resource references, and before/after metadata should be stable.

## V1 Non-Goals

- No backend route implementation.
- No Firestore schema implementation.
- No UI implementation.
- No invitation email implementation.
- No contractor organization implementation.
- No property manager company hierarchy implementation.
- No billing delegation.
- No autonomous AI action delegation.
- No evidence chain-of-custody implementation.

## Recommended Implementation Sequence

1. Define delegated role constants and permission vocabulary.
2. Define delegated access grant storage and immutable activity event shape.
3. Add server-side authorization helper for landlord owner versus delegate access.
4. Add invitation and acceptance API.
5. Add revocation and active grant checks.
6. Add owner-facing delegate management UI.
7. Add read-only delegated activity view.
8. Add contractor organization and property manager company layers only after V1 is stable.
