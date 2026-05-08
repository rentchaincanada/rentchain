# Future RWA Execution Readiness Audit v1

Status: strategy audit
Branch: `strategy/future-rwa-execution-readiness-audit-v1`
Scope: documentation-only, governance-first, no blockchain implementation

## Executive Conclusion

RentChain is not ready for future RWA execution implementation yet.

The platform has meaningful institutional-readiness foundations: canonical events, audit timelines, export governance, identity and portability read models, institutional export previews, legal document composition, rendering/accessibility foundations, payment execution boundaries, and manual-review-first automation guardrails. Those systems make RentChain better prepared for future institutional trust work than for tokenization, smart contracts, autonomous execution, or financial-rail expansion.

The correct next mission is:

`feat/verified-account-foundations-v1`

Identity trust must precede execution trust. RentChain should first establish progressive, provider-attestable account verification levels for landlords, tenants, applicants, operators, and property/organization actors before any permissioned execution or RWA-style framework is considered.

## Audit Scope Completed

This audit reviewed current architecture and implementation surfaces for:

- governance/privacy hardening
- canonical event and timeline systems
- audit/compliance readiness
- legal document engine and document exports
- tenant identity, identity portability, and tenant share packages
- landlord and tenant onboarding/readiness surfaces
- screening workflows and screening report access
- automation/action execution systems
- support/debug/admin tooling
- payment/billing/payment-boundary architecture
- registry/property verification systems
- institutional export/readiness surfaces
- existing tokenization, settlement, interoperability, and institutional strategy docs

Representative files reviewed:

- `docs/architecture/asset-tokenization-readiness-infrastructure-v1.md`
- `docs/architecture/payment-execution-boundary-v1.md`
- `docs/architecture/identity-layer-v1.md`
- `docs/architecture/verified-rental-history-ledger-v1.md`
- `docs/architecture/institution-export-layer-v1.md`
- `docs/architecture/audit-compliance-layer-v1.md`
- `docs/architecture/policy-gated-agent-actions-v1.md`
- `docs/architecture/settlement-rail-readiness-v1.md`
- `docs/architecture/institutional-sharing-room-v1.md`
- `docs/architecture/regulatory-profile-layer-v1.md`
- `rentchain-api/src/lib/events/buildEvent.ts`
- `rentchain-api/src/lib/governance/platformGovernance.ts`
- `rentchain-api/src/lib/identityLayer/deriveIdentityProfile.ts`
- `rentchain-api/src/services/identityPortability/deriveIdentityPortability.ts`
- `rentchain-api/src/services/tenantPortal/tenantSharePackageService.ts`
- `rentchain-api/src/lib/automation/automationExecutor.ts`
- `rentchain-api/src/lib/automation/automationActions.ts`
- `rentchain-api/src/lib/payments/paymentExecutionService.ts`
- `rentchain-api/src/lib/payments/paymentReconciliation.ts`
- `rentchain-api/src/services/registry/registryMatchingService.ts`
- `rentchain-api/src/services/registry/registryStatusProjectionService.ts`
- `rentchain-api/src/lib/institutionExports/deriveInstitutionExportPackage.ts`
- `rentchain-api/src/lib/auditCompliance/deriveAuditComplianceReadiness.ts`
- `rentchain-api/src/lib/supportConsole/buildSupportConsoleResource.ts`
- `rentchain-api/src/routes/supportConsoleRoutes.ts`
- `rentchain-api/src/routes/identityOracleInternalRoutes.ts`
- `rentchain-api/src/events/blockchainEnvelope.ts`
- `rentchain-api/src/events/blockchainAdapter.ts`

## Current Maturity Level

Overall maturity: institution-readiness foundations are emerging, but execution readiness is not mature.

| Area | Current maturity | Finding |
| --- | --- | --- |
| Canonical events | Medium | Append-only event builder exists with constrained domains, resources, actors, visibility, and Firestore persistence. Event authority is useful, but not all future execution domains are normalized or universally emitted. |
| Governance/privacy | Medium-high | Metadata-only governance helpers, export sensitivity classification, telemetry sanitization, redaction helpers, and support-console accountability exist. |
| Legal/documents | Medium | Legal document composition and export metadata exist. Current documents are suitable for deterministic rendering/export foundations, not legal execution automation. |
| Identity | Low-medium | Identity read models and portability summaries exist, but they are operational references and platform-derived signals, not provider-grade identity assurance. |
| Property verification | Medium | Registry matching/projection exists for public registry data and manual review states. Ownership/operator authority remains incomplete. |
| Payments | Medium for boundary, low for execution | Provider-neutral boundaries and reconciliation helpers exist. Stripe rent-session seam exists. No custody, banking, payout, or institution settlement execution should be inferred. |
| Automation | Low-medium | Policy-gated execution and audit events exist. Current execution should remain narrow and human-governed; high-risk execution must not expand. |
| Institutional exports | Medium | Preview-only, redaction-aware, manual-only packages exist. No external submissions or institution integrations exist. |
| RWA/tokenization | Readiness-only | Existing asset-tokenization readiness docs explicitly prohibit token issuance, blockchain integration, public marketplaces, wallets, and autonomous tokenization. |

## Reliable Record Sources Today

RentChain can treat the following as relatively reliable internal records for review and readiness purposes, with the caveat that reliability means operational auditability, not legal or regulated authority:

- Canonical events written through `writeCanonicalEvent`, when the event has a valid domain, resource, actor, timestamp, visibility, and summary.
- Support-console access events that record metadata-only operator access with redaction and retention metadata.
- Institution export previews produced by deterministic derivation, with `manualOnly: true` and `externalSubmissionEnabled: false`.
- Audit-compliance readiness checks, because they preserve missing evidence, blocked reasons, redactions, disclaimers, and manual-review requirements.
- Legal document definitions and metadata that include document kind, version, province, sensitivity, and governance metadata.
- Property registry status projections derived from registry source records and match/review state, especially when match status is verified/matched and projection provenance is retained.
- Payment reconciliation derivations that compare an internal payment intent to normalized provider evidence and fail closed on missing references, duplicates, amount/currency mismatch, or unknown provider status.
- Tenant share package records for permission state, expiration, revocation, token hash, approved/requested scopes, and public summary boundaries.
- Identity layer profiles as lineage summaries, not as identity proof. Their redactions and status derivations are reliable as metadata about what references exist.

## Weak or User-Asserted Record Sources

The following records are useful but should not be treated as institution-grade source-of-truth without additional verification:

- Tenant-entered profile data, application data, addresses, employment, income, references, and contact details.
- Landlord-entered property, unit, lease, rent, and tenant details before registry or document/evidence linkage.
- Uploaded document presence or checklist completion without provider validation.
- Lease records without signed document lineage, party identity assurance, and property/ownership verification.
- Manual payment records without provider evidence, reconciliation receipt, duplicate suppression, and settlement metadata.
- Screening status labels when they indicate process completion but not government identity, property, or account authority.
- Application reuse and tenant portability summaries derived from completeness, not provider-grade verification.
- AI insights, analytics, risk summaries, dashboard states, and marketing copy. These are advisory or UI signals, not execution authority.
- Simulated blockchain envelopes or adapters. The current adapter explicitly simulates anchoring and must not be treated as on-chain proof.

## Canonical Events vs UI/Analytics Signals

Events strong enough for future execution lineage:

- Events built through the canonical event builder with validated domain, action, resource, actor, visibility, and summary.
- Support-console access events with governance metadata.
- Automation skipped/executed events that include policy outcome and reason metadata.
- Payment-related canonical event taxonomy and reconciliation descriptors, once future missions deliberately persist/emit them across live flows.

Events and signals that are not execution authority:

- UI analytics events.
- Frontend telemetry.
- PDF/export observability telemetry, except as export diagnostics.
- AI insights and recommendation surfaces.
- Readiness descriptor arrays embedded in read models when they are not persisted canonical events.
- Demo ledger events, mock state, marketing claims, or sample reports.

## Identity Verification Gap

RentChain currently lacks government-grade or provider-grade identity verification for:

- landlords
- tenants
- property operators
- tenant applicants
- organization/business actors
- institutional users

Current identity signals should be separated as follows:

| Signal | Current use | Assurance level |
| --- | --- | --- |
| Email verification/authentication | Account access and communication channel | Low; proves control of email/account, not legal identity. |
| Phone presence | Contact/profile completeness | Low unless verified by provider. |
| Screening completion | Applicant workflow and risk/screening status | Medium for workflow evidence; not equivalent to government ID verification unless provider explicitly attests identity proofing. |
| Payment method or Stripe session | Payment execution evidence | Medium for payment evidence; not identity, ownership, or bank authority proof. |
| Uploaded documents/checklists | Document presence/completeness | Low-medium; must be validated before relying on content. |
| Registry property match | Public property-registration linkage | Medium for property record lineage; not necessarily ownership/operator authority. |
| Government ID verification | Not implemented | Required for higher assurance, preferably by provider attestation without raw ID storage. |
| Business verification | Not implemented | Required for institutional landlord/operator trust. |
| Property ownership/operator verification | Partial registry readiness exists | Needs authoritative ownership/operator attestation and manual review workflow. |
| Institution-grade identity assurance | Not implemented | Required before permissioned execution or RWA frameworks. |

Recommended direction:

- Define progressive trust levels, not binary “verified” language.
- Store provider attestations, verification metadata, timestamps, scopes, provider references, and expiry/revocation status.
- Avoid raw government-ID document storage as the default path.
- Treat screening, payment, document, and registry signals as separate attestations with explicit scopes.
- Require identity assurance levels before enabling higher-risk exports, institutional sharing, or execution eligibility.

## Governance and Privacy Readiness

Mature enough to reuse:

- Sensitivity and retention metadata.
- Export sensitivity classification.
- Metadata-only telemetry pattern.
- Redaction helper patterns.
- Support-console access auditability.
- Institution export redaction categories.
- Audit-compliance disclaimers and manual-only flags.
- Sharing-room and institutional export models that disable external submission/execution by default.

Gaps:

- No single trust-level taxonomy connecting identity assurance, record verification, permission scope, export eligibility, and execution eligibility.
- No uniform attestation model for provider-grade evidence across identity, business verification, property ownership, payments, screening, and registry records.
- No explicit lifecycle model for attestations: issuer, subject, scope, status, evidence reference, issuedAt, expiresAt, revokedAt, and review result.
- No universal policy matrix that maps action type to minimum identity/record assurance level.
- No signed audit packet format for external institutional review.

## Execution-Risk Assessment

Actions that can remain safely automated today only inside current constraints:

- Low-risk internal derivations and read-model generation.
- Metadata-only export observability and diagnostics.
- Policy-gated automation where the existing policy returns allow, scope is narrow, and canonical audit events are written.
- Provider session creation for the existing supported Stripe rent-payment flow, with existing behavior unchanged.
- Internal readiness derivations that do not mutate source records or submit externally.

Actions that must remain human-reviewed:

- Legal notice sending, eviction-related workflows, and tribunal-facing actions.
- Rent collection escalation, delinquency workflows, payment mismatch handling, refunds, payouts, settlement, or account changes.
- Any external institution export, lender/insurer/government package, or regulator filing.
- Property ownership/operator verification.
- Government ID or business verification decisions.
- Screening result interpretation beyond existing provider workflow.
- Cross-tenant/cross-landlord data sharing.
- Any AI-generated operational recommendation before it affects a record or external party.

Workflows that could eventually support permissioned execution:

- Institution export package generation after explicit review and scoped approval.
- Verified account attestation updates from trusted providers.
- Registry status refreshes and manual property verification workflows.
- Payment reconciliation status updates after provider-event receipt persistence and idempotency controls.
- Subsidy or assistance workflow packet preparation, once identity, eligibility, payment, property, and consent attestations exist.
- Insurance/lender review packet preparation, once institutional schemas and identity/property/business verification are mature.

## RWA and Programmable Execution Boundaries

RentChain should not implement the following yet:

- tokenized rent payments
- tokenized leases
- tokenized tenant records
- tokenized property records
- on-chain identity
- on-chain tenant records
- smart-contract lease enforcement
- autonomous subsidy execution
- automated eviction or legal notice execution
- custody of tenant or landlord funds
- banking, PSP, MSB, or payment-institution behavior
- credit bureau behavior
- government identity provider behavior
- public marketplace, investor onboarding, securities offering, wallets, staking, yield, or DeFi behavior
- AI-directed external execution

Near-term strategy should focus on:

- verified records
- provider attestations
- auditable events
- permissioned actions
- institutional redaction and review workflows
- progressive trust levels
- governed execution readiness without execution

## Subsidy and Government Readiness

Current strengths:

- Government-program package type exists in institution export previews.
- Regulatory profile and audit-compliance readiness docs preserve manual review and no external filing.
- Tenant share packages can expose permissioned identity/payment/lease summaries.
- Registry projection can support property-readiness lineage.

Current blockers:

- No provider-grade tenant identity assurance.
- No provider-grade landlord/operator/business verification.
- No property ownership/operator authority attestation.
- No eligibility attestation model for subsidy programs.
- No government API integration or submission controls.
- No explicit consent model for government program data sharing beyond current share package scopes.
- No signed audit packet or institution-grade schema validation workflow for government review.

Conclusion: government/subsidy readiness should be packet-preparation and review-only until verified account foundations and institutional records exist.

## Lender and Insurer Readiness

Current strengths:

- Institution export previews support lender and insurance review package types.
- Settlement readiness, regulatory profile, verified rental history, and sharing-room docs define useful read-model boundaries.
- Payment reconciliation and obligation ledger foundations support future financial traceability.

Current blockers:

- No verified landlord/business/ownership assurance.
- No institution-specific schema signing or external submission.
- No rent-roll attestation model.
- No verified tenant consent/identity package suitable for lender/insurer reliance.
- Payment summary is operational, not settlement-grade.

Conclusion: lender and insurer workflows should remain internal/manual review surfaces until verified account and institutional records frameworks are in place.

## AI-Assisted Operations Readiness

Current strengths:

- Policy-gated agent actions are explicitly recommendation-only.
- Automation executor records skipped/executed outcomes and policy decisions.
- Support console surfaces automation history, policy decisions, reconciliation, SLA, assignment, and redacted identifiers.

Current blockers:

- No policy matrix tying AI suggestions to minimum identity/record assurance.
- No AI action sandbox with explicit allowed targets, approval, rollback, and audit packet requirements.
- No external execution authorization model.

Conclusion: AI should remain assistive and human-reviewed. AI must not trigger legal, financial, identity, subsidy, or external institution actions.

## Recommended Readiness Model

RentChain should introduce progressive trust levels before execution frameworks:

| Level | Description | Examples |
| --- | --- | --- |
| L0 asserted | User-entered or UI-derived data only | Profile fields, manual notes, uploaded document presence. |
| L1 authenticated | Tied to authenticated account/session | Email-authenticated landlord or tenant account. |
| L2 platform-corroborated | Multiple RentChain records align | Application, lease, tenant profile, timeline, share package. |
| L3 provider-attested | External provider attests a scoped fact | ID provider, business verification, payment provider, screening provider, registry source. |
| L4 institution-reviewed | Human/institution review accepted a packet | Manual institutional review, operator review, signed audit packet. |
| L5 execution-eligible | Explicit policy says action may execute | Only after verified identity, verified record, permission, audit, rollback, and legal/compliance review. |

V1 should target L0-L3 foundations only. L4-L5 should remain future strategy.

## Recommended Next Mission

Proceed next with:

`feat/verified-account-foundations-v1`

Reasoning:

- Current record and readiness systems are useful, but identity assurance is the largest blocker.
- Execution trust depends on knowing who the actor is, what they are authorized to do, and what facts are provider-attested.
- Verified account foundations can be implemented without raw government-ID storage by modeling provider attestations, trust levels, verification scopes, evidence references, expiry, revocation, and manual review requirements.
- This mission would unblock later institutional records work without prematurely building tokenization, financial rails, or autonomous execution.

Recommended scope for `feat/verified-account-foundations-v1`:

- Define account trust levels for landlord, tenant, applicant, operator, organization, and property roles.
- Add an attestation metadata model: issuer, subject, scope, status, evidence reference, issuedAt, expiresAt, revokedAt, redaction metadata, and manualReviewRequired.
- Map existing signals into conservative trust levels without overstating assurance.
- Add read-only account verification projections and tests.
- Preserve provider-neutral design; do not add a live identity provider integration in the first pass unless separately authorized.
- Do not store raw government IDs by default.

## Future Mission Sequencing

Recommended sequence:

1. `feat/verified-account-foundations-v1`
2. `strategy/institutional-identity-readiness-audit-v1`
3. `feat/institutional-records-framework-v1`
4. `feat/permissioned-execution-framework-v1`
5. `feat/future-rwa-execution-framework-v1`

Do not jump directly to `feat/future-rwa-execution-framework-v1`.

## Acceptance Criteria Assessment

- Architecture audit completed: yes.
- Future RWA/execution readiness assessed honestly: yes; not ready for implementation.
- Identity verification gaps documented: yes.
- Institutional readiness gaps documented: yes.
- Execution boundaries defined: yes.
- No product behavior changed: yes.
- No blockchain/tokenization implementation added: yes.
- Recommended next mission identified: `feat/verified-account-foundations-v1`.

## Remaining Risks

- Some older code uses "blockchain-ready" language and a simulated adapter. That should be treated as hash/envelope experimentation only and should not become a product claim.
- Current "verified" labels in identity/readiness models may be read too strongly by future teams. A trust-level taxonomy should replace broad verified wording where institution-grade assurance matters.
- Institutional exports and sharing rooms are preview/readiness surfaces. They should not be converted into external submissions without a separate compliance, legal, privacy, and security mission.
- Payment boundaries are improving, but payment execution and settlement remain regulated domains. Future provider work must stay explicitly scoped and reviewed.
