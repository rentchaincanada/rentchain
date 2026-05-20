# Evidence Pack Projection Profile v1

## Executive Summary

This report documents the first explicit evidence pack projection profile used by RentChain evidence bundle derivation.

The implementation is intentionally narrow. It does not change route access, Firestore schema, Firestore rules, authentication, institutional export behavior, or evidence pack collection storage. It adds metadata to derived evidence packs so downstream review, export, and governance systems can understand the projection boundary that produced the package.

## Profile Contract

The V1 profile is `landlord_evidence_review` with version `evidence_projection_profile_v1`.

Profile metadata declares:

- audience: landlord operational review
- scope type: the requested evidence pack scope
- allowed source collections represented by included evidence items
- sensitivity class: sensitive or restricted
- allowed field groups
- excluded field groups
- redaction policy
- internal reference policy
- source lineage policy

## V1 Guarantees

The profile guarantees that derived evidence packs are:

- scoped to the requested evidence context
- manual-review only
- not externally shared
- not certification artifacts
- accompanied by redaction category metadata
- accompanied by source collection/source ID lineage where practical
- explicit about internal ID handling

Internal IDs may appear as source references where needed for traceability. They are not intended to be primary display labels.

## Allowed Field Groups

V1 evidence packs allow:

- operational labels
- status summaries
- timestamps
- scoped source references
- redaction categories
- manual review metadata

## Excluded Field Groups

V1 evidence packs exclude:

- raw provider payloads
- raw CSV values
- payment account details
- private message bodies
- identity documents
- debug payloads
- unrelated resource records

## Source Lineage

Evidence item lineage is derived from included evidence items. Each source reference includes:

- source collection
- source ID
- evidence item type
- evidence item label

This provides deterministic lineage for review and future export governance without broadening evidence access.

## Redaction Summary

Evidence packs include a redaction summary with:

- redaction policy
- redacted field groups
- redaction count

The summary is metadata-only. It does not mutate canonical source records or append-only audit history.

## Relationship To Governance Docs

This profile implements the direction established by:

- `firestore-sensitivity-and-projection-registry-v1`
- `canonical-event-taxonomy-v1`
- `firestore-collection-ownership-registry-v1`

It is the first implementation bridge from projection governance into evidence infrastructure.

## Not In Scope

This V1 does not implement:

- institutional exports
- evidence sharing
- route access changes
- Firestore migrations
- event bus/runtime event framework
- message-body evidence profiles
- provider/raw data profiles
- tenant trust export expansion
- review workspace orchestration

## Future Work

Recommended follow-ups:

1. Add route-level evidence projection profile assertions.
2. Add profile-specific evidence pack derivation for tenant-trust and institutional-review contexts.
3. Add source event lineage IDs when canonical event runtime adapters are introduced.
4. Add governed message-body evidence profiles only after consent and scope policy are approved.
5. Persist profile metadata when evidence pack persistence is formalized.

## DO NOT IGNORE

- Evidence packs must remain whitelist projections, not raw object exports.
- Raw provider data, raw CSV data, payment credentials, debug payloads, and message bodies must stay excluded by default.
- Internal references are traceability metadata, not user-facing operational labels.
- Projection metadata must not be treated as evidence certification or legal compliance.
