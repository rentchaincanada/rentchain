# Enterprise Migration Strategy v1

Status: planning only; no import implementation or customer-data migration

## Why Transition Risk Matters

For a 3,000-unit operator, switching cost is operational risk: data mapping, accounting continuity, staff training, tenant disruption, integrations, support, close periods and the inability to unwind a failed cutover. RentChain should remove the big-bang decision.

The adoption promise should be:

> Start beside Yardi as a governed workflow, evidence and PAD-readiness layer; expand only after reconciled pilot results.

## Coexistence And Source Of Truth

Before importing data, agree a field-level ownership matrix.

| Domain | Initial authority | RentChain role |
| --- | --- | --- |
| Legal entity/accounting books | Existing PMS/accounting system | Reference mapping and governed exports only. |
| Property/unit master | Existing PMS initially | Imported canonical RentChain records with external IDs as attributes, reconciled changes. |
| Tenant/lease baseline | Existing PMS at cutover | Workflow context; lease lifecycle becomes authoritative only where explicitly contracted. |
| Applications/new workflow evidence | RentChain for pilot scope | Primary workflow/evidence record, export summaries back to incumbent process. |
| Maintenance pilot workflow | Agreed per property group | Operational record with export/reconciliation. |
| PAD mandate/payment evidence | Processor plus RentChain workflow/reconciliation | Processor is execution evidence; lease/obligation ownership remains explicit. |
| General ledger and close | Existing accounting system | Export payment/adjustment batches; no native GL claim. |

Never use external identifiers as RentChain primary keys. Preserve them as scoped mapping attributes. Conflicts go to review, not last-write-wins automation.

## Minimum Import Capability

Start with versioned CSV templates and a two-step preview/apply workflow. An API or Yardi-specific adapter can follow after canonical contracts are stable.

### Priority 1: pilot baseline

- organizations/property groups and properties;
- units with human-readable labels and occupancy status;
- tenant identities/contact data with minimization and lawful-purpose review;
- leases, parties, dates, rent, deposit and lifecycle state;
- starting balances as dated opening entries, never fabricated transaction history;
- external source/system/record references and import batch provenance.

### Priority 2: continuity context

- payment history summarized or transaction-level where legally and operationally justified;
- maintenance history, open work and vendor/contractor mapping;
- documents only after classification, consent/access and storage rules are approved;
- renewal, notice and move-in/out context.

### Import controls

1. Upload to an isolated, access-controlled staging area.
2. Parse without mutation; validate encoding, schema, required fields, types and enumerations.
3. Normalize dates/time zones, currency amounts and addresses deterministically.
4. Match through explicit external-reference mappings; flag duplicates and ambiguous identities.
5. Produce row errors, warnings, proposed creates/updates and financial control totals.
6. Require an authorized operator to approve an immutable preview fingerprint.
7. Apply idempotently in bounded batches with append-safe audit events.
8. Produce a signed-off reconciliation report and rejected-row file.
9. Support correction through superseding imports/reversals, not destructive history rewrites.

## Yardi And Other PMS Inputs

Accept customer-produced CSV/export files first. Do not promise direct Yardi connectivity until the customer edition, licensed interface, credentials, permitted use, field contracts, rate limits and support ownership are known.

Build a provider-neutral canonical import contract before a Yardi adapter. Each adapter should translate external fields, never leak vendor semantics into product identity or authority logic. Store source system, export timestamp, external reference and transformation version for reconciliation.

## Parallel-Run Strategy

```text
discovery and field ownership
  -> sanitized sample mapping
    -> full dry-run and control totals
      -> bounded property-group import
        -> 60-90 day parallel workflow
          -> weekly reconciliation
            -> expand, hold or exit
```

During parallel run:

- the incumbent remains authoritative for agreed master/accounting domains;
- staff avoid double entry through a written operating procedure and assigned reconciliation owner;
- RentChain exports agreed changes/outcomes on a fixed cadence;
- exceptions are logged and resolved with actor/reason evidence;
- no automated bidirectional sync is introduced in the first pilot;
- a freeze/cutover window is used only if a domain later transfers authority.

## Staged Rollout

1. **Discovery:** inventory systems, data owners, volumes, quality, integrations, close calendar, retention and privacy constraints.
2. **Sample mapping:** use synthetic or minimized samples; approve mapping and source-of-truth matrix.
3. **Dry run:** import a production-shaped export into a non-production isolated environment; reconcile counts and totals.
4. **Pilot group:** select a representative but bounded property group and train named champions.
5. **Parallel run:** operate selected workflows with weekly data and process reconciliation.
6. **Controlled expansion:** add property groups only when prior acceptance gates pass; preserve cohort/version tracking.
7. **Optional domain cutover:** transfer authority one domain at a time with freeze, final delta, sign-off and rollback plan.

## White-Glove Onboarding

Enterprise onboarding is a service, not only an import screen. Assign an implementation lead, customer data owner, security/privacy contact, workflow champion, support owner and executive sponsor.

Checklist:

- contract, DPA/security review and permitted data approved;
- system/data inventory and field ownership signed;
- staff roles and least-privilege access approved;
- import templates, mappings, control totals and rejection policy approved;
- sandbox/dry-run evidence accepted;
- training and operating procedures completed;
- support severity/escalation and communication channels agreed;
- go-live, reconciliation, rollback/export and deletion responsibilities agreed;
- weekly pilot review and final outcome review scheduled.

A one-time migration/implementation fee is justified because mapping, cleanup, rehearsal, training and reconciliation are material services. Quote by sources, domains, record volume, data quality, documents/integrations and support—not units alone.

## Fear-Reduction Commitments

- No portfolio-wide commitment before a bounded pilot.
- No forced replacement of accounting/PMS authority.
- Preview before mutation and customer-readable rejection reports.
- Reconciled counts and financial control totals at every batch.
- Stable exports and a documented exit path.
- Clear separation of current capability, configured pilot behavior and roadmap.
- Named human support and no hidden autonomous remediation.
- Expansion gates based on evidence, not sunk cost.

## Migration Acceptance Gates

- 100% of imported rows accounted for as accepted, warned or rejected.
- Property, unit, tenant and lease counts reconcile to approved source extracts.
- Starting-balance totals reconcile by property and in aggregate; opening entries are visibly distinct from transaction history.
- Duplicate/ambiguous identities are resolved by an authorized reviewer.
- Role and tenant projection tests show no cross-landlord or cross-tenant leakage.
- Re-running the same batch is idempotent.
- Export/rollback procedure is rehearsed.
- Customer data owner signs off before each rollout cohort.

## Deferred Work

- Automated bidirectional synchronization.
- Direct write-back to Yardi or accounting systems.
- Import of every historical document and message.
- Automatic identity merging.
- General ledger conversion or historical accounting reconstruction.
- Big-bang portfolio cutover.

These should remain future integration missions justified by pilot evidence.
