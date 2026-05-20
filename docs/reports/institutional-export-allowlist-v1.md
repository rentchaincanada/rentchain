# Institutional Export Allowlist Profile v1

## Executive Summary

This report documents RentChain's first institutional export allowlist profile for generated institutional export previews.

The implementation is a governance hardening step. It does not broaden export access, introduce external sharing, add public endpoints, change route visibility, modify auth, change Firestore schema, or change Firestore rules.

## Allowlist Profile

The V1 profile is `institutional_export_preview` with version `institution_export_allowlist_v1`.

Profile metadata declares:

- audience category
- export scope
- allowed collections
- allowed field groups
- excluded field groups
- sensitivity class
- authority basis
- projection policy
- retention policy
- redaction policy
- lineage policy
- audit expectation

## V1 Export Scope

The V1 scope is `landlord_portfolio_preview`.

This means the package is a landlord-scoped preview used for operational and institutional-readiness review. It is not an external submission, certification, public export, or automated institutional filing.

## Authority Basis

The V1 authority basis is `landlord_scoped_preview`.

This means source inputs must already be scoped by the calling landlord route or service. The allowlist profile records the authority posture; it does not replace route authorization or broaden access.

## Allowed Field Groups

V1 institutional export previews allow:

- aggregate counts
- status summaries
- occupancy summaries
- delinquency summaries
- audit event counts
- portable trust metadata
- redaction categories

## Excluded Field Groups

V1 institutional export previews exclude:

- tenant contact details
- identity documents
- raw provider payloads
- raw screening reports
- raw CSV values
- payment account details
- private message contents
- debug payloads
- unrelated resource records

## Metadata Added To Export Packages

Export packages now include:

- `exportProfile`
- `exportVersion`
- `exportScope`
- `sensitivityClass`
- `authorityBasis`
- `sourceCollections`
- `sourceRefs`
- `projectionPolicy`
- `redactionSummary`
- `lineageSummary`
- `exportGeneratedAt`

These fields are deterministic metadata. They do not change source data, export visibility, or route authorization.

## Lineage Expectations

The V1 source lineage model records source collection and source ID references where practical.

Source references are internal traceability metadata. They are not primary display labels and they are not a substitute for future canonical event lineage IDs.

## Retention And Audit Expectations

The V1 retention policy is preview metadata only. External sharing and longer retention policies require a future approved export workflow.

The V1 audit expectation is manual review and audit event linkage before any institutional export release.

## Relationship To Evidence Profiles

This mission extends the same governance direction established by `evidence-pack-projection-profile-v1`:

- explicit profile/version metadata
- source lineage
- redaction summary
- sensitivity class
- manual-review posture
- no raw/provider/debug/private-message payload propagation

## Not In Scope

This V1 does not implement:

- public export links
- institutional submission flows
- route authorization changes
- Firestore migrations
- export persistence changes
- tenant trust export expansion
- message-body export profiles
- raw provider export profiles
- runtime policy engine enforcement

## Future Work

Recommended follow-ups:

1. Add route-level assertions for institutional export profile metadata.
2. Add export checksum/hash metadata before external release workflows.
3. Add canonical event lineage IDs when event adapters are implemented.
4. Add consent-aware export profiles for tenant trust and government workflows.
5. Add persistence rules only after export storage and retention policy are approved.

## DO NOT IGNORE

- Institutional exports must stay allowlist-based.
- Export previews must not become broad landlord data dumps.
- Raw provider, screening, banking, CSV, debug, and message-body data must stay excluded by default.
- Export profile metadata does not certify compliance or authorize external sharing.
