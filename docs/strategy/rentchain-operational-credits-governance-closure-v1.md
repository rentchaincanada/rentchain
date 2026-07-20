# RentChain Operational Credits Governance Closure v1

Status: proposed governance closure for review; no engineering implementation is authorized

Dependencies:

- draft PR #1431, `rentchain-operational-credits-architecture-preparation-v1.md`;
- draft PR #1432, the five Operational Credits decision records.

Merge and approval order:

1. PR #1431 — governing architecture;
2. PR #1432 — classification, authority, catalogue, Certn, and incentive decisions;
3. this closure package — consolidated interpretation and engineering-preparation gate.

If either dependency changes materially, this closure must be re-reviewed before approval.

## 1. Executive summary

PRs #1431 and #1432 form a coherent architectural package. They establish RentChain Operational Credits as organization-owned, non-cash operational service credits backed by an immutable, auditable ledger. Credits remain separate from subscription access, pricing, billing, rent, tenant deposits, PAD, payment processing, unit limits, seats, and enterprise contracts. Subscription or contract events may eventually create eligibility evidence, but they are not the credit account or ledger.

The provider strategy is correctly layered. A universal service catalogue defines the operational service; provider offerings, including a preferred future Certn launch offering, remain replaceable and separately versioned. Provider monetary cost, customer credit quantity, eligibility, region, and commercial terms do not become ledger semantics.

The package supports independent landlords through enterprise and institutional organizations by placing ownership at a canonical organization boundary and treating staff, office, department, cost-centre, and parent/subsidiary allocations as governed spending controls rather than new credits. It preserves attribution, append-safe history, reversals, reconciliation, safe projections, and separation of duties.

The commercial strategy is appropriately conservative: a small annual-plan allocation activated after verified onboarding is preferred over “10 free credit checks,” and a Certn launch negotiation should begin with pay-as-you-go wholesale, volume tiers, and a capped co-funded pilot. No quantity, wholesale price, public tier, or incentive claim is approved.

The package is suitable for **Phase 1 engineering preparation** after this closure and its dependencies are reviewed and approved. The first engineering milestone must remain pure, backend-only, unmounted, dependency-injected, and non-customer-facing. It must not persist accounts, read Firestore, expose balances, invoke providers, or mutate subscription/billing state.

## 2. Comprehensive two-PR review

### 2.1 Terminology consistency

The package consistently uses:

- customer-facing working name: **RentChain Operational Credits**;
- neutral internal concepts: `service_credit`, `operational_unit`, `credit_account`, `credit_ledger_entry`, and `service_catalogue_item`;
- organization ownership rather than user wallets;
- grants, reservations, redemptions, reversals, expirations, and adjustments as attributable ledger events;
- catalogue service, provider offering, credit policy, and provider cost as separate concepts.

The package consistently rejects cryptocurrency, blockchain, investment, cash-equivalent, stored-value, wallet, rent-payment, tenant-deposit, transferable-property, and withdrawal language.

### 2.2 Ownership consistency

Both PRs place future ownership at a canonical organization. PR #1432 correctly strengthens PR #1431 by stating that current `landlordId`, authenticated user IDs, aliases, client-provided scope, or property ownership are insufficient permanent authority.

Governing interpretation:

- an independent landlord is a one-member organization;
- users are representatives, not personal owners;
- organization membership, subscription ownership, permissions, and account scope must be resolved server-side;
- allocations control use but do not change economic ownership or mint credits;
- parent and subsidiary organizations remain isolated unless an explicit contracted allocation relationship exists.

### 2.3 Architectural consistency

The documents agree on an immutable ledger as the source of truth, reconciled balance/availability projections, idempotent operations, transactional reservations, compensating reversals, source-specific lots, effective-dated catalogue policies, provider abstraction, and audit-safe projections.

No proposal relies on a mutable balance field as sole truth. No proposal couples ledger entries to Certn products. No proposal mixes Operational Credits with the existing lease credit-allocation or receivables domain.

### 2.4 Dependency ordering

The governing dependency order is:

```text
product classification and hard boundaries
  -> canonical organization and subscription authority
  -> provider-neutral service catalogue
  -> pure account/ledger/transaction/audit contracts
  -> persistence/query/index/IAM design
  -> protected persistence and reconciliation
  -> entitlement or administrative grant workflow
  -> reservation/redemption against a synthetic service
  -> approved provider adapter
  -> customer-safe read projections and UI
```

Commercial, legal, accounting, privacy, provider, and customer-claim gates remain parallel prerequisites where relevant.

### 2.5 Implementation sequencing

PR #1431’s roadmap is consistent with PR #1432’s blockers. One wording ambiguity is resolved here: “recommended first production slice” in PR #1431 means **first engineering-preparation slice**, not production-mounted behavior. The described slice is pure and unmounted and must remain so.

The first slice cannot include Firestore, environment configuration, auth middleware, routes, jobs, provider clients, subscription listeners, billing calls, customer balances, or UI.

### 2.6 Enterprise and institutional consistency

The package supports organization pools, legal-entity isolation, multi-office controls, regional/department budgets, per-user limits, approval thresholds, cost centres, contract-specific catalogues, institutional exports, partner funding, and append-safe evidence.

It does not yet prove a canonical organization hierarchy, government-program authority, white-label boundary, API-partner authorization, or cross-entity contract treatment. Those are implementation blockers for the relevant enterprise feature, not reasons to weaken the core model.

### 2.7 Certn alignment

Certn remains the preferred future launch screening partner, not the only provider and not a currently proven integration. The preferred commercial posture—pay-as-you-go wholesale, negotiated volume tiers, and a capped co-funded onboarding pilot—preserves optionality and limits early CAC/commitment risk.

No Certn-specific product key, price, webhook, failure rule, report shape, consent assumption, or invoice rule belongs in the ledger or universal service definition.

### 2.8 Subscription alignment

Credits remain a distinct operational layer. Subscription or contract entitlement may later create evidence for an idempotent grant, but:

- subscription access is not a credit balance;
- plan limits and seats are not units;
- cancellation does not silently delete ledger history;
- the authenticated user is not automatically the entitled organization;
- current public tier names/prices remain unchanged by these documents;
- the `$39`, `$89`, `$249`, and `$30/unit/year` figures remain scenarios, not approved configuration or public copy.

### 2.9 Governance and audit alignment

Every grant, hold, release, redemption, reversal, expiration, allocation, and adjustment must be attributable and reviewable. Corrections use compensating entries. Administrative status alone does not authorize mutation. High-risk actions require reason, purpose-built permission, threshold approval, and impersonation-write blocking.

Customer, admin, partner, institutional, and export DTOs require separate whitelist projections. Raw provider payloads, reports, wholesale costs, credentials, internal IDs, idempotency keys, paths, support metadata, and unrelated PII remain excluded.

## 3. Contradictions, duplication, ambiguity, and risks

### 3.1 Material contradictions

None found.

### 3.2 Governing clarifications

| Ambiguity | Closure interpretation |
| --- | --- |
| Decision records say “proposed,” while this mission treats principles as approved | Product architecture is settled only after the three-document package is approved. Legal/accounting conclusions and commercial terms remain unapproved. |
| “First production slice” describes an unmounted library | Treat it as first engineering-preparation slice; it cannot be called production-ready or receive a runtime call site. |
| Working plan prices differ from current public tiers | Treat every working number as scenario input; no plan migration, renaming, configuration, or public copy is approved. |
| Certn is “preferred launch partner” | Preference guides negotiation and adapter validation only; it is not integration status, exclusivity, or provider lock-in. |
| Subscription-included credits are the preferred initial source | This is a product direction, not authorization to connect current subscription code or grant credits. |
| Feature flags appear in Phase 1 expectations | Phase 1 may define an injected feature-gate contract/status only; no environment flag or runtime registration is authorized. |

### 3.3 Intentional duplication

Hard boundaries repeat across documents to prevent domain drift. The closure does not create a second source of truth for detailed schema or commercial analysis; it records precedence and approved interpretation.

### 3.4 Highest implementation risks

1. Reusing `landlordId` or user fallback as organization authority.
2. Treating a projection or user/organization field as the authoritative balance.
3. Adding persistence before exact transaction and reconciliation rules are proven.
4. Coupling catalogue or ledger types to Certn.
5. Letting subscription, onboarding, admin, or AI events mint credits without an idempotent governed grant operation.
6. Representing allocations as new credits and duplicating the pool.
7. Publishing a quantity or cash-style value before provider economics and legal review.
8. Mixing Operational Credits with rent, deposits, PAD, tenant payments, or lease credit allocation.

## 4. Confirmed decisions

Subject to approval of PRs #1431, #1432, and this closure, the following architecture decisions are settled:

1. Operational Credits are organization-owned operational service credits.
2. Users are authorized representatives; they do not own personal wallets or transferable balances.
3. Credits are not cryptocurrency, blockchain assets, investment products, cash equivalents, rent payments, tenant deposits, or withdrawable value.
4. Credits are non-transferable between organizations and not externally exchangeable.
5. The initial product direction is promotional or subscription-included credits; purchased credits are excluded.
6. Subscription, billing, pricing, units, seats, contracts, and Operational Credits remain separate concepts.
7. The immutable ledger is the source of truth; balance/availability is a reconciled projection.
8. Every mutation is organization-scoped, attributable, idempotent, append-safe, and reviewable.
9. Reservations prevent concurrent overspend; redemptions consume valid reservations; corrections use linked compensating entries.
10. A universal, versioned service catalogue separates service identity, provider offering, credit quantity, provider monetary cost, eligibility, subscription policy, region, status, and effective dates.
11. Provider adapters are replaceable and cannot decide balances or mint credits.
12. Certn is the preferred future launch screening partner but not an exclusive or embedded core dependency.
13. The preferred Certn opening posture is pay-as-you-go wholesale with volume tiers and a capped co-funded pilot.
14. The preferred founding incentive is a small, capped annual-plan allocation activated after verified onboarding, not ten free checks.
15. Credit quantity remains configurable and does not equal a report or a monetary amount.
16. Administrative grants, reversals, and adjustments require purpose-built permissions, reason, approval evidence, and immutable audit.
17. Enterprise allocations are spending-control projections, not duplicate grants.
18. Parent/subsidiary, multi-office, institutional, government, white-label, and API-partner behavior requires explicit relationships and scoped governance.
19. Customer/provider/admin/export projections remain audience-specific and whitelist-based.
20. No customer balance, provider execution, purchase, or UI appears before its separate governance and validation gates.

## 5. Deferred decisions

The following remain intentionally deferred:

| Decision | Why deferred | Blocking scope |
| --- | --- | --- |
| Purchased credits | Prepaid-service, tax, refund, revenue, and consumer rules unresolved | Purchase, checkout, customer sale |
| Final legal classification | Requires jurisdiction/customer-specific counsel | Customer terms and production launch |
| Accounting treatment | Deferred revenue, liability, breakage, partner funding, and recognition unresolved | Accounting projection and production launch |
| Sales tax | Service, bundle, jurisdiction, and customer treatment unresolved | Purchase and invoicing; possibly disclosures |
| Expiry policy | Legal enforceability, notices, lot behavior, and enterprise overrides unresolved | Expiration runtime and customer claim |
| Refund/cancellation policy | Provider failure, customer cancellation, subscription termination, and lot restoration unresolved | Refund/reversal customer policy |
| Subscription termination treatment | Unused grants and active reservations unresolved | Subscription-grant runtime |
| Enterprise pricing and public tiers | Working scenarios conflict with current public packaging | Pricing configuration and public copy |
| Included allocation quantity | Provider economics, margin floor, CAC, redemption, and subsidy unknown | Grant policy and incentive claim |
| Partner funding accounting | Contract and invoice-credit treatment unknown | Partner-funded grants |
| Certn wholesale economics | No confirmed prices, minimums, failure/refund or volume terms | Provider launch and incentive size |
| Certn product/jurisdiction | Product availability, consent, data, and contract scope unknown | Provider adapter activation |
| Canonical organization authority | Current landlord/user patterns are insufficient proof | Persisted accounts and all runtime reads/writes |
| Canonical subscription ownership | Existing user/legacy subscription paths are not sufficient | Subscription entitlement grants |
| Firestore schema/index/IAM/rules | Exact query and transaction design not audited | Persistence |
| Customer/admin UX | Safe DTOs and runtime authority do not exist | UI and public claims |

Deferred commercial/legal decisions do not block pure type and deterministic logic preparation when those modules make no production claim and encode configurable policy rather than a chosen answer. They do block persistence or behavior that would operationalize the unresolved decision.

## 6. Phase 1 engineering readiness

### 6.1 Readiness conclusion

The package is ready for a narrowly bounded **Phase 1A engineering-preparation mission** after governance approval. It is not ready for production implementation, persistence, provider integration, or user-visible behavior.

### 6.2 Exact smallest safe milestone

Recommended branch:

```text
backend/phase-1a-operational-credits-foundation-primitives-v1
```

Recommended location:

```text
rentchain-api/src/lib/operationalCredits/
```

Allowed scope:

- versioned `OperationalCreditAccount` abstraction containing canonical `organizationId` as injected data;
- immutable `OperationalCreditLedgerEntry` and transaction-intent contracts;
- grant, reservation, release, redemption, reversal, expiration, and adjustment event types;
- integer-unit and source-lot validation;
- deterministic signed-effect, balance, reserved, and available-unit projections;
- idempotency-key and source/workflow fingerprint helpers;
- reservation state-transition and stale-state validation;
- reversal/compensating-entry validation;
- provider-neutral service-catalogue contracts only;
- audit interface contracts and non-sensitive audit metadata validation;
- injected feature-gate status contract that defaults disabled in tests;
- deterministic fixtures and focused pure tests.

### 6.3 Explicit exclusions

- Firestore imports, reads, writes, transactions, collections, indexes, IAM, or rules;
- auth middleware, organization lookup, membership lookup, or subscription lookup;
- environment variables, package scripts, runtime registration, routes, jobs, schedulers, or startup calls;
- customer balances, DTO routes, UI, dashboard cards, admin tools, exports, or notifications;
- Certn or other provider clients, credentials, webhooks, reports, or execution;
- purchases, checkout, billing, payment collection, PAD, rent, deposits, or money movement;
- subscription grants, onboarding grants, campaigns, marketplace redemption, or administrative mutation;
- hardcoded prices, plan names, quantities, expiry periods, provider costs, or legal conclusions.

### 6.4 Phase 1A exit criteria

1. All contracts are pure, unmounted, and dependency-injected.
2. No runtime call site or protected dependency exists.
3. Ledger/projection equivalence is deterministic.
4. Duplicate, stale, ambiguous, invalid, negative-balance, cross-account, and illegal-transition inputs fail closed.
5. Original entries remain immutable; corrections require compensating entries.
6. Catalogue and provider contracts remain neutral.
7. Output is internal/non-financial validation and domain data only; no customer-safe balance claim is made.
8. Focused tests and backend build pass, with protected-scope scans proving the exclusions.

### 6.5 Later gated phases

After Phase 1A, require separate audits before:

- canonical organization/subscription authority adapter;
- Firestore schema/query/index/IAM/rules design;
- protected persistence and reconciliation;
- administrative or entitlement grants;
- reservation/redemption runtime;
- Certn adapter;
- customer/admin projections and UI;
- purchases or marketplace services.

## 7. Enterprise readiness review

### 7.1 Supported architectural direction

| Future segment | Supported by the architecture |
| --- | --- |
| Enterprise landlords | Organization pool, contract policies, budgets, thresholds, reporting |
| Institutional housing | Legal-entity isolation, governance, audit, safe exports, approval rules |
| Government/municipalities | Programme funding source, explicit authority, regional catalogue, audit evidence |
| Universities | Organization/department budgets, term periods, delegated roles |
| Property managers | Staff permissions, portfolio/cost-centre limits, organization continuity |
| Franchise operators | Parent standards with isolated franchise organizations and explicit allocations |
| White-label partners | Provider-neutral services and audience-specific projections, subject to branding/data contracts |
| API partners | Versioned catalogue and idempotent operations, subject to OAuth/tenant isolation governance |
| Marketplace providers | Provider offering, service request, reservation, fulfilment, and reconciliation separation |

### 7.2 Remaining enterprise gaps

1. Canonical organization, membership, legal-entity, and relationship source of truth.
2. Contract ownership and subscription-entitlement mapping.
3. Parent/subsidiary and franchise allocation authority.
4. Government programme eligibility, funding, procurement, records, and public-sector privacy requirements.
5. White-label audience, branding, data-controller, and support boundaries.
6. API authentication, delegated scopes, quotas, idempotency, and partner isolation.
7. Budget-period, cost-centre, approval-threshold, and separation-of-duties rules.
8. Institutional export schema, retention, redaction, recipient authority, and revocation.
9. Multi-region catalogue, data residency, tax, currency, and provider availability policy.
10. Performance, reconciliation, disaster recovery, and bulk-operation proof at enterprise scale.

These gaps should be resolved in focused later audits. Phase 1A primitives must avoid assumptions that foreclose them.

## 8. Strategic validation

### 8.1 Annual subscription adoption

The architecture can support an annual-only activation incentive without embedding the incentive in plan access. Milestone activation aligns cost with meaningful onboarding. Weakness: conversion lift and unit economics are unproven, so no quantity can be approved.

### 8.2 Retention and customer lifetime value

Versioned renewal grants, expiring lots, and accumulated operational utility can reinforce retention without making credits customer deposits. Weakness: overly aggressive expiry or cancellation treatment could damage trust; legal/product terms remain essential.

### 8.3 Certn relationship

The catalogue and adapter preserve a durable Certn partnership while protecting RentChain from lock-in. Shared pilot funding and future volume tiers align both parties. Weakness: there is no confirmed commercial or technical evidence yet.

### 8.4 Partner ecosystem and marketplace expansion

Provider-neutral services allow screening, identity, employment/income verification, supervised AI services, evidence exports, contractors, legal referrals, insurance, and future partners to use one governed operational layer. Weakness: each new service needs its own legal, privacy, fulfilment, refund, and reconciliation approval.

### 8.5 Enterprise positioning

Organization ownership, immutable evidence, approval thresholds, budgets, effective-dated policy, and institutional exports reinforce RentChain’s governance-first enterprise position. Weakness: canonical enterprise authority and scale proof remain absent.

### 8.6 Housing infrastructure strategy

Operational Credits can become a standardized entitlement and reconciliation layer connecting subscriptions, governed services, screening, supervised AI, and partner workflows without becoming money infrastructure. This supports a housing infrastructure platform only if RentChain resists shortcut implementations, provider coupling, hidden automation, and promotional overclaims.

## 9. Governance gates before implementation

The Phase 1A engineering-preparation mission may be authorized only after:

1. PR #1431 is reviewed and approved as governing architecture.
2. PR #1432 is reviewed and approved as the decision layer.
3. This closure is reviewed and approved.
4. Reviewers accept the governing clarifications in section 3.2.
5. The Phase 1A mission repeats every explicit exclusion in section 6.3.
6. The branch and PR are backend-library-only and do not become a vehicle for persistence or integration.

No approval of Phase 1A authorizes Phase 1B or production behavior.

## 10. Final recommendation

**Recommendation: Approved for Phase 1 engineering preparation, conditional on review and approval of PRs #1431, #1432, and this closure package.**

The exact first engineering mission should be:

> Build a pure, backend-only, unmounted Operational Credits foundation under `rentchain-api/src/lib/operationalCredits`. Define provider-neutral account, catalogue, immutable ledger-entry, transaction-intent, reservation, redemption, reversal, expiration, projection, idempotency, feature-gate, and audit-interface contracts with deterministic tests. Use injected data only. Do not add Firestore, auth, environment access, routes, jobs, runtime call sites, customer balances, UI, subscription grants, provider execution, purchases, billing, PAD, rent, deposits, or money movement.

Until all three documentation packages are approved, the initiative remains in governance preparation and backend implementation must not begin.
