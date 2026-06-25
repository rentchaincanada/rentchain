# RC1 Workflow Continuity Audit Plan v1

Branch: `docs/rc1-enterprise-demo-readiness-plan-v1`
Scope: audit planning only; no workflow implementation.

## Purpose

Enterprise demos fail when workflow handoffs look disconnected. RC1 should audit whether current RentChain workflows connect cleanly enough to support a one-building pilot conversation.

Each handoff should be assessed for current state, known gaps, risk level, and suggested mission.

## Handoff Audit Matrix

| Handoff | Current State | Known Gaps | Risk | Suggested Mission |
| --- | --- | --- | --- | --- |
| PM Company -> Staff Assignment -> Operations | PM Company relationships and staff assignment management exist. | Assignment-to-operations visibility and staff work routing need validation. | Medium | `audit/pm-company-to-operations-continuity-v1` |
| Lease -> Renewal -> Vacancy | Lease and renewal surfaces exist, but renewal visibility appears reduced after Dashboard V2.0 changes. | Renewal-to-vacancy transition is not first-class. | High | `audit/lease-renewal-route-visibility-v1` |
| Vacancy -> Public Listing -> Inquiry | Vacancy publishing is roadmap, not current production capability. | Source of truth, publish approval, safe projection, and inquiry intake need definition. | High | `audit/vacancy-publishing-source-of-truth-v1` |
| Application -> Screening -> Approval | Application and screening foundations exist. | Manual screening workflow and automated dispatch are not demo-ready as complete production flows. | High | `audit/screening-provider-readiness-v1` |
| Approval -> Lease -> Signing | Lease drafting/signing workflows exist. | Handoff from approved application into lease execution needs audit before demo scripting. | Medium | `audit/application-to-lease-handoff-v1` |
| Signing -> Active Lease -> Tenant Portal | Signed lease and tenant portal paths exist. | Signed-document missing/cancelled states require hardening. | High | `fix/lease-signed-document-retrieval-and-cancelled-state-v1` |
| Maintenance -> Contractor -> Invoice/Expense | Maintenance and contractor-related foundations exist. | Contractor organization model is future; invoice/expense continuity is not RC1-ready. | Medium | `audit/maintenance-contractor-expense-continuity-v1` |
| Payment -> Receipt -> Ledger/Export Future | Payment surfaces and export strategy exist. | PAD, ledger reconciliation, and accounting export are future work. | High | `audit/payments-pad-readiness-v1` and `feat/accounting-export-framework-v1` |
| Evidence/Audit Continuity Across Workflows | Audit and evidence foundations exist. | Cross-workflow evidence package and enterprise audit review are not productized. | Medium | `audit/rc1-workflow-continuity-v1` |

## Continuity Principles

RC1 handoffs should:

- preserve actor attribution
- preserve append-safe history
- avoid raw internal IDs as labels
- distinguish demo-ready behavior from roadmap behavior
- fail closed on authorization or projection ambiguity
- keep tenant-facing and landlord-facing views consistent

## Required Audit Output

The RC1 workflow audit should produce:

- confirmed source-of-truth object for each handoff
- route or UI surface where each handoff is visible
- missing states
- blocked or broken transitions
- unsafe projection risks
- recommended mission order

## Acceptance Criteria

- every demo handoff has an explicit readiness assessment
- high-risk gaps are linked to missions
- no implementation is started from the audit plan itself
- roadmap-only flows are labelled honestly during demos
