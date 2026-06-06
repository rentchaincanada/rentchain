# Screening Provider Integration Readiness Audit

Branch: prep/screening-provider-integration-readiness-v1
Date: 2026-06-05

## Scope Classification

- Mission type: backend workflow foundation with frontend entry screens, tests, and documentation.
- Runtime scope: new provider-neutral screening workflow surfaces only.
- Protected areas: `rentchain-api/firestore.rules` is explicitly in scope for screening collection rules; auth core, billing, pricing, entitlement logic, deployment, and infrastructure remain out of scope.

## Existing Backend Patterns

1. Route mounting
   - `rentchain-api/src/app.build.ts` mounts public webhooks before JSON parsing for Stripe and TransUnion.
   - Auth decode is mounted globally with `authenticateJwt`, then feature routers are mounted under `/api`, `/api/landlord`, and `/api/admin`.
   - Existing screening routes are mounted at `/api` through `screeningRoutes.ts`.

2. Auth and role boundaries
   - `requireAuth` enforces Bearer token presence and hydrates `req.user`.
   - `requireLandlord` permits landlord/admin roles and resolves `user.landlordId`.
   - `requireAdmin` permits admin role or allowlisted admin identity.
   - Tenant-specific middleware exists elsewhere, but tenant routes commonly rely on `requireAuth` and server-side tenant ownership checks.

3. Existing screening implementation
   - `screeningRoutes.ts` is legacy/application-oriented and uses `@ts-nocheck`.
   - Existing provider files include mock, single-key, TransUnion, manual, and bureau adapter concepts.
   - Existing provider defaults can fall back to mock. This mission should not change those existing purchase/report paths.
   - Existing frontend has screening components for workflow messaging, history, report viewing, and invite flows.

4. Firestore and data access
   - Existing services use `db.collection(...).doc(...).get/set/update/create` patterns.
   - Current `rentchain-api/firestore.rules` is deny-all. Screening collection rules must be explicit and narrow.
   - Unit ownership data is stored in `units` with `landlordId`, but not all tests need a real unit record if service-level ownership checks are injectable.

5. Frontend patterns
   - API helpers use `apiFetch`, which prefixes `/api` automatically and attaches the active token.
   - Tenant routes are gated by `TENANT_PORTAL_ENABLED`; landlord routes use `RequireAuth`/`RequireRole` and `LandlordNav`.
   - Existing screening UI uses tokenized inline styles and compact workflow cards.

## Risks and Design Decisions

1. The mission is broad enough to create a parallel screening system if not scoped carefully. The implementation should use explicit provider-neutral v1 workflow files and avoid modifying legacy screening checkout/report behavior.
2. Provider webhook routes must remain unauthenticated, but signature verification must fail closed for unknown or unconfigured providers.
3. Tenant consent must be explicit and revocable. Landlord request creation must require active consent.
4. Tenant-facing projections must never expose screening results, decisions, raw payloads, reports, landlord private notes, or provider payloads.
5. Manual report handling should avoid real storage side effects in Phase A; the service can create metadata-only report references and document future storage wiring.
6. Full manual QA requires seeded landlord, tenant, admin accounts, webhook simulator access, and storage configuration.

## Implementation Plan

1. Add provider-neutral screening workflow types and provider registry.
2. Add service-layer workflow helpers for consent, request initiation, webhook logging, result ingestion, decision recording, and manual report metadata.
3. Add a new route file for Phase A endpoints and mount it without disturbing existing screening routes.
4. Add Firestore rules for the new screening collections while keeping the default deny.
5. Add frontend API helpers and lightweight tenant/landlord screens for consent, request initiation/status, decision, and manual report metadata upload.
6. Add focused backend and frontend tests for the provider registry, workflow services, route auth/projection boundaries, and status component.
7. Add provider contract and operations documentation.

## Manual QA Requirement

Manual QA is required because this mission adds backend routes, frontend screens, and user-visible screening workflow behavior. It requires seeded local or staging accounts and should follow the checklist in `.handoff/mission-current.md`.
