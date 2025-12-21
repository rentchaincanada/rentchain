# RC-01 — Build-Safe Route Boundary

**Checkpoint ID:** RC-01  
**Status:** LOCKED ✅  
**Owner:** CTO (Orion)  
**Scope:** rentchain-api routing + production build safety

## Purpose
Establish a hard boundary between **production-safe routes** and **dev/legacy routes** so CI/builds and production deploys are never blocked by legacy code.

## Contract
### Build-Safe Routes
Only routes mounted via `mountSafeRoutes()` are allowed in production builds and production runtime.

**Canonical file:** `src/app.routes.ts`  
**Entrypoint:** `src/app.build.ts` mounts ONLY safe routes.

### Dev/Legacy Routes
Dev-only and legacy routes must be mounted exclusively via `mountDevRoutes()` and only when `NODE_ENV !== "production"`.

**Canonical file:** `src/app.routes.dev.ts`  
**Runtime:** `src/app.ts` mounts safe always; dev routes only in non-production.

## Rules (Non-Negotiable)
1. Any new production route must be added to `mountSafeRoutes()`.
2. Safe routes MUST NOT import dev/legacy services directly.
3. Legacy services MAY exist, but MUST NOT break `npm run build`.
4. Production runtime MUST NOT mount dev routes.

## Acceptance Criteria
- `npm run build` completes successfully.
- Safe routes compile without importing legacy-only modules.
- `app.build.ts` mounts safe routes only.
- `app.ts` mounts dev routes only when `NODE_ENV !== "production"`.

## Out of Scope (Quarantined)
The following legacy services are quarantined and must not block builds:
- `authService`
- `screeningRequestService`
- `totpService`

## Change Control
Any violation of RC-01 requires either:
- a new checkpoint (RC-02+) explicitly redefining the boundary, or
- a rollback to restore RC-01 compliance.
