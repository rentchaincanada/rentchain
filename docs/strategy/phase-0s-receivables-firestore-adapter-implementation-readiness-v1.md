# Phase 0S Receivables Firestore Adapter Implementation Readiness v1

Status: implementation-readiness audit only; the Firestore source adapter remains deferred

## 1. Executive summary

Phase 0T is **not approved**. Phase 0R proves that RentChain can deterministically classify injected schema, index, IAM, completeness, consistency, pagination, redaction, rollout, rollback, and verification claims. It does not collect, authenticate, or independently verify those claims.

The repository still lacks production-shaped evidence for canonical persisted ownership and mappings, deployed exact-query indexes, a dedicated read-only execution identity, exhaustive queries, a cross-collection consistent-read boundary, and allowlist projection at the raw-read boundary. A synthetic fixture that makes the classifier return `ready` is a unit-test guarantee, not operational readiness.

The next safe step is another audit: `audit/phase-0t-receivables-schema-inventory-command-readiness-v1`. It should define the security and evidence contract for a future report-only inventory command. It must not implement that command, a Firestore adapter, schema writes, indexes, IAM, a job, route, or UI.

Tenant rent remains landlord/property-manager revenue, not RentChain revenue. Direct settlement remains the future payment posture. Rotessa, PAD, payment execution, bank data, money movement, custody, pooled accounts, payout liabilities, and settlement float remain out of scope.

## 2. Current accounting foundation recap

Phases 0 through 0R provide pure, unmounted accounting primitives; a safe DTO assembler; legacy normalization and parity fixtures; a disabled comparator; snapshot, runner, and authoritative receipt-driven cores; schema/query and rollout plans; and an injected-evidence readiness classifier.

None of these components reads or writes Firestore, invokes runtime accounting behavior, exposes financial data, or mounts a route, job, scheduler, or UI. Phase 0N remains the authority boundary: only complete, canonical, independently scoped read receipts may produce Phase 0I input.

## 3. What Phase 0R proves

Phase 0R proves that a pure classifier can:

- accept a versioned evidence manifest without Firestore or infrastructure dependencies;
- evaluate ten readiness domains deterministically;
- fail closed on missing, partial, ambiguous, conflicting, unsafe, or incompatible evidence;
- detect write-capable or privileged IAM, catch-to-empty behavior, post-read filtering, ambiguous caps, and unsafe rollback;
- return only non-financial status, reason codes, warnings, and next steps; and
- remain unmounted and side-effect free.

Its tests prove classifier behavior for constructed inputs. They do not attest that any target environment satisfies those inputs.

## 4. What Phase 0R does not prove

Phase 0R does not prove:

- the contents or compatibility rate of persisted records;
- that canonical landlord ownership and lease/property/unit/tenant mappings exist without aliases;
- that required indexes are checked in, deployed, built, and usable;
- that a dedicated identity exists or is denied writes, privileged access, secrets, Storage, and impersonation;
- that exact-scope queries exhaust every page without post-read filtering or catch-to-empty handling;
- that independent collection reads share a valid boundary under concurrent writes;
- that raw snapshots exclude bank, provider, credential, admin, document-path, and storage-path fields;
- that emulator fixtures reflect production-shaped legacy conflicts and volume; or
- that rollout, rollback, retention, logging, and operator controls work in an approved environment.

The classifier accepts asserted booleans and counts. Readiness evidence must therefore originate outside the component being classified and remain reviewable.

## 5. Required evidence before implementation approval

Phase 0T may be reconsidered only when an immutable, environment-specific, versioned manifest supplies independently produced evidence for every Phase 0R domain. Each claim needs a producer, collection time, approved environment, source revision, bounded scope, validation method, reviewer, and expiry rule.

Evidence is invalid when it is self-asserted by adapter code, derived from demo/in-memory fallback, produced by an incomplete scan, stale after schema/index/IAM changes, or summarized without retaining a protected verification record. The classifier must return `ready`, but that result is necessary rather than sufficient: security, data, infrastructure, and accounting reviewers must also approve the exact manifest.

## 6. Schema readiness requirements

The following must be measured against persisted, production-shaped data rather than fixtures:

- canonical `landlordId` and exact lease/property/unit/tenant mappings;
- supported schema and source-revision fields;
- cents, CAD, effective-date, kind, link, reversal, and responsibility semantics for financial evidence;
- explicit absence/not-applicable states rather than inferred mappings; and
- zero accepted records whose ownership or financial linkage depends on aliases, labels, email, current session, amount/date similarity, provider metadata, or document IDs.

Conflicting, unsupported, or ambiguous records remain quarantined and diagnostically ineligible. No compatibility percentage can make false ownership acceptable.

Current status: **blocked**. No approved inventory report or backfill evidence proves persisted compatibility.

## 7. Index readiness requirements

The six Phase 0P compound indexes must exist for `ledgerEntries`, `payments`, `rentPayments`, `paymentIntents`, `paymentReconciliationRecords`, and `leaseCreditAllocationRecords`, each using canonical landlord/lease scope, the approved deterministic date, and `__name__` ordering.

Readiness requires checked-in configuration, query-to-index review, deployment to the target environment, `READY` status, preview verification, realistic multi-page tests, and configuration drift checks. Emulator query success is insufficient because it does not prove production index enforcement or build state.

Current status: **blocked**. The required accounting query indexes have not been authorized or deployed.

## 8. IAM and execution-identity readiness requirements

A dedicated short-lived workload identity must be explicitly bound to the future controlled execution host. It must have the narrowest feasible Firestore read access and proven denial of document writes, batch/transaction writes, index administration, IAM changes, service-account impersonation/key creation, Secret Manager, Storage, provider access, and payment execution.

Client Firestore rules do not constrain Admin SDK access. If collection-level IAM cannot express the full boundary, host isolation, dependency removal, application allowlists, organization controls, and negative-permission tests are mandatory compensating controls. No developer-machine credentials or broad existing service identity may substitute.

Current status: **blocked**. The repository does not prove a dedicated, bound, read-only receivables identity.

## 9. Completeness and exact-query readiness

Every receipt query must use canonical landlord and lease predicates, deterministic order, explicit page size, cursor progression, and an exhaustion proof. Successful zero results must be distinguishable from denied, unavailable, timed-out, malformed, missing-index, inconsistent, cancelled, or capped reads.

Catch-to-empty behavior, authority-relevant post-read filtering, whole-collection reads, alias unions, and silent caps invalidate the receipt. Required direct documents and every evidence collection must report typed completeness metadata compatible with Phase 0N.

Current status: **blocked**. Existing application readers include patterns expressly rejected for financial authority, and no approved exact-query adapter exists.

## 10. Ownership-proof readiness

Ownership must come from a persisted canonical landlord-to-lease relationship read at the same approved boundary as the mapped lease, property, and unit evidence. Property-manager membership, route context, user claims alone, legacy owner aliases, labels, email, or the in-memory fallback cannot prove financial scope.

The operator/runtime identity proves permission to run diagnostics; it does not prove a landlord owns a lease. Cross-landlord, duplicate, missing, or changed ownership fails closed before financial evidence is normalized.

Current status: **blocked** pending measured canonical ownership coverage and exact-read proof.

## 11. Consistent-read and pagination readiness

Independent Firestore queries do not inherently provide one cross-collection snapshot. Implementation requires either a platform-valid read-only transaction within documented limits or a proven source-revision/high-watermark protocol. Every receipt must bind to that boundary, and concurrent changes must invalidate rather than silently mix snapshots.

Pagination must use immutable deterministic ordering, monotonic cursors, duplicate/gap detection, bounded resources, and explicit exhaustion. Reaching a cap is not completeness; it must fail closed.

Current status: **blocked**. No approved cross-source boundary or high-watermark protocol exists.

## 12. Unsafe-field exclusion and redaction readiness

Raw Firestore documents must be projected through per-collection allowlists before entering receipts, logs, errors, fixtures, or diagnostic artifacts. The projection must exclude bank and payment-method data, provider payloads and identifiers, credentials/tokens, admin/support-only fields, raw document/storage paths, unrelated PII, and free-form fields that may contain them.

Rejected-field tests must cover nested objects and arrays. Logs may contain only bounded reason codes, versions, environment classification, aggregate counts, and approved irreversible correlation digests. Financial totals and canonical internal IDs must not appear in ordinary telemetry.

Current status: **blocked**. Phase 0N validates injected receipts, but no concrete raw-snapshot projection has proven exclusion before receipt construction.

## 13. Required emulator and automated tests

Before Phase 0T approval, tests must cover:

- production-shaped compatible, legacy, conflicting, malformed, and restricted-field fixtures;
- all exact landlord/lease query shapes, empty results, multiple pages, equal timestamps, cursor boundaries, concurrent changes, cap exhaustion, and injected read failures;
- canonical ownership success and alias, post-filter, cross-landlord, missing-map, duplicate-map, and in-memory-fallback rejection;
- typed distinction between confirmed empty and every failure class;
- Phase 0N receipt construction, Phase 0I snapshot compatibility, Phase 0E normalization preflight, and exact Phase 0G parity using injected results only;
- negative dependency tests proving no writes, transactions with writes, provider calls, routes, jobs, schedulers, or UI imports;
- negative IAM tests in an approved non-production environment; and
- deterministic, non-financial logs and responses.

The emulator is necessary for query behavior but cannot prove deployed indexes, IAM, production data compatibility, or production consistency limits.

## 14. Production safety checks

No adapter may perform an exploratory production read merely to establish readiness. A separately approved, report-only inventory mechanism must first prove its identity, environment guard, immutable manifest, exact bounds, redaction, retention, abort thresholds, and non-financial output.

Before later production use, reviewers must verify environment/project identity, index readiness, negative permissions, manifest freshness, schema conflict counts, consistent-read behavior, query cost/latency limits, no-write telemetry, alerting, and a kill switch/default-off state. Existing ledger/payment routes and RC1 behavior must remain unchanged.

## 15. Rollout, rollback, and verification requirements

The sequence remains: inventory design and approval; report-only inventory; separately authorized schema compatibility work; additive index deployment; consistent-read protocol; dedicated identity; reclassification; then an unmounted/default-off adapter reconsideration.

Each gate requires its own PR and approval. Rollback means disabling the new isolated component or identity and reverting additive configuration; it must never delete accounting history, broaden identity fallback, or require a legacy route to consume new fields. Verification must compare checked-in and deployed state and rerun the exact evidence manifest after any relevant change.

## 16. Remaining blockers

| Domain | Status | Blocking evidence |
| --- | --- | --- |
| Persisted schema | Blocked | No approved exhaustive inventory or canonical-coverage report |
| Exact indexes | Blocked | Six required indexes not approved/deployed/verified |
| IAM | Blocked | No dedicated bound identity or negative-permission proof |
| Completeness | Blocked | No exact exhaustive source reader; unsafe legacy patterns remain |
| Ownership | Blocked | Canonical persisted coverage not independently measured |
| Consistency | Blocked | No cross-collection boundary/high-watermark proof |
| Pagination | Blocked | No concrete query implementation or exhaustion evidence |
| Redaction | Blocked | No per-collection raw-read allowlist projection proof |
| Operational controls | Blocked | No approved inventory host, manifest, logging, retention, or kill-switch evidence |

No single blocker is waived by Phase 0R returning `ready` for a synthetic fixture.

## 17. Implementation decision

Do not implement `backend/phase-0t-receivables-firestore-source-adapter-v1` yet. Schema/index/IAM readiness alone would still be insufficient without canonical ownership, exhaustive exact queries, consistent-read semantics, early unsafe-field exclusion, and controlled operational evidence.

Phase 0T may be approved only after all Section 16 domains have current independent evidence, Phase 0R returns `ready` for that exact immutable manifest, every required reviewer approves it, and the proposed adapter remains unmounted, default-off, read-only, backend-only, and unable to expose financial output.

## 18. Recommended next PR

The next branch should be:

`audit/phase-0t-receivables-schema-inventory-command-readiness-v1`

That docs-only audit should define whether a future report-only inventory command can safely collect schema and canonical-mapping evidence. It should specify execution identity, environment/operator guards, exact bounded query manifests, non-financial aggregate output, unsafe-field exclusion, retention, failure semantics, tests, and approval gates.

It must not implement the inventory command, read Firestore at runtime, write Firestore, add indexes or IAM, invoke Phase 0K, add a job/scheduler/route/UI, or approve the adapter. If that audit finds no safe evidence-collection mechanism, implementation remains deferred.

## 19. Non-goals

- No Firestore adapter, runtime read, or write.
- No schema migration, backfill, index, infrastructure, IAM, deployment, or persistence change.
- No diagnostic job, scheduler, route, or UI.
- No payment mutation, provider integration, Rotessa, PAD, bank data, or money movement.
- No landlord-visible balances, charges, payments, allocations, rent roll, aging, schedules, or tenant balances.
- No change to existing ledger/payment behavior or RC1 demo behavior.
- No treatment of tenant rent as RentChain revenue.
- No model of RentChain-held funds, pooled rent accounts, trust custody, landlord payout liabilities, or settlement float.

## 20. Risks and guardrails

| Risk | Guardrail |
| --- | --- |
| Synthetic readiness is mistaken for operational proof | Require independent, immutable, environment-specific evidence and reviewer approval |
| Alias or session context becomes ownership | Canonical persisted predicate and exact mapping only; fail closed |
| Partial reads become financial authority | Exhaustion receipts, typed failures, no catch-to-empty/post-filtering |
| Concurrent writes mix evidence | Approved transaction or source-revision/high-watermark boundary |
| Broad runtime identity enables mutation | Dedicated short-lived identity plus negative-permission tests |
| Raw documents leak restricted data | Per-collection allowlist projection before receipt/log construction |
| Index/emulator success is overstated | Verify deployed target indexes and production-safe query plans separately |
| Rollout couples schema, infrastructure, IAM, and adapter | Sequential PRs with explicit stop gates and phase-specific rollback |
| Accounting foundation becomes payment execution | Keep all provider, PAD, mutation, custody, and money movement out of scope |

Phase 0S therefore records a clear no-go for Phase 0T adapter implementation and narrows the next step to a docs-only audit of safe readiness-evidence collection.
