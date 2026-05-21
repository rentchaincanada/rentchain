# Production Debug Surface Hardening v1

## Executive summary

This audit reviewed RentChain production-exposed diagnostic, probe, echo, route-inspection, build, health, and status surfaces. The mission preserves deployment health observability while reducing public exposure of route structure, exact build identifiers, echo payloads, and low-value debug metadata.

The implementation keeps public health/status checks minimal and introduces production gating for unsafe diagnostic surfaces using the existing internal job token pattern. Public build/revision probes now expose presence metadata instead of exact Cloud Run revision or commit identifiers.

## Diagnostic surface inventory

| Surface | Current purpose | Exposure classification | v1 posture |
| --- | --- | --- | --- |
| `/health` | Cloud Run/status health | public-safe health | Public, unchanged |
| `/health/ready` | readiness check | public-safe health | Public, unchanged |
| `/health/db` | DB readiness when configured | public-safe health | Public, unchanged |
| `/health/version` | service version check | production-safe diagnostic | Public, unchanged |
| `/api/status/public` | status app/public status payload | production-safe diagnostic | Public, unchanged |
| `/api/__probe/version` | deployment probe | production-safe diagnostic | Public, redacted build presence metadata |
| `/api/__probe/revision` | deployment revision probe | production-safe diagnostic | Public, redacted revision/commit presence metadata |
| `/api/_build` | build stamp | production-safe diagnostic | Public, redacted revision/commit presence metadata |
| `/api/__routes` | route mount summary | admin/internal diagnostic | Production gated |
| `/api/__probe/routes` | Express route/mount dump | admin/internal diagnostic | Production gated |
| `/api/__probe/routes-lite` | public route-lite probe | admin/internal diagnostic | Production gated |
| `/api/__probe/tenants-mount` | route mount probe | admin/internal diagnostic | Production gated |
| `/api/__probe/onboarding-route` | route mount probe | admin/internal diagnostic | Production gated |
| `/api/_echo` | POST reachability echo | admin/internal diagnostic | Production gated and duplicate mount removed |
| `/api/__debug/build` | Vercel/build route-check details | admin/internal diagnostic | Production gated and redacted |
| `/api/__debug/ping-application-links` | low-value debug ping | admin/internal diagnostic | Production gated |

## Production gating rules

- Public health/status endpoints remain available because Cloud Run, Terraform, Vercel previews, and the status app depend on low-friction health verification.
- Unsafe diagnostic endpoints are available in non-production for local/preview debugging and require `INTERNAL_JOB_TOKEN` via `x-internal-job-token` or `x-internal-token` in production.
- Gated production diagnostics return a minimal 404 response instead of exposing whether the debug surface exists.
- Public build/revision probes return only safe presence booleans, not exact revision IDs, commit SHAs, timestamps, env values, request bodies, tokens, stack traces, or route internals.

## Health/status exception rationale

`/health`, `/health/ready`, and `/health/db` are deliberately preserved as public minimal endpoints. They expose service availability and DB readiness only, and are required for deployment and status checks. This mission does not alter their route behavior.

`/api/status/public` remains public because it is the status-app integration surface. It remains under the diagnostics rate-limit profile.

## Preview/dev expectations

Local and non-production environments continue to support diagnostic access for deployment troubleshooting. Production applies the internal-token gate to unsafe surfaces so diagnostics remain available to controlled internal checks without exposing internals to public traffic.

## Tests added/updated

- `diagnosticSurfaceGuard.test.ts` verifies production gating, internal-token access, and redacted build metadata.
- `apiRouteOwnershipRegression.test.ts` now asserts:
  - unsafe diagnostic surfaces are explicitly gated,
  - `_echo` is mounted once,
  - public revision probes are redacted,
  - debug/echo payloads are not exposed without the internal diagnostic token,
  - API catchall behavior remains deterministic.

## Known limitations

- The internal-token gate is a conservative first-pass control. It is not a complete admin diagnostics product or a full incident-response workflow.
- Public health endpoints remain intentionally reachable. Future hardening can add environment-specific allowlists only if deployment/status checks are updated together.
- Some route-source headers remain useful for protected route ownership regression and operational debugging. They should continue to avoid secrets, env values, stack traces, and raw payloads.

## Future hardening roadmap

1. Inventory any remaining route-specific probe endpoints as new route families are added.
2. Add deployment-level policy checks for diagnostic routes after Cloud Run/Terraform/status dependencies are fully mapped.
3. Consider a dedicated internal diagnostics router with admin/support authority once privileged-access governance matures.
4. Add monitoring around 404/429 volume for gated diagnostic routes without logging tokens or request bodies.

## Explicit confirmations

- No auth behavior changed.
- No Firestore rules changed.
- No permissions were widened.
- No product workflow behavior expanded.
- `/health`, `/health/ready`, `/health/db`, and status app checks are preserved.
