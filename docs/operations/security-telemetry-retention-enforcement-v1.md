# Security Telemetry Retention Enforcement V1

## Purpose

This document defines the first operational retention boundary for RentChain security/session telemetry and support-safe access forensics.

The retention layer exists to preserve security accountability while preventing internal telemetry from becoming an uncontrolled archive. It applies to `security_session_internal` telemetry used for recipient review sessions, institution review invites, tenant-mediated delivery, support diagnostics, operator timelines, and access forensics.

## Audit Summary

Current telemetry is persisted as metadata-only security events on tenant institution access grant event records. Those records include redacted grant, recipient, session, user, request, and lifecycle references. Raw IP addresses, full user agents, trust payloads, provider payloads, raw identity data, raw property data, precise geolocation, fingerprinting data, behavioral profiles, and risk scores are not stored.

Before this mission, telemetry had an internal-only classification but no deterministic lifecycle decision. Support-safe diagnostics and forensics could summarize all available telemetry as active operational signal, and the support console still displayed retention enforcement as a future follow-up.

## Retention Model

`security_session_internal` telemetry is evaluated by policy version `security_telemetry_retention.v1`.

The lifecycle states are:

- `active`: telemetry can contribute to active support-safe security summaries and forensics.
- `archived`: telemetry can remain visible as archived support-safe continuity, but it no longer contributes to active operational signals.
- `retention_expired`: telemetry is no longer included in support-safe summaries or forensic chains and is eligible for purge handling.
- `purge_pending`: telemetry is past retention plus grace period and should be handled by future destructive cleanup.
- `purged`: telemetry must not appear in support-safe summaries or forensic chains.

Initial policy windows:

- Active retention: 180 days
- Archive after: 180 days
- Retention expiry: 365 days
- Purge-pending grace: 30 days after retention expiry

This mission does not run destructive cleanup jobs or mutate historical records. It introduces deterministic retention evaluation and TTL-compatible lifecycle metadata so future cleanup can be implemented safely.

## Purge And Archive Semantics

Archived telemetry is not treated as active. It can support operational continuity without increasing active incident counts, active request-origin counts, or current support signals.

Retention-expired, purge-pending, and purged telemetry must not influence active support metrics, incident summaries, request-origin summaries, or forensic chains.

Future destructive enforcement should be implemented under `feat/security-telemetry-retention-enforcement-v2` or a narrowly scoped cleanup mission only after legal/compliance review confirms exact retention windows and deletion obligations.

## Support/Admin Visibility

Support/admin operators may see support-safe retention counts:

- active count
- archived count
- retention-expired count
- purge-pending count
- purged count

Operators must not see raw IP values, full user agents, raw identity/property/provider payloads, trust payloads, or exportable telemetry artifacts.

Telemetry retention state is internal operational metadata. It must not appear in tenant views, recipient review payloads, institution review payloads, trust exports, portable attestations, public pages, or downloadable artifacts.

## Audit And Forensic Continuity

Forensics remain support-safe and metadata-only.

Active telemetry can contribute to active forensic incidents. Archived telemetry can remain part of continuity where still retained, but it is marked by retention state and does not become an active incident signal. Retention-expired, purge-pending, and purged telemetry is excluded from reconstructed chains.

Operator audit timelines remain metadata-only. Retention enforcement must not erase operator accountability; future destructive cleanup should retain immutable audit records needed for compliance while avoiding raw telemetry persistence.

## Prohibited Uses

Telemetry retention must not be used for:

- tenant scoring
- recipient scoring
- behavioral profiling
- risk scoring
- automated fraud decisions
- automated institutional decisions
- institution-visible analytics
- public security dashboards
- portable trust artifacts

## Remaining Risks

- No destructive purge job is implemented in this mission.
- Final retention windows require legal/compliance confirmation before production cleanup automation.
- Existing grant event storage remains the persistence location; future cleanup will need careful handling to preserve immutable audit integrity while removing expired telemetry details.
