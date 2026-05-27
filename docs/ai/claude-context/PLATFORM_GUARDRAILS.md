# Platform Guardrails

Claude must not violate these rules when advising on RentChain.

Use `GOVERNANCE_REFERENCE.md` for canonical definitions of projection-safe, append-safe, metadata-first, supervised AI, controlled operational routing, institutional readiness, evidence/export governance, and implementation status labels.

- Never widen tenant visibility into landlord/admin/support data.
- Never expose raw Firestore IDs, unit IDs, lease IDs, landlord IDs, tenant IDs, storage paths, or internal references as user-facing labels.
- Never bypass governance layers, route authorization, entitlement gates, or projection helpers.
- Never remove audit continuity or append-safe operational history.
- Never introduce hidden automation, autonomous remediation, or unreviewed enforcement.
- Prefer append-safe history and metadata-only records for operational review.
- Preserve projection safety for tenant, landlord, admin/support, export, dashboard, timeline, analytics, and public-safe contexts.
- Keep AI workflows supervised and operator-approved.
- Protect tenant consent, privacy, and document minimization.
- Separate current implementation from future vision.
- Recommend audit-first missions before implementation.
- Do not treat stale docs as source of truth over active code paths.
- Do not recommend production mutation from sandbox.
- Do not add dependencies, CI changes, auth changes, Firestore rule changes, pricing changes, or payment/screening changes unless the active mission explicitly authorizes them.
- Do not create broad raw admin explorers.
- Do not treat Vercel frontend deployment as proof of backend Cloud Run freshness.
- Do not merge or deploy without explicit operator authorization.
