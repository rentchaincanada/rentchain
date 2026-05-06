# Network Participant Layer v1

## Purpose

The Network Participant Layer normalizes permissioned operational ecosystem actors into deterministic read models for review, evidence, sharing, settlement, regulatory, and audit visibility.

This layer is institutional ecosystem relationship infrastructure. It is not public networking, public discovery, reputation scoring, messaging, or external institution integration.

## Participants

Supported participant types:

- landlord
- operator
- lender
- insurer
- auditor
- regulator
- contractor
- institutional_partner
- review_actor

Each participant profile is derived from existing landlord-scoped operational references and includes:

- identity references
- relationship references
- review references
- evidence references
- permission references
- redactions
- blocked reasons
- descriptor-only canonical events

## Required Safety Flags

Every profile returns:

- `manualReviewRequired: true`
- `publiclyDiscoverable: false`
- `externalRelationshipExecutionEnabled: false`

These flags are invariant in v1.

## Relationship Rules

Relationships are deterministic and derived from existing references:

- identity lineage present -> verification relationship can be verified
- sharing-room metadata present -> sharing relationship is visible
- review sessions present -> review relationship is visible
- evidence packs present -> evidence relationship is visible
- settlement/regulatory restrictions -> operational relationship can be blocked
- public access or external execution metadata -> relationship blocked
- missing institutional identity lineage -> review required or unavailable

No AI trust scoring, probabilistic ranking, public reputation, autonomous trust, or public discovery is introduced.

## Canonical Event Descriptors

The layer emits descriptor-only event references:

- `network_participant_profile_derived`
- `network_relationship_verified`
- `network_relationship_review_required`
- `network_relationship_blocked`
- `network_relationship_redaction_applied`

These are additive, deterministic, explainable, and traceable. They do not mutate source records or create external relationships.

## Redaction Model

The layer excludes:

- private identity details and raw government identifiers
- raw screening and credit bureau payloads
- payment account details and unrestricted financial information
- unrestricted audit histories and private tenant communications
- public profile or reputation metadata

## Non-Goals

This release does not add:

- public participant profiles
- public participant search or discovery
- social-network features
- messaging systems
- public reputation systems
- AI trust scoring
- autonomous relationship execution
- external institution integrations
- financial execution
- legal certification
