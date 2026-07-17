# Enterprise Pricing And Pilot Package v1

Status: strategic recommendation only; no approved pricing or entitlement change

## Pricing Conclusion

Current public plans (`Free`, `Starter`, `Pro`, `Elite`) are designed for smaller landlords; the documented maximum public price is `$79/month` or `$790/year`. That structure should remain simple. It is not an appropriate enterprise price once RentChain includes implementation, migration, portfolio governance, PAD operations, reconciliation, security review and premium support.

At `$79/month`, a 3,000-unit operator would pay only `$948/year`, or about `$0.32/unit/year`. That cannot plausibly fund enterprise onboarding, payment exceptions, compliance work and service commitments.

Enterprise should be contract-based and per-unit, with a minimum annual commitment. `$30/unit/year` is a useful reference, not approved public pricing:

```text
3,000 units x $30/unit/year = $90,000/year
```

## Packaging Recommendation

| Package | Customer | Commercial model | Scope |
| --- | --- | --- | --- |
| Public plans | Small landlords | Simple monthly/annual subscription | Current self-serve capabilities and limits. |
| Enterprise pilot | One selected property group | Fixed paid pilot fee, credited partly toward annual contract | Implementation, migration subset, workflow wedge, support and success measurement. |
| Enterprise core | Larger operators | Per-unit annual price with minimum ACV | Applications/lease/maintenance/portals, governance, evidence, exports, onboarding and support. |
| PAD module | Approved enterprise customers | Add-on or included above a higher floor; processor fees separate/pass-through as contracted | Mandates, schedules, debit lifecycle, reconciliation, receipts and exception operations after release. |
| Screening | Eligible customers | Usage-based credits/package fees | Provider cost plus platform workflow; consent and report-access controls. |

Do not insert “Enterprise” into legacy plan normalization or publish a number without a separate commercial approval. Safe public copy is `Custom`. `Starting at $30/unit/year` should appear only after margin, scope, minimums, processor economics and sales authority are approved.

## Price Scenarios For 3,000 Units

| Scenario | Unit price | Annual contract value | Use |
| --- | ---: | ---: | --- |
| Entry wedge | $20/unit/year | $60,000 | Narrow workflows, limited integrations/support; PAD fees/module extra. |
| Reference | $30/unit/year | $90,000 | Strong target for governed workflow, onboarding, support and enterprise operations. |
| Premium | $45/unit/year | $135,000 | PAD included subject to usage bands, advanced support/reporting and greater implementation scope. |

These are planning scenarios, not price commitments. Validate willingness to pay, cost-to-serve, provider fees, payment failure rates, screening economics and required support before selection.

## Recommended Commercial Mechanics

- Annual prepayment or committed annual contract, not casual monthly cancellation.
- Enterprise minimum ACV: test `$30,000-$50,000` during discovery; approve after pipeline validation.
- Unit bands with an annual true-up and an explicit definition of billable active/managed units.
- One-time implementation/migration fee based on complexity, provisionally `$15,000-$50,000+` for a 3,000-unit operator.
- Premium support priced separately or included only in higher bands, with named hours/severity targets rather than an unsupported 24/7 promise.
- Processor transaction/return fees separately disclosed; never hide volatile rail cost inside an unbounded flat price.
- Certn/other screening credits usage-based, with expiry/refund/provider-failure terms and no claim that Certn is currently live.

## PAD Monetization Options

| Option | Advantage | Risk | Recommendation |
| --- | --- | --- | --- |
| Included in enterprise core | Simple sales story. | Unbounded usage/support and return costs. | Include only with volume/exception limits at premium pricing. |
| Annual PAD module add-on | Aligns price with high-value capability. | More procurement complexity. | Best initial production model. |
| Per-successful-debit platform fee | Aligns with usage. | Variable bills and regulatory/tenancy fee sensitivity. | Consider only after legal review; do not charge tenants by default. |
| Processor fees plus platform subscription | Transparent cost allocation. | Requires clear reconciliation/invoicing. | Use as baseline contract treatment. |

## Proposed 60-90 Day Pilot

### Objective

Prove that RentChain can reduce workflow friction and create trusted records beside the incumbent PMS without requiring a portfolio-wide switch.

### Scope

- One landlord and one bounded property group, ideally 100-300 units rather than all 3,000.
- Applications, lease/move-in workflow, tenant portal, maintenance/contractor coordination and evidence/export.
- A migration subset with reconciliation to the incumbent PMS.
- PAD only if the beta exit gates are met; otherwise complete provider/design validation and sandbox demonstrations without live tenant debits.
- Screening only through a confirmed configured path; Certn remains excluded until implemented and approved.

### Delivery

- Weeks 0-2: discovery, data ownership, security/legal review, success baseline and import rehearsal.
- Weeks 3-4: configuration, training, synthetic/internal acceptance, reconciled production import.
- Weeks 5-10: live bounded use, weekly operating review, exceptions and measured adoption.
- Weeks 11-12: reconciliation, user feedback, outcomes, annual proposal and expand/hold/exit decision.

### Success Measures

- Import validation and reconciliation error rate.
- Application-to-decision and lease/move-in cycle time.
- Tenant activation and task completion.
- Maintenance acknowledgment/resolution time and exception aging.
- Evidence completeness and export success.
- Support incidents by severity and time to resolution.
- If PAD is authorized: mandate completion, successful debit, return/NSF, reconciliation and notice-delivery rates, with zero duplicate or unauthorized debits.

Targets must be agreed from the operator's baseline before launch.

### Commercial Structure

- Paid pilot, suggested discovery band `$15,000-$30,000`, based on migration and support scope.
- Define what portion is creditable toward a 12-month agreement signed within a fixed period.
- Processor/screening usage passed through or separately itemized.
- No custom feature promises outside a signed change process.
- Annual expansion option around the `$90,000/year` reference, adjusted for included modules, unit volume and support.

### Exit Criteria

Proceed to annual rollout only if security/compliance gates, data reconciliation, workflow adoption, support capacity and agreed outcome measures pass. Otherwise export customer data, document gaps and end or extend the pilot without forcing migration.

## Sales Guardrails

- Sell the wedge beside Yardi, not replacement parity.
- Show current, pilot, beta and roadmap states separately.
- Do not promise PAD dates before provider/legal design gates.
- Do not call Certn integrated.
- Do not promise full accounting, AP, bulk operations or 3,000-unit performance before validation.
- Attach every price to units, modules, implementation scope, service levels, usage and contract term.
