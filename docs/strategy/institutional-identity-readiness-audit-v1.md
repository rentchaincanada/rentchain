# Institutional Identity Readiness Audit v1

Status: strategy audit
Branch: `strategy/institutional-identity-readiness-audit-v1`
Scope: documentation-only, governance-first, privacy-first, no provider integration

## Executive Conclusion

RentChain is approaching readiness for a provider-neutral institutional identity assurance framework, but it is not ready for live identity-provider implementation yet.

The verified-account foundation is a useful base: it gives RentChain explainable trust levels, metadata-only verification signals, trust-state summaries, provider-ready references, and explicit flags that prevent execution eligibility and raw sensitive payload storage. That layer should remain separate from institutional identity assurance.

The correct next mission is:

`feat/institutional-identity-assurance-framework-v1`

That mission should define the orchestration framework only. It should not integrate Persona, Trulioo, Verified.Me, Stripe Identity, Equifax, government digital identity systems, or any KYC provider. Identity trust must stay progressive, consented, externally attested, metadata-first, and non-blocking until product and compliance readiness are explicit.

## Audit Scope Completed

This audit reviewed current architecture and implementation surfaces for:

- verified account and trust-state foundations
- identity-layer profile derivation
- tenant onboarding and tenant portal identity readiness
- tenant identity portability
- tenant share packages and scoped external sharing
- institutional identity package derivation
- institutional export preview packages
- governance, privacy, redaction, retention, and telemetry helpers
- support-console visibility and operator accountability
- property identity oracle and registry verification surfaces
- canonical event and verification event descriptors
- future RWA execution readiness strategy
- existing identity, institution export, and verified-account architecture docs

Representative files reviewed:

- `docs/architecture/verified-account-foundations-v1.md`
- `docs/strategy/future-rwa-execution-readiness-audit-v1.md`
- `docs/architecture/identity-layer-v1.md`
- `docs/architecture/institution-export-layer-v1.md`
- `rentchain-api/src/lib/accountTrust/accountTrustTypes.ts`
- `rentchain-api/src/lib/accountTrust/deriveAccountTrustState.ts`
- `rentchain-api/src/lib/identityLayer/deriveIdentityProfile.ts`
- `rentchain-api/src/lib/governance/platformGovernance.ts`
- `rentchain-api/src/services/tenantPortal/tenantProfileService.ts`
- `rentchain-api/src/services/identityPortability/deriveIdentityPortability.ts`
- `rentchain-api/src/services/tenantPortal/tenantSharePackageService.ts`
- `rentchain-api/src/services/institutional/deriveInstitutionalIdentityPackage.ts`
- `rentchain-api/src/lib/institutionExports/deriveInstitutionExportPackage.ts`
- `rentchain-api/src/lib/supportConsole/buildSupportConsoleResource.ts`
- `rentchain-api/src/services/identityOracle/identityOracleTypes.ts`
- `rentchain-api/src/services/identityOracle/identityOracleService.ts`
- `rentchain-api/src/routes/identityOracleInternalRoutes.ts`

External provider capability review used primary provider and government sources only:

- Persona hosted flows, inquiries, and verification primitives: https://docs.withpersona.com/hosted-flow, https://docs.withpersona.com/inquiries, https://docs.withpersona.com/verifications
- Trulioo identity and business verification platform: https://www.trulioo.com/, https://docs.verification.trulioo.com/
- Stripe Identity verification sessions and redaction: https://docs.stripe.com/identity/verification-sessions
- Verified.Me / SecureKey Canadian digital identity context: https://www.interac.ca/en/content/news/interac-acquires-securekey-digital-id-services-for-canada-five-things-you-need-to-know/
- Equifax identity and verification products: https://developer.equifax.com/products/apiproducts/digital-identity-trust, https://developer.equifax.com/products/apiproducts/document-verification, https://developer.equifax.com/products/apiproducts/verification-exchange-canada
- Government of Canada digital credentials direction: https://www.canada.ca/en/government/system/digital-government/digital-government-innovations/digital-credentials.html

## Current Identity Maturity

Overall maturity: low-medium for institutional identity, medium for verified-account foundations.

RentChain now has the first layer needed for institutional identity work:

- `AccountTrustLevel` separates asserted, authenticated, platform-correlated, provider-attested, and institution-reviewed states.
- `VerificationSignal` records metadata about signal type, source, status, evidence type, confidence, subject, timestamps, expiry, revocation, and review need.
- `deriveAccountTrustState` produces metadata-only trust summaries and explicitly marks raw sensitive payload storage as false.
- Identity-layer profiles can carry trust-state summaries without turning tenant, landlord, applicant, property, or organization profiles into identity proof.
- Governance helpers enforce metadata-only telemetry, sensitivity classification, redaction, and retention categories.
- Institution exports remain preview-only and manual-only.

RentChain does not yet have institution-grade identity assurance:

- No provider-backed identity orchestration exists.
- No government ID provider, business verification provider, or digital credential provider is integrated.
- No raw identity document custody should be introduced.
- No support-console workflow should expose raw provider payloads.
- No onboarding path should become blocked by identity verification until progressive trust policy is explicitly designed.

## Verified Account Foundations vs Institutional Identity Assurance

These must remain separate systems.

| Layer | Purpose | Current state | Boundary |
| --- | --- | --- | --- |
| Verified account foundations | Explain what platform trust signals exist for a subject | Implemented as metadata-only trust primitives and derivation helpers | Does not prove government identity, business authority, ownership, or eligibility |
| Institutional identity assurance | Orchestrate external attestations from providers and institutions | Not implemented | Must be provider-backed, consented, revocable, scoped, and metadata-first |

The current trust-state layer can say: RentChain observed account access, email verification, phone verification, screening workflow completion, payment-method evidence, lease participation, registry lineage, operator review, or a future provider reference.

It must not say: RentChain independently proved a legal identity, government identity, beneficial ownership, bank authority, business legitimacy, subsidy eligibility, or creditworthiness.

## Self-Asserted vs Verified Boundaries

| Data or signal | Current source | Current assurance | Institutional use |
| --- | --- | --- | --- |
| Name, contact details, tenant profile fields | User-entered profile/application data | Self-asserted unless separately verified | Useful for workflow context, not identity proof |
| Email verified/authenticated account | Firebase/auth or email verification signal | Account/contact control | Useful low-assurance channel signal |
| Phone verified/present | Profile or phone verification signal where available | Contact control; low unless provider verified | Useful communication signal |
| Screening completed | Screening workflow/provider reference | Workflow evidence; may indicate provider interaction | Not KYC unless provider explicitly attests identity proofing scope |
| Payment method/session readiness | Payment provider/session/reconciliation metadata | Payment-flow evidence | Not bank identity, account ownership, or custody authority |
| Lease participation | Lease records and platform linkage | Platform-correlated tenancy evidence | Useful after party identity and lease lineage mature |
| Property registry match | Identity oracle or registry projection | Property-record lineage | Not ownership or operator authority by itself |
| Operator review | Internal/manual review metadata | Human-reviewed platform decision | Useful with audit trail; not independent identity proof |
| Tenant share package | Tenant-controlled permissions, expiry, revocation, token hash | Consent/share-control evidence | Useful for controlled disclosure; payload must stay minimal |
| Institutional identity package | Derived tenant-controlled readiness summary | Readiness summary | Not provider-grade assurance today |
| Government ID verification | Not implemented | None | Should be provider-attested only |
| Business verification | Not implemented | None | Needed for landlord/operator assurance |
| Property ownership/operator authority | Partially adjacent through registry work | Incomplete | Needs separate authority attestation model |

## Existing Trust Signals That Are Institutionally Useful

The following are useful for future institutional workflows if presented with exact scope:

- Canonical events: useful for lineage and auditability when event actor, resource, visibility, timestamp, and summary are deterministic.
- Trust-state summaries: useful to explain signal provenance and current trust level.
- Tenant share package records: useful for consent state, expiration, revocation, approved scopes, and external disclosure boundaries.
- Institutional preview packages: useful for future lender, insurer, government, and auditor packet formats because they already enforce redaction and manual submission.
- Screening workflow references: useful as workflow completion evidence, not identity authority.
- Property registry lineage: useful as property-record evidence, not owner/operator proof.
- Support-console audit events: useful for operator accountability and privacy review.
- Governance metadata: useful for sensitivity, retention, metadata-only, and redaction enforcement.

## Unsafe Trust Assumptions

The following assumptions must be prohibited in future identity work:

- Treating tenant `identityStatus: verified` or `verificationLevel: strong` as government-grade identity proof.
- Treating screening completion as full KYC, credit-bureau authority, or legal identity proof.
- Treating payment readiness or a payment session as bank account ownership or financial identity assurance.
- Treating a property registry match as proof that a landlord owns or is authorized to operate the property.
- Treating a tenant share package as provider-grade identity attestation.
- Treating an institutional export preview as an approved external submission.
- Treating support-console visibility as broad permission to inspect identity, screening, or financial payloads.
- Treating trust level as permission to automate legal, financial, subsidy, eviction, or external institutional actions.
- Treating provider references as portable evidence without consent, expiry, revocation, provider scope, and retention controls.

## Provider Orchestration Readiness

RentChain has enough primitives to design a provider-neutral orchestration framework:

- subject types for tenant, landlord, applicant, operator, organization, and property
- verification signal types for account access, email, phone, screening, payment method, lease participation, identity, business, property, and institution
- lifecycle statuses for asserted, pending, verified, failed, expired, revoked, and manual-review-required
- metadata fields for provider key, evidence reference, issued date, expiry, revocation, confidence, review requirement, and notes
- governance defaults that prevent raw sensitive payload storage and execution eligibility

Critical gaps remain:

- no consent object or consent lifecycle tied to provider verification sessions
- no provider session state machine
- no webhook/callback normalization model
- no provider payload redaction contract
- no reverification policy by assurance level, subject type, or institutional use case
- no support-console visibility matrix for provider references and verification failures
- no portability schema for institution-safe attestations
- no policy matrix mapping institutional actions to minimum assurance levels
- no separate business, beneficial ownership, operator authority, or property authority attestation model

## Provider Fit Assessment

This is not a procurement recommendation. Provider capabilities and contractual terms must be revalidated before any implementation mission.

| Provider | Architectural fit | Strengths | Risks and boundaries |
| --- | --- | --- | --- |
| Persona | High fit for configurable hosted identity flows and modular verification checks | Hosted and API-created inquiry flows, webhook-ready lifecycle, granular verification types including government ID, phone, selfie, document, and database checks | RentChain should store only inquiry/reference metadata and outcome scope, not raw submitted identity documents or biometric artifacts |
| Trulioo | High fit for broader North American and global identity/business verification | Person and business verification, KYC/KYB/AML-oriented workflows, broad coverage, document verification SDKs | Higher compliance and operational burden; avoid importing raw provider payloads or sanctions/watchlist details into RentChain records |
| Verified.Me / Interac digital identity services | Strategic fit for Canadian trust-network use cases | Canadian digital identity network context, bank/government access heritage, privacy-enhancing credential-sharing direction | Availability and participant coverage must be validated; should be treated as relying-party attestation, not RentChain-owned identity authority |
| Stripe Identity | Medium-high fit if Stripe remains part of payment-adjacent infrastructure | Verification session lifecycle, document and ID-number checks, webhook events, explicit redaction support, strong developer ergonomics | Must remain separate from payment custody; Stripe metadata must not contain sensitive PII; not sufficient alone for business/property authority |
| Equifax/KYC ecosystems | Targeted fit for credit, income/employment, fraud, and regulated workflows | Digital identity trust, document verification, employment/income verification exchange, consent and audit-oriented products | Highest regulatory sensitivity; should not become generalized RentChain identity source without consent, adverse-action, retention, and permitted-purpose governance |
| Future government digital identity systems | Long-term strategic fit for public-program eligibility | Strong public-sector credential direction, consented sharing, optional access, privacy-protecting design principles | Immature/long-horizon; RentChain must remain a relying party and workflow orchestrator, not a government identity provider |

## Consent, Retention, and Data-Minimization Findings

Consent gaps:

- No reusable consent artifact currently binds subject, provider, purpose, institutional recipient, requested attributes, expiry, revocation, and audit event.
- Tenant share packages have scoped sharing lifecycle controls, but they do not yet represent provider identity consent.
- Institutional identity packages state that consent is required, but they do not yet carry provider-specific consent lineage.

Retention gaps:

- Governance helpers classify retention categories, but provider-specific identity retention windows are not modeled.
- There is no clear expired/revoked attestation purge or archival policy.
- There is no provider redaction completion tracking.

Data-minimization requirements:

- RentChain should store provider references, attestation metadata, confidence, status, scope, timestamps, expiry, revocation, jurisdiction, and consent references.
- RentChain should not store raw identity-document payloads as the default architecture.
- External institutions should receive scoped attestation summaries, not raw provider artifacts, unless a future compliance-approved workflow explicitly requires a user-consented handoff.

## Identity Data RentChain Should Never Retain by Default

The following should not be retained in RentChain application data:

- raw passport, driver license, national ID, health card, SIN, SSN, or equivalent numbers
- raw government ID scans, images, PDFs, barcode payloads, MRZ data, or extracted document payloads
- selfie images, face maps, biometric templates, liveness videos, or biometric comparison artifacts
- raw provider KYC/KYB/AML payloads
- raw credit-bureau reports or screening-provider payloads
- bank account numbers, routing numbers, payment card details, or open-banking transaction payloads
- raw fraud/device fingerprints beyond provider reference and risk category metadata
- unredacted insurer, lender, or government eligibility responses
- adverse-action-sensitive reasoning not required for platform workflow and not governed by consent/retention policy

Providers should retain and process raw identity evidence under their own regulated, contractual, and deletion frameworks. RentChain should retain only the minimum attestation metadata needed to make platform decisions explainable and auditable.

## Reverification Lifecycle Gaps

Future identity assurance must define:

- assurance expiration by signal type and provider
- subject-triggered reverification after legal name, address, phone, business, ownership, or operator changes
- risk-triggered reverification after suspicious activity, support escalation, failed export review, or provider revocation
- institution-triggered reverification for lender, insurer, or government workflows
- manual-review states for mismatches, partial matches, unavailable sources, and provider outages
- revocation and downgrade behavior when an attestation expires or is withdrawn
- user-visible explanations that avoid unsupported "verified" badges

## Portability and Trust Boundaries

Trust metadata that could become portable:

- subject type and RentChain internal subject reference
- assurance level and signal type
- provider key or institution key
- provider reference ID or opaque evidence reference
- verification status and lifecycle state
- issued, expires, revoked, and reviewed timestamps
- verification scope, jurisdiction, and permitted use
- consent reference and export/share package reference
- redaction category and privacy classification
- manual review required flag and high-level reason category

Trust metadata that should not become portable:

- raw government identity fields
- raw biometric or document artifacts
- raw screening, credit, or provider payloads
- raw payment or banking data
- internal fraud rules, private support notes, or unrestricted operator comments
- cross-tenant or cross-landlord identifiers
- provider secrets, webhook payloads, or request logs
- unsupported conclusions such as "source of truth", "KYC passed for all purposes", or "government approved"

## Institutional Scenario Readiness

| Scenario | Readiness | Required before implementation |
| --- | --- | --- |
| Tenant insurance onboarding | Approaching strategy readiness | Consented tenant identity attestation, address/occupancy evidence, scoped insurer export schema, no raw ID handoff by default |
| Landlord insurance onboarding | Not ready | Business verification, operator authority, property ownership/management authority, consented export packet |
| Lender verification | Not ready | Business/property authority, rent-roll lineage, payment evidence, signed audit packet, institution export review workflow |
| Credit bureau integration | Not ready | Permitted-purpose model, consumer consent, adverse-action governance, retention limits, provider contract review |
| Subsidy eligibility workflows | Not ready | Provider-grade tenant identity, household/eligibility attestations, government program schemas, explicit consent, human review |
| Affordable-housing workflows | Not ready | Identity assurance, income/household attestations, property/program eligibility, retention and redaction policy |
| Government housing programs | Not ready | Relying-party government identity posture, eligibility packets, explicit consent, agency-specific audit packet format |
| Operator/business legitimacy verification | Not ready | Business verification and beneficial/authorized operator attestation model |
| Property ownership/operator verification | Partially adjacent | Registry evidence exists, but ownership/operator authority and review workflow are incomplete |
| AI-assisted government workflows | Not ready | Identity assurance policy gates, no autonomous submission, human review, audit packet lineage |
| Portable tenant records | Low-medium | Tenant consent and operational summaries exist; provider-backed attestations and portability schema are missing |
| Portable landlord trust metadata | Low | Business/property/operator assurance foundations are missing |
| Institution-grade export packages | Medium as preview | Manual-only exports exist; external submission, signature, assurance policy, and recipient schemas are missing |

## Institutional Assurance Levels

Future assurance levels should be explicit and scoped:

| Level | Meaning | Example use |
| --- | --- | --- |
| `asserted_profile` | User has supplied profile information | Basic onboarding and internal workflow context |
| `account_controlled` | User controls account and verified communication channels | Low-risk account recovery and notification routing |
| `platform_correlated` | Multiple internal records correlate, such as lease participation and screening workflow | Tenant/landlord operational confidence, not external assurance |
| `provider_identity_attested` | External provider attests identity within defined scope | Higher-trust exports and identity-sensitive workflows |
| `business_attested` | External or institution-reviewed business legitimacy evidence exists | Landlord/operator/institution workflows |
| `property_authority_attested` | Property ownership or operator authority is verified by registry/provider/manual packet | Insurance, lender, subsidy, and property-program workflows |
| `institution_reviewed` | Institution or approved operator has reviewed evidence under a defined purpose | Manual institutional package approval |

No assurance level should automatically authorize legal, financial, subsidy, eviction, credit-reporting, or government submission actions.

## AI and Government Workflow Concerns

Future AI-assisted workflows require stronger identity governance than current platform workflows:

- AI must not infer identity assurance from profile completeness or screening completion.
- AI must not recommend government, subsidy, credit, legal, or insurance actions unless required assurance metadata is present.
- AI outputs must remain advisory until policy gates, human review, and canonical audit events exist.
- Government workflows must require explicit consent, scoped attribute disclosure, expiry, and revocation.
- AI should see privacy-safe trust summaries, not raw identity documents or provider payloads.

## Recommended Sequencing

Recommended next mission:

`feat/institutional-identity-assurance-framework-v1`

Required scope for that mission:

- provider-neutral assurance lifecycle types
- provider session/reference metadata types
- consent reference model for identity assurance
- reverification and expiration policy primitives
- provider callback normalization design without live providers
- privacy-safe support-console visibility categories
- assurance-level policy matrix for future exports and institution workflows
- no raw ID storage
- no provider API integration
- no onboarding blocking

Recommended follow-on missions:

1. `feat/business-and-property-verification-foundations-v1`
2. `feat/portable-attestation-framework-v1`
3. `feat/institutional-trust-export-framework-v1`

RentChain should not proceed directly to insurer, lender, government, subsidy, credit bureau, or AI-assisted compliance execution until these foundations exist.

## Primary Questions Answered

1. Current identity signals are email/account control, phone status, screening workflow status, payment method/session evidence, lease participation, property registry lineage, operator review metadata, tenant share permissions, and trust-state summaries.
2. Institutionally meaningful signals are canonical audit lineage, consent/share lifecycle, provider-ready trust metadata, property registry lineage, and manual review events, when scoped accurately.
3. Profile data, application data, landlord property assertions, tenant documents, lease details, and most readiness labels remain self-asserted or platform-derived only.
4. Unsafe assumptions include treating platform `verified` labels, screening completion, payment evidence, registry matches, or share packages as provider-grade identity.
5. Portable trust metadata can include status, scope, provider reference, issued/expiry/revocation timestamps, consent reference, jurisdiction, and assurance level.
6. Raw IDs, biometrics, provider payloads, credit/screening reports, payment data, support notes, and unsupported identity conclusions should never become portable.
7. RentChain should not store raw government IDs, biometric artifacts, KYC payloads, raw credit/screening reports, or bank/payment credentials by default.
8. Providers should store and process raw identity evidence; RentChain should store only attestation metadata and consent-linked references.
9. Persona, Trulioo, Verified.Me/Interac, Stripe Identity, Equifax, and future government digital identity systems are compatible only as external attestation providers, not as architecture to copy into RentChain.
10. Consent architecture must bind subject, purpose, provider, requested attributes, recipient, expiry, revocation, and audit event.
11. Reverification must handle expiry, changed identity facts, provider revocation, suspicious activity, institution requirements, and manual review.
12. Assurance levels should separate asserted, account-controlled, platform-correlated, provider-attested, business-attested, property-authority-attested, and institution-reviewed states.
13. Insurers, lenders, and governments should trust only scoped attestations, consented packets, signed audit lineage, and purpose-specific verified records.
14. Future AI workflows require identity policy gates, minimal trust summaries, human review, and no access to raw provider payloads.
15. RentChain is ready to design the provider-neutral institutional identity assurance framework, but not ready to implement live provider verification.

## Boundaries

RentChain should become a governed trust orchestration platform.

RentChain should not become:

- a bank
- a financial institution
- a raw KYC vault
- a biometric identity custodian
- a government identity authority
- a credit bureau
- an autonomous subsidy executor
- an AI identity-scoring system

No blockchain, tokenization, custody, banking, open-banking, government-ID upload, biometric processing, provider API, insurer API, lender API, subsidy API, or automated legal execution work belongs in this mission.

## Remaining Risks

- Existing UI and service terminology still uses `verified` in operational contexts that could be misunderstood by institutions.
- Tenant portability and institutional identity packages summarize readiness but do not yet carry provider-backed assurance metadata.
- Property identity oracle work helps property-record lineage but not ownership or operator authority.
- Support-console redaction exists, but future provider identity artifacts will require stricter visibility categories.
- Provider choice could change data residency, retention, consent, deletion, and breach-surface obligations.
- Institutional export previews are valuable, but they remain manual-only and not externally submitted.

## PR-Ready Summary

This audit recommends progressing to `feat/institutional-identity-assurance-framework-v1` as a framework-only mission.

The implementation should preserve RentChain's current direction:

- externalize raw identity evidence to providers
- store only metadata-first attestations
- keep trust progressive and explainable
- keep external sharing consented and revocable
- keep support visibility restricted
- avoid unsupported institutional claims
- avoid identity-provider, banking, subsidy, insurer, lender, blockchain, and AI execution implementation until governance foundations are ready
