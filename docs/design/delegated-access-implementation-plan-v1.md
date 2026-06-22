# Delegated Access Implementation Plan V1

## Scope

This document translates the approved delegated access governance audit into an implementation-ready plan.

This is design-only. It does not implement code, backend routes, UI, Firestore schema changes, security rules, email delivery, billing changes, or deployment changes.

Source governance:

- `docs/audit/delegated-access-governance-v1.md`
- `docs/audit/delegated-roles-permissions-matrix-v1.md`
- `docs/audit/delegated-access-audit-activity-model-v1.md`
- `docs/audit/delegated-access-invitation-revocation-flow-v1.md`

## Product Objective

Delegated Access V1 should make RentChain safe for multi-operator landlord work without turning delegated access into impersonation.

The system should support:

1. Landlord owner remains account authority.
2. Delegates use their own accounts.
3. Access is granted by explicit role and scope.
4. Authorization is evaluated server-side.
5. Revocation fails closed.
6. Delegated activity is auditable and attributable.

Billing/settings remain landlord-owner only in V1.

## Implementation Principles

- Landlord ownership is not transferable through delegation.
- Shared logins are explicitly unsupported.
- Delegated access grants are relationships, not identity replacement.
- Every delegated request must resolve the authenticated actor and the landlord being represented.
- Permission evaluation must happen before projection, mutation, export, message send, or evidence access.
- Audit capture must preserve actor attribution without copying sensitive payloads.
- V1 should prefer predefined roles over a custom permission builder.
- Contractor organizations and property manager companies must fit the model later without changing the V1 meaning.

## Phase 0: Design Lock And Vocabulary

Goal: lock the vocabulary before implementation begins.

Work:

- Define canonical role constants.
- Define workspace scope constants.
- Define permission flag constants.
- Define target resource type vocabulary.
- Define delegated access lifecycle event names.
- Confirm owner-only actions for V1.

Outputs:

- Shared permission vocabulary.
- Implementation checklist for backend and UI phases.
- Test matrix for delegated role and scope behavior.

Dependencies:

- Merged governance audit package.
- Current landlord auth helper patterns.
- Current audit/event helper patterns.

Validation:

- Architecture review confirms vocabulary matches the approved matrix.
- No code or schema changes in this phase unless a later implementation PR explicitly opens them.

## Phase 1: Data Model And Backend Authorization Foundation

Goal: introduce the storage and authorization foundation without exposing delegate management UI yet.

Work:

- Add Firestore collections for invitations, grants, grant history, and audit references.
- Add backend permission resolver that distinguishes landlord owner from delegate.
- Add server-side grant lookup by authenticated user and acting landlord.
- Add property, workspace, and resource scope evaluation.
- Add explicit deny handling for revoked, expired, inactive, or out-of-scope access.
- Add audit event helper integration for delegated lifecycle and denied access events.

Outputs:

- Delegated access grant model.
- Invitation model.
- Revocation history model.
- Permission evaluation helper.
- Audit helper surface for delegated events.

Non-goals:

- No owner-facing delegate management UI yet.
- No contractor organization hierarchy.
- No delegated billing access.
- No broad route rewrites.

Validation:

- Unit tests for owner access.
- Unit tests for active delegate access.
- Unit tests for revoked delegate fail-closed behavior.
- Unit tests for property and workspace scope denial.
- Unit tests for billing/settings owner-only behavior.

## Phase 2: Invitation, Acceptance, And Revocation APIs

Goal: implement the delegated access lifecycle behind authenticated backend routes.

Work:

- Add landlord-owner-only invite creation route.
- Add invitation email token generation and acceptance route.
- Add invite expiration and cancellation behavior.
- Add role/scope change route.
- Add revocation route.
- Add current grants and pending invites retrieval for owner review.
- Add active grant checks to invalidate stale permission assumptions.

Outputs:

- Invite creation API.
- Invite acceptance API.
- Invite cancellation and expiration behavior.
- Delegate grant management API.
- Revocation API.
- Owner-visible delegate list API.

Non-goals:

- No custom role builder.
- No delegated billing.
- No property manager company account model.
- No contractor organization implementation.

Validation:

- Auth tests for owner-only invite, scope change, and revoke actions.
- Token acceptance tests for valid, expired, cancelled, already accepted, and wrong-account cases.
- Revoked grant tests across representative landlord routes.
- Audit tests for lifecycle events.

## Phase 3: Owner And Delegate UX

Goal: make delegated access usable without expanding permissions.

Work:

- Add owner-facing delegate management surface.
- Add pending, active, revoked, and expired invite states.
- Add role and scope selection using predefined roles.
- Add concise permission review before send.
- Add delegate acceptance experience.
- Add delegate workspace entry and scoped navigation.
- Add revoked access state.
- Add owner-visible recent delegated activity view.

Outputs:

- Delegate management UI.
- Invitation send and resend UI.
- Role/scope edit UI.
- Revoke UI.
- Delegate acceptance UI.
- Scoped workspace entry for delegates.

Validation:

- Manual preview QA for owner invite, delegate accept, scoped access, revoked access, and mobile.
- Frontend tests for role/scope selection and revoked state.
- Backend tests remain authoritative for permission enforcement.

## Phase 4: Route-by-Route Enforcement Expansion

Goal: safely expand delegated access across landlord workspaces.

Recommended sequence:

1. Dashboard read access.
2. Scheduling read/create/edit for scoped roles.
3. Unified Inbox view/message for scoped roles.
4. Work Orders and maintenance workflows.
5. Properties and units for scoped operational roles.
6. Tenants and leases with conservative projection.
7. Payments read-only summaries where approved.
8. Evidence and exports with heightened audit.

Route expansion should be incremental. Each route should define:

- Required permission flag.
- Workspace scope.
- Property/resource scope.
- Projection rules.
- Audit requirements.
- Owner-only exceptions.

## Rollout Sequencing

Recommended rollout:

1. Internal development seed data and unit tests.
2. Owner-only delegate management hidden behind a guarded route or feature flag.
3. Limited staff roles on non-payment, non-evidence workspaces.
4. Add payment summaries only after projection and audit review.
5. Add evidence/export visibility only after export audit review.
6. Add contractor and company-level layers in later missions.

Do not launch broad delegated access until revocation and denied-access behavior are verified.

## Dependencies

Technical dependencies:

- Firebase Auth user identity.
- Existing landlord workspace authorization helpers.
- Existing Firestore access patterns.
- Existing audit/event helper patterns.
- Email sending infrastructure for invitations.
- Current workspace navigation and sticky shell.

Governance dependencies:

- Approved role matrix.
- Approved audit fields.
- Owner-only billing/settings rule.
- Projection-safe tenant, payment, message, evidence, and export behavior.

## Migration Strategy

V1 should be additive.

Recommended migration:

- Existing landlord owners remain unchanged.
- No existing landlord data is rewritten.
- Delegate collections start empty.
- Existing routes continue requiring landlord owner until each route explicitly opts into delegate authorization.
- Admin/support impersonation or support workflows remain separate and must not be conflated with delegation.
- Historical actions remain landlord-owner actions unless captured under delegated fields after launch.

Backfill is not required for V1.

## Implementation Readiness Checklist

Before implementation starts:

- Confirm data model document is accepted.
- Confirm permission evaluation model is accepted.
- Confirm audit architecture is accepted.
- Confirm invitation architecture is accepted.
- Confirm risk register has no Critical unresolved blockers.
- Choose first implementation PR boundary.

Recommended first implementation PR:

`feat/delegated-access-foundation-v1`

Suggested scope:

- Constants and types.
- Firestore model helpers.
- Permission evaluation helper.
- Audit event type definitions.
- Unit tests.

No UI in the first implementation PR.

## Manual QA Expectations

Docs-only design does not require manual QA.

Implementation phases will require manual QA when:

- Delegate management UI is introduced.
- Invitation acceptance is introduced.
- Delegated workspace navigation is introduced.
- Any route exposes landlord data to non-owner accounts.

## Deferred Scope

- Custom permission builder.
- Delegated billing.
- Property manager company hierarchy.
- Contractor organization hierarchy.
- SSO/SCIM.
- Mandatory MFA enforcement.
- Access certification campaigns.
- Legal hold and evidence chain-of-custody implementation.
- Automated AI action delegation.
