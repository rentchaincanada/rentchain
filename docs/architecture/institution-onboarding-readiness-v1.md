# Institution Onboarding Readiness v1

## Purpose

The Institution Onboarding Readiness Layer provides deterministic, permissioned, read-only readiness references for future operational coordination with lenders, insurers, auditors, municipalities, regulators, institutional landlords, and ecosystem partners.

This layer is an internal operational readiness surface. It does not create live integrations, external onboarding submission, public onboarding portals, autonomous approvals, legal certification, or institution credential exchange.

## Model

The v1 read model derives `InstitutionOnboardingReadiness` records for:

- `lender`
- `insurer`
- `auditor`
- `regulator`
- `municipality`
- `institutional_landlord`
- `operational_partner`

Every readiness record includes:

- `manualReviewRequired: true`
- `externalOnboardingEnabled: false`
- `autonomousApprovalEnabled: false`
- deterministic status and summary counts
- participant, trust, identity, evidence, review, settlement, regulatory, sharing, and audit references
- onboarding restrictions
- redaction metadata
- descriptor-only canonical events

## Status Rules

Readiness derivation is deterministic:

- `ready_for_review`: required references are present and no selected references are blocked or unavailable
- `partially_ready`: lineage exists but at least one selected reference is incomplete
- `review_required`: required lineage is unavailable and no selected reference is blocked
- `blocked`: selected references or restrictions indicate unsafe or conflicting onboarding context
- `unknown`: insufficient source context exists

No AI scoring, probabilistic ranking, or external onboarding decisioning is used.

## Restrictions

Onboarding restrictions are surfaced when source relationships are incomplete or unsafe:

- missing consent or access lineage blocks onboarding readiness
- incomplete trust relationship readiness creates trust restrictions
- incomplete settlement readiness creates settlement restrictions
- incomplete regulatory readiness creates regulatory restrictions
- missing evidence, review, or audit lineage creates manual review requirements

Restrictions are visibility-only. They do not approve, reject, submit, communicate, integrate, or execute.

## Canonical Events

The layer emits descriptor-only event metadata for audit traceability:

- `institution_onboarding_readiness_derived`
- `institution_onboarding_review_required`
- `institution_onboarding_blocked`
- `institution_onboarding_restriction_detected`
- `institution_onboarding_redaction_applied`

These are additive descriptors in the derived read model. They do not mutate source records or create external side effects.

## Redaction Model

The derived model excludes:

- raw government identifiers
- screening and credit bureau payloads
- payment account details
- unrestricted financial information
- private tenant documents
- tenant communications
- external onboarding payloads
- public portal and unrestricted directory data

Landlord routes remain scoped to landlord-accessible operational metadata.

## Non-Goals

This layer does not provide:

- lender, insurer, or regulator integrations
- onboarding submission
- public onboarding portals
- autonomous onboarding approvals
- public institutional directories
- legal certification
- institution credential exchange
- AI onboarding scoring
