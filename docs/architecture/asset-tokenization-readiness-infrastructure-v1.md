# Asset Tokenization Readiness Infrastructure v1

## Purpose

Asset Tokenization Readiness Infrastructure is a deterministic, landlord-scoped read model for institutional real-world asset readiness review. It aggregates canonical asset references, lease cashflow summaries, occupancy lineage, maintenance/performance lineage, settlement readiness, regulatory profiles, review lineage, evidence lineage, and redaction metadata.

This layer is infrastructure readiness only. It does not mint tokens, deploy smart contracts, integrate with blockchains, create wallets, onboard investors, create securities offerings, move money, or operate a public marketplace.

## Model

Asset readiness records include:

- `assetReadinessId`
- `assetType`: `property`, `lease_cashflow`, or `operational_asset`
- status: `eligible_for_review`, `partially_ready`, `blocked`, or `unknown`
- required safety flags:
  - `manualReviewRequired: true`
  - `tokenIssuanceEnabled: false`
  - `blockchainIntegrationEnabled: false`
  - `publicMarketplaceEnabled: false`
- asset identity references
- lease cashflow references
- occupancy references
- maintenance/performance references
- settlement-readiness references
- regulatory-profile references
- review and evidence lineage
- redactions and blocked reasons

## Deterministic Eligibility Rules

- `unknown`: insufficient landlord-scoped source context exists.
- `blocked`: required settlement or regulatory lineage is missing/blocked, unresolved delinquency review metadata is visible, or a referenced source is blocked.
- `partially_ready`: source lineage exists but one or more references remain partial or unavailable.
- `eligible_for_review`: required settlement, regulatory, review, and evidence lineage are present and no blocked or partial references remain.

No AI tokenization scoring, probabilistic eligibility ranking, public reputation score, or autonomous approval is used.

## Restriction Rules

The layer derives blocked-tokenization reasons from existing read models only:

- missing settlement readiness blocks tokenization readiness
- missing regulatory profile blocks tokenization readiness
- blocked settlement readiness blocks tokenization readiness
- blocked regulatory readiness blocks tokenization readiness
- blocked evidence pack blocks tokenization readiness
- unresolved delinquency review metadata blocks tokenization readiness
- incomplete cashflow, occupancy, review, or evidence lineage keeps readiness partial

## Redaction Rules

Asset readiness records expose summary references only. They exclude:

- token issuance payloads
- blockchain addresses, wallets, and custody metadata
- investor data and securities-offering materials
- raw financial account data and unrestricted financial exports
- sensitive tenant, screening, and private audit payloads

## Canonical Event Descriptors

The layer emits descriptor-only canonical event metadata:

- `asset_tokenization_readiness_derived`
- `asset_tokenization_review_required`
- `asset_tokenization_blocked`
- `asset_tokenization_restriction_detected`
- `asset_tokenization_redaction_applied`

These descriptors are additive, deterministic, explainable, and traceable. They do not persist source-record mutations or perform external execution.

## Non-Goals

This layer does not add:

- token issuance
- smart contract deployment
- blockchain integration
- wallet or custody systems
- investor onboarding
- securities offerings
- crypto settlement
- public marketplaces
- DeFi, staking, or yield behavior
- autonomous tokenization
- live institutional financial integrations
