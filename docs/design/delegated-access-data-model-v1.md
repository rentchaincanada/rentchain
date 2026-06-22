# Delegated Access Firestore/Data Model Proposal V1

## Scope

This document proposes the Firestore data model for Delegated Access V1.

This is design-only. It does not create collections, indexes, rules, migrations, backend routes, or UI.

## Data Model Goals

The data model should support:

- Landlord owner authority.
- Delegate-owned user accounts.
- Role assignments.
- Property scoping.
- Workspace scoping.
- Resource scoping for contractors and auditors.
- Invitation lifecycle.
- Revocation history.
- Immutable audit references.
- Future property manager company and contractor organization layers.

## Ownership Model

Existing landlord ownership remains the source of account authority.

Recommended relationship:

```text
landlord workspace
  ownerUserId
  active delegate grants
  pending invitations
  revoked grant history
  delegated activity audit references
```

The landlord owner is not represented as a delegate grant. Owner authority should be resolved from the existing landlord ownership model.

## Proposed Collections

Collection names are proposals and should be confirmed during implementation.

| Collection | Purpose |
| --- | --- |
| `delegatedAccessInvitations` | Pending, accepted, expired, or cancelled invitations. |
| `delegatedAccessGrants` | Active or revoked access grants from landlord to delegate. |
| `delegatedAccessGrantHistory` | Append-safe role/scope/revocation history for grants. |
| `delegatedAccessAuditEvents` | Immutable delegated access lifecycle and use events, or references into a canonical audit collection. |

If the existing audit system has a canonical collection, `delegatedAccessAuditEvents` should be implemented as event types within that system instead of a duplicate audit store.

## Landlord Owner Relationship

Landlord owner authority should resolve from existing landlord account data.

Required owner fields:

| Field | Purpose |
| --- | --- |
| `landlordId` | Canonical landlord workspace reference. |
| `ownerUserId` | Authenticated user with owner authority. |
| `ownerEmail` | Optional display/support metadata, not authority by itself. |
| `billingOwnerUserId` | Optional explicit billing owner if later separated. In V1, owner-only billing remains enforced. |

Email must not be used as the only authorization key.

## Delegate Accounts

Delegates must use their own authenticated accounts.

Delegate identity fields:

| Field | Purpose |
| --- | --- |
| `delegateUserId` | Authenticated Firebase user ID after acceptance. |
| `delegateEmail` | Invitation and display metadata. |
| `delegateDisplayName` | Optional display label. |
| `delegateAuthProvider` | Optional provider metadata. |
| `mfaRecommendedAt` | Optional recommendation metadata. |
| `mfaVerifiedAt` | Optional future enforcement metadata. |

Before acceptance, invitation records may only know `inviteeEmail`.

## Role Assignments

Active grants should carry one role at a time in V1.

Recommended grant fields:

| Field | Purpose |
| --- | --- |
| `grantId` | Canonical grant identifier. |
| `landlordId` | Landlord workspace being delegated. |
| `delegateUserId` | Authenticated delegate account. |
| `role` | Predefined delegated role. |
| `status` | `active`, `revoked`, `suspended`, or `expired`. |
| `createdByUserId` | Landlord owner who created the grant or invitation. |
| `acceptedAt` | Acceptance timestamp. |
| `updatedAt` | Last grant metadata update timestamp. |
| `revokedAt` | Revocation timestamp when applicable. |
| `revokedByUserId` | Actor who revoked access. |
| `revocationReason` | Optional sanitized reason. |

V1 roles:

- `property_manager`
- `assistant_office_admin`
- `maintenance_coordinator`
- `contractor`
- `contractor_admin`
- `read_only_auditor`

`landlord_owner` is not inviteable and should not be stored as a delegate role.

## Property Scoping

Property scope should be explicit.

Recommended shape:

```json
{
  "propertyScope": {
    "mode": "selected",
    "propertyIds": ["property_ref_1", "property_ref_2"],
    "unitIds": []
  }
}
```

Modes:

| Mode | Meaning |
| --- | --- |
| `all_current_properties` | All current properties for the landlord. Use sparingly. |
| `selected` | Only listed properties. Preferred default. |
| `resource_only` | No property-wide access; only assigned resources. |
| `none` | No property access. |

Property IDs are internal authorization references. User-facing projections should show safe property labels.

## Workspace Scoping

Workspace scope should be a list of allowed workspace keys.

Recommended workspace keys:

- `dashboard`
- `operations`
- `properties`
- `tenants`
- `leases`
- `payments`
- `unified_inbox`
- `scheduling`
- `work_orders`
- `evidence_exports`
- `settings_billing`

V1 should reject `settings_billing` for all delegate roles.

## Resource Scoping

Resource scope supports contractors, contractor admins, auditors, exports, and future company models.

Recommended shape:

```json
{
  "resourceScope": {
    "workOrderIds": [],
    "maintenanceRequestIds": [],
    "messageThreadIds": [],
    "evidencePackageIds": [],
    "exportPackageIds": [],
    "contractorJobIds": []
  }
}
```

Resource scope should be evaluated together with property and workspace scope. Resource scope must not widen property scope unless explicitly designed.

## Invitation Records

Invitation records should be separate from grants until accepted.

Recommended invitation fields:

| Field | Purpose |
| --- | --- |
| `invitationId` | Canonical invitation identifier. |
| `landlordId` | Landlord workspace being delegated. |
| `inviteeEmail` | Email address invited. |
| `role` | Proposed role. |
| `propertyScope` | Proposed property scope. |
| `workspaceScope` | Proposed workspace scope. |
| `resourceScope` | Proposed resource scope. |
| `status` | `pending`, `accepted`, `expired`, `cancelled`. |
| `tokenHash` | Hashed invitation token. |
| `expiresAt` | Expiration timestamp. |
| `createdByUserId` | Landlord owner who invited. |
| `createdAt` | Creation timestamp. |
| `acceptedByUserId` | Delegate user who accepted. |
| `acceptedAt` | Acceptance timestamp. |
| `cancelledByUserId` | Actor who cancelled invitation. |
| `cancelledAt` | Cancellation timestamp. |

Raw invitation tokens should not be stored.

## Revocation Records

Revocation can be represented in grant history and audit events. If a separate record is useful, it should be append-only.

Recommended revocation fields:

| Field | Purpose |
| --- | --- |
| `revocationId` | Canonical revocation identifier. |
| `grantId` | Grant revoked. |
| `landlordId` | Landlord workspace. |
| `delegateUserId` | Delegate revoked. |
| `previousRole` | Role before revocation. |
| `previousScope` | Scope before revocation. |
| `revokedByUserId` | Landlord owner who revoked. |
| `revokedAt` | Server timestamp. |
| `reason` | Optional sanitized reason. |

Revoked grants should remain queryable for audit and owner history.

## Audit References

Grant, invitation, and revocation records should include audit references where useful.

Recommended fields:

| Field | Purpose |
| --- | --- |
| `createdAuditEventId` | Invitation or grant creation event. |
| `acceptedAuditEventId` | Acceptance event. |
| `roleChangedAuditEventIds` | Optional list or queryable history reference. |
| `scopeChangedAuditEventIds` | Optional list or queryable history reference. |
| `revokedAuditEventId` | Revocation event. |

Audit events should remain the durable activity source. Records should not need to duplicate full audit payloads.

## Future Company Compatibility

The model should allow a future organization layer without rewriting V1 grants.

Future property manager company fields:

- `propertyManagerCompanyId`
- `companyAdminUserId`
- `companyStaffUserIds`
- `landlordToCompanyGrantId`
- `companyStaffAssignmentId`

Future contractor organization fields:

- `contractorOrganizationId`
- `contractorAdminUserId`
- `technicianUserIds`
- `assignedJobIds`

V1 individual grants should remain valid even after organization support is added.

## Security Rule Posture

Security rules are not implemented in this design.

Implementation should not rely on client-readable Firestore paths for delegated authorization. Server-side authorization should remain authoritative for landlord workspace APIs.

## Index Considerations

Likely query patterns:

- Active grants by `landlordId`.
- Active grants by `delegateUserId`.
- Grant by `landlordId` and `delegateUserId`.
- Invitations by `landlordId` and `status`.
- Invitations by token hash during acceptance.
- Grant history by `grantId`.
- Audit events by `actingForLandlordId`, `actorUserId`, `eventType`, and timestamp.

Index implementation should be done in the implementation phase, not in this docs-only mission.

## Non-Goals

- No Firestore collection creation.
- No index creation.
- No security rule change.
- No migration.
- No backfill.
- No billing delegation.
- No custom permission builder.
