# Operational Service Catalogue Decision v1

## Status

Proposed provider-neutral architecture. No service, provider, credit quantity, price, or regional availability is approved.

## Context

RentChain has screening packages, pay-per-use monetization, consent workflows, provider-neutral components, and provider-specific operational paths. It does not have a universal catalogue authority connecting Operational Credit quantities to approved services. Directly embedding Certn products or current provider assumptions in a ledger would block provider replacement and future services.

## Decision

Create a versioned universal service catalogue that separates six concerns:

1. stable operational service definition;
2. provider offering and fulfilment adapter;
3. Operational Credit cost policy;
4. provider monetary/commercial cost;
5. customer eligibility and subscription entitlement;
6. availability/version/effective-date controls.

### Proposed records

```ts
type OperationalServiceDefinition = {
  serviceKey: string;
  version: string;
  displayName: string;
  category: string;
  fulfilmentRequirementsVersion: string;
  status: "draft" | "active" | "suspended" | "retired";
  effectiveFrom: string;
  effectiveTo: string | null;
};

type ServiceProviderOffering = {
  offeringKey: string;
  serviceKey: string;
  serviceVersion: string;
  providerKey: string;
  providerProductKey: string;
  regions: string[];
  status: "draft" | "active" | "suspended" | "retired";
  commercialTermsVersion: string;
  effectiveFrom: string;
  effectiveTo: string | null;
};

type ServiceCreditPolicy = {
  policyKey: string;
  serviceKey: string;
  customerSegmentOrContractKey: string;
  requiredUnits: number;
  eligibilityPolicyKey: string;
  fundingPolicyKey: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
};
```

Provider wholesale cost belongs in a protected commercial record and must not be exposed through customer catalogue DTOs. Subscription access and credit quantity are policy overlays, not fields that redefine the service.

### Candidate services

- tenant credit report;
- identity verification;
- background check;
- employment verification;
- income verification;
- supervised AI-assisted lease review;
- premium evidence export;
- future contractor service;
- future legal-service referral;
- future insurance service.

These are examples only. Inclusion does not establish availability, legality, provider readiness, or an approved credit cost.

## Alternatives considered

1. **Certn product table as catalogue:** rejected because it couples core service identity to one provider.
2. **One credit per service:** rejected because costs and value differ.
3. **Plan-specific duplicate catalogue items:** rejected; use versioned eligibility/credit-policy overlays.
4. **Provider monetary price stored on customer item:** rejected because it leaks commercial terms and conflates units with money.
5. **Mutable current-price fields:** rejected because historical redemptions require effective-dated versions.

## Rationale

Separating service, provider, credit policy, commercial cost, and eligibility allows provider replacement, regional restrictions, temporary suspension, contract pricing, partner funding, and enterprise-specific availability without rewriting the ledger.

## Consequences

- Reservations pin service, offering, and credit-policy versions.
- A provider can be suspended without changing the stable service definition.
- Multiple providers may fulfil the same service under deterministic selection/approval rules.
- Historical receipts retain display-safe snapshots of the version used.
- Plan or contract differences are explicit policy, never hidden provider logic.

## Risks

- Excessive policy combinations could become hard to explain and reconcile.
- Provider substitution may change consent, disclosures, data residency, or fulfilment semantics.
- Incorrect effective-date handling could quote one quantity and redeem another.
- Calling AI, legal, insurance, or contractor referrals “services” may create unsupported expectations without careful scope text.

## Open questions

- Which service is the bounded launch candidate after approvals?
- Who owns catalogue, commercial offering, eligibility, and credit policy review?
- Are plan-specific credit costs commercially desirable or unnecessarily complex?
- How are provider selection, substitution consent, outage fallback, taxes, and regional rules represented?
- Which catalogue fields may appear in landlord, admin, enterprise, and export projections?

## Dependencies

- Operational Credit classification and organization authority decisions;
- provider adapter and reconciliation contracts;
- consent/permissible-purpose requirements per service;
- commercial terms registry and secrets boundary;
- subscription/contract entitlement authority;
- safe DTO and audit snapshot rules.

## Legal or accounting review requirements

Review service characterization, provider resale/referral restrictions, customer disclosures, taxes, regional availability, refund/cancellation, data retention, AI/legal/insurance disclaimers, and partner-funded treatment.

## Security implications

Only approved server-side catalogue versions can be reserved. Commercial cost and provider product identifiers require protected access. Suspension and effective-date transitions must fail closed without invalidating historical evidence.

## Privacy implications

Each service version defines minimum required data, consent, retention, provider disclosure, region, and customer projection. The catalogue must not contain raw provider payloads or tenant records.

## Enterprise implications

Enterprise-specific policies may limit catalogue entries by contract, entity, region, office, cost centre, approval threshold, or funding source while preserving the universal service definition.

## Implementation constraints

- Provider-neutral service keys.
- Immutable/effective-dated versions.
- Integer credit quantities separate from monetary cost.
- Safe customer projection and protected commercial projection.
- No automatic provider substitution when consent or service semantics differ.

## Explicit out of scope

Catalogue persistence, admin UI, public catalogue, provider adapters, Certn execution, prices, credit quantities, subscription changes, reservations, redemptions, routes, Firestore, or customer claims.

## Conditions required before implementation

1. Catalogue ownership and version lifecycle are approved.
2. Initial service semantics and provider-neutral contract are accepted.
3. Commercial cost and customer projection boundaries are reviewed.
4. Effective-date, suspension, substitution, consent, and regional rules are specified.
5. No service is activated until its provider, legal, privacy, security, and reconciliation gates pass.
