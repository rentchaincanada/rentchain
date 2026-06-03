# Auth Session Revocation Glossary v1

## Scope

This glossary defines session revocation and auth incident-response terms for Phase 3 design work. It is documentation only. It does not add runtime session revocation, auth endpoints, Firestore collections, Firestore indexes, dependencies, deployment changes, or production data changes.

## Current State vs Future Design

Current state: RentChain uses stateless JWTs for backend auth. Logout clears client-side token storage and receives backend acknowledgement. Outstanding JWTs remain valid until expiration unless a protected route rejects them for another reason.

Future design: Phase 4 may add server-side revocation through a session-record model, JWT denial records, token-version checks, or a combination approved by a later mission. These terms describe how to discuss that future work without implying that it already exists.

## Canonical Terms

- **Token**: A bearer credential string presented to an API so the backend can verify identity and scope.
- **JWT**: A signed token format containing claims such as subject, role, scope, and expiration.
- **Bearer token**: A token sent in an Authorization header. Possession is treated as authority until verification fails.
- **Token expiration**: The time after which a JWT fails verification automatically.
- **Token revocation**: A server-side decision that rejects an otherwise unexpired token.
- **Session**: A logical authenticated use period. Current runtime does not store first-class session records for each login.
- **Session record**: A proposed backend record that would represent one login or device-scoped use period.
- **Session state**: A proposed state such as active, revoked, expired, or review_pending.
- **Logout**: Client-side token clearing plus backend acknowledgement in the current implementation.
- **Revocation**: A backend rejection decision for a token, session, or version that would otherwise be accepted.
- **Disablement**: Manual account or factor disablement, distinct from per-token or per-session revocation.
- **Device compromise**: A suspected loss of control over a browser, device, or stored trusted-device value.
- **Token identifier**: A proposed stable claim used to identify a token without storing the token content.
- **Token fingerprint**: A short non-sensitive derived label used only for operator correlation.
- **Token hash**: A one-way hash of a token identifier or token material used for lookup without storing the source value.
- **Session identity**: A proposed identifier for one stored session record.
- **Device identity**: A proposed stable device reference that remains separate from user-facing labels.
- **Device fingerprint**: A hashed device reference derived from approved metadata, never browser-header text in clear form.
- **Incident response**: Manual security triage, containment, remediation, and closure.
- **Mitigation**: A temporary action that reduces risk but may not fully remediate the cause.
- **Containment**: An action that limits additional harm while review continues.
- **Remediation**: A completed fix or operator-approved response.
- **Audit linkage**: A reference connecting a security action to append-safe audit evidence.
- **Audit immutability**: The requirement that security-sensitive records cannot be overwritten after creation.
- **Append-safe**: A write posture where new records are appended or created, not mutated destructively.

## Important Distinctions

Logout is not revocation in the current implementation. Logout removes the client copy of a token and notifies the backend; it does not add a server-side rejection record.

Session is not the same thing as JWT. A JWT exists today. A stored session record is only a future design option.

Disablement is broader than revocation. User disablement or permission removal may block future access, but it is not the same as denying one token or one device session.

Token expiration is automatic. Revocation is a server-side decision added before the natural expiration time.

Frontend session storage is local browser state. Backend session state would require server-side storage or version checks and is not present today.

## Incident Taxonomy Reference

The incident foundation document defines `auth_session`, `credential_secret`, and `admin_support_access` categories that this mission uses for auth-specific runbooks and scenarios (`docs/reports/security-audit-and-incident-response-foundations-v1.md`).

## Non-Goals

- No tenant-visible incident disclosure model is defined here.
- No tenant-visible session management surface is defined here.
- No runtime revocation implementation is implied by these definitions.
- No account-lock, password-reset, credential-rotation, or trusted-device code changes are included.

## Cross-References

- `docs/security/session-revocation-design-options-v1.md`
- `docs/security/auth-incident-response-runbook-v1.md`
- `docs/security/session-revocation-incident-scenarios-v1.md`
- `docs/security/logout-session-revocation-contract-v1.md`
