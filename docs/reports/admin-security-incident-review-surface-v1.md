# Admin Security Incident Review Surface v1

## Philosophy

This mission adds a governed, metadata-only admin review surface for security-relevant operational signals. It is not a SIEM, raw event explorer, public endpoint, autonomous remediation engine, or unrestricted admin data browser.

The review surface is intended to help RentChain operators manually inspect security signals while preserving tenant, landlord, provider, document, export, support, and impersonation projection boundaries.

## Event Sources Audited

- `telemetry_events`: operational telemetry, including impersonation lifecycle events emitted by impersonation governance.
- `events`: legacy audit/canonical event metadata used by audit and readiness surfaces.
- `impersonationRoutes.ts`: governed impersonation start/end telemetry source.
- `adminSupportProjectionSafety`: audience-based filtering for support/admin metadata introduced before this mission.
- `adminObservabilityIncidentReadinessRoutes.ts`: existing readiness-oriented incident governance surface, not a raw incident review workspace.
- Admin audit/integrity/observability pages: existing admin UI patterns for safe summary views.

Unsupported event types are intentionally excluded rather than displayed as raw records.

## Implemented Categories

- `impersonation_started`
- `impersonation_ended`
- `impersonation_denied`
- `policy_denied`
- `projection_safety_redaction`
- `export_blocked`
- `export_prepared`
- `support_metadata_redacted`
- `route_source_anomaly`
- `auth_required_failure`
- `admin_access_denied`
- `automation_blocked`
- `webhook_failure`
- `screening_provider_callback_anomaly`

These categories are derived only from existing metadata event names and route/source metadata. The implementation does not invent production incidents when no supported metadata exists.

## Protected Routes

- `GET /api/admin/security/incidents`
- `GET /api/admin/security/incidents/:incidentId`

Both routes require authenticated admin authority through the existing `system.admin` permission convention. Route source attribution is `adminSecurityIncidentRoutes.ts`.

## Metadata Contract

Incident summaries include:

- category, severity, status
- title and safe summary
- occurred/last seen timestamps
- safe actor and target summaries
- workflow family
- policy outcome summary
- source route and route owner where already available
- redaction summary
- recommended manual review action
- safe internal evidence references

Detail responses add only safe timeline entries, related event summaries, redaction notes, and a suggested next review step.

## Redacted Fields

The review model excludes raw or sensitive fields including:

- raw actor and target ids
- impersonation session ids
- tokens, credentials, cookies, authorization headers, and secrets
- raw provider payloads and raw screening reports
- raw request/response bodies
- unrestricted event payloads
- stack traces and debug payloads
- raw tenant documents and storage paths

Admin/support metadata is projected through the existing support projection safety helper before review summaries are built.

## UI Surface

The frontend adds `/admin/security/incidents` as an admin-only route. It provides:

- summary counts
- category, severity, status, and search filters
- incident list
- safe detail panel
- explicit metadata-only and redaction messaging

No mutation controls, enforcement actions, alerting integrations, raw JSON drawers, or public links are included.

## Known Limitations

- No incident persistence or status mutation is introduced.
- No automatic alerting, account locking, token revocation, credential rotation, or remediation exists.
- The read model is built from current metadata sources only; unsupported/raw-only events are excluded.
- Incident ids are derived projection ids, not permanent workflow records.
- Severity is deterministic and conservative, not a substitute for manual security triage.

## Future Follow-Ups

- Add append-oriented incident review notes once support-session audit persistence exists.
- Add explicit admin incident status transitions with audit lineage.
- Add support-session and impersonation review linking once persistence contracts are finalized.
- Add incident runbook integration without autonomous remediation.
- Add exportable admin-only incident summaries with projection-safe governance.

