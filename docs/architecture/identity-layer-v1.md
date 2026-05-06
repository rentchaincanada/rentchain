# Identity Layer v1

## Purpose

Identity Layer v1 introduces deterministic, permissioned operational identity references for RentChain. It centralizes safe identity lineage for tenants, properties, organizations, operators, and review actors without creating public identity profiles or external identity execution.

## Scope

This layer is read-only and landlord-scoped. It derives identity profiles from existing operational references:

- tenant profile references
- property registry references
- organization/operator attribution references
- consent references
- verification references
- operator review references
- canonical event references

## Required Safety Flags

Every derived identity profile includes:

- `manualReviewRequired: true`
- `publiclyShareable: false`
- `externalInstitutionSharingEnabled: false`
- `tokenizationEnabled: false`

## Status Rules

Identity status is deterministic:

- `verified`: required verification and consent references are present
- `partially_verified`: at least one verification reference exists, but other lineage is missing
- `review_required`: source context exists but required verification or consent lineage is missing
- `blocked`: conflicting or unsafe identity references require manual review
- `unknown`: source context is unavailable

No probabilistic trust scoring, AI adjudication, or hidden identity ranking is used.

## Redaction Model

The identity profile is a safe read model. It excludes:

- government identity numbers
- raw screening or credit bureau payloads
- payment account details
- private tenant documents

Redaction metadata is shown so operators understand what categories are intentionally excluded.

## Canonical Event Descriptors

Identity Layer v1 emits deterministic event descriptors for audit lineage:

- `identity_profile_derived`
- `identity_verification_reference_attached`
- `identity_consent_reference_attached`
- `identity_review_required`
- `identity_blocked`

These are additive descriptors only. They do not mutate source records.

## Non-Goals

Identity Layer v1 does not add:

- public identity sharing
- tokenization or blockchain identity
- decentralized wallets
- live institution integrations
- autonomous verification
- legal identity certification
- payment or financial identity rails
- source-of-truth tenant, lease, property, or payment mutations

## Future Work

Future missions may add institutional sharing rooms, verified rental history ledgers, settlement rail readiness, and regulatory profile layers. Those extensions should build on this permissioned identity reference model rather than creating a parallel identity system.
