# Phase B B0 Administrative Prerequisites

> Status: evidence package only. B1 and all Phase B implementation remain **unauthorized**.

## Purpose

B0 converts the architecture approved for governance review in PR #1442 into an administrative gate. PR #1441 proved a bounded keyless Vercel Preview-to-IAM-protected Cloud Run identity bridge; it did not prove permanent ownership, billing, Terraform, data, or operating controls. PR #1442 selected a shared permanent isolated non-production foundation, ephemeral exact-head compute, and shared namespaced synthetic data with serialized mutation workflows.

## Evidence versus recommendation

- **Confirmed:** the merged PR #1441 technical proof and teardown; the merged PR #1442 architecture, prohibitions, cost estimates, and B0–B10 sequence; repository configuration findings cited there.
- **Founder-approved policy:** create a new purpose-built Preview project and use the ownership, cost, Terraform, trust, IAM, privacy, and provider policies in this package under disclosed solo-founder governance.
- **Pending implementation/confirmation facts:** final project-ID availability and placement, billing attachment, budget/alerts, Terraform Cloud configuration, Vercel trust, IAM, Firebase, provider suppression, fixtures, cost revalidation, and separate written B1 authorization.

## Solo-founder governance disclosure

RentChain is presently operated by a solo founder. Administrative, engineering, security, billing, QA, infrastructure, privacy, provider, incident-response, and emergency-access responsibilities are therefore consolidated under **Founder — Paul**. This is an accepted early-stage operating constraint, not independent separation of duties. RentChain will separate implementation, approval, security review, billing oversight, and emergency-access responsibilities as qualified personnel or external reviewers become available and as risk requires.

Founder approval is classified as `founder-approved`, `internally accepted under solo-founder governance`, and `not independently reviewed`. Bounded non-production work may be implemented and approved by the Founder only with written advance scope, production prohibition, keyless least privilege, reversibility, cost ceilings, passing automated checks, exact-head evidence, defined rollback/teardown, and no overridden substantive failure. External or second-person review is mandatory for the triggers in the [ownership model](phase-b-b0-ownership-and-raci.md).

## Gate outcome

The Founder has accepted all current accountable roles and the policies in this package. B0 policy and ownership are complete under solo-founder governance. Planned configuration is not implemented evidence. B1 is administratively ready for a **separate written authorization**, but this direction does not authorize or start B1.

```mermaid
flowchart LR
  E[PR 1441 and 1442 evidence] --> P[B0 policies and registers]
  P --> O[Named owner acceptance]
  P --> A[Founder policy acceptance under disclosed solo-founder governance]
  O --> R{Policy accepted and implementation facts scoped?}
  A --> R
  R -->|No| D[Defer B1]
  R -->|Yes| S[Separate written B1 authorization request]
  S -->|Approved| B1[B1 project and billing baseline only]
```

## B1 boundary

A later, separately authorized B1 may confirm or create the approved isolated project, attach only the approved billing account, apply labels, establish ownership records, create budget alerts, verify placement, capture evidence, and stop. Baseline API enablement is recommended for B2 so B1 remains administrative and reversible. B1 excludes Terraform Cloud setup, Cloud Run, WIF, service accounts, Vercel changes, Firebase, Firestore, Storage, fixtures, providers, and QA.

## Package map

See the [project decision](phase-b-b0-project-placement-decision.md), [ownership model](phase-b-b0-ownership-and-raci.md), [billing authorization](phase-b-b0-billing-and-cost-authorization.md), [Terraform authority](phase-b-b0-terraform-authority.md), [Vercel trust policy](phase-b-b0-vercel-trust-policy.md), [IAM policy](phase-b-b0-iam-policy.md), [privacy policy](phase-b-b0-synthetic-data-and-privacy-policy.md), [provider authority](phase-b-b0-provider-suppression-authority.md), [evidence register](phase-b-b0-evidence-register.md), [decision register](phase-b-b0-decision-register.md), [B1 checklist](phase-b-b0-b1-authorization-checklist.md), and [executive brief](phase-b-b0-executive-approval-brief.md).
