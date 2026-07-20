# Operational Credit Organization Authority Decision v1

## Status

Proposed target architecture. Operator use and runtime implementation are not authorized.

## Context

Current RentChain authorization commonly resolves a landlord scope through `landlordId`, with some legacy paths falling back to the authenticated user ID. Landlord, admin, tenant, contractor, delegated-access, property-manager, and institutional patterns exist, but the audit does not establish a single canonical organization membership and subscription-ownership authority suitable for a financial-style service-credit account.

Operational Credits need durable ownership beyond a particular user while still supporting independent landlords, property managers, portfolio operators, institutions, enterprises, multi-office businesses, and government/housing-authority programmes.

## Decision

Operational Credits belong to the **canonical RentChain organization**. Users act only as authorized representatives.

An independent landlord is represented by a one-member organization rather than a personal wallet. A future credit account references a canonical `organizationId`; `landlordId`, user ID, email, alias, property ownership, or client-provided scope is insufficient authority by itself.

### Authority model

| Capability | Required authority |
| --- | --- |
| View balance/activity | Organization membership plus `operational_credits.read` |
| Reserve/redeem | Membership, service permission, budget/limit availability, and valid workflow authority |
| Allocate staff/office budget | `operational_credits.allocate` plus scope and threshold controls |
| Grant or debit adjustment | Dedicated protected permission, reason, case reference, and approval rule |
| Reverse redemption | Protected permission plus original transaction/service evidence |
| Export usage | Audience-specific export permission and safe projection |
| Configure enterprise rules | Contract/governance role with separation of duties where required |

Admin status alone does not authorize credit mutation. Impersonation sessions must not perform grants, redemptions, reversals, or adjustments.

### Lifecycle rules

- Removing a user removes their authority but does not move or delete organization credits.
- Subscription cancellation changes entitlement/grant policy according to approved terms; it does not transfer credits to users.
- Organization closure freezes new use, preserves audit evidence, and applies approved expiry/refund rules.
- Ownership disputes freeze mutation and enter a governed review; support cannot silently reassign balances.
- Parent/subsidiary organizations retain distinct accounts. Central budgets are allocations from an explicitly contracted parent pool, not implicit cross-organization access.

## Alternatives considered

1. **User-owned wallet:** rejected because users change roles/employers and cannot own an enterprise entitlement personally.
2. **Landlord ID as permanent owner:** rejected as a near-term alias that does not fully express multi-entity organizations.
3. **Property-level accounts:** rejected as the primary model; too fragmented for subscriptions and central governance.
4. **One global enterprise account across legal entities:** rejected without explicit contract and governed allocation relationships.
5. **Subscription owner equals credit owner automatically:** rejected until subscription ownership is canonical and lifecycle-safe.

## Rationale

Organization ownership aligns the credit liability, subscription/contract, staff permissions, enterprise reporting, and service consumption. It prevents personal transferability and preserves continuity when staff change.

## Consequences

- A canonical organization and membership authority must precede persistence.
- Subscription events require an adapter that proves the entitled organization.
- Every ledger entry must record organization, account, actor, role, permission context, and audit evidence.
- Budget allocation affects spending authority, not economic ownership or total units.
- Parent/subsidiary and multi-office access require explicit relationship records and exact scope.

## Risks

- Reusing `landlordId` fallback behavior could permit wrong-organization access.
- Broad admin roles could enable unauthorized adjustments.
- Ambiguous mergers, closures, or ownership disputes could strand or misassign credits.
- Complex enterprise allocation can accidentally duplicate credits if modeled as new grants.

## Open questions

- What collection/service is the canonical organization and membership authority?
- How are current landlord records migrated to one-member organizations?
- Which actor owns existing subscriptions and future enterprise contracts?
- What delegated roles and approval thresholds are required at launch?
- Are central pools permitted across distinct legal entities, and under what contract?
- What happens to active reservations during user removal, subscription cancellation, or organization freeze?

## Dependencies

- canonical organization/member/relationship model;
- subscription ownership and contract mapping;
- permission registry and server-side authorization pattern;
- operational-credit classification and catalogue decisions;
- append-safe audit and organization closure/dispute procedures.

## Legal or accounting review requirements

Review organization ownership, agency authority, contract-party treatment, account closure, unused-credit treatment, enterprise legal entities, government programme constraints, and dispute handling.

## Security implications

Every read/write must resolve organization authority server-side and fail closed. Exact permissions, budget limits, approval thresholds, version checks, organization isolation tests, and immutable attribution are mandatory.

## Privacy implications

Customer projections should use organization/service display labels and omit raw IDs, membership internals, actor emails, provider references, and support metadata. Staff activity visibility must follow role and employment/privacy policy.

## Enterprise implications

The model supports offices, departments, regions, cost centres, per-user limits, approval thresholds, contract-specific catalogues, and institutional exports while retaining legal-entity isolation.

## Implementation constraints

- No user-owned wallet or personal transferable balance.
- No client-supplied `organizationId` trusted without server resolution.
- No alias-only or post-read filtering as ownership proof.
- Allocations are control projections, not ledger grants.
- All organization lifecycle actions are append-safe and reviewable.

## Explicit out of scope

Organization schema migration, membership runtime changes, permissions, routes, Firestore rules, account creation, balances, staff UI, enterprise hierarchy UI, subscription mutation, and credit operations.

## Conditions required before implementation

1. Canonical organization, membership, and subscription authority are documented and proven.
2. Launch roles and permissions are approved.
3. Closure, removal, cancellation, dispute, and parent/subsidiary rules are approved.
4. Organization isolation and impersonation-write tests are specified.
5. PR #1431 and the classification decision are approved dependencies.
