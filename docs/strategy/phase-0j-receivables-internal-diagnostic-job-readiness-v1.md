# Phase 0J Receivables Internal Diagnostic Job Readiness v1

Status: architecture audit only; no job, route, loader, persistence, or runtime invocation is authorized

## 1. Executive summary

A manually initiated internal-only diagnostic job is the preferred eventual invocation mechanism for the receivables shadow chain, but RentChain is not ready to register or run that job yet.

Phase 0I can validate an injected source snapshot, reject unverified/fallback ownership and unsafe evidence, preflight Phase 0E normalization, calculate an independent signed legacy effect, and emit a Phase 0G-compatible input only when safe. Phase 0G can then return a seven-field non-financial equivalence status. Neither component retrieves authoritative production data, authenticates an operator, enforces a job-level landlord-and-lease manifest, constrains execution, or controls runtime logging and persistence.

The next safe PR is therefore not a runnable job. It is an unmounted backend-only diagnostic runner core with injected interfaces for operator authorization, exact pilot manifest, authoritative snapshot provider, clock, telemetry sink, and cancellation. It may orchestrate Phase 0I and Phase 0G in tests, but it must not import Firestore, register a command/job/schedule, read environment configuration directly, or run from any route or deployed worker.

Only after that core and a real read-only snapshot provider are separately proven and audited should an operator-triggered one-shot diagnostic job be considered. A scheduled job and any HTTP route remain deferred.

Tenant rent remains landlord/property-manager revenue, not RentChain revenue. The direct-settlement model remains unchanged. Rotessa, PAD, provider execution, bank data, money movement, custody, pooled funds, settlement float, and payout liabilities remain out of scope.

## 2. Current accounting foundation recap

The foundation now includes:

- **Phase 0 / PR #1396:** deterministic receivable transaction, schedule, balance, aging, rent-roll, fingerprint, and reversal primitives;
- **Phase 0B / PR #1397:** separation of lease, tenant, property, aging, statement/export, and support read models;
- **Phase 0C / PR #1398:** pure landlord-safe DTO assembly and legacy-balance equivalence;
- **Phase 0D / PR #1399:** authorization, ownership, source-completeness, parity, and route gates;
- **Phase 0E / PR #1400:** pure legacy source normalization, explicit precedence, linked deduplication, and ambiguity failure;
- **Phase 0F / PR #1401:** default-off shadow-read readiness plan;
- **Phase 0G / PR #1402:** pure disabled/exact-allowlist comparator returning only non-financial status;
- **Phase 0H / PR #1403:** adoption audit keeping Phase 0G library-only and preferring a future internal job over HTTP;
- **Phase 0I / PR #1404:** pure source-snapshot validation and independent signed-effect adapter.

All components remain under `rentchain-api/src/lib/accounting`. There is no runtime source loader, job registration, schedule, queue consumer, command, route, UI, persistence, provider integration, or financial read exposure. The legacy ledger remains unchanged.

## 3. What Phase 0I enables

For injected inputs, `buildReceivablesSourceSnapshot` now enables:

- stable `receivables_source_snapshot_v1` contracts;
- exact comparator enablement/landlord-allowlist preconditions;
- authoritative-lease proof-source requirements;
- rejection of in-memory fallback, missing, and ambiguous ownership claims;
- exact landlord/lease/property scope alignment;
- lease/property/unit/tenant-responsibility mapping gates;
- required display and billing-term validation;
- CAD-only and monthly-only Phase 0 scope;
- explicit complete, confirmed-empty, unavailable, ambiguous, and truncated source states;
- source-batch kind integrity and empty-state consistency;
- recursive rejection of bank, provider/processor, admin-scope, path, credential, secret, and token fields;
- Phase 0E normalization preflight;
- an independent safe-integer signed legacy effect as of one date;
- deterministic reason codes, counts, and non-financial validation state;
- a nullable internal `CompareReceivablesShadowInput` emitted only for a ready snapshot;
- test-only in-memory compatibility with Phase 0G.

This is a strong pure boundary for rejecting unsafe snapshots before comparison.

## 4. What Phase 0I still does not permit

Phase 0I does not authorize or implement:

- Firestore reads or authoritative query helpers;
- proof that injected records came from one consistent production snapshot;
- authentication or authorization of an initiating operator/service;
- an exact landlord-and-lease pilot manifest outside the comparator’s landlord allowlist;
- environment, deployment, or kill-switch governance;
- job concurrency, maximum leases, timeouts, retry, cancellation, or idempotency;
- a command, Cloud Run job, queue consumer, scheduler, CI action, HTTP endpoint, or worker;
- runtime log, metric, trace, alert, or error-redaction enforcement;
- zero-write proof for a real service dependency graph;
- durable audit or diagnostic result retention;
- source read cost and index readiness;
- protection against a broad service identity scanning non-approved portfolios;
- evidence that the legacy signed-effect mapping covers real source variants;
- permission to execute against production or staging data.

`proofSource: authoritative_lease` remains an injected assertion until a separately audited provider constructs it from authoritative reads. Phase 0I rejects bad inputs but cannot prove the caller did not omit relevant records before labeling a batch complete.

## 5. Diagnostic job purpose

The only approved future purpose is to answer one narrow readiness question for a bounded approved pilot:

> Can one authoritative, complete legacy source snapshot produce an exact Phase 0C/0E receivables result equivalent to the independent legacy signed-effect view?

The job is not:

- a landlord balance endpoint;
- a ledger replacement or repair tool;
- a payment/reconciliation processor;
- a data migration, backfill, cleanup, or correction workflow;
- an accounting close, statement, rent roll, aging, or collections process;
- a monitoring daemon or production alert auto-remediator;
- a provider settlement verifier;
- a way to establish RentChain revenue or funds custody.

Its output is readiness evidence only. It must not affect any user-facing or operational decision.

## 6. Why internal-only job is preferred over HTTP route

A manually initiated job can constrain execution to an operator-approved manifest, fixed environment, one-shot run, fixed concurrency, and aggregate result. It creates no landlord-facing network endpoint and does not require HTTP existence/error semantics, caching, rate limiting, route precedence, or client capability discovery.

An HTTP route remains riskier because:

- configuration failure can make it externally reachable;
- callers can probe lease existence and result categories repeatedly;
- authentication middleware may treat admin/support identity as landlord authority;
- identifiers enter URL/access logs and tracing by default;
- retries, browser/API clients, and monitoring can create uncontrolled repeated reads;
- a non-financial endpoint can still become a de facto product contract;
- future UI integration pressure is higher.

A scheduled job is also not appropriate: recurrence expands scope over time, source changes make runs harder to compare, retry can amplify reads, and passive availability can turn diagnostic code into an operational dependency.

Preference order remains:

1. library-only now;
2. unmounted runner core and read provider foundations;
3. manually initiated internal-only one-shot job after another approval;
4. scheduled job deferred;
5. diagnostic or landlord HTTP route deferred longest.

## 7. Required invocation model

Any future job must be:

- disabled by default in every environment;
- registered only after explicit operator authorization;
- manually initiated for a single approved execution;
- one-shot, with no recurring schedule and no queue subscription;
- limited to an immutable exact landlord-and-lease pilot manifest;
- limited to a fixed small maximum lease count;
- fixed to one environment, deployment revision, schema/comparison version, and as-of date;
- read-only with an explicit dependency allowlist;
- fixed to low concurrency and bounded per-lease/whole-run timeout;
- no automatic retry by default;
- cancellable through an operator kill switch;
- incapable of expanding from landlord to all portfolio leases;
- incapable of accepting arbitrary runtime IDs from a public request;
- incapable of returning or persisting financial values.

Execution phases should be: authorize operator -> validate global gate -> validate exact manifest -> dry-run scope/count preflight -> construct authoritative snapshot -> Phase 0I -> Phase 0G -> aggregate safe category -> terminate. Any failure stops that lease; gate/manifest failures stop the entire run before source reads.

## 8. Who may initiate the job

The initiator must be a named internal operator using a separately defined diagnostic permission. Existing landlord, tenant, contractor, billing-admin, or generic support roles are insufficient.

Required initiator controls:

- verified workforce identity with phishing-resistant MFA where available;
- membership in a narrowly scoped diagnostic operator group;
- explicit accounting-diagnostic permission separate from deployment/admin roles;
- production access approval under least privilege;
- a second reviewer for production pilot manifest changes and job invocation;
- reason, ticket/change reference, environment, expiry, rollback owner, and expected lease count;
- no shared account, static public token, client-supplied role, or implicit admin-to-landlord impersonation;
- invocation attribution in restricted governance records without including financial data or raw manifest IDs in ordinary logs.

The job service identity is a machine executor, not an initiator and not landlord ownership proof. CI identities and application runtime identities must not initiate production diagnostics automatically.

## 9. Exact allowlist governance

Runtime scope requires all of these gates:

1. global job-enabled flag, default false;
2. approved environment and deployment revision;
3. exact initiating operator identity/permission;
4. exact canonical landlord allowlist;
5. exact canonical lease list nested under each landlord;
6. short approval expiry;
7. fixed maximum leases and no wildcard expansion.

Rules:

- empty, whitespace, wildcard, malformed, expired, or unknown configuration denies all;
- no email/domain/role/prefix/substring/regex/property/portfolio matching;
- exact case-sensitive canonical identifiers only;
- duplicate entries are normalized only when identical; conflicting scope denies the manifest;
- a landlord entry with no leases grants nothing;
- no “all current leases” or query-generated expansion;
- manifest creation/change needs author and reviewer, reason, environment, expiry, and rollback owner;
- manifest and allowlist contents are restricted configuration, not log/metric/output fields;
- Phase 0I and Phase 0G inner allowlist checks remain active even after outer manifest validation;
- configuration is revalidated immediately before reads, not only at deployment;
- kill-switch changes stop new leases and prevent retry.

## 10. Input/source snapshot requirements

A future authoritative snapshot provider must:

- receive only the already-approved landlord/lease pair and one as-of date;
- read the canonical lease without the in-memory fallback;
- verify property, unit, tenant, and responsibility relationships server-side;
- read every required ledger, payment, intent, reconciliation, obligation, allocation, and independent legacy-effect source under exact scope;
- distinguish query success-empty from failure, timeout, ambiguity, and truncation;
- use one compatible snapshot/as-of boundary for both comparison paths;
- declare batch completeness only after pagination/result bounds prove no omitted records;
- reject cross-scope records rather than silently filtering integrity conflicts;
- map source records to Phase 0I contracts without provider/admin/bank/path fields;
- calculate independent legacy effects without importing Phase 0 balance, aging, rent-roll, DTO, or normalized-transaction output;
- avoid route-local helpers that catch errors as empty arrays or mix reads with writes/provider enrichment;
- return immutable inputs and never cache them across landlord/lease/date/version boundaries.

The job cannot proceed until this provider exists, is unmounted, is independently tested, and passes a separate architecture/security audit.

## 11. Ownership proof requirements

Ownership proof must be derived, not asserted:

1. validate the exact manifest landlord/lease pair;
2. fetch the canonical lease through an authoritative read interface;
3. require canonical lease `landlordId` equality;
4. fetch/verify the property under the same landlord;
5. verify unit membership or explicit no-unit state;
6. verify tenant/responsibility linkage to the same lease and landlord;
7. validate each evidence record against landlord, lease, and property;
8. reject ambiguous aliases and conflicting related records;
9. create `authoritative_lease` proof only after all gates pass;
10. pass the derived proof through Phase 0I and Phase 0G unchanged.

An internal operator, service identity, allowlist, manifest, lease ID, or successful query is not by itself ownership proof. Missing and cross-landlord leases must produce the same safe job category outside restricted diagnostics.

## 12. Non-financial output boundary

Per-lease diagnostic output may contain only a stricter subset of Phase 0G:

- comparison/job version;
- safe result category;
- boolean completed/allowed if needed internally;
- generic reason code;
- correlation token with no embedded scope.

Run-level output may contain only:

- job version and deployment revision;
- start/end timestamps and duration band;
- total requested/started/completed counts;
- aggregate counts by safe result category;
- cancelled/kill-switch state.

Do not output balances, amounts, charges, rent, deposits, payments, credits, adjustments, write-offs, allocations, aging, rent roll, schedules, tenant balances, transaction rows, source fingerprints, record-level counts tied to a lease, display labels, raw IDs, manifest contents, paths, provider/processor references, or internal DTOs/findings.

Do not return `InternalReceivablesSourceSnapshotPackage.comparatorInput`. Do not serialize Phase 0C DTOs. Console output, job APIs, build logs, notifications, tickets, and PR comments all inherit this boundary.

## 13. Logging and observability rules

Allowed bounded telemetry:

- job/comparison/snapshot versions and deployment revision;
- approved environment;
- safe result categories;
- aggregate category counts;
- duration and source-record count bands, not exact per-lease financial/source details;
- cancellation, timeout, and kill-switch counters;
- a random correlation ID not derived from landlord/lease/payment IDs.

Prohibited in ordinary logs, metrics labels, traces, alerts, errors, and output:

- any financial value or display string;
- landlord, lease, property, unit, tenant, responsibility, payment, intent, reconciliation, allocation, transaction, provider, processor, or bank identifiers;
- names, addresses, emails, raw records, query parameters, manifest contents, collection names, Firestore/storage paths, fingerprints, canonical event keys, or stack traces;
- high-cardinality labels or serialized errors that may contain query/scope data.

Use safe structured error categories and bounded labels. Capture-and-scan tests must inspect console, logger, metric, trace, and job-result sinks. Detailed investigation should reproduce synthetic fixtures; it must not broaden production logging.

## 14. Failed parity handling

Ownership, completeness, unsafe-source, normalization, DTO, and parity failures are observations only.

For any failure:

- suppress financial/internal output;
- emit only the safe category;
- stop processing that lease;
- do not choose the legacy or Phase 0 result;
- do not mutate ledger, lease, payment, allocation, reconciliation, tenant, or decision state;
- do not create adjustments, corrections, reminders, notices, tasks, or provider calls;
- do not retry automatically;
- do not continue to dependent projections;
- increment a bounded aggregate category count;
- require manual engineering/accounting review through synthetic/restricted evidence processes;
- cancel the pilot when mismatch, ambiguity, unsafe data, or unexpected-error thresholds are exceeded.

Recommended categories map one-to-one from Phase 0I/0G families without exposing record details: `ownership_failed`, `source_incomplete`, `source_ambiguous`, `unsafe_source`, `normalization_failed`, `legacy_projection_failed`, `dto_failed`, `parity_mismatch`, `equivalent`, `cancelled`, and `unexpected_error`.

## 15. Data retention and audit trail considerations

Phase 0J recommends **no diagnostic result persistence yet**.

- Do not write Firestore, object storage, analytics warehouses, tickets, spreadsheets, or message systems with per-lease results.
- Do not persist comparator inputs, snapshots, Phase 0C DTOs, raw evidence, financial values, fingerprints, or manifests.
- General telemetry follows existing short operational retention and contains only bounded aggregate categories.
- A restricted operator/change record may document authorization metadata: job version, environment, operator/reviewer, reason, expiry, requested lease count, start/end, cancellation state, and aggregate safe categories.
- That governance record must not contain raw landlord/lease identifiers in ordinary logs; the approved manifest remains in its controlled configuration/change system with its own access and expiry.

If durable diagnostic evidence becomes necessary, design access, encryption, retention, deletion, legal/privacy classification, incident response, append-only semantics, and redaction in a separate audit. A GET/job run must not create an accounting audit event merely because comparison occurred.

## 16. Test requirements before implementation

### Runner core and invocation gates

- default-off for absent, false, malformed, or unknown enablement;
- exact operator authority and second-review requirement;
- empty, wildcard, malformed, expired, cross-environment, and non-matching manifests deny before reads;
- exact landlord-and-lease scope, fixed maximum size, no portfolio expansion;
- deterministic version/as-of date and immutable manifest;
- cancellation and kill switch prevent later leases;
- concurrency, timeout, and retry bounds;
- injected dependencies only; no environment/global state leakage.

### Snapshot provider and ownership

- canonical owned, absent, and cross-landlord lease cases;
- in-memory fallback is never called;
- property/unit/tenant/responsibility ambiguity fails closed;
- complete-empty versus query error, timeout, truncation, and pagination overflow;
- cross-scope evidence cannot be silently filtered;
- all required source classes and independent legacy effects included;
- same immutable source/as-of boundary;
- independent legacy path imports no Phase 0 projection/DTO output.

### Phase 0I/0G orchestration

- every Phase 0I failure maps to a safe job category and prevents comparator execution;
- comparator runs only when `comparatorInput` exists;
- every Phase 0G result maps to a safe category;
- exact parity, one-cent mismatch, DTO failure, normalization failure, unsafe source, and legitimate empty snapshot;
- input objects are not mutated;
- all existing Phase 0 through Phase 0I tests remain green.

### No-side-effect and output safety

- spies deny Firestore writes, batch/transaction, provider calls, payments, allocations, decisions, notifications, messages, and audit-event appends;
- dependency/import scans deny route, scheduler, queue, provider, mutation, and frontend imports in foundation PRs;
- capture and scan all output/log/metric/trace/error sinks for financial fields, IDs, labels, paths, fingerprints, manifest contents, provider terms, and raw errors;
- exact output schemas and aggregate-only run summary;
- no durable persistence;
- existing ledger API/UI fixture compatibility;
- backend TypeScript build and exact-head deployment verification before any later pilot.

## 17. Manual QA / operator checklist if implemented

Manual QA is not required for this docs-only audit. Before any future job pilot:

1. verify exact reviewed commit/deployment revision;
2. verify global gate is off by default and produces zero reads;
3. verify operator identity, permission, reviewer, reason, environment, expiry, and rollback owner;
4. inspect exact landlord-and-lease manifest and maximum count;
5. verify no wildcard, property/portfolio expansion, or recurring schedule;
6. run dry-run scope/count preflight with no source reads beyond authority metadata if possible;
7. enable for one approved non-production/synthetic lease first;
8. verify authoritative ownership and no in-memory fallback;
9. verify equivalent and each fail-closed category emits only safe output;
10. scan logs, metrics, traces, alerts, console, and job result for prohibited data;
11. compare database/workflow/provider state before and after to prove no writes or mutations;
12. verify timeout, cancellation, and kill switch;
13. verify no retry or recurrence was created;
14. verify existing ledger and RC1 behavior are unchanged;
15. disable the job, expire/remove manifest, and confirm it cannot run again;
16. record only approved non-financial governance summary.

No production-data mutation, auth bypass, or broad portfolio query is permitted during QA.

## 18. Non-goals

- No job, runner registration, command, scheduler, queue consumer, route, loader, worker, or runtime invocation in Phase 0J.
- No frontend UI, API helper, navigation, dashboard, ledger replacement, or landlord-visible financial read.
- No Firestore write/read implementation, migration, backfill, schema change, or persistence.
- No payment, allocation, reconciliation, decision, notification, message, or workflow mutation.
- No Rotessa/PAD or other provider integration, credential, API call, webhook, polling, or status claim.
- No PAD mandate, authorization, scheduling, initiation, retry, return, cancellation, or payment-method collection.
- No tenant bank data, money movement, custody, pooled rent account, trust accounting, settlement float, payout, or landlord payout liability.
- No treatment of tenant rent as RentChain revenue.
- No public financial totals, aging, rent roll, schedule, tenant balance, statement, export, general ledger, tax, close, or bank reconciliation.
- No existing ledger or RC1 demo behavior change.

## 19. Recommended next PR, if safe

Proceed with a pure, unmounted foundation PR:

```text
backend/phase-0k-receivables-internal-diagnostic-runner-core-v1
```

Allowed scope:

- define immutable operator authorization and exact landlord-and-lease manifest contracts;
- define injected interfaces for snapshot provider, clock, cancellation, and non-financial telemetry sink;
- implement a pure/near-pure one-shot runner core that gates authorization/manifest before provider calls;
- orchestrate Phase 0I then Phase 0G only through injected inputs;
- map results to bounded non-financial categories and aggregate counts;
- enforce fixed batch, sequential/low-concurrency, timeout/cancellation, and no-retry semantics in deterministic tests;
- prove no persistence, provider/mutation, route, job-registration, environment, or Firestore dependency;
- keep the runner unregistered and uninvoked outside tests.

Do not add the authoritative Firestore snapshot provider or runnable job in the same PR. Those require separate audits because they introduce production read authority and operational identity. Phase 0K merge must not be treated as permission to deploy or execute a diagnostic.

If a useful runner core cannot be designed without importing a job framework, runtime configuration, or Firestore, remain library-only and defer implementation.

## 20. Risks and guardrails

| Risk | Consequence | Guardrail |
| --- | --- | --- |
| Injected authoritative claim is mistaken for a real read | False readiness | Separate audited snapshot provider before runtime job |
| Internal service identity has broad access | Cross-portfolio reads | Exact lease manifest, least privilege, fixed maximum |
| Job flag defaults open | Unapproved execution | Default false; malformed/empty denies all |
| Allowlist expands to all landlord leases | Silent scope growth | Nested exact lease list; no query expansion |
| Admin/support role implicitly authorizes run | Authority confusion | Separate operator permission and second reviewer |
| Snapshot omits a failed query | False equivalence/zero | Explicit unavailable/truncated states |
| Legacy comparison is circular | Parity always succeeds | Independent raw signed-effect path and mismatch fixtures |
| Job retries/schedules itself | Repeated broad reads | One-shot, no schedule, no automatic retry |
| Logs contain IDs or values | Privacy/financial exposure | Aggregate categories and capture-and-scan tests |
| Persisted result becomes shadow ledger | Unreviewed system of record | No persistence; separate retention audit |
| Parity failure triggers correction | Accounting corruption | Observation only; manual review; no mutation |
| Comparator input is serialized | Full internal financial exposure | Keep internal; exact output schemas; serialization tests |
| HTTP route is added for convenience | New external attack surface | Route explicitly deferred; internal job preferred |
| Pilot success becomes product claim | Premature readiness | Separate promotion audit and explicit approval |
| Runner foundation is treated as runnable | Governance bypass | Unmounted/unregistered code and forbidden-import scans |

## Decision

A manually initiated internal-only one-shot diagnostic job is the preferred eventual invocation mechanism, but it is not yet safe to implement or run. Phase 0I still depends on injected source truth, and no authoritative runtime snapshot provider or operator/job governance exists. Proceed only with an unmounted Phase 0K runner core using injected interfaces and non-financial result categories. Keep the comparator, adapter, and runner uninvoked from runtime until the read provider, job registration, and pilot are separately audited and explicitly authorized.
