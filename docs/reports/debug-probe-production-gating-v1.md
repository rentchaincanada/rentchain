# Debug Probe Production Gating v1

## Executive summary

This mission finalizes RentChain's production debug/probe posture after the earlier production debug-surface hardening pass. The goal is to keep deployment health checks and status observability available while preventing public production traffic from receiving route internals, exact build/revision identifiers, echo payloads, env hints, tokens, secrets, stack traces, or raw debug metadata.

The implementation remains conservative:

- public health and status checks stay reachable;
- unsafe debug/probe/echo/routes surfaces remain gated by the existing internal diagnostic token pattern;
- the leftover billing probe is now production-gated;
- public health-adjacent responses no longer expose exact revision or commit identifiers;
- public health-adjacent responses avoid server-only env names and exact environment hints;
- internal echo diagnostics no longer return raw request bodies;
- no auth behavior, Firestore rules, schemas, route visibility, product workflows, or permissions were changed.

## Diagnostic surface inventory

| Surface | Classification | Final posture |
| --- | --- | --- |
| `/health` | public-safe health | Public, minimal service/readiness metadata; exact release/revision/commit values redacted to presence booleans. |
| `/health/ready` | public-safe readiness | Public, minimal route/db readiness checks preserved. |
| `/health/db` | public-safe db health | Public, minimal ok/skipped/fail result preserved for deployment verification. |
| `/health/version` | production-safe health diagnostic | Public; environment hint removed. |
| `/api/status/public` | production-safe status | Public status-app integration preserved without route-source/debug headers. |
| `/api/health` | production-safe app health | Public capability booleans only; server-only env/provider details are not returned. |
| `/api/health/stripe` | production-safe app health | Public Stripe/pricing readiness retained; exact Cloud Run revision and server-only Stripe env names are redacted. |
| `/api/health/pricing` | production-safe app health | Public pricing configuration health retained as counts/booleans rather than specific env names. |
| `/api/health/screening-provider` | production-safe provider readiness | Public provider readiness retained; exact commit/revision redacted to safe build presence metadata. |
| `/api/__probe/version` | production-safe deployment probe | Public, redacted build presence metadata. |
| `/api/__probe/revision` | production-safe deployment probe | Public, redacted revision/commit presence metadata. |
| `/api/_build` | production-safe deployment probe | Public, redacted revision/commit presence metadata. |
| `/api/_probe/billing` | internal diagnostic | Production-gated by `INTERNAL_JOB_TOKEN`. |
| `/api/__routes` | internal diagnostic | Production-gated by `INTERNAL_JOB_TOKEN`. |
| `/api/__probe/routes` | internal diagnostic | Production-gated by `INTERNAL_JOB_TOKEN`. |
| `/api/__probe/routes-lite` | internal diagnostic | Production-gated by `INTERNAL_JOB_TOKEN`. |
| `/api/__probe/tenants-mount` | internal diagnostic | Production-gated by `INTERNAL_JOB_TOKEN`. |
| `/api/__probe/onboarding-route` | internal diagnostic | Production-gated by `INTERNAL_JOB_TOKEN`. |
| `/api/_echo` | internal diagnostic | Production-gated by `INTERNAL_JOB_TOKEN`; allowed and denied responses do not echo request payloads. |
| `/api/__debug/build` | internal diagnostic | Production-gated by `INTERNAL_JOB_TOKEN`; allowed response uses redacted build metadata and does not return Vercel env values. |
| `/api/__debug/ping-application-links` | internal diagnostic | Production-gated by `INTERNAL_JOB_TOKEN`. |

## Production gating rules

Unsafe diagnostics use `requireDiagnosticAccess(...)`. In production, access requires the configured internal token in `x-internal-job-token` or `x-internal-token`. Without that token, diagnostics fail closed with the same minimal 404 shape used by the API catchall.

Allowed diagnostic responses must not include:

- env values or secret names as data;
- raw request bodies;
- tokens, cookies, API keys, or webhook secrets;
- stack traces;
- raw route tables or route internals;
- exact Cloud Run revision IDs;
- exact commit SHAs.
- exact deployment environment labels from platform env vars.

## Health and status rationale

`/health`, `/health/ready`, `/health/db`, and `/api/status/public` remain public because Cloud Run, Terraform, Vercel preview checks, smoke tests, and the status app rely on low-friction availability checks. These surfaces now remain minimal and avoid exact build identifiers.

Provider and pricing health endpoints remain public because they support operational verification and existing QA workflows. They report readiness and configuration booleans, not secret values, raw provider payloads, or tenant data.

## Preview and development expectations

Non-production environments keep diagnostic access usable for deployment troubleshooting. Production applies the internal-token gate to unsafe diagnostics. Public deployment probes remain intentionally low detail so QA can confirm the service is alive without exposing exact revision data.

## Tests added or updated

- `healthRoutes.test.ts` verifies `/health`, `/health/version`, `/health/ready`, and `/health/db` remain reachable and do not expose exact release, revision, commit, or environment values.
- `apiRouteOwnershipRegression.test.ts` verifies the billing probe is gated, public route probes use redacted build metadata, exact `apiRevision` fields are not reintroduced in `publicRoutes.ts`, public health-adjacent responses avoid raw env/config fields, `_echo` does not return raw request bodies, and existing debug/echo route ownership remains deterministic.

## Known limitations

- Internal diagnostic access still depends on the existing shared `INTERNAL_JOB_TOKEN` pattern. This is appropriate for this phase but is not a full admin diagnostics product.
- Public health endpoints intentionally remain reachable. Any future IP allowlisting or deployment-gateway restriction must be coordinated with Cloud Run, Terraform, Vercel, and the status app.
- Route-source headers remain useful for ownership debugging. They should continue to identify route owners without exposing secrets, raw payloads, or stack traces.

## Future hardening roadmap

1. Replace broad `/api` route mounting with narrower route prefixes where practical.
2. Add a generated route registry that can replace manual route-inspection probes.
3. Move internal diagnostics toward privileged admin/support governance once that tooling exists.
4. Add deployment-level policy checks for diagnostic surfaces after health/status dependencies are fully mapped.
5. Continue regression-testing newly introduced probes before production exposure.

## Explicit confirmations

- No permissions were widened.
- No auth behavior changed.
- No Firestore rules or schemas changed.
- No product workflow behavior expanded.
- No autonomous behavior was introduced.
- Deployment health and status checks remain preserved.
