# Session Revocation Design Options v1

## Scope

This document compares three candidate server-side session revocation architectures for future implementation. It is design documentation only. It does not add runtime revocation, auth routes, Firestore collections, Firestore indexes, dependencies, deployment changes, or production data changes.

## Current State vs Future Design

Current state: logout is client-side token clearing plus backend acknowledgement. `POST /api/auth/logout` does not verify or revoke JWTs. `requireAuth` verifies JWT signature and expiration, then hydrates a canonical session user. There is no active-session store, token denial collection, token-version check, trusted-device revocation table, or concurrent-session invalidation.

Future design: Phase 4 may implement one of the designs below. Any implementation must be separately scoped, reviewed, tested, and approved before runtime behavior changes.

## Shared Constraints

All options must preserve these constraints:

- Preserve tenant, landlord, admin, and support separation.
- Never expose session or revocation internals to tenant-facing APIs, exports, dashboards, or timeline views.
- Store only hashed identifiers or metadata; do not store bearer values or unredacted credential material.
- Keep support and admin review surfaces permission-gated and audit-linked.
- Preserve append-safe audit records for security-sensitive revocation events.
- Keep revocation decisions reviewable and reversible by storing status and review metadata rather than destructive deletes.
- Avoid cross-landlord and cross-tenant revocation scope.
- Use metadata-only incident references for security review records.
- Define concurrent-session behavior explicitly.

## Option A: Session-Record Model

### Current State vs Future Design

Current state: no backend record is created per login. Logout has no server-side session state to mark.

Future design: each successful login creates a session record scoped to one user and optional landlord or tenant context. Logout or incident response marks a record as revoked, expired, or review_pending. `requireAuth` checks the session record before accepting a token.

### Design

- Collection: proposed `authSessions`.
- Keying: generated session reference; token contains a session reference claim.
- Scope: user ID plus optional landlord ID and tenant ID.
- Device: hashed device reference, browser-header hash, and coarse created-at metadata.
- Status: active, revoked, expired, review_pending.
- Reversibility: revoked records can move to review_cleared only through an audit-linked admin action.

### Pros

- Granular per-device or per-session revocation.
- Clear session inventory for admin-only incident response.
- Straightforward concurrent-session semantics.
- Supports device-level trusted-session review.

### Cons

- Adds Firestore writes on login, logout, expiration cleanup, and incident response.
- Adds read or cache dependency in `requireAuth`.
- Requires new indexes for status, user, and issued-at queries.
- Requires careful device metadata redaction and admin-only projection.

### Firestore Implications

- Proposed collection: `authSessions`.
- Query patterns: by user and status, by user and issuedAt, by session reference.
- Index impact: composite indexes likely needed for userId/status/issuedAt and landlordId/status/issuedAt.
- Cost profile: write on every login and logout; read or cached lookup on protected requests.
- Contention: high-login users may produce frequent writes under the same user scope.

### Phase 4 Checklist

- Add a session reference claim to new JWTs.
- Create session record on successful login, signup, demo login, invite acceptance, and 2FA verification.
- Update logout to mark the current session revoked.
- Add `requireAuth` session-status validation.
- Add admin-only session review route.
- Add append-safe audit event for each revocation status transition.
- Add projection tests preventing tenant-facing exposure.

### Audit And Incident Response

Revocation records must include audit references, actor role, reason, incident reference, metadata-only flags, and source action. Device identity must be hashed. Session listing must be admin-only and tenant-invisible.

### Multi-Device Behavior

One session can be revoked without invalidating other sessions. Account-wide revocation requires marking all active sessions for that user.

## Option B: JWT Deny-List Model

### Current State vs Future Design

Current state: JWTs have no token identifier claim and no server-side denial lookup. Verification accepts a valid signature and unexpired claim set.

Future design: JWTs include a token identifier or issued-at value. A server-side denial record rejects tokens by hashed identifier, user cutoff time, or incident window.

### Design

- Collection: proposed `authTokenDenials`.
- Keying: hash of token identifier or scoped issued-at cutoff.
- Scope: user ID plus optional landlord or tenant context.
- Decision: deny, review_cleared, expired.
- Reversibility: denial record can be set to review_cleared without deleting history.

### Pros

- Backward-compatible with stateless login if lookup is cached.
- Works for bulk incidents using issued-at cutoffs.
- Does not require storing every active login.
- Can revoke one token identifier without full user disablement.

### Cons

- Requires token identifier standardization.
- Requires post-verification lookup and caching for performance.
- Bulk issued-at cutoffs can revoke more sessions than intended.
- Denial records must outlive token expiration.

### Firestore Implications

- Proposed collection: `authTokenDenials`.
- Query patterns: by token identifier hash, by user and cutoff, by status and expiresAt.
- Index impact: tokenHash/status and userId/status/expiresAt are likely needed.
- Cost profile: write on denial, read or cached lookup during token verification.
- Retention: denial records must live at least as long as the maximum token lifetime plus clock-skew tolerance.

### Token-Lifetime vs Denial-Record Lifetime

If tokens last seven days, denial records should remain for at least seven days plus a safety buffer. Removing a denial record before token expiration could allow a previously denied token to succeed again if it is still otherwise valid.

### Phase 4 Checklist

- Add `jti` or equivalent token identifier to JWT claims.
- Define token identifier hashing.
- Add denial record writer with append-safe audit linkage.
- Add denial lookup after JWT verification.
- Add cache invalidation plan and fail-closed fallback.
- Add retention policy and expiration job design.
- Add tests proving bearer values never enter denial records.

### Audit And Incident Response

Denial records must reference incident metadata and audit events without embedding token contents. Admin/support review can display safe hashes and status only.

### Multi-Device Behavior

Per-token denial affects one token. User cutoff denial affects all tokens issued before a timestamp. Bulk incident denial can affect many users if scoped that way.

## Option C: Token-Version Model

### Current State vs Future Design

Current state: JWT claims include version `1` for claim schema, but there is no per-user token version checked against a user record.

Future design: user records store an auth token version. JWTs include that version. `requireAuth` rejects tokens whose version is lower than the current user value.

### Design

- Storage: proposed `authTokenVersion` field on user or account records.
- Scope: per user, with optional landlord or tenant context if needed.
- Revocation action: increment the version to invalidate older tokens.
- Reversibility: store prior version and review state in an append-safe audit record; un-revocation means issuing a fresh token after review, not trusting old bearer values.

### Pros

- Simple all-device invalidation.
- No new collection required if user/account records are used.
- Low write volume compared with session records.
- Useful for password-reset, account compromise, and severe incident containment.

### Cons

- All-or-nothing for that user.
- Cannot revoke one device without affecting others.
- Adds a user-record read or cache dependency to protected route verification.
- Multi-app users must re-authenticate everywhere after a version bump.

### Firestore Implications

- Proposed field: `authTokenVersion`.
- Query patterns: direct user/account lookup during auth hydration.
- Index impact: likely no new index for direct document reads, but admin review surfaces may need status indexes if added later.
- Cost profile: write on version bump; read or cached lookup during verification.
- Contention: repeated incident response against one user updates the same user record and must be audit-linked.

### Phase 4 Checklist

- Add `authTokenVersion` to user/account records.
- Add token-version claim to new JWTs.
- Update `requireAuth` hydration to compare token version with current record.
- Add explicit failure reason for internal audit, not tenant-facing detail.
- Add password-reset and incident-response version bump procedures.
- Add admin-only review of version bump history.

### Audit And Incident Response

Each version bump must include actor, reason, incident reference, scope, timestamp, and append-safe audit linkage. Client responses should not expose version numbers.

### Multi-Device Behavior

Version bump invalidates all existing tokens for that user. It is suitable for account compromise, not for ordinary one-device logout.

## Trade-Off Comparison

| Dimension | Session-Record Model | JWT Deny-List Model | Token-Version Model |
| --- | --- | --- | --- |
| Storage | One record per active session | One record per denial or cutoff | One field per user/account |
| Login latency | Higher: session write | Low unless identifier work added | Low |
| Protected-route latency | Session lookup or cache | Denial lookup or cache | User version lookup or cache |
| Granularity | Per session or device | Per token, user cutoff, or incident window | Per user |
| Concurrent sessions | Independently controllable | Depends on token or cutoff scope | All revoked together |
| Audit burden | High: each session transition | Medium: each denial record | Medium: each version bump |
| Firestore costs | Login/logout writes plus lookups | Denial writes plus lookups | Version writes plus lookups |
| Device handling | Strongest | Limited unless token maps to device | Weak |
| Bulk incident handling | Many session writes | Strong with cutoff records | Many user updates |
| Reversibility | Status can be review_cleared | Status can be review_cleared | Fresh token after audited review |

## Recommended Phase 4 Evaluation

Use this order for future implementation review:

1. Decide whether ordinary logout needs server-side revocation.
2. Decide whether admin incident response needs per-device or account-wide control.
3. Decide whether protected-route latency can tolerate Firestore lookup or requires a cache.
4. Decide whether revocation records must support trusted-device review.
5. Add projection tests before exposing any admin review surface.

## Cross-References

- `docs/security/auth-session-revocation-glossary-v1.md`
- `docs/security/auth-incident-response-runbook-v1.md`
- `docs/security/session-revocation-incident-scenarios-v1.md`
- `docs/security/logout-session-revocation-contract-v1.md`
