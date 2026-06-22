# Delegated Access Permission Evaluation Model V1

## Scope

This document defines the intended permission evaluation model for Delegated Access V1.

This is design-only. It does not implement authorization helpers, backend routes, UI, Firestore rules, or tests.

## Evaluation Objective

Every landlord-scoped request should answer:

1. Who is authenticated?
2. Which landlord workspace is being accessed?
3. Is the actor the landlord owner?
4. If not owner, is there an active delegated grant?
5. Does the grant permit the workspace, property, resource, and action?
6. Should the action be allowed, denied, or owner-only?
7. What audit event is required?

Authorization must be server-side. Frontend navigation and hidden buttons are not security boundaries.

## Request Context

Recommended authorization context:

| Field | Purpose |
| --- | --- |
| `actorUserId` | Authenticated user from Firebase Auth. |
| `actingForLandlordId` | Landlord workspace being accessed. |
| `routeWorkspace` | Workspace owning the request. |
| `action` | `view`, `create`, `edit`, `approve`, `export`, `assign`, `message`, `revoke`, or `billing_access`. |
| `targetResourceType` | Resource type being accessed. |
| `targetResourceId` | Resource identifier when available. |
| `propertyId` | Property scope to evaluate when known. |
| `unitId` | Unit scope to evaluate when known. |
| `sensitivity` | Optional `standard`, `payment`, `evidence`, `privacy`, or `billing`. |

## Authorization Flow

Recommended flow:

1. Authenticate request.
2. Resolve requested landlord workspace server-side.
3. Check whether `actorUserId` is the landlord owner.
4. If owner, allow unless the route has another independent blocker.
5. If not owner, load active delegate grant for `actorUserId` and landlord.
6. If no active grant, deny.
7. If grant is revoked, suspended, expired, or pending, deny.
8. Check workspace scope.
9. Check property scope.
10. Check resource scope where applicable.
11. Check permission flag for action.
12. Apply high-risk owner-only constraints.
13. Return allow/deny decision with evaluated permission scope.
14. Emit required audit event for lifecycle, denied, high-risk, mutation, export, or message actions.

## Role Inheritance

V1 should not implement complex inheritance.

Recommended behavior:

- Landlord Owner authority comes from account ownership, not role inheritance.
- Delegate roles map to predefined permission templates.
- Scope narrows role permissions.
- Explicit deny and owner-only rules override role permissions.
- Contractor Admin may manage contractor staff only in future contractor organization scope, not landlord delegates.
- Read-only Auditor cannot inherit mutation rights.

If future company-level delegation is added, company membership should produce an evaluated grant context but should not make company staff indistinguishable from the company admin.

## Explicit Deny Behavior

Explicit deny must win.

Examples:

| Condition | Result |
| --- | --- |
| Grant revoked | Deny. |
| Invitation pending | Deny. |
| Invitation expired | Deny. |
| Role lacks workspace scope | Deny. |
| Role lacks property scope | Deny. |
| Role lacks required permission flag | Deny. |
| Action is billing/settings in V1 | Deny for delegates. |
| Payment mutation by delegate in V1 | Deny unless a future approved model exists. |
| Evidence export without explicit export scope | Deny. |
| Contractor attempts non-assigned job access | Deny. |

Denied decisions should be audited when practical, especially for payment, evidence, billing, revoked, or out-of-scope attempts.

## Property-Level Restrictions

Property-level evaluation should be required for landlord resources tied to a property or unit.

Recommended rules:

- `selected` property scope allows only listed properties.
- `all_current_properties` allows all current properties for landlord, but should be used sparingly.
- `resource_only` allows only resources specifically assigned to the delegate.
- `none` denies property-scoped access.
- Unit access must resolve to property scope server-side.
- A client-provided property ID must not be trusted without server-side ownership verification.

If a resource cannot be safely resolved to a property or assigned resource, authorization should fail closed.

## Workspace-Level Restrictions

Workspace-level scope controls which product surfaces can be accessed.

Recommended mapping:

| Workspace | Scope key |
| --- | --- |
| Dashboard | `dashboard` |
| Operations | `operations` |
| Properties | `properties` |
| Tenants | `tenants` |
| Leases | `leases` |
| Payments | `payments` |
| Unified Inbox | `unified_inbox` |
| Scheduling | `scheduling` |
| Work Orders | `work_orders` |
| Evidence / Exports | `evidence_exports` |
| Settings / Billing | `settings_billing` |

V1 delegates should not receive `settings_billing` access.

Workspace scope alone is not sufficient. Property/resource and action permissions must also pass.

## Owner Override Behavior

The landlord owner can:

- View and manage delegates.
- Create invitations.
- Change role/scope.
- Revoke access.
- View delegated activity.
- Access billing/settings.
- Perform final approvals.

Owner override does not mean:

- Owner can bypass platform-wide auth.
- Owner can alter immutable audit history.
- Owner can make a delegate action appear as owner action.
- Owner can avoid audit on high-risk actions where audit is required.

## High-Risk Action Rules

V1 conservative constraints:

| Surface | V1 rule |
| --- | --- |
| Billing/settings | Owner-only. |
| Delegate revocation | Owner-only. |
| Payment mutation | Owner-only unless future explicit delegation exists. |
| Payment exports | Owner-only by default. |
| Evidence exports | Explicit scope and audit required. |
| Lease approval/finalization | Owner-only or explicitly delegated later. |
| Contractor access | Assigned-job/resource-only by default. |
| Tenant privacy data | Scoped projection only. |

## Projection Interaction

Permission evaluation should happen before data projection.

After authorization:

- Return only fields allowed for role and workspace.
- Preserve tenant-facing whitelist projection boundaries.
- Do not leak admin/support metadata.
- Do not expose raw internal IDs as labels.
- Do not include sensitive provider payloads.

Delegated access should never be implemented as broad owner data plus frontend filtering.

## Audit Decision Output

Authorization helper should return a decision object suitable for audit.

Recommended shape:

```json
{
  "allowed": true,
  "actorUserId": "user_ref",
  "actingForLandlordId": "landlord_ref",
  "relationship": "delegate",
  "delegatedRole": "property_manager",
  "permissionScope": {
    "workspaceScopes": ["dashboard", "operations"],
    "propertyScopeMode": "selected",
    "permissionFlags": ["view", "edit", "message"]
  },
  "auditRequired": true
}
```

For denied decisions, include a safe denial reason code such as `grant_revoked`, `workspace_scope_denied`, `property_scope_denied`, or `owner_only_action`.

## Failure Modes

Authorization should fail closed when:

- Auth context is missing.
- Landlord scope cannot be resolved.
- Grant lookup fails.
- Resource ownership cannot be resolved.
- Permission vocabulary is unknown.
- Scope data is malformed.
- Route attempts to use delegate support before it has been reviewed.

Service availability failures should be logged and surfaced safely. They should not silently allow access.

## Non-Goals

- No custom permission builder.
- No organization-level inheritance in V1.
- No delegated billing permissions.
- No frontend-only enforcement.
- No impersonation mode.
