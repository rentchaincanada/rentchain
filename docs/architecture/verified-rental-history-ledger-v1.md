# Verified Rental History Ledger v1

Verified Rental History Ledger v1 introduces a deterministic, permissioned, read-only rental-history reference layer for RentChain.

The ledger organizes portable operational rental-history references without creating a public reputation system, credit reporting system, tenant ranking system, tokenized asset, or public identity profile.

## Purpose

The ledger gives landlords and operators a reviewable view of rental-history context backed by:

- lease participation references
- occupancy timeline summaries
- property identity references
- operator review lineage
- evidence lineage
- consent lineage
- canonical audit references
- delinquency-review references
- maintenance participation summaries
- identity-layer verification references

## Model

Each ledger is tenant-scoped and landlord-scoped:

- `ledgerType`: `tenant_rental_history`
- `manualReviewRequired`: `true`
- `publiclyShareable`: `false`
- `externalInstitutionSharingEnabled`: `false`
- `tokenizationEnabled`: `false`

Supported statuses are:

- `verified`
- `partially_verified`
- `review_required`
- `blocked`
- `unknown`

Status derivation is deterministic. It depends on available lease, identity, consent, evidence, and review references. No AI trust score, probabilistic ranking, public score, or bureau-style conclusion is produced.

## Included References

V1 may include safe references and summaries for:

- lease participation
- occupancy periods
- property references
- maintenance participation
- delinquency review context
- operator reviews
- evidence packs
- canonical events
- identity verification references
- consent references

These are references and summaries only, not unrestricted source-record copies.

## Redaction Rules

The ledger explicitly excludes or redacts:

- raw government identity numbers
- raw screening and credit bureau payloads
- payment account details
- private tenant documents
- unrestricted tenant communications

The ledger is designed to preserve redaction metadata and avoid sensitive payload leakage through landlord-facing routes.

## Canonical Event Descriptors

V1 emits deterministic event descriptors for audit lineage:

- `rental_history_ledger_derived`
- `rental_history_entry_verified`
- `rental_history_review_required`
- `rental_history_blocked`
- `rental_history_redaction_applied`

These are descriptors in the derived model. V1 does not persist ledger records or mutate source records.

## Non-Goals

V1 does not add:

- credit bureau reporting
- public rental-history profiles
- public reputation scoring
- tenant ranking systems
- AI trust scoring
- blockchain or tokenization
- public sharing
- external integrations
- autonomous verification
- payment or financial rails

## Future Work

Future missions may add settlement rail readiness, regulatory profiles, or controlled institutional use cases. Those extensions should build on this permissioned ledger model and preserve consent, redaction, review, and audit lineage.
