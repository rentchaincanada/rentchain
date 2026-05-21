# Consent Governance Timeline v1

## Executive summary

This report establishes RentChain's first governed consent timeline foundation for screening/reporting consent, evidence-sharing consent, tenant trust export consent, institutional export consent, and future coordination workflows.

The implementation is metadata-only. It introduces deterministic consent lifecycle semantics and a small helper for audit-safe consent timeline metadata. It does not change legal agreements, authentication, Firestore schema, Firestore rules, route visibility, export visibility, tenant visibility, or sharing behavior.

## Consent philosophy

Consent is a lifecycle-bound governance record, not a one-time boolean.

Future consent-aware workflows should be able to answer:

- what consent type was requested or granted
- who requested it and who granted it
- what landlord, tenant, lease, application, export, evidence, review, or institution scope applied
- when it was requested, granted, revoked, expired, superseded, or denied
- what evidence/export/review artifacts reference that consent
- whether the consent state is tenant-visible or internal audit-only
- whether the workflow is metadata-only and projection-safe

Consent timelines must remain server-authority scoped and append/audit compatible. They should never copy raw provider payloads, export payloads, evidence payloads, privileged review internals, debug metadata, tokens, or private message content.

## Lifecycle state definitions

| State | Meaning | Notes |
| --- | --- | --- |
| `requested` | Consent has been requested but not granted or denied. | Default state when only request metadata exists. |
| `granted` | Consent was affirmatively granted. | Useful as an event/action label; timeline helpers normalize active granted consent to `active`. |
| `active` | Consent is currently effective for the recorded scope. | Requires granted metadata and no expiry/revocation/supersession/denial. |
| `expiring` | Consent is active but close to expiry. | V1 helper treats consent expiring within 14 days as expiring. |
| `expired` | Consent is no longer effective because its expiry timestamp has passed. | Should block future sharing/export unless renewed or superseded by new consent. |
| `revoked` | Consent was withdrawn. | Revocation should preserve audit history and reason metadata where available. |
| `superseded` | Consent was replaced by a newer consent record. | New consent should carry its own scope and lineage. |
| `denied` | Requested consent was declined. | Do not treat as permission for sharing/export. |

## Consent type definitions

| Type | Current/future use |
| --- | --- |
| `screening_consent` | Tenant/applicant consent for screening/reporting workflows. |
| `reporting_consent` | Consent linked to credit/reporting submission or status workflows. |
| `evidence_sharing_consent` | Future consent basis for scoped evidence package sharing. |
| `tenant_trust_export_consent` | Consent for tenant-controlled trust/export package portability. |
| `institutional_export_consent` | Future consent basis for government, lender, insurer, subsidy, or institutional export workflows. |
| `future_subsidy_coordination_consent` | Reserved governance language for subsidy/program coordination. |
| `future_caseworker_coordination_consent` | Reserved governance language for caseworker or support-agency coordination. |

## Metadata expectations

V1 timeline metadata concepts:

- `consentTimelineVersion`
- `consentId`
- `consentType`
- `consentState`
- `requestedAt`
- `grantedAt`
- `expiresAt`
- `revokedAt`
- `supersededAt`
- `deniedAt`
- `requestedBy`
- `grantedBy`
- `authorityScope`
- `evidenceRefs`
- `exportRefs`
- `reviewRefs`
- `sourceRefs`
- `revocationReason`
- `timelineSummary`
- `tenantVisible`
- `metadataOnly`

Internal references are lineage metadata only. They are not primary display labels and do not authorize broader access.

## Export, evidence, and review linkage guidance

Consent linkage should remain reference-based:

- evidence packages should reference consent lineage without copying consent payloads
- institutional exports should record consent basis and consent reference IDs only through explicit export profiles
- tenant trust exports should require active, scope-compatible consent before portability
- review workspaces may reference consent timelines internally for operational context
- tenant-visible projections must not expose privileged review internals

Consent references should include source collection and source ID where practical. They should not include raw provider reports, raw screening/reporting payloads, raw CSV content, payment credentials, document bodies, message bodies, debug payloads, stack traces, route-source diagnostics, tokens, or secrets.

## Expiration and revocation semantics

Expiration and revocation are not destructive actions. They are lifecycle states that should preserve prior consent history while preventing future sharing/export that depends on now-invalid consent.

Future runtime systems should:

- treat revoked consent as higher priority than active/granted metadata
- treat superseded consent as non-current unless the newer consent is active
- treat expired consent as non-effective until renewed
- preserve revocation reasons as metadata, not raw legal or support notes
- avoid automatic revocation or renewal until a reviewed consent workflow exists

## Tenant-safe visibility expectations

Tenant-visible consent timeline projections may show:

- consent type
- lifecycle state
- requested/granted/expiry/revocation timestamps where appropriate
- safe status labels
- export/evidence consent purpose summaries

Tenant-visible projections must exclude:

- privileged review internals
- support/admin notes
- raw provider/reporting/screening payloads
- raw export or evidence payloads
- unrelated landlord/tenant/resource references
- internal IDs as primary display labels
- route-source/debug/stack metadata

## Future institutional coordination direction

Institutional, subsidy, and caseworker coordination must not be built by broadening existing exports. Future workflows need:

- explicit consent type and purpose
- explicit recipient/audience class
- authority-scoped source resources
- tenant-safe projection rules
- evidence/export profile alignment
- audit event linkage
- expiration and revocation handling
- review workspace compatibility

## Helper implemented

`rentchain-api/src/lib/consentGovernance/consentTimeline.ts` adds metadata-only helpers:

- `normalizeConsentType`
- `classifyConsentState`
- `normalizeConsentRefs`
- `buildConsentAuditRef`
- `normalizeConsentTimeline`

The helper is intentionally not wired to routes or persistence. It normalizes consent semantics and scoped internal references for future consent-aware surfaces.

## Known limitations

- No legal-signature engine is introduced.
- No external identity verification is introduced.
- No automatic consent revocation exists.
- No automatic renewal or expiration job exists.
- No institution-facing sharing portal exists.
- No public trust-sharing infrastructure exists.
- No Firestore collection migration or persistence model is introduced.
- Existing screening/reporting consent workflows remain unchanged.

## Future roadmap

1. Add consent-aware projection profiles for tenant trust exports.
2. Add route-level assertions for consent metadata on screening/reporting status surfaces where safe.
3. Add consent event adapters after canonical event runtime adapters are approved.
4. Add revocation/expiry handling only through explicit manual workflows.
5. Add institutional recipient/audience policy only after consent, export, and authority scopes are reviewed together.
6. Add tenant-facing consent timeline UI only after tenant-safe projection rules are approved.

## DO NOT IGNORE

- Consent must not be treated as a global permission flag.
- Tenant-visible consent status must not expose privileged review internals.
- Institutional exports must remain consent-aware and allowlist-based before expansion.
- Revoked, expired, superseded, or denied consent must not authorize sharing/export.
- Consent metadata must not copy raw provider, export, evidence, payment, message, debug, token, or secret payloads.
- This V1 foundation does not create legal guarantees or automated consent orchestration.
