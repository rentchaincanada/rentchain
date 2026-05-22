# Telemetry and Screening Route Governance v1

## Executive Summary

This report documents the route-governance stabilization for the frontend telemetry endpoint and landlord screening-history endpoints.

The mission keeps the implementation narrow:

- `/api/telemetry` remains an authenticated, non-blocking product telemetry write surface.
- `/api/screenings/history` remains landlord/admin scoped and projection-safe.
- Screening-history routes are now mounted explicitly in the production app build path.
- Telemetry and screening-history ownership is pinned immediately after auth decode and ahead of broad `/api` routers such as risk-agent and screening job/admin fallback routes.
- No auth behavior, Firestore rules, schemas, screening workflow semantics, or telemetry architecture were changed.

## Route Inventory

| Route | Owner | Intended Visibility | Behavior |
| --- | --- | --- | --- |
| `POST /api/telemetry` | `telemetryRoutes.ts` | Authenticated app users only | Accepts allowlisted `nudge_*` and `pdf_*` event names; stores sanitized metadata in `telemetry_events`. |
| `GET /api/screenings/history` | `screeningRoutes.ts` | Landlord/admin only | Returns scoped screening history summaries for an application or tenant. |
| `GET /api/screenings/history/:id` | `screeningRoutes.ts` | Landlord/admin only | Returns a scoped screening detail projection. |
| `GET /api/screenings/history/:id/report` | `screeningRoutes.ts` | Landlord/admin only | Streams a stored report only when `screeningAccessService` authorizes access. |
| `POST /api/admin/screening-jobs/run` | `screeningJobsAdminRoutes.ts` | Internal/admin only | Processes screening jobs through internal-token/admin controls. |
| `POST /api/admin/screening-jobs/enqueue/:orderId` | `screeningJobsAdminRoutes.ts` | Internal/admin only | Enqueues a screening job for an existing order. |

## Route Ownership Findings

Preview QA showed unexplained `404` responses for:

- `POST /api/telemetry`
- `GET /api/screenings/history?...`

Audit findings:

- `telemetryRoutes.ts` existed and was mounted, but it was mounted after broad `/api` routers. That made route ownership harder to reason about when debugging preview responses.
- `screeningRoutes.ts` contained the authoritative `/screenings/history` handlers, but it was not mounted in `app.build.ts`.
- `riskAgentRoutes.ts` and `screeningJobsAdminRoutes.ts` are broad-mounted at `/api`, so sensitive route families must be mounted before them or otherwise pinned with explicit ownership tests.

## Intended Visibility Model

Telemetry:

- Authenticated only.
- Non-blocking from the frontend caller.
- Event-name allowlisted to `nudge_*` and `pdf_*`.
- Payloads pass through the shared governance sanitization path.
- No public telemetry read surface is introduced.

Screening history:

- Landlord/admin only.
- Requires `applicationId` or `tenantId` for list access.
- Uses service-layer landlord scoping before returning records.
- Returns screening summaries and report availability metadata, not raw provider payloads.
- Full report streaming remains gated by `resolveScreeningReportAccess`.

## Projection Safety

These routes must not expose:

- raw provider payloads
- raw screening reports outside authorized report streaming
- tokens, secrets, stack traces, or debug payloads
- unrelated landlord or tenant records
- unrestricted message bodies

This mission does not add new telemetry event categories or raw diagnostic persistence.

## Environment Expectations

The same app-owned route behavior should apply in local, preview, and production:

- `/api/telemetry` should be owned by `telemetryRoutes.ts`.
- `/api/screenings/history` should be owned by `screeningRoutes.ts`.
- Neither route should fall through to broad `/api` routers such as `riskAgentRoutes.ts` or `screeningJobsAdminRoutes.ts`.
- Missing auth should produce an owner-specific authorization failure rather than an unrelated 404.

## Tests Added

Route ownership regression coverage now confirms:

- telemetry and screening-history mounts appear before broad `/api` routers including `riskAgentRoutes.ts` and `screeningJobsAdminRoutes.ts`
- `POST /api/telemetry` is owned by `telemetryRoutes.ts`
- `GET /api/screenings/history` is owned by `screeningRoutes.ts`
- neither route falls through to unrelated broad routers
- unknown API paths still reach the explicit API catchall

## Known Limitations

- This does not build a full telemetry platform.
- This does not add telemetry dashboards.
- This does not add external observability vendors.
- This does not change screening-history projection semantics beyond making the existing route reachable through the production app build.
- This does not expose raw screening provider payloads.

## Future Roadmap

Recommended future missions:

1. Add a support/admin observability view for sanitized telemetry counters.
2. Add explicit telemetry retention summaries for high-volume events.
3. Add screening-history UI empty/error states that distinguish no data from unavailable route ownership.
4. Continue reducing broad `/api` fallback mounts in favor of narrower route prefixes.
5. Add provider-specific report-access audit summaries without exposing raw provider payloads.
