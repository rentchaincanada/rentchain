# Session Revocation Incident Scenarios v1

## Scope

This document tests the Phase 3 session revocation design options against likely auth incidents. It is documentation only. It does not implement detection, revocation, notifications, Firestore writes, routes, dependencies, deployment changes, or production data changes.

## Current State vs Future Design

Current state: operators can review audit/support metadata and apply manual mitigations such as password reset or user disablement, but cannot atomically revoke outstanding JWTs.

Future design: a later mission may implement session-record, JWT denial, or token-version revocation. These scenarios compare how each option would behave.

## Scenario 1: Suspected Account Compromise

Description: A user reports possible credential exposure or suspicious login from an unfamiliar context.

Assumptions: audit logs are readable, admin permission is valid, and the affected account scope can be identified without exposing bearer values.

Current mitigation: password reset, manual account disablement, and support-console timeline review.

Session-record model: revoke only the suspicious session or device. Other sessions can remain active if reviewed as safe.

JWT deny-list model: deny the affected token identifier or deny all tokens issued before a reviewed timestamp.

Token-version model: bump the user's version and force re-login on every device.

Incident flow: admin review audit timeline, choose containment, record incident metadata, apply password reset or future revocation, then prepare user security communication if a later notification model exists.

## Scenario 2: Malicious Device Registration

Description: A trusted-device value is suspected to be copied from browser storage.

Assumptions: the trusted-device value is not copied into incident notes and device references are hashed.

Current mitigation: no server-side trusted-device revocation exists. Disable 2FA or local storage clearing on one browser is not sufficient for all devices.

Session-record model: trusted-device tokens can point to session records and the device session can be marked revoked.

JWT deny-list model: normal JWT denial does not handle trusted-device values unless trusted devices receive their own identifiers and denial records.

Token-version model: version bump can force re-authentication for all sessions, but may not directly revoke a separate trusted-device value unless the trusted-device check also validates version.

Incident flow: review 2FA events, identify device scope, apply current manual mitigation, then require Phase 4 trusted-device refactoring before precise device revocation.

## Scenario 3: Support Console Abuse

Description: An admin account is suspected of using support console access outside authorized review.

Assumptions: support-console audit records are metadata-only and admin audit review remains permission-gated.

Current mitigation: remove admin permission, disable account, and review adminAuditEvents and support-console timeline.

Session-record model: revoke the active privileged session while preserving review evidence.

JWT deny-list model: deny the privileged token or all privileged tokens issued before the incident timestamp.

Token-version model: bump the affected admin user's token version and force re-authentication.

Incident flow: audit admin access, contain privilege, record incident reference, preserve append-safe audit links, escalate if tenant data was involved.

## Scenario 4: Multi-Tenant Scope Concern

Description: A token is suspected of carrying or resolving to the wrong tenant scope.

Assumptions: `requireAuth` and session hydration are the authority boundary, and tenant/landlord identifiers are handled as internal references.

Current mitigation: token verification and session hydration reject scope mismatch when database-backed checks identify it; otherwise manual disablement or password reset may be used.

Session-record model: revoke only sessions matching the affected user and tenant scope. It must never revoke another tenant's session by shared landlord context alone.

JWT deny-list model: deny the affected token identifier or scoped issued-at window. Denial record scope must include the affected user and tenant reference.

Token-version model: version bump affects all tokens for that user and must not affect other tenants.

Incident flow: immediate token verification analysis, audit event creation, support escalation, and projection-safety review.

## Scenario 5: Bulk Auth Incident

Description: Widespread phishing, dependency compromise, or credential concern affects multiple users.

Assumptions: affected-user list is curated manually and credentials used by operators are not themselves compromised.

Current mitigation: manual password resets or user disablement per affected user.

Session-record model: bulk session revocation is possible but requires many session writes and careful Firestore write scheduling.

JWT deny-list model: issued-at cutoff records can deny a wide token window with fewer records if scoping is accurate.

Token-version model: one version bump per affected user invalidates all devices for those users.

Incident flow: incident discovery, triage affected users, select revocation strategy, execute with append-safe audit linkage, monitor for retry or abuse patterns.

## Current State vs Future Design Summary

Current response remains manual and limited. Future revocation options improve containment but introduce read/write cost, audit, projection, and operator-review requirements.

## Cross-References

- `docs/security/auth-session-revocation-glossary-v1.md`
- `docs/security/session-revocation-design-options-v1.md`
- `docs/security/auth-incident-response-runbook-v1.md`
- `docs/security/logout-session-revocation-contract-v1.md`
