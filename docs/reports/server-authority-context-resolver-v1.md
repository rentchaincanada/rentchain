# Server Authority Context Resolver v1

## Purpose

RentChain now has a shared server-side request authority resolver for deriving actor and scope context from the existing `req.user` session shape. This is a first governance-hardening step, not an authentication rewrite.

The resolver centralizes repeated local patterns such as:

- `req.user?.landlordId || req.user?.id`
- `req.user?.actorLandlordId || req.user?.landlordId || req.user?.id`
- `req.user?.tenantId || req.user?.id`
- local role normalization for landlord, tenant, admin, and operator-style actors

## Resolver Location

`rentchain-api/src/auth/requestAuthority.ts`

## Contract

The resolver returns deterministic, explicit context:

- `actorId`
- `actorRole`
- `userId`
- `landlordId`
- `tenantId`
- `actorLandlordId`
- `effectiveLandlordId`
- `effectiveTenantId`
- `isAdmin`
- `isLandlord`
- `isTenant`
- `isSupport`
- `authoritySource`
- `warnings`
- `errors`

## Guarantees In This Version

- Uses only existing session/user fields.
- Preserves current landlord fallback behavior for landlord/admin-style users.
- Preserves tenant fallback behavior for tenant users.
- Keeps authority resolution server-side.
- Reports ambiguity as warnings/errors instead of silently changing enforcement.

## Non-Goals

This version does not:

- change JWT format
- change Firebase Auth behavior
- change Firestore rules
- change route visibility
- introduce new roles or claims
- enforce a new authorization model
- migrate every route family

## Routes Migrated In This Version

- Landlord evidence pack preview landlord scope resolution.
- Landlord and tenant messaging scope resolution.
- Payments listing/export landlord scope helpers.

These migrations are intentionally small and preserve current behavior.

## Remaining Migration Candidates

- `requireLandlord` and `requireLandlordOrAdmin` middleware internals.
- Admin route families with local `normalizeRole()` helpers.
- Work-order and contractor marketplace route authority helpers.
- Operator review and institutional-readiness route families.
- Tenant workspace routes that derive landlord/tenant context locally.
- Payment write/event attribution paths, after audit of existing event semantics.

## Risk Notes

- This PR should not be treated as comprehensive authorization hardening.
- Current route-level enforcement remains distributed.
- Some route families still mix actor identity, landlord scope, and workflow scope locally.
- Future migrations should be route-family-specific and backed by behavior-preservation tests.
