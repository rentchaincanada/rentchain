# Portable Attestation Framework v1

Status: implemented foundation
Branch: `feat/portable-attestation-framework-v1`
Scope: provider-neutral metadata framework, no public exposure or institution integration

## Implementation Audit Summary

RentChain already had the core ingredients for portable trust but not a portable attestation contract:

- `accountTrust` derives metadata-only account trust levels from verification signals.
- `identityAssurance` describes provider-neutral identity/business/property assurance with consent, retention, expiry, revocation, reverification, and support-safe redaction.
- `propertyTrust` describes business, property, registry-linkage, and operator-authority metadata without ownership conclusions.
- `identityLayer` aggregates trust, assurance, property trust, consent, redaction, and lineage into internal read models.
- tenant share packages provide token-gated summary sharing with package expiry/revocation, but not claim-level institutional attestations.
- institution exports and sharing rooms are preview/review scaffolds with manual-only, non-public behavior.
- governance utilities already provide metadata-only, retention, sensitivity, telemetry sanitization, and identifier redaction helpers.

The gap was a missing claim-level portable schema that can express what may leave RentChain under explicit consent, recipient purpose, expiration, revocation, and strict minimization.

## Portable Attestation Model

The framework introduces `rentchain-api/src/lib/portableAttestations` with:

- `PortableAttestation`
- `PortableAttestationType`
- `PortableAttestationSubjectType`
- `PortableAttestationClaimCategory`
- `PortableAttestationStatus`
- `PortableAttestationLifecycleState`
- `PortableAttestationConsentScope`
- `PortableAttestationAudience`
- `PortableAttestationRetentionClass`
- `PortableAttestationEvidenceSummary`
- `PortableAttestationExportSummary`
- `PortableAttestationSupportSummary`

Portable attestations are provider-neutral and metadata-only. They can reference existing trust sources such as account trust, identity assurance, property trust, legal document metadata, tenant share packages, institution exports, and sharing rooms without replacing those foundations.

## Consent and Audience Scope

Every export-ready portable summary requires:

- claim-level consent id
- granted timestamp
- recipient audience
- permitted purpose
- claim category allowlist
- optional consent expiry and revocation timestamps

If consent is missing, expired, revoked, mismatched to the audience, or does not include the claim category, the attestation remains `pending_consent` and no export summary is produced.

## Lifecycle

Lifecycle is first-class:

- active attestations become `export_ready`
- missing consent becomes `consent_required`
- expired attestations become `expired`
- revoked attestations become `revoked`
- superseded attestations become `superseded`
- stale attestations become `reverification_required`
- unsafe payload or unsupported-claim attempts become `blocked`

Reverification-required summaries may still be projected so recipients can see that a previously present claim needs fresh review. Expired, revoked, superseded, blocked, and pending-consent claims are not export-ready.

## Export-Safe Summaries

`derivePortableAttestationSummary` produces export-safe summaries only when all privacy, consent, and policy guards pass. `buildPolicySafeExportSummary` is the reusable gate future adoption points should call before any share package, institution export, insurer workflow, lender workflow, subsidy workflow, or government workflow uses portable attestation metadata.

Export summaries include:

- schema version
- attestation type
- subject type and scoped subject id
- claim category, label, and description
- status and lifecycle
- issuer category
- audience and permitted purpose
- consent reference
- retention class
- evidence category and source system
- timestamps
- jurisdiction
- redaction profile
- non-authority disclaimers

Export summaries do not include:

- raw provider ids
- raw evidence refs
- raw provider payloads
- support-console metadata
- token hashes
- internal governance notes
- public access controls
- external submission behavior

## Attestation Policy Gate

Attestation Policy Gate v1 adds deterministic deny-by-default policy evaluation through:

- `AttestationPolicyContext`
- `AttestationPolicyDecision`
- `AttestationPolicyReason`
- `evaluateAttestationPolicy`
- `assertPortableAttestationShareable`
- `buildPolicySafeExportSummary`

The gate evaluates the requested operation, audience, purpose, sensitivity context, lifecycle state, consent state, retention class, evidence safety, source alignment, and internal-vs-portable metadata boundaries.

Allowed export or sharing requires:

- active attestation status
- `export_ready` lifecycle
- active claim-level consent
- requested audience matching both the attestation and consent audience
- requested purpose matching the consent purpose
- claim category included in consent scope
- portable retention class
- non-public context
- non-internal sensitivity context
- no raw, provider, evidence, support, public-access, or external-submission payload flags
- matching evidence and source systems

Blocked decisions include machine-readable reasons such as:

- `consent_missing`
- `consent_expired`
- `consent_revoked`
- `consent_scope_insufficient`
- `audience_missing`
- `audience_mismatch`
- `purpose_missing`
- `purpose_mismatch`
- `expired`
- `revoked`
- `superseded`
- `blocked`
- `reverification_required`
- `retention_not_portable`
- `sensitivity_blocked`
- `unsupported_claim`
- `raw_payload_blocked`
- `support_metadata_blocked`
- `public_exposure_blocked`
- `external_submission_blocked`
- `unsafe_evidence_summary`
- `source_mismatch`
- `share_allowed`
- `export_allowed`

`reverification_required` is intentionally blocked by policy even though the underlying framework can represent it. A stale claim may be visible internally for review, but it is not exportable until refreshed.

## Support/Admin Separation

Support summaries are separate from portable summaries. They may show:

- lifecycle state
- redacted consent/reference/source ids
- source system
- retention class
- expiry, revocation, and reverification timestamps

Support summaries explicitly mark:

- raw provider payloads are not visible
- raw evidence is not visible
- support metadata is not portable

This keeps support/admin diagnostics distinct from institution-readable payloads.

## Trust-Source Alignment

Portable attestations reference source systems through `PortableAttestationSourceReference` and `PortableAttestationEvidenceSummary`.

Supported initial source systems:

- `account_trust`
- `identity_assurance`
- `property_trust`
- `legal_document`
- `tenant_share_package`
- `institution_export`
- `sharing_room`

The source reference exists for audit alignment. Raw source identifiers are redacted from support summaries and excluded from export summaries.

## Guardrails Preserved

This framework does not:

- expose attestations publicly
- widen tenant share packages
- add public profile pages
- integrate institution APIs
- integrate identity, business, registry, insurer, lender, subsidy, or government providers
- add blockchain, tokenization, or verifiable credential protocols
- create reputation scores
- automate institutional decisions
- create ownership, identity, creditworthiness, subsidy, or approval conclusions
- wire portable attestations into tenant share packages or institution exports

## Regression Risks

- Future adoption could accidentally add portable attestations to existing share payloads without a policy gate.
- Broad "verified" copy in other surfaces can still be overread unless future integrations use the portable schema language.
- Institution-specific packet signing, revocation notification, and recipient policy matrices remain future work.
- Property authority attestations must continue to carry non-ownership disclaimers.
- The policy gate is currently a pure helper; future route/service adoption must still prove it is called before any external projection.
- Institution Trust Export Framework v1 adds the first package-level composer for policy-gated portable trust summaries, but routes still must explicitly opt into supplying portable attestations.

## Verification

Tests cover:

- model validation through typed fixtures
- consent-scoped export summaries
- pending consent behavior
- revocation, expiration, and reverification lifecycle
- raw payload and unsupported-claim blocking
- internal/support metadata separation
- raw source/provider/reference exclusion from export summaries
- source alignment with identity assurance and property trust foundations
- deny-by-default policy evaluation
- consent, audience, purpose, lifecycle, retention, sensitivity, raw payload, support metadata, public exposure, and source-alignment blocking
- policy-safe export summary generation
