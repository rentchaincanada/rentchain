# RentChain Sign Feasibility Study v1

Branch: `feat/rentchain-sign-feasibility-study-v1`
Scope: architecture and feasibility study only; no signing workflow implementation, provider configuration, Cloud Run change, or PR #1162 merge decision

## Non-Legal-Advice Notice

This study is an operational architecture and product feasibility assessment. It is not legal advice, does not approve RentChain Sign for production use, and does not replace review by qualified Canadian counsel in each target province and tenancy scenario.

## Executive Summary

RentChain can feasibly design a native e-signature workflow for Canadian residential leasing, but it should not be positioned as notarization, legal certification, qualified digital signature infrastructure, or a replacement for counsel-reviewed lease execution rules.

Recommended direction:

**Hybrid approach**

1. Build `RentChain Sign` as the primary low-cost, governed lease execution workflow for standard residential leasing where electronic signing is permitted and all parties consent to electronic records/signatures.
2. Keep Dropbox Sign or another external provider as an optional enterprise/provider-backed dispatch path for customers who require third-party brand assurance, provider audit certificates, or an established vendor.
3. Pause production Dropbox Sign configuration until API cost, webhook verification, lease document delivery, and provider-readable URL constraints are settled.
4. Do not close or merge PR #1162 as part of this feasibility mission; treat it as a draft provider-integration option.

Rationale:

- RentChain already has lease signing request/event foundations, canonical events, evidence package generation, manifest/hash chain-of-custody, institutional export metadata, and Trust & Compliance Center visibility.
- The marginal cost of native signing can be near zero per signature request, while Dropbox Sign API pricing currently starts at $75 USD/month billed annually for the Essentials API tier.
- Native signing creates more engineering and legal responsibility. That risk is manageable only if V1 is narrow, consent-first, audit-heavy, tamper-evident, and reviewed by counsel before production reliance.

## Sources Reviewed

Public legal and provider-cost sources reviewed for this study:

- Government of Canada, PIPEDA full text: https://laws-lois.justice.gc.ca/eng/acts/p-8.6/FullText.html
- Government of Canada, Secure Electronic Signature Regulations: https://laws-lois.justice.gc.ca/eng/regulations/SOR-2005-30/FullText.html
- British Columbia Electronic Transactions Act: https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/01010_01
- Dropbox Sign API product/pricing page: https://www.dropboxsign.com/products/dropbox-sign-api

Repository sources reviewed:

- `docs/architecture/lease-execution-provider-integration-v1.md`
- `rentchain-api/src/services/signing/leaseSigningService.ts`
- `rentchain-api/src/services/signing/providers/mockSigningProvider.ts`
- `rentchain-api/src/services/signing/providers/dropboxSignProvider.ts`
- `rentchain-api/src/services/evidencePackages/*`
- `rentchain-api/src/services/institutionalExports/*`
- `rentchain-api/src/services/trustCompliance/*`
- `docs/strategy/institution-legal-and-compliance-readiness-v1.md`
- `docs/strategy/external-legal-review-preparation-v1.md`

## Current Platform Baseline

Current mainline RentChain has:

- provider-neutral lease signing service boundaries
- `leaseSigningRequests`
- `leaseSigningEvents`
- `leaseSigningWebhookDeadLetters`
- canonical event infrastructure
- mock signing provider as the default local/dev/test behavior
- Dropbox Sign provider boundary as a configured stub on main
- tenant lease signing projection foundations
- landlord send/cancel/status/download signing routes
- evidence package PDF generation
- evidence manifest/hash metadata
- institutional export event generation
- Trust & Compliance Center read-only governance visibility

Current mainline RentChain does not yet have:

- native secure signing sessions
- counsel-reviewed e-sign consent capture
- document version lock for native signing
- native signature capture UI
- signed PDF generation from native signature blocks
- production real-provider dispatch
- public verification portal
- legal certification or notarization capability

## Legal Feasibility

### Baseline

Canadian federal law recognizes electronic documents and electronic signatures in broad terms. PIPEDA defines an electronic document as computer-recorded or computer-stored data that can be read or perceived, including a display, printout, or other output. PIPEDA defines an electronic signature as digital letters, characters, numbers, or other symbols incorporated in, attached to, or associated with an electronic document.

The Secure Electronic Signature Regulations define a higher-assurance federal `secure electronic signature` process using asymmetric cryptography, hash functions, certificates, certificate validation, and a presumption tied to the certificate-identified person. RentChain Sign V1 should not claim to be this type of secure electronic signature unless it implements that certificate-based regulatory process.

Provincial electronic transaction statutes generally support electronic records and signatures where applicable, party consent exists, and the record remains accessible/retainable for later reference. The British Columbia Electronic Transactions Act is a useful example: it defines electronic signature as information in electronic form that a person created or adopted to sign a record and that is in, attached to, or associated with that record; it also states electronic records should not be denied legal effect solely because they are electronic, and electronic participation is not mandatory without consent.

### Residential Lease Caution

Residential leasing is province-specific. A native RentChain signing flow should be reviewed for:

- province-specific standard lease form requirements
- any required delivery, retention, print, or access language
- exceptions where electronic signing is restricted or insufficient
- multi-party tenant/guarantor/cosigner signing rules
- landlord representative authority
- consumer protection, accessibility, and language requirements
- tribunal/court evidence expectations for disputed signatures

### Required Legal Review Questions

Counsel should review:

- whether RentChain Sign consent language is sufficient for each target province
- whether typed, drawn, and checkbox signature methods are acceptable for residential leases
- whether email verification plus authenticated session plus audit metadata is sufficient identity attribution for intended launch scope
- whether a tenant must be offered a paper/non-electronic alternative
- whether the signed lease PDF and audit certificate need specific wording
- whether signed document retention and tenant copy access satisfy statutory requirements
- whether the workflow should exclude Quebec or other provinces until local counsel reviews civil-law and language requirements
- whether landlord countersignature can be asynchronous in each target jurisdiction
- what disclosures are required for IP/device/user-agent collection

## Technical Feasibility

RentChain Sign is technically feasible using existing platform primitives if V1 stays narrow.

Recommended V1 capabilities:

- secure signing request created by landlord for one lease
- tenant receives email link to signing session
- secure token stored hashed only
- token expires and can be revoked/cancelled
- tenant must authenticate or verify email before signing
- tenant must consent to electronic signing and electronic records
- tenant reviews immutable lease document version
- tenant signs using typed name and optional drawn signature
- tenant checks acknowledgements for intent, consent, accuracy, and access to the signed record
- request captures signer IP, user agent, timestamp, authenticated user reference, email verification state, and session reference
- document manifest hash is computed before signing
- signed PDF is rendered with signature block, consent certificate, and verification summary
- signed PDF hash and metadata are stored after signing
- canonical events are emitted for request sent, session opened, consent captured, signature applied, PDF generated, completed, cancelled, expired, and failed states

Not recommended in V1:

- public verification portal
- blockchain anchoring
- notarization or witness flows
- qualified/certificate-based digital signature claims
- broad document management system
- provider selection UI
- cross-platform external document editing

## Proposed V1 Architecture

### Core Components

1. `rentchainSignSessionService`
   - creates and validates signing sessions
   - stores hashed tokens
   - enforces expiry, revocation, replay protection, signer role, and lease ownership

2. `rentchainSignConsentService`
   - captures electronic signing consent
   - records acknowledgement text version
   - records ability to access/retain the record
   - records intent to sign

3. `rentchainSignDocumentLockService`
   - resolves the lease document version
   - computes pre-sign document hash and manifest hash
   - prevents signing after document mutation

4. `rentchainSignSignatureService`
   - captures typed signature and optional drawn signature
   - stores signature metadata and rendered signature artifact safely
   - avoids storing unnecessary raw biometric-like data in broad projections

5. `rentchainSignedLeasePdfService`
   - renders final signed PDF
   - includes lease content, signature blocks, consent certificate, audit summary, document hash, signed PDF hash, and safe evidence references
   - avoids raw Firestore IDs, storage paths, token values, private payloads, and provider IDs

6. `rentchainSignAuditService`
   - appends `leaseSigningEvents`
   - writes canonical signing events
   - links signed metadata to evidence packages, institutional exports, and Trust & Compliance Center

### Workflow

1. Landlord sends signing request.
2. RentChain creates a signing request and secure tenant signing session.
3. RentChain emails a secure signing link.
4. Tenant opens link.
5. Tenant authenticates or verifies email.
6. Tenant consents to electronic signing and electronic records.
7. Tenant reviews locked lease document.
8. Tenant signs with typed name and optional drawn signature.
9. RentChain validates the document version has not changed.
10. RentChain records signature metadata and canonical events.
11. Landlord countersigns if required.
12. RentChain renders signed PDF.
13. RentChain stores signed PDF metadata and internal storage reference.
14. Evidence package and institutional export surfaces show safe signed-document metadata.

### Data Model

Reuse existing collections where possible:

- `leaseSigningRequests`
- `leaseSigningEvents`
- `leaseSigningWebhookDeadLetters`
- `canonicalEvents`

Recommended additions inside existing signing records:

`leaseSigningRequests`

- `providerId: "rentchain_sign"`
- `requestStatus`
- `leaseId`
- `landlordId`
- `tenantEmailHashes`
- `documentVersionId`
- `documentHash`
- `documentManifestHash`
- `expiresAt`
- `cancelledAt`
- `completedAt`
- `signedDocumentHash`
- `signedDocumentStoragePath` internal only
- `signedDocumentGeneratedAt`
- `rawIdsIncluded: false`
- `payloadIncluded: false`

`leaseSigningSessions`

- Consider a new collection only if session lifecycle cannot fit safely in `leaseSigningRequests`.
- If added, store token hashes only, not raw tokens.
- Fields: `requestId`, `leaseId`, `landlordId`, `signerRole`, `emailHash`, `tokenHash`, `expiresAt`, `usedAt`, `revokedAt`, `attemptCount`, `lastAttemptAt`.

`leaseSigningEvents`

- `request_sent`
- `session_opened`
- `email_verified`
- `esign_consent_captured`
- `document_reviewed`
- `signature_applied`
- `landlord_signature_applied`
- `signed_pdf_generated`
- `completed`
- `cancelled`
- `expired`
- `failed`

`canonicalEvents`

- `lease.signing_request_sent`
- `lease.signing_session_opened`
- `lease.esign_consent_captured`
- `lease.signature_applied`
- `lease.signing_completed`
- `lease.signing_cancelled`
- `lease.signing_expired`
- `lease.signing_failed`

Canonical metadata must remain safe:

- safe request reference
- lease safe reference
- landlord safe reference
- signer role
- consent version
- document hash
- manifest hash
- signed PDF hash
- timestamp
- no raw token
- no raw Firestore IDs in user-facing projections
- no raw IP in broad projections
- no user-agent in broad projections
- no storage path in user-facing output

## Security Requirements

Required controls:

- expiring signing links
- random high-entropy tokens
- token hashes only at rest
- one active signing session per signer/request unless deliberately reissued
- replay protection
- rate limiting on token redemption and email verification
- tenant email verification or authenticated tenant session binding
- landlord ownership checks server-side
- immutable document version check before signature acceptance
- IP/user-agent capture in restricted audit metadata only
- signed PDF hash
- document manifest hash
- append-only events
- no raw token exposure in logs
- no signing tokens in canonical events
- signed document storage paths internal only
- lifecycle-safe cancellation and expiry

## Evidence, Export, And Trust Integration

RentChain Sign fits the Phase 4 governance foundation:

- evidence packages can include signature event summaries and signed-document metadata
- chain-of-custody can include pre-sign document hash, manifest hash, and signed PDF hash
- institutional exports can include signed lease evidence as PDF-only V1 output
- Trust & Compliance Center can surface signing posture, signature completion count, missing consent states, and recent signing audit events

These integrations should remain metadata-first. V1 should not expose raw tokens, raw storage paths, raw device payloads, or unredacted signer network details.

## Product And Pricing Assessment

### Dropbox Sign

Official Dropbox Sign API pricing currently lists Essentials starting at `$75 USD / month`, billed annually as `$900 USD`, with 50 signature requests per month. This is materially useful for third-party assurance but high-friction for early landlord economics, especially when signature volume is intermittent.

Benefits:

- established e-sign brand
- provider audit trail
- provider-managed email delivery
- provider signing UX
- enterprise perception advantage

Costs/risks:

- fixed monthly API minimum
- external dependency
- provider-readable document URL or file upload requirement
- webhook/config complexity
- provider ID/payload governance risk
- less control over native lease UX

### RentChain Sign

Benefits:

- near-zero marginal signature request cost
- fully native UX
- direct integration with evidence, custody, export, and trust surfaces
- no provider-readable URL requirement
- better plan bundling for small landlords
- stronger control over consent and audit wording

Costs/risks:

- legal review required
- increased engineering and security ownership
- court/tribunal acceptance depends on evidence quality and jurisdiction
- enterprise buyers may prefer external provider assurance
- dispute handling must be designed carefully
- signed document rendering and storage become RentChain responsibilities

### Manual PDF Upload

Benefits:

- low build complexity
- familiar offline signing path
- useful fallback

Costs/risks:

- weak audit attribution
- manual document tampering risk
- fragmented evidence package
- poor UX
- landlord operational burden

## Comparison Matrix

| Option | Feasibility | Cost | Trust perception | Evidence quality | Engineering burden | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| RentChain Sign | Feasible with counsel review | Low marginal cost | Strong if framed transparently, weaker for enterprise without vendor brand | Strong if hashes/audit/PDF are implemented | High | Build V1 after legal review |
| Dropbox Sign | Feasible but blocked by config/cost | $75 USD/month API minimum, billed annually | Strong third-party brand | Strong provider audit trail | Medium | Keep optional/provider path |
| DocuSign | Feasible future option | Likely higher/commercial | Strong enterprise brand | Strong provider audit trail | Medium/high | Defer |
| Manual PDF upload | Already possible as fallback pattern | Low platform cost | Mixed | Weak unless heavily governed | Low | Keep as fallback only |

## Recommended Implementation Sequence

Do not implement signing execution until counsel reviews this study and approves the baseline consent/evidence model.

If approved, implement in this order:

1. `feat/rentchain-sign-session-foundations-v1`
   - secure token issuance
   - hashed token storage
   - expiry/revocation/replay protection
   - landlord ownership and tenant signer resolution

2. `feat/rentchain-sign-esign-consent-v1`
   - consent copy versioning
   - signer acknowledgement capture
   - electronic records access/retention acknowledgement
   - canonical consent event

3. `feat/rentchain-sign-document-lock-v1`
   - immutable document version
   - pre-sign document hash
   - manifest hash
   - mutation blocking after request send

4. `feat/rentchain-sign-signature-capture-v1`
   - typed signature
   - optional drawn signature
   - intent-to-sign acknowledgement
   - signer attribution metadata

5. `feat/rentchain-sign-signed-pdf-v1`
   - signed PDF render
   - signature blocks
   - consent certificate
   - audit/evidence summary
   - signed PDF hash and storage metadata

6. `feat/rentchain-sign-audit-evidence-export-v1`
   - evidence package linkage
   - institutional export linkage
   - Trust & Compliance Center signing posture

7. `feat/signing-provider-dispatch-choice-v1`
   - decide whether Dropbox Sign remains optional provider path
   - do not add provider selection UI until operational need is clear

## Legal Review Checklist

Counsel should review:

- electronic signature validity for each launch province
- standard residential lease form requirements
- consent to electronic signing and electronic records
- paper alternative / opt-out obligations
- signer attribution standard
- landlord representative authority
- tenant/cosigner/guarantor sequencing
- document retention obligations
- signed copy delivery/access obligations
- admissibility posture for tribunal/court evidence
- wording for consent certificate and audit certificate
- whether IP/device/user-agent collection is necessary and disclosed properly
- privacy policy and terms updates
- province-specific exclusions or required rollout order
- Quebec civil-law and language-specific review before any Quebec launch

## Risk Assessment

### High

- Legal enforceability perception if RentChain overclaims native signatures.
- Identity attribution disputes if email/session controls are weak.
- Document tampering allegations if document version locking is incomplete.
- Privacy risk if IP/device/user-agent details leak into user-facing projections.

### Medium

- Tribunal/court acceptance may vary by facts and province.
- Enterprise customers may prefer third-party provider assurance.
- Signed PDF rendering and long-term storage create new reliability obligations.
- Countersignature and multi-signer sequencing can add edge cases.

### Low

- Incremental platform cost once built.
- Evidence/export/trust integration complexity if signing metadata stays safe and structured.

## Feasibility Recommendation

Build RentChain Sign, but not as an immediate production shortcut around Dropbox Sign cost.

Recommended next step:

**External legal review of RentChain Sign V1 consent/evidence model before implementation.**

After counsel review, proceed with `feat/rentchain-sign-session-foundations-v1`. Keep PR #1162 draft as an optional external-provider path and do not configure Dropbox Sign production/test credentials unless the operator decides the provider path is still needed for near-term QA or enterprise trust.

## Explicit Non-Goals For RentChain Sign V1

- no notarization claim
- no legal certification claim
- no secure electronic signature claim under federal certificate-based regulations unless separately implemented and reviewed
- no blockchain anchoring
- no public verification portal
- no broad document management system
- no provider selection UI
- no autonomous legal or compliance decisions
- no hidden AI remediation
- no replacement for counsel-reviewed lease forms and province-specific rules
