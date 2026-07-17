# PAD Go/No-Go Decision Table v1

Status: executive validation record; all gates begin open

## Decision boundary

This table decides whether RentChain may propose a separately authorized PAD beta implementation mission. It does not approve production release or a live debit. Provider, counsel, pilot, tenant, and internal evidence must describe the same participant roles, funds flow, jurisdiction, authorization model, and cohort.

| Gate | Required status | Evidence | Owner | Actual status/conditions |
| --- | --- | --- | --- | --- |
| Provider feasibility memo complete | `PASS` | Written feasibility, restrictions, event/timeline matrix, fees, support, unknowns | Payments lead | `OPEN` |
| Counsel go/no-go memo complete | `PASS` | Written counsel recommendation and approved/conditional deliverables | Legal owner | `OPEN` |
| No-custody funds flow confirmed | `PASS` | Provider-confirmed diagram, contracts, responsibility matrix, counsel review | Payments + counsel | `OPEN` |
| RPAA/FINTRAC/MSB risk reviewed | `PASS` or approved conditions that block live activity only | Activity-by-activity written legal analysis | Counsel + executive | `OPEN` |
| Pilot landlord selected | `PASS` | Named sponsor, decision makers, written interest/commitment | Enterprise lead | `OPEN` |
| Paid pilot accepted/negotiating | `PASS` or `PASS WITH CONDITIONS` | 60–90 day structure accepted or written negotiation with deadline | Executive + customer | `OPEN` |
| Limited property group selected | `PASS` | Property/unit/tenant cohort, province, source ownership, data inventory | Product + customer | `OPEN` |
| Tenant authorization copy tested | `PASS` | Counsel-reviewed copy and 3–5 comprehension-test results with critical issues closed | Product + counsel | `OPEN` |
| Sandbox access ready | `PASS` | Isolated provider access, fixtures, event simulations, secrets/teardown plan | Engineering + security | `OPEN` |
| Support playbook ready | `PASS` | Named owners, scripts, severity/escalation, cancellation/failure/complaint paths | Operations + counsel | `OPEN` |
| Audit/reconciliation plan ready | `PASS` | Event taxonomy, evidence chain, daily/period reconciliation, exception ownership | Engineering + finance | `OPEN` |
| Internal go/no-go meeting complete | `PASS` | Signed minutes, risk acceptance, conditions, expiry, next-mission scope | Executive sponsor | `OPEN` |

## Cross-gate commercial and migration facts

- The enterprise planning reference is $30/unit/year; 3,000 units equals $90,000/year.
- PAD supports enterprise value more directly than public small-landlord pricing and must not be placed in a low-cost flat monthly tier without review.
- Final pricing, provider costs, paid white-glove onboarding, and annualization willingness are validated in the pilot.
- The pilot runs beside Yardi/existing PMS, uses staged property groups, avoids forced full migration, and uses limited CSV/import/export only as needed.

## Mandatory warnings

- Do not reuse the legacy PAP prototype as production PAD.
- Do not let RentChain hold funds directly in the first implementation.
- Provider sandbox success is not legal approval.
- Do not begin live debit testing without counsel-approved authorization language.
- Do not publicly promise PAD until provider/legal/beta readiness is confirmed.
- Do not claim Certn is live unless the integration is actually live.

## Decision outcomes

| Outcome | When to use | Authorized next action |
| --- | --- | --- |
| `PROCEED TO PAD BETA IMPLEMENTATION` | Every critical gate passes and conditions are compatible with a bounded design | Draft a separate operator-approved implementation mission; no automatic coding or live debit |
| `EXTEND PHASE 0 VALIDATION` | Evidence is incomplete but no disqualifying risk is established | Assign missing evidence, owner, deadline, and expiry |
| `PAUSE — COMPLIANCE RISK` | Counsel blocks or material legal/privacy/insurance risk is unresolved | Stop implementation preparation until written resolution |
| `PAUSE — PROVIDER/FUNDS-FLOW UNCERTAINTY` | Eligibility, payee, settlement, custody, liability, returns, or reconciliation is unclear | Continue provider diligence or evaluate another provider |
| `PAUSE — LACK OF PILOT DEMAND` | No qualified landlord accepts a bounded paid pilot/value hypothesis | Reassess market need and pricing before payment work |

## Decision record

| Field | Entry |
| --- | --- |
| Decision/date | TBD |
| Provider/model/version | TBD |
| Pilot landlord/property group/province | TBD |
| Decision outcome | TBD |
| Critical evidence links | TBD |
| Conditions, owners, deadlines, expiry | TBD |
| Dissenting/blocking views | TBD |
| Executive/product/payments/legal/security/privacy/finance/operations approvals | TBD |

**Production PAD implementation must not begin until all critical gates are met.** A decision to proceed authorizes only the next governed beta implementation mission. A first live debit requires the later compliance, security, reconciliation, operational, provider, and production-readiness gates.
