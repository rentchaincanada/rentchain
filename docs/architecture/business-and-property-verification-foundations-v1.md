# Business and Property Verification Foundations v1

## Audit Summary

RentChain already has operational property records, registry/PID readiness paths, identity assurance foundations, account-trust summaries, export observability, and support/governance redaction helpers. Those systems are useful, but they do not yet form an institutional property authority model.

Current property trust is mostly operational:

- `properties.landlordId`, `ownerUserId`, and `managerUserIds` scope product access and management permissions.
- property registry projections and Identity Oracle adapters can provide property-record lineage, PID syntax validation, public registry matching, and review status.
- institution export previews summarize portfolios, leases, occupancy, maintenance, decisions, and audit events.
- identity-layer property profiles can show registry references and trust-state summaries.

Current business trust is limited:

- identity assurance can represent future `business_attested` and `property_authority_attested` levels.
- no live KYB, business registry, title, banking, or ownership-provider integration exists.
- organization/business metadata is not yet a provider-backed legitimacy record.

The key gap is operator/property authority:

- registry linkage is not ownership proof.
- landlord onboarding and property onboarding remain mostly self-asserted.
- property-to-account relationships are product control relationships, not legal authority conclusions.
- insurers, lenders, subsidy programs, and government workflows need explicit confidence, provenance, expiry, consent, and redaction metadata before they can rely on property records.

## Self-Asserted vs Externally Supported

Self-asserted or platform-derived today:

- landlord-entered business names, property addresses, unit counts, rents, amenities, and operator roles
- property membership through landlord-scoped records
- manager assignment and owner/landlord ids used for application behavior
- property onboarding completion and portfolio readiness copy

Externally supported but not ownership-grade:

- public registry source rows and projections
- PID or PIN syntax normalization
- registry match status and match confidence
- operator review sessions and canonical event lineage

Not implemented:

- business registry/KYB provider verification
- title-system verification
- beneficial ownership verification
- management agreement or agent authority verification
- insurer/lender/government institution review packets for property authority

## Foundation Model

Business and Property Verification Foundations v1 adds a provider-neutral, metadata-only property trust layer.

Core primitives:

- `BusinessVerificationStatus`
- `PropertyVerificationStatus`
- `OperatorAuthorityStatus`
- `RegistryLinkStatus`
- `AuthorityConfidenceLevel`
- `PropertyAuthorityRelationshipType`
- `PropertyVerificationAttestation`
- `PropertyTrustSummary`

The model supports scoped relationships between:

- landlord or operator account
- business or organization
- property record
- registry/provider/reference evidence
- consent and retention metadata

The model explicitly preserves these boundaries:

- no live registry, title, KYB, or banking integration
- no onboarding blocker
- no execution eligibility
- no public sharing by default
- no raw title, registry, KYB, banking, or provider payload custody
- no legal ownership conclusion

## Support and Admin Visibility

Support-safe summaries expose:

- authority state
- business/property/operator status
- registry linkage state
- confidence level
- provider category
- timestamps
- redacted provider and evidence references

Support-safe summaries do not expose:

- raw title documents
- raw registry payloads
- banking/KYB payloads
- title-system payloads
- beneficial ownership payloads
- legal ownership conclusions

## Trust-State Alignment

Completed, active, metadata-only property trust attestations can produce conservative account-trust signals:

- completed business verification becomes a `business` signal
- registry-linked or completed property verification becomes a `property` signal
- externally supported or institution-reviewed operator authority becomes a `property` or `institution` signal

The evidence reference is internal:

```text
property_trust:{attestationId}
```

Raw provider reference ids are never copied into account-trust signals.

## Adoption

Initial adoption is intentionally narrow:

- the identity-layer backend read model derives `propertyTrust`
- the landlord identity-layer route can read optional `propertyVerificationAttestations`
- the identity profile UI renders conservative authority status and guardrails
- tests protect metadata-only summaries, redaction, trust-state alignment, and “no ownership conclusion” language

No property onboarding, registry ingestion, institution export, support-console resource, or legal/document flow is changed.

## Regression Risks

Key risks and mitigations:

- **Unsupported ownership claims:** mitigated by `legalOwnershipConclusion: false`, conservative copy, and tests.
- **Sensitive payload leakage:** mitigated by metadata-only filtering, redacted support summaries, and tests that reject raw references.
- **Onboarding friction:** mitigated by `onboardingBlocking: false` and no route/write changes.
- **Public trust leakage:** mitigated by `publicShareable: false` and identity-layer-only display.
- **Over-broad registry assumptions:** mitigated by describing registry linkage separately from ownership or operator authority.

## Remaining Gaps

Future missions should address:

- provider-specific business verification orchestration
- property/operator authority review workflow
- consented portable attestation framework
- institution trust export schemas
- property authority expiry and reverification operations
- support-console visibility matrix for property authority review
