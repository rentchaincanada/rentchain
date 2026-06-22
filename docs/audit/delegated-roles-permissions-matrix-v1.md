# Delegated Roles and Permissions Matrix V1

## Scope

This document defines the first-pass delegated role and permission model for landlord workspaces.

This is documentation-only. It does not implement roles, permissions, routes, UI, backend enforcement, Firestore rules, billing changes, or contractor organization support.

## Permission Vocabulary

| Permission | Meaning |
| --- | --- |
| View | Can see scoped records and summaries. |
| Create | Can create new operational records within scope. |
| Edit | Can update operational records within scope. |
| Approve | Can approve or finalize sensitive workflow decisions. |
| Export | Can generate or download scoped exports. |
| Assign | Can assign work to a person, team, contractor, or workspace. |
| Message | Can send or reply to scoped messages. |
| Revoke | Can remove or change delegate access. |
| Billing access | Can see or modify plan, billing, payment method, invoices, or subscription settings. |

Permission enforcement must be server-side. Frontend visibility is not an authorization boundary.

## Role Definitions

| Role | Purpose | Default scope |
| --- | --- | --- |
| Landlord Owner | Account owner and final authority. | Full landlord account. |
| Property Manager | Operates assigned properties for the landlord. | Assigned properties and related workspaces. |
| Assistant / Office Admin | Handles office workflows, scheduling, inbox, applications, and routine updates. | Assigned properties/workspaces. |
| Maintenance Coordinator | Handles maintenance intake, scheduling, work orders, contractors, and related messages. | Assigned properties and maintenance/work-order workspaces. |
| Contractor | Performs assigned work only. | Assigned work orders/jobs. |
| Contractor Admin | Manages contractor organization staff and assigned jobs. | Assigned contractor organization and jobs. |
| Read-only Auditor | Reviews scoped records and exports without mutation rights. | Assigned properties/workspaces/evidence exports. |

## Workspace Permission Matrix

Legend:

- `Y` = allowed by default in V1.
- `Scoped` = allowed only for assigned properties, workspaces, jobs, or records.
- `Owner` = landlord owner only in V1.
- `No` = not allowed in V1.
- `Future` = deferred enterprise or explicit delegation scope.

### Dashboard

| Role | View | Create | Edit | Approve | Export | Assign | Message | Revoke | Billing access |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Landlord Owner | Y | No | No | Y | Y | Y | Y | Y | Y |
| Property Manager | Scoped | No | No | Scoped | No | Scoped | Scoped | No | No |
| Assistant / Office Admin | Scoped | No | No | No | No | No | Scoped | No | No |
| Maintenance Coordinator | Scoped | No | No | No | No | Scoped maintenance only | Scoped maintenance only | No | No |
| Contractor | Scoped job summaries only | No | No | No | No | No | Job messages only | No | No |
| Contractor Admin | Scoped job summaries only | No | No | No | No | Scoped contractor staff | Job messages only | No | No |
| Read-only Auditor | Scoped | No | No | No | Scoped | No | No | No | No |

### Operations

| Role | View | Create | Edit | Approve | Export | Assign | Message | Revoke | Billing access |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Landlord Owner | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| Property Manager | Scoped | Scoped | Scoped | Scoped non-billing | No | Scoped | Scoped | No | No |
| Assistant / Office Admin | Scoped | Scoped routine items | Scoped routine items | No | No | No | Scoped | No | No |
| Maintenance Coordinator | Scoped maintenance/work orders | Scoped maintenance/work orders | Scoped maintenance/work orders | Maintenance completion review only | No | Scoped maintenance/work orders | Scoped maintenance/work orders | No | No |
| Contractor | Assigned jobs only | Job updates only | Own job updates only | No | No | No | Job messages only | No | No |
| Contractor Admin | Assigned contractor jobs | Job updates only | Contractor job updates | No | No | Assign contractor staff only | Job messages only | No | No |
| Read-only Auditor | Scoped | No | No | No | Scoped | No | No | No | No |

### Properties

| Role | View | Create | Edit | Approve | Export | Assign | Message | Revoke | Billing access |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Landlord Owner | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| Property Manager | Scoped | Scoped if delegated | Scoped | Scoped operational approvals | No | Scoped | Scoped | No | No |
| Assistant / Office Admin | Scoped | Scoped draft/setup only | Scoped routine details | No | No | No | Scoped | No | No |
| Maintenance Coordinator | Scoped maintenance-relevant property/unit details | No | No | No | No | Scoped maintenance only | Scoped maintenance only | No | No |
| Contractor | Assigned job property/unit context only | No | No | No | No | No | Job messages only | No | No |
| Contractor Admin | Assigned job property/unit context only | No | No | No | No | Contractor staff assignment only | Job messages only | No | No |
| Read-only Auditor | Scoped | No | No | No | Scoped | No | No | No | No |

### Tenants

| Role | View | Create | Edit | Approve | Export | Assign | Message | Revoke | Billing access |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Landlord Owner | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| Property Manager | Scoped | Scoped | Scoped | Scoped operational approvals | No | Scoped | Scoped | No | No |
| Assistant / Office Admin | Scoped | Scoped invite/intake only | Scoped routine details | No | No | No | Scoped | No | No |
| Maintenance Coordinator | Tenant contact needed for maintenance only | No | Maintenance coordination notes only | No | No | Scoped maintenance only | Maintenance messages only | No | No |
| Contractor | Tenant contact only when required for assigned job | No | No | No | No | No | Job messages only | No | No |
| Contractor Admin | Tenant contact only when required for assigned job | No | No | No | No | Contractor staff assignment only | Job messages only | No | No |
| Read-only Auditor | Scoped | No | No | No | Scoped if authorized | No | No | No | No |

### Leases

| Role | View | Create | Edit | Approve | Export | Assign | Message | Revoke | Billing access |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Landlord Owner | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| Property Manager | Scoped | Scoped draft only if delegated | Scoped draft/routine only | Owner or explicitly delegated | No by default | Scoped | Scoped | No | No |
| Assistant / Office Admin | Scoped | Draft intake only | Draft/routine fields only | No | No | No | Scoped | No | No |
| Maintenance Coordinator | Lease occupancy context only | No | No | No | No | No | Maintenance messages only | No | No |
| Contractor | No except job-required occupancy context | No | No | No | No | No | Job messages only | No | No |
| Contractor Admin | No except job-required occupancy context | No | No | No | No | No | Job messages only | No | No |
| Read-only Auditor | Scoped | No | No | No | Scoped if authorized | No | No | No | No |

### Payments

| Role | View | Create | Edit | Approve | Export | Assign | Message | Revoke | Billing access |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Landlord Owner | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| Property Manager | Scoped summaries/details | No by default | No by default | No by default | No by default | No | Scoped payment follow-up messages | No | No |
| Assistant / Office Admin | Scoped summaries only | No | No | No | No | No | Scoped payment follow-up messages if delegated | No | No |
| Maintenance Coordinator | No | No | No | No | No | No | No | No | No |
| Contractor | No | No | No | No | No | No | No | No | No |
| Contractor Admin | No | No | No | No | No | No | No | No | No |
| Read-only Auditor | Scoped summaries/details | No | No | No | Scoped if authorized | No | No | No | No |

### Unified Inbox

| Role | View | Create | Edit | Approve | Export | Assign | Message | Revoke | Billing access |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Landlord Owner | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| Property Manager | Scoped | Scoped messages | Scoped status/triage | Scoped operational approvals | No | Scoped | Scoped | No | No |
| Assistant / Office Admin | Scoped | Scoped messages | Scoped status/triage | No | No | No | Scoped | No | No |
| Maintenance Coordinator | Maintenance/work-order messages only | Maintenance/work-order messages | Maintenance triage | No | No | Maintenance assignment | Maintenance/work-order messages | No | No |
| Contractor | Assigned job messages only | Job replies | Own job message status | No | No | No | Job messages only | No | No |
| Contractor Admin | Assigned contractor job messages only | Job replies | Contractor job message status | No | No | Contractor staff assignment only | Job messages only | No | No |
| Read-only Auditor | Scoped | No | No | No | Scoped if authorized | No | No | No | No |

### Scheduling

| Role | View | Create | Edit | Approve | Export | Assign | Message | Revoke | Billing access |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Landlord Owner | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| Property Manager | Scoped | Scoped | Scoped | Scoped operational approvals | No | Scoped | Scoped | No | No |
| Assistant / Office Admin | Scoped | Scoped | Scoped | No | No | No | Scoped | No | No |
| Maintenance Coordinator | Maintenance/work-order schedule only | Maintenance/work-order schedule | Maintenance/work-order schedule | No | No | Scoped maintenance/work orders | Maintenance/work-order messages | No | No |
| Contractor | Assigned job schedule only | Availability/job updates only | Own job availability only | No | No | No | Job messages only | No | No |
| Contractor Admin | Assigned contractor job schedules | Availability/job updates | Contractor availability/job status | No | No | Contractor staff assignment only | Job messages only | No | No |
| Read-only Auditor | Scoped | No | No | No | Scoped if authorized | No | No | No | No |

### Work Orders

| Role | View | Create | Edit | Approve | Export | Assign | Message | Revoke | Billing access |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Landlord Owner | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| Property Manager | Scoped | Scoped | Scoped | Scoped operational approvals | No | Scoped | Scoped | No | No |
| Assistant / Office Admin | Scoped | Scoped intake only | Scoped routine updates | No | No | No | Scoped | No | No |
| Maintenance Coordinator | Scoped | Scoped | Scoped | Completion/cost routing only if delegated | No | Scoped | Scoped | No | No |
| Contractor | Assigned jobs only | Job updates only | Own job updates only | No | No | No | Job messages only | No | No |
| Contractor Admin | Assigned contractor jobs | Job updates only | Contractor job updates | No | No | Contractor staff assignment only | Job messages only | No | No |
| Read-only Auditor | Scoped | No | No | No | Scoped if authorized | No | No | No | No |

### Evidence / Exports

| Role | View | Create | Edit | Approve | Export | Assign | Message | Revoke | Billing access |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Landlord Owner | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| Property Manager | Scoped | Scoped operational evidence | No immutable edits | Owner or explicitly delegated | No by default | Scoped | Scoped | No | No |
| Assistant / Office Admin | Scoped limited | Upload support docs only if delegated | No immutable edits | No | No | No | Scoped | No | No |
| Maintenance Coordinator | Maintenance/work-order evidence only | Maintenance/work-order evidence | No immutable edits | No | No | Scoped maintenance/work orders | Scoped maintenance/work orders | No | No |
| Contractor | Assigned job evidence only | Job evidence uploads only | Own draft uploads before submission only | No | No | No | Job messages only | No | No |
| Contractor Admin | Assigned contractor job evidence | Job evidence uploads only | Contractor draft uploads before submission only | No | No | Contractor staff assignment only | Job messages only | No | No |
| Read-only Auditor | Scoped | No | No | No | Scoped export if authorized | No | No | No | No |

### Settings / Billing

| Role | View | Create | Edit | Approve | Export | Assign | Message | Revoke | Billing access |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Landlord Owner | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| Property Manager | No by default | No | No | No | No | No | No | No | No |
| Assistant / Office Admin | No by default | No | No | No | No | No | No | No | No |
| Maintenance Coordinator | No | No | No | No | No | No | No | No | No |
| Contractor | No | No | No | No | No | No | No | No | No |
| Contractor Admin | Contractor org settings only in future | Future | Future | Future | Future | Future | Future | No landlord access | No |
| Read-only Auditor | No by default | No | No | No | No | No | No | No | No |

## High-Risk Permission Rules

1. Billing access remains landlord-owner only in V1.
2. Delegate revocation remains landlord-owner only in V1.
3. Payment mutation and payment exports are owner-only unless later explicitly delegated.
4. Evidence exports require explicit audit capture.
5. Contractor access is assigned-job scoped, not property-wide by default.
6. Contractor admin access is contractor-organization scoped in future work, not landlord-account scoped.
7. Read-only auditor access must not imply message sending, payment mutation, lease approval, or billing access.
8. Property manager access should support assigned properties and workspaces, not unrestricted account access by default.

## V1 Non-Goals

- No custom role builder.
- No delegated billing administration.
- No contractor organization implementation.
- No property manager company hierarchy.
- No SSO/SCIM.
- No automated approval chains.
- No hidden impersonation mode.
