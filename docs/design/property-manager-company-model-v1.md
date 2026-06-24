# Property Manager Company Model V1 Mission Brief

## Scope

This brief designs how property management companies operate inside RentChain after Delegated Access V1.

This is design-only. It does not implement backend routes, frontend UI, Firestore schema changes, security rules, billing behavior, migrations, tests, or deployment changes.

## Mission Goal

Define the governance, relationship, permission, audit, billing, and contractor-compatibility model for Property Manager Companies before implementation planning begins.

The model must preserve:

- Landlord authority over landlord workspaces.
- Individual staff identity and actor attribution.
- Projection-safe access to tenant, lease, property, payment, message, and evidence data.
- Append-safe audit and relationship history.
- Clear V1 boundaries around billing, custom permissions, and contractor organizations.

## Non-Goals

- No implementation.
- No backend changes.
- No UI changes.
- No Firestore schema changes.
- No security rule changes.
- No billing delegation.
- No custom permission builder.
- No staff-to-staff delegation.
- No contractor organization implementation.
- No data migration or backfill.

## Company Model

A Property Manager Company is an organization-level operating entity that can manage rental operations for one or more landlord workspaces through explicit landlord-approved authority.

A Property Manager Company is different from an individual Delegate.

| Concept | Delegate | Property Manager Company |
| --- | --- | --- |
| Identity | One authenticated user | Organization with staff members |
| Grant target | User receives direct landlord grant | Company receives landlord relationship grant |
| Staff lifecycle | Controlled by landlord grant only | Controlled by company membership and assignments |
| Turnover handling | Landlord revokes individual user | Company admin removes staff; landlord may suspend or terminate relationship |
| Audit | User acted for landlord | Staff user acted for company, for landlord |
| Scale | Best for one-off access | Best for professional management firms |

The company must never become a shared landlord account. Every staff member must use an individual authenticated RentChain account.

## Governance Model

Core authorization chain:

```text
authenticated staff user
  -> active company membership
  -> company role/template
  -> active landlord-company relationship
  -> staff assignment inside approved relationship scope
  -> scoped landlord workspace access
```

The landlord remains the authority over landlord-owned data and workspace relationships. The PM company receives operational authority only where explicitly granted by the landlord.

Governance principles:

- Landlord owner controls whether a PM company may operate for the landlord workspace.
- Landlord owner controls the landlord-company relationship scope.
- Company Owner/Admin controls company staff membership.
- Company Owner/Admin may assign staff only within the approved landlord-company relationship scope.
- Staff access requires both active company membership and active landlord-company relationship.
- Revocation, suspension, or termination must fail closed.
- Staff actions must preserve individual actor attribution.
- Company authority must not imply billing/settings authority in V1.

## No Staff-to-Staff Delegation in V1

V1 must not support chain delegation.

Disallowed:

```text
Landlord -> PM Company -> Staff -> Sub-delegate
```

Rules:

- A PM company staff member cannot delegate access to another person.
- Staff cannot invite other staff unless they are Company Owner or Company Admin.
- Staff cannot create sub-grants, shadow assignments, or invite outside collaborators.
- All staff access must flow through Company Owner/Admin membership and assignment.
- Contractor or external specialist access must use a future approved contractor organization or resource assignment model, not staff sub-delegation.

This keeps authority traceable and avoids unmanaged access paths.

## Company Structure Model

Recommended V1 hierarchy:

| Role | Purpose | V1 Boundary |
| --- | --- | --- |
| Company Owner | Owns PM company account and top-level governance | Can manage company profile, admins, staff, and company-level settings |
| Company Admin | Manages staff and assignments | Can invite, remove, and assign staff inside company hierarchy |
| Regional Manager | Supervises multiple assigned properties or property managers | May review assigned relationships and assign staff within approved scope if allowed by Company Admin policy |
| Property Manager | Operates assigned landlord/property workflows | Can access granted workspaces and scopes |
| Leasing Agent | Handles leasing/application workflows | Limited tenant, application, and lease workflow access |
| Office Administrator | Supports administrative workflows | Operational inbox, scheduling, documentation, and task support where scoped |
| Maintenance Coordinator | Handles operations and work orders | Work-order and scheduling focused |
| Read-only Auditor | Reviews assigned information | No mutation or export unless explicitly granted by template/scope |

Company Owner is not the same as Landlord Owner. A user may hold both roles in different contexts, but authority must be resolved by active context.

## PM Company Admin Staff Management

Company Owner/Admin can:

- Invite staff to the PM company.
- Remove staff from the PM company.
- Assign staff to landlord-company relationships.
- Assign staff to approved property/workspace subsets.
- Change company roles/templates.
- Deactivate staff membership.

Company Owner/Admin cannot:

- Override the landlord-company relationship scope.
- Assign staff to properties not included in the landlord-approved scope.
- Grant billing/settings access to landlord workspaces in V1.
- Make staff authority exceed the landlord-company relationship.
- Create landlord-owned properties, tenants, leases, or billing authority unless separately allowed by scoped product workflows.

Staff assignment must remain inside the PM company hierarchy.

## Permission Templates

V1 should use predefined permission templates, not raw permission toggles.

Recommended templates:

- Property Manager
- Leasing Agent
- Office Administrator
- Maintenance Coordinator
- Read-only Auditor
- Regional Manager

Templates should be product-owned permission bundles combined with explicit workspace/property scope. They should not expose raw action flags to landlords or PM company admins in V1.

Template behavior:

- Landlord selects the company relationship scope.
- Company Owner/Admin assigns staff using templates.
- Staff permissions are the intersection of template, company assignment, and landlord-company relationship scope.
- Owner-only and billing/settings restrictions override templates.
- Unknown, malformed, or unsupported template values fail closed.

## Custom Permissions Deferred

No custom role or permission builder should ship in V1.

Custom permissions are deferred to a later enterprise mission. V1 uses:

- Predefined role templates.
- Workspace scope.
- Property scope.
- Resource scope only where explicitly designed.

This avoids unreviewed permission combinations before the company model is proven.

## Regional Manager Role

Regional Manager is a V1 company role template.

Purpose:

- Supervises multiple assigned properties or property managers.
- Reviews operations across assigned landlord/company relationships.
- May assign company staff within approved landlord-company scope if Company Admin policy allows.
- Coordinates work across a portfolio subset without receiving landlord owner authority.

Boundaries:

- No landlord billing/settings authority.
- No access outside assigned landlord-company relationship scope.
- No custom permission expansion.
- No staff-to-staff delegation unless acting with Company Owner/Admin authority.
- No authority to terminate landlord-company relationships unless explicitly held as Company Owner/Admin and allowed by future workflow.

## Landlord to PM Company Relationship Model

The model should support:

| Relationship | Supported | Notes |
| --- | --- | --- |
| One landlord -> one PM company | Yes | Common full-service management case |
| One landlord -> multiple PM companies | Yes | Useful for region, property, or service-specific managers |
| One PM company -> multiple landlords | Yes | Core professional PM use case |

The landlord-company relationship must support both:

- Entire portfolio scope.
- Selected-property scope.

Recommended conceptual relationship record:

```text
landlordCompanyRelationship
  landlordId
  propertyManagerCompanyId
  status: pending | active | suspended | terminated
  relationshipScope:
    propertyScope:
      mode: entire_portfolio | selected_properties
      propertyIds: [...]
    workspaceScope: [...]
  createdByLandlordOwnerUserId
  acceptedByCompanyAdminUserId
  startedAt
  suspendedAt
  suspendedByUserId
  suspensionReason
  reactivatedAt
  terminatedAt
  terminatedByUserId
  terminationReason
```

Internal property IDs are authorization references only. User-facing views must use safe property labels.

## Selected-Property Relationships

Selected-property scope must be explicit in the relationship model.

Rules:

- `entire_portfolio` allows the PM company to operate across the landlord's current portfolio within approved workspace scope.
- `selected_properties` allows only listed landlord-owned properties.
- Staff assignments can narrow selected-property scope but cannot widen it.
- Unit, tenant, lease, work order, message, and task access must resolve server-side to the approved property scope where applicable.
- If a resource cannot be resolved safely to an approved property or resource assignment, authorization fails closed.

Future implementation should define how newly added landlord properties interact with `entire_portfolio` versus `selected_properties`.

## Suspended vs Terminated Relationships

Relationship status must distinguish temporary pause from final end.

### Suspended

Suspended means a temporary pause.

Expected behavior:

- Access is blocked.
- Relationship record is preserved.
- Audit/history is preserved.
- Staff assignments remain historical and inactive while suspended.
- Relationship may be reactivated by an approved process.

Suspension is useful for disputes, contract review, non-payment, operational pause, suspected account risk, or temporary offboarding.

### Terminated

Terminated means final relationship end.

Expected behavior:

- Access is blocked.
- Relationship record is preserved.
- Audit/history is preserved.
- Staff assignments become inactive for future authorization.
- Reactivation should require a new relationship or an explicit reactivation process with audit.

Termination must not delete historical activity, landlord-owned records, or company actor attribution.

## Landlord Visibility Over PM Company Staff

The landlord must be able to see which PM company staff have access to their workspace.

Recommended landlord-visible fields:

- Staff name/email.
- PM company name.
- Company role/template.
- Assigned properties.
- Assigned workspaces.
- Access status.
- Recent activity if available.

V1 boundary:

- Landlord does not directly manage company employees.
- Landlord does not edit PM company staff membership.
- Landlord can suspend or terminate the landlord-company relationship.
- Landlord can request staff changes through operational workflow if implemented later.

This preserves company employment control while keeping landlord access visibility.

## Data Ownership

Initial V1 ownership recommendation:

| Data | Owner | PM Company Rights |
| --- | --- | --- |
| Properties | Landlord | Scoped operational access |
| Units | Landlord | Scoped operational access |
| Tenants | Landlord relationship context | Scoped operational access, projection-safe |
| Leases | Landlord | Scoped operational access; final authority remains landlord unless later delegated |
| Payments/billing | Landlord | No billing control in V1 |
| Messages | Landlord workspace context | Staff actor attribution required |
| Work orders | Landlord, with assigned operational access | PM may coordinate if scoped |
| Audit events | Platform-owned immutable record | Visible by landlord; company/staff views are projected |

Termination behavior:

- Landlord data remains with landlord.
- PM company loses future access immediately.
- Historical audit records remain preserved.
- Staff actions remain attributed to the original actor and company context.
- Company should retain only its own operational metadata, not landlord-owned private data copies.
- Exported/downloaded material risk should be handled through audit and future policy controls.

## Permission Evaluation Model

Every landlord-scoped PM company request should answer:

1. Who is authenticated?
2. Which PM company membership is active?
3. Which landlord workspace is being accessed?
4. Is the landlord-company relationship active?
5. Is the staff member assigned to this relationship?
6. Does the assignment permit the requested workspace?
7. Does the assignment permit the requested property/resource?
8. Does the template permit the requested action?
9. Is the action owner-only or billing/settings related?
10. What audit event is required?

Explicit deny wins:

- Missing authentication.
- Inactive company membership.
- Removed staff member.
- Suspended company membership.
- Suspended landlord-company relationship.
- Terminated landlord-company relationship.
- Missing staff assignment.
- Out-of-scope property/workspace/resource.
- Billing/settings access in V1.
- Unknown template or malformed scope.
- Any attempted chain delegation.

## Audit Model

Every PM company action must preserve this meaning:

```text
Staff user acted for PM company, for landlord, under relationship scope.
```

Recommended audit fields conceptually:

```text
actorUserId
actorCompanyId
actingForLandlordId
relationshipId
companyStaffAssignmentId
companyRoleTemplate
workspaceScope
propertyScope
targetResourceType
targetResourceId
eventType
outcome
timestamp
```

Audit requirements:

- Landlord can see PM company and staff actor attribution.
- Company can see its own staff activity where appropriate.
- Staff must not appear as landlord owner.
- Company-level actions and staff-level actions must be distinct.
- Invitation, assignment, removal, suspension, reactivation, termination, exports, messages, and high-risk mutations must be auditable.
- No raw internal IDs should be user-facing labels.

## Billing Model Boundaries

V1 billing remains landlord-owned.

Rules:

- PM companies do not control landlord billing.
- PM companies do not change landlord subscription, payment method, invoices, or plan.
- PM companies do not receive billing/settings workspace scope.
- PM companies do not manage landlord payment processors or payout configuration.
- PM company billing for its own future RentChain account, if introduced, must be separate from landlord billing.
- Any future PM-paid or agency-billed model requires a separate billing mission and explicit authorization.

## Contractor Interaction Model

The PM company model must not conflict with the future Contractor Organization model.

Compatibility rules:

- PM companies manage landlord operations.
- Contractor organizations perform assigned work or jobs.
- Contractors should remain job/resource-scoped by default.
- PM staff may coordinate contractor workflows only if landlord-company scope allows operations/work orders.
- PM company membership must not imply contractor organization membership.
- Contractor organization admins must not become landlord delegates or PM company staff by accident.
- Future contractor organization access should reuse layered authorization and actor attribution patterns.

Recommended future relationship separation:

```text
landlord -> propertyManagerCompany -> staff assignment
landlord/propertyManagerCompany -> contractorOrganization -> technician assignment
```

The contractor model should add job-scoped access, not broaden PM company authority.

## Future Staff Replacement and Handover

Staff replacement and handover should be future scope, not V1.

Future workflow should support:

- Replace assigned property manager.
- Transfer active tasks to another staff member.
- Hand over work orders, message ownership, scheduled events, and open operational tasks.
- Preserve historical actor attribution for prior work.
- Avoid orphaned work orders, messages, tasks, and tenant follow-ups.
- Notify affected landlord users where appropriate.

This should be designed as an operational continuity workflow, not as audit rewriting.

## Future PM Company Branding/Profile

Future PM company profile support may include:

- Company name.
- Logo.
- Contact information.
- Public-facing company profile.
- Tenant-visible branding if approved.
- Landlord-visible branding if approved.

Branding must be governed separately from authorization. A visible company profile should not imply broader access.

## Risk Assessment

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Company staff turnover leaves access active | High | Require company membership and assignment checks on every request |
| PM company becomes shared landlord account | High | Require individual staff accounts and actor attribution |
| Staff-to-staff delegation creates unmanaged access | High | Disallow chain delegation in V1 |
| Landlord loses visibility into who acted | High | Show staff access list and audit staff user, company, landlord, relationship, and scope |
| Company admin overrides landlord scope | High | Enforce relationship scope as upper bound |
| Billing authority leaks to PM company | High | Keep billing/settings owner-only in V1 |
| Multi-landlord PM console leaks data across landlords | High | Evaluate relationship and scope per landlord request |
| Relationship termination deletes history | High | Preserve terminated relationships and immutable audit |
| Contractor model conflict | Medium | Keep contractor organizations separate and job/resource scoped |
| Overly complex V1 permissions | Medium | Use predefined templates and explicit scopes before custom permissions |
| Raw IDs exposed in UI | Medium | Use safe display labels for landlord, company, property, and staff |

## Recommended Phased Implementation Plan

### Phase 0: Design Approval

- Review and approve this model.
- Confirm role/template vocabulary.
- Confirm no staff-to-staff delegation in V1.
- Confirm landlord visibility requirements.
- Confirm selected-property relationship behavior.
- Confirm billing remains landlord-owned.
- Confirm contractor compatibility assumptions.

### Phase 1: Data and Authorization Design

- Define company, membership, relationship, and assignment records.
- Define permission template constants.
- Define server-side permission evaluation helper.
- Define audit event vocabulary.
- Define safe projections.
- No UI implementation yet.

### Phase 2: Company Account Foundation

- Create PM company identity and membership management.
- Support Company Owner/Admin/Staff roles.
- Support staff invitation/removal inside company hierarchy.
- No landlord access until relationship grant exists.

### Phase 3: Landlord-to-Company Relationship

- Landlord invites or approves PM company.
- Relationship supports active, suspended, and terminated states.
- Relationship supports entire portfolio and selected-property scope.
- Landlord can view company and assigned staff.

### Phase 4: Staff Assignment and Workspace Access

- Company Owner/Admin assigns staff to landlord relationships.
- Staff access evaluates company membership plus landlord relationship.
- Staff access uses templates plus property/workspace scope.
- Landlord can see staff access and suspend/terminate relationship.

### Phase 5: Multi-Landlord PM Console

- PM staff can switch between authorized landlord workspaces.
- No cross-landlord data blending.
- Clear workspace labels and safe projections.

### Phase 6: Contractor Organization Compatibility

- Introduce contractor organizations separately.
- Add job/resource-scoped contractor access.
- Preserve PM company and contractor organization boundary.

### Future Phase: Enterprise Permissions and Handover

- Custom permission builder.
- Staff replacement and handover workflows.
- Advanced access review.
- PM company branding/profile.
- Enterprise policy controls.

## Acceptance Criteria for This Design Mission

- Property Manager Company is clearly distinct from Delegate.
- No staff-to-staff delegation is allowed in V1.
- Company hierarchy and Regional Manager role are defined.
- Landlord visibility into PM company staff access is required.
- PM Company Owner/Admin staff-management authority is defined.
- Permission templates replace raw permission selection in V1.
- Custom permissions are explicitly deferred.
- Entire portfolio and selected-property relationships are supported.
- Suspended and terminated relationship states are distinct.
- Landlord-owned data and billing boundaries are preserved.
- Audit preserves landlord visibility and staff attribution.
- Contractor organization model remains unblocked.
- Staff replacement/handover and company branding are documented as future scope.
- Implementation is deferred until this brief is reviewed and approved.
