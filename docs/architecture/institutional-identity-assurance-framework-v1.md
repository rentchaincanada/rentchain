# Institutional Identity Assurance Framework v1

Status: implemented foundation
Branch: `feat/institutional-identity-assurance-framework-v1`
Scope: provider-neutral metadata framework, no live provider integration

## Implementation Audit Summary

RentChain already had verified-account foundations through `accountTrust` and operational identity profiles through `identityLayer`. Those systems are useful but intentionally conservative:

- account trust tracks metadata-only verification signals and derives asserted, authenticated, platform-correlated, provider-attested, and institution-reviewed states
- identity profiles expose permission-scoped operational references, consent lineage, review lineage, redactions, and manual-review requirements
- tenant portability and institutional identity packages summarize readiness, not provider-grade identity assurance
- governance helpers classify sensitivity, retention, redaction, and metadata-only telemetry
- support-console resources expose restricted diagnostics with redacted identifiers

The gap was a missing institutional identity assurance layer that can describe provider-neutral identity attestations without integrating providers or storing raw identity evidence.

## Assurance Model

The framework introduces:

- `IdentityAssuranceSubjectType`
- `IdentityAssuranceLevel`
- `IdentityAssuranceStatus`
- `IdentityAssuranceLifecycleState`
- `IdentityAssuranceProviderType`
- `IdentityAssuranceConsentScope`
- `IdentityAssuranceRetentionClass`
- `IdentityAssuranceAttestation`
- `IdentityAssuranceSummary`

The model supports tenants, landlords, applicants, property operators, business entities, organizations, and properties. It is provider-neutral and can represent future attestations from identity providers, business verification providers, property registries, financial identity providers, government digital credential systems, institution reviews, operator reviews, or future providers.

## Privacy and Storage Boundaries

RentChain stores metadata-only assurance state:

- assurance status and level
- provider category and non-sensitive provider key
- internal attestation id
- redacted provider/evidence references for support summaries
- consent purpose and consent reference metadata
- retention class
- completion, expiry, revocation, and reverification timestamps
- audit event reference

RentChain does not store:

- raw government ID scans
- passport or driver licence images
- biometric images, selfie, face maps, or liveness payloads
- raw provider KYC/KYB/AML payloads
- SIN/SSN equivalents
- banking credentials
- unsupported institution-wide "source of truth" conclusions

Attestations that claim raw sensitive payload storage are ignored by the summary derivation.

## Lifecycle and Events

The framework defines metadata-only event descriptors:

- `identity_assurance_requested`
- `identity_assurance_started`
- `identity_assurance_completed`
- `identity_assurance_failed`
- `identity_assurance_expired`
- `identity_assurance_revoked`
- `identity_assurance_reverification_required`

These are descriptors for future canonical-event alignment. This mission does not add provider callbacks, webhook handling, persistence, external submission, or live provider orchestration.

## Trust-State Alignment

Identity assurance does not replace verified-account foundations.

Completed, active, metadata-only attestations can be converted into conservative account-trust verification signals. The conversion uses internal `identity_assurance:{attestationId}` evidence references rather than raw provider reference ids.

This lets provider-neutral assurance inform `provider_attested` account trust without exposing raw provider identifiers through identity-layer surfaces.

## Support/Admin Visibility

Support-safe summaries expose:

- assurance status
- assurance level
- lifecycle state
- provider category
- provider key
- redacted provider reference
- redacted evidence reference
- consent purpose
- retention class
- completion, expiry, and reverification timestamps
- review-required flag

Support/admin summaries do not expose raw ID documents, raw provider responses, biometric data, or identity document numbers.

## UI Foundation

The identity layer panel now shows conservative assurance status:

- identity assurance not started
- pending/requested lifecycle states
- completed through approved workflow
- reverification required
- failed, expired, revoked, or manual-review-required states

The UI avoids unsupported claims such as "KYC approved", "government ID verified", or broad public verified badges.

## Out of Scope Preserved

This framework does not:

- integrate Persona, Trulioo, Verified.Me, Stripe Identity, Equifax, or government credential systems
- add identity document upload UI
- store raw identity documents or biometrics
- implement KYC custody
- block onboarding
- expose trust metadata in public share packages
- widen execution automation
- add banking, open-banking, insurer, lender, subsidy, blockchain, or tokenization behavior

## Regression Risks

- Future teams may still overread existing tenant-facing `verified` copy unless they use the assurance summary for institutional contexts.
- Provider integrations will need separate consent, retention, callback, deletion, and support-visibility reviews.
- Business and property authority assurance are represented as levels but are not implemented as live workflows.
- Public share packages intentionally do not expose identity assurance metadata in this mission.
