# Auth Deep Dive

## Purpose
Reference for Firebase Auth providers, user roles, onboarding, and session/access boundaries.

## Auth Stack
- Firebase Auth for identity
- backend verifies Firebase tokens
- Firestore stores role/context relationships
- role-aware middleware controls access

## Supported Auth Modes
- email/password
- invite-token onboarding → account creation/link
- password reset via Firebase action flows
- future providers only if explicitly added by mission

## User Roles
- landlord
- tenant
- contractor
- admin

## Authority Model
Do not grant tenant access by loose property membership alone.

Tenant access must resolve from one of:
- applicant linkage
- active lease/tenancy linkage
- valid invite-token linkage

## Session Rules
- backend trusts verified Firebase token only
- frontend must not invent role authority
- role/context must be resolved server-side
- protected routes must fail closed

## Invite Token Guidance
- token must be random and single-use
- store hash only
- set expiry
- bind to `rc_prop_id` and `application_id`
- write redemption audit event
- invalidate after redemption

## Projection Rules
- landlord views may access full operational records
- tenant views must use explicit whitelist projection maps
- never expose newly added backend fields by default

## Security Constraints
- no PII in logs unless mission explicitly requires and protects it
- no direct client access to privileged records
- no wildcard tenant queries
- no auth bypass via URL parameters

## Change Checklist
When changing auth:
1. define role impact
2. define onboarding impact
3. define middleware impact
4. define token/session impact
5. define test coverage
