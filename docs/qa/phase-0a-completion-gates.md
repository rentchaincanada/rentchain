# Phase 0A QA Completion Gates

## Purpose

This document defines the Phase 0A sign-off gates for RentChain QA infrastructure. It is an operator review companion for the dashboard artifact index emitted at:

```text
test-results/qa-artifacts/qa-dashboard-index.json
```

The dashboard index is a read-only local or CI artifact. It does not approve releases, merge pull requests, deploy services, mutate data, or automate operator decisions. It consolidates Phase 0A evidence so reviewers can confirm that the QA foundation is complete before authorizing any future phase.

## Phase 0A Completion Scope

Phase 0A is complete when the repository contains and validates:

- authenticated Playwright role smoke coverage for tenant, landlord, and admin contexts
- deterministic storage-state fixture support and secure path-based injection guidance
- legacy smoke coverage that remains separate from authenticated role smoke
- mobile layout matrix coverage with known pre-existing admin layout blockers documented
- sanitized QA report artifacts from the Playwright reporter
- a dashboard artifact index that summarizes coverage, artifacts, sanitization, and sign-off gates
- runbook documentation for authenticated Playwright execution
- completion records in `.handoff/merge-log.md`

Phase 0A does not include live dashboards, CI gate automation, support-specific storage-state fixtures, token capture automation, deployment changes, or operator approval automation.

## Dashboard Artifact Index

The Playwright QA reporter writes two JSON artifacts under the configured output directory:

- `qa-report.json`
- `qa-dashboard-index.json`

The dashboard index aggregates the QA report and local artifact inventory into a single review surface. Operators should use it to inspect:

- role smoke coverage by tenant, landlord, and admin context
- mobile layout coverage and known blocker categorization
- artifact inventory and schema validation status
- sanitization audit results
- Phase 0A sign-off gate status

The index is append-safe as an operational record: once reviewed and attached to a sign-off decision, it should not be edited in place. Generate a new artifact for a new run.

## Sign-Off Gates

The dashboard index evaluates these gates:

| Gate | Expected result | Review action |
| --- | --- | --- |
| QA report artifact generated | `pass` | Confirm `qa-report.json` is present. |
| QA report schema validation | `pass` | Confirm schema validation passed. |
| Dashboard index generation | `pass` or `manual-review-required` during first write | Confirm `qa-dashboard-index.json` exists after the run. |
| Artifact sanitization audit | `pass` | Confirm no sensitive values were detected. |
| Tenant role coverage captured | `pass` when tenant smoke data exists | Confirm tenant routes and role boundaries were exercised. |
| Landlord role coverage captured | `pass` when landlord smoke data exists | Confirm landlord-owned boundaries were exercised. |
| Admin role coverage captured | `pass` when admin smoke data exists | Confirm admin/support-gated surfaces were exercised. |
| Role boundary coverage represented | `pass` when all three role summaries are present | Confirm tenant, landlord, and admin summaries exist. |
| Mobile layout baseline represented | `pass` or `manual-review-required` | Confirm mobile layout matrix output is present when the run includes it. |
| Known mobile blockers categorized | `pass` when known admin blockers are recorded | Confirm existing clipped-select limitations remain categorized as pre-existing. |
| Storage-state integration documented | `pass` | Confirm the authenticated runbook exists and remains current. |
| Artifact reporter integration | `pass` | Confirm reporter emitted dashboard index output. |
| Documentation completeness | `pass` | Confirm operator and schema docs exist. |
| CI readiness | `manual-review-required` | Future CI consumption requires a separate approved mission. |
| Operator sign-off | `manual-review-required` | Operator review is required before future phase authorization. |

Manual-review-required gates are not automatically blocking. They identify decisions that must remain human-reviewed, especially CI gate adoption and future phase authorization.

## Sanitization Review

The sanitization audit scans JSON artifacts without copying matched sensitive values into the dashboard index. Findings include:

- artifact path
- JSON path
- pattern name
- severity
- message

The audit fails on likely secrets, credentials, token-bearing strings, storage paths, or invalid JSON. Warning findings require review and should be resolved or explicitly accepted only when they are deterministic non-sensitive fixture values.

Operators should manually search generated JSON artifacts for high-risk strings before sign-off:

```text
Bearer
sk_
pk_
gs://
auth-token
storage-state
```

Storage-state JSON, screenshots, videos, traces, and private downloaded data must never be committed or attached to public review artifacts.

## Coverage Review

Review role coverage in `coverage.roles`:

- Tenant coverage should validate tenant-only workspace, lease, maintenance, message, and landlord/admin denial paths.
- Landlord coverage should validate owned property, unit, tenant, maintenance, and admin/tenant denial paths.
- Admin coverage should validate platform-wide admin visibility and support-gated operational surfaces without leaking sensitive raw payloads.

Review mobile coverage in `mobileBaseline`:

- Known pre-existing admin blockers are tracked separately from new regressions.
- New mobile layout failures must not be treated as part of the accepted baseline without a separate review decision.

## Operator Sign-Off Checklist

Before marking Phase 0A signed off:

1. Confirm `.handoff/merge-log.md` shows Phase 0A complete.
2. Run or review a Playwright artifact-producing run.
3. Confirm `qa-report.json` and `qa-dashboard-index.json` are valid JSON.
4. Confirm `signOffChecklist.gates` contains a status for every Phase 0A gate.
5. Confirm sanitization audit status is `pass`.
6. Confirm tenant, landlord, and admin role coverage summaries are present.
7. Confirm mobile known blockers remain categorized as pre-existing limitations.
8. Confirm generated artifacts contain no secrets, credentials, storage-state JSON, provider payloads, or private documents.
9. Confirm no CI/CD, deployment, auth, billing, entitlement, screening, Terraform, or Firestore rules changes were introduced by the capstone.
10. Record the reviewed dashboard index artifact path or CI artifact reference in the operator sign-off record.

## Phase Boundary

Phase 0A completion does not authorize future automation. Future phases require new mission authorization before adding:

- CI gate consumption of `qa-dashboard-index.json`
- scheduled QA jobs
- storage-state capture automation
- dashboard UI or backend services
- automatic operator approval or merge decisions

The dashboard index is the handoff artifact, not an approval engine.
