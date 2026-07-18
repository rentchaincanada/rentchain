# Phase 0H Receivables Shadow Comparator Adoption v1

Status: architecture audit only; the Phase 0G comparator remains uninvoked and library-only

## 1. Executive summary

The Phase 0G comparator should remain library-only. It is not yet safe to connect it to a route, scheduled job, queue consumer, command, or other runtime diagnostic workflow.

Phase 0G proves that a pure function can enforce explicit enablement, an exact landlord allowlist, injected ownership assertions, source-completeness states, Phase 0E normalization, Phase 0C assembly, and exact legacy-balance parity while returning only seven non-financial status fields. It does not prove that a runtime caller can obtain one complete authoritative snapshot, independently calculate the legacy comparison, establish ownership without a permissive fallback, or operate and observe the comparison without leaking financial or scope data.

The safe adoption sequence is:

1. keep `compareReceivablesShadow` uninvoked in production;
2. implement an unmounted, backend-only source-snapshot and independent-parity adapter with injected read dependencies and exhaustive fixtures;
3. audit that adapter before selecting an invocation mechanism;
4. if the adapter is proven, prefer a manually initiated internal-only diagnostic job for an exact lease-level pilot over any HTTP route;
5. require another explicit approval before runtime registration, deployment enablement, or pilot execution.

A landlord-facing or exact-landlord-allowlisted shadow route is not recommended at this stage. A disabled diagnostic route still expands the authenticated HTTP attack surface and makes a future enablement error externally reachable. A job can be safer only if it has internal operator authority, an exact landlord-and-lease pilot manifest, bounded one-shot execution, no financial output, no durable financial result store, and no recurring schedule by default.

Tenant rent remains landlord/property-manager revenue, not RentChain revenue. The direct-settlement model remains unchanged. Rotessa, PAD, provider execution, bank data, money movement, custody, pooled funds, settlement float, and payout liabilities remain out of scope.

## 2. Current accounting foundation recap

The accounting sequence now consists of:

- **Phase 0 / PR #1396:** pure receivable transaction, schedule, fingerprint, balance, aging, rent-roll, and reversal primitives;
- **Phase 0B / PR #1397:** separation of lease, tenant, property rent-roll, aging, statement/export, and support read models;
- **Phase 0C / PR #1398:** pure landlord-safe DTO assembly with nullable display fields, explicit source states, and legacy-balance equivalence;
- **Phase 0D / PR #1399:** ownership, source-authority, completeness, parity, and default-off route gates;
- **Phase 0E / PR #1400:** pure legacy evidence normalization, explicit precedence, linkage-based deduplication, and fail-closed ambiguity;
- **Phase 0F / PR #1401:** conditional shadow-route readiness rules and the requirement for authoritative loading plus independent parity;
- **Phase 0G / PR #1402:** a pure, unmounted comparator that composes Phase 0E and Phase 0C and returns a minimal non-financial result.

No accounting route, job, loader, UI, provider integration, or money movement was introduced by this sequence. The existing lease ledger remains the production behavior.

## 3. What Phase 0G comparator proves

For supplied in-memory inputs, `compareReceivablesShadow` proves:

- disabled/default-off behavior unless `enabled` is exactly `true` or `"true"`;
- denial for missing, empty, malformed, wildcard, or non-matching allowlists;
- exact, case-sensitive landlord membership;
- exact alignment among requested landlord, ownership proof, normalization scope, DTO lease, and DTO property;
- identity sources must be `complete` and evidence sources must be `complete` or `empty_confirmed`;
- `unavailable`, `ambiguous`, and `truncated` sources fail closed;
- Phase 0E must return complete normalization without error findings;
- the legacy projection must be marked available and contain a safe-integer balance;
- Phase 0C must return an exact equivalent, complete DTO with available/non-stale schedule, balance, aging, and rent-roll projections;
- a one-cent mismatch fails;
- the success response is limited to `ok`, `enabled`, `allowed`, `status`, `reasonCode`, `warnings`, and `comparisonVersion`;
- the comparator itself has no Express, Firebase, Firestore, environment, provider, payment-mutation, or network dependency.

The comparator is deterministic for deterministic inputs and is suitable as a final pure gate inside a future controlled diagnostic pipeline.

## 4. What Phase 0G comparator does not prove

Phase 0G accepts assertions; it does not establish their production truth. It does not prove:

- verified Firebase authentication or a strict runtime audience;
- Firestore-authoritative lease ownership;
- that property, unit, tenant, and responsibility records came from the same authorized scope;
- that the in-memory lease fallback cannot be reached by a caller;
- that source reads distinguish confirmed empty from caught error, timeout, partial response, or truncation;
- that all overlapping legacy collections were read from one compatible as-of boundary;
- that the supplied legacy balance was calculated independently from Phase 0 projections;
- that the legacy calculation is category-compatible beyond net balance;
- that caller-supplied configuration came from governed server configuration;
- that enablement/allowlist checks occur before database reads;
- that a route or job emits no financial, identifier, allowlist, or raw-record telemetry;
- that a runtime invocation produces no writes, provider calls, notifications, decisions, or audit-domain mutations;
- that concurrency, timeout, retry, rate, batch size, and cancellation are bounded;
- that a deployed kill switch disables invocation without a code change;
- that failures cannot create landlord/lease existence oracles;
- that a pilot sample is representative or parity-stable over time.

`IndependentLegacyReceivablesProjection` is a contract name, not proof of independence. A caller could accidentally derive both comparison sides from the same normalized transaction set. Runtime adoption must prevent circular parity through separate audited code paths and fixtures.

## 5. Invocation options

### Option A: remain library-only

**Current recommendation.**

Benefits:

- no runtime attack surface or new production reads;
- no risk of configuration drift exposing the comparator;
- no logging, retry, scheduling, or partial-read operational risk;
- preserves RC1 and existing ledger behavior exactly;
- permits the missing source-snapshot/parity adapter to be proven independently.

Limitations:

- parity is validated only through tests and fixtures;
- no observation of real legacy source combinations;
- no production-read readiness evidence.

This limitation is acceptable because runtime evidence would be unsafe or uninterpretable before authoritative input construction is proven.

### Option B: internal-only diagnostic job

**Preferred first invocation mechanism only after the adapter and another audit.**

Potential benefits:

- no landlord-facing HTTP endpoint;
- operator-controlled, bounded, one-shot pilot execution;
- an exact landlord-and-lease manifest can be reviewed before execution;
- concurrency, timeout, retry, and total record bounds can be fixed;
- results can be aggregated without returning a response to product users.

Risks:

- service identity may have broad Firestore access;
- a batch job can amplify a scoping error across many leases;
- scheduled recurrence or automatic retry can turn a diagnostic into an ungoverned process;
- job logs can leak identifiers or financial values;
- durable result storage may become an unreviewed financial dataset;
- job configuration may bypass the comparator’s landlord allowlist semantics.

Required posture: no recurring schedule, no broad portfolio scan, no wildcard, exact lease-level manifest, one approved environment, dry-run source-count preflight, zero writes, no financial output, and explicit operator start/stop approval.

### Option C: disabled internal diagnostic route

**Not recommended as the first invocation.**

A route enables targeted on-demand testing but creates an authenticated network surface, routing precedence, rate-limit, cache, enumeration, and error-shaping obligations. “Disabled” is configuration, not isolation. A malformed flag, middleware ordering error, or allowlist bug can make the endpoint reachable.

If considered later, it must be admin/internal-only—not a landlord endpoint—and must require workload identity or a separately approved support authority in addition to the global kill switch and exact lease-level pilot manifest. It must return only minimal non-financial status, use private/no-store caching, and share 404 semantics for disabled or unknown scope. Admin authority must not be converted into a landlord identity implicitly.

### Option D: exact-allowlist landlord shadow route

**Defer.**

This option best exercises real landlord authentication but has the highest risk of becoming a de facto financial API. Exact landlord allowlisting alone does not prove lease ownership and does not prevent UI or third-party discovery. It also exposes result codes whose differences may disclose source health or lease existence.

Do not implement this option until an internal job has proven stable exact parity, a separate route audit approves the information-disclosure model, and an operator explicitly authorizes landlord-accessible shadow invocation. It must remain default-off, non-financial, unlinked from UI, and removable without changing the legacy ledger.

### Comparison

| Option | External surface | Blast radius | Current readiness | Decision |
| --- | --- | --- | --- | --- |
| Library-only | None | Tests only | Ready | Keep now |
| Internal-only job | Internal execution | Potential batch scope | Not ready; adapter missing | Preferred future pilot |
| Disabled diagnostic route | Authenticated HTTP | Per request plus enumeration | Not ready | Defer |
| Exact-allowlist shadow route | Landlord HTTP | Product/API exposure | Not ready | Defer longest |

## 6. Recommended adoption path

### Stage 1: prove authoritative input construction

Implement a pure/unmounted source-snapshot and independent-parity adapter. It should use injected read interfaces, return explicit `complete`, `empty_confirmed`, `unavailable`, `ambiguous`, and `truncated` states, prohibit the in-memory lease fallback, and build the Phase 0G input without invoking the comparator from runtime.

The independent legacy projection must be calculated through the audited legacy signed-effect rules from the same immutable raw snapshot, not from Phase 0E normalized transactions or Phase 0 balance output.

### Stage 2: audit the adapter and pilot design

Review source query coverage, authority, independence, failure semantics, read cost, time bounds, telemetry, job identity, and exact pilot manifest governance. No invocation is implied by merging the adapter.

### Stage 3: internal one-shot diagnostic job

Only after explicit approval, register a manually initiated internal job with:

- global default-off kill switch;
- approved environment and service identity;
- exact landlord-and-lease manifest;
- fixed maximum leases, concurrency, timeout, and no automatic retry;
- immutable as-of date per execution;
- read-only dependencies and write-spy proof;
- minimal aggregate non-financial result counts;
- no recurring schedule and no route.

### Stage 4: reassess

Zero unexplained mismatches in fixtures and an approved bounded pilot is necessary but not sufficient for a route. A separate audit must decide whether any diagnostic route or landlord-accessible read is justified.

## 7. Ownership proof requirements

Before any invocation, ownership proof must be constructed server-side from an authoritative lease read:

1. authenticate the internal job/service identity or approved diagnostic caller;
2. resolve the exact approved landlord and lease from the immutable pilot manifest;
3. fetch the canonical lease without using the in-memory fallback;
4. require exact canonical lease `landlordId` equality;
5. verify the property belongs to the same landlord;
6. verify unit scope against the property, allowing no silent nested/standalone conflict;
7. verify tenant/responsibility relationship against the same lease and landlord;
8. validate every ledger/payment/intent/reconciliation/obligation/allocation record against landlord, lease, and property scope;
9. mark conflicting related records ambiguous rather than filtering them silently;
10. create the `independently_verified` proof only after all mandatory gates pass.

An internal service identity is not ownership proof. An allowlist is not ownership proof. A lease ID from a request, manifest, log, or UI is not ownership proof. Admin/support roles require an explicit diagnostic authority and must never be treated as the landlord account.

## 8. Allowlist governance

Any future runtime invocation requires layered scope controls:

- a global default-off kill switch;
- an exact canonical landlord allowlist;
- an exact canonical lease pilot manifest nested within each allowed landlord;
- an approved environment and service/caller identity;
- optional execution expiry and one-time approval token if the job framework supports them safely.

Rules:

- empty, whitespace, wildcard, malformed, duplicate-conflicting, or unknown configuration denies all;
- no email, domain, role, prefix, substring, regex, property-wide, portfolio-wide, or client-supplied matching;
- the lease manifest cannot expand implicitly to “all leases for landlord”;
- changes require named operator approval, peer review, reason, environment, expiry, and rollback owner;
- configuration values and manifest contents are secrets/restricted operational metadata and never response or log fields;
- expiry removes access automatically; renewal requires reapproval;
- the comparator’s internal landlord allowlist remains required even when the outer job manifest passed;
- enablement and scope checks occur before accounting source reads;
- every pilot invocation records non-sensitive governance metadata outside general application logs, without financial values or raw IDs.

## 9. Operational logging and observability

Observability must answer whether the diagnostic is safe and stable without becoming a financial record system.

Allowed bounded telemetry:

- comparison version and deployment revision;
- environment and invocation mechanism version;
- result category: `equivalent`, `disabled`, `not_allowed`, `ownership_unverified`, `source_incomplete`, `normalization_failed`, `legacy_parity_unavailable`, `dto_failed`, `parity_mismatch`, or `unexpected_error`;
- aggregate counts by result category;
- bounded execution duration, source-read duration, and record-count bands;
- source completeness categories without record contents;
- request/execution correlation ID generated for the diagnostic;
- kill-switch state as enabled/disabled, not allowlist contents.

Prohibited in general logs, metrics labels, traces, alerts, and client/job output:

- balances, charges, payments, credits, write-offs, adjustments, rent, deposits, aging, rent-roll, or schedule amounts;
- landlord, lease, property, unit, tenant, responsibility, payment, intent, reconciliation, allocation, transaction, provider, processor, or bank identifiers;
- names, addresses, emails, raw records, query payloads, Firestore paths, storage paths, fingerprints, canonical event keys, or allowlist/manifest contents;
- stack traces or database errors in externally visible output.

Use bounded metric labels only. Detailed diagnosis should occur by reproducing approved synthetic fixtures or through a separately authorized restricted support process, not by expanding production logs. Phase 0H does not authorize durable result storage. If later required, retention, access, encryption, deletion, and incident-response rules need a separate design.

## 10. Failed parity handling

A failed parity result is a diagnostic finding, never a reason to mutate data or choose one balance.

On mismatch, incomparability, source ambiguity, or source failure:

- return/record only the safe result category;
- suppress all financial output and internal DTOs;
- stop processing that lease;
- do not retry automatically unless failure is classified as transient under a separately approved bounded policy;
- do not edit ledger, payment, allocation, reconciliation, lease, or tenant records;
- do not create compensating transactions, adjustments, decisions, reminders, or notices;
- do not call a provider or infer settlement;
- do not select the legacy or Phase 0 value as authoritative for product display;
- do not continue to later dependent projections;
- count the result in bounded telemetry and require manual engineering/accounting review using approved fixtures;
- disable the pilot if mismatch, ambiguity, or unexpected-error thresholds exceed the approved zero/low threshold.

Parity failures must be classified into mapping defect, unsupported legacy category, source integrity conflict, query incompleteness, snapshot timing mismatch, or code defect without putting raw financial evidence in ordinary tickets or PR comments.

## 11. Security and data-exposure boundaries

- The comparator remains an internal library and its input type must not become an HTTP body schema.
- No caller may supply landlord, ownership, completeness, legacy balance, or normalized evidence as trusted client input.
- Future loaders resolve authority and data server-side from the approved manifest.
- No UI, frontend API helper, navigation, capability, dashboard, or ledger integration may probe the comparator.
- Any future output remains the seven-field non-financial comparator result or a stricter aggregate subset.
- Do not return `LandlordLeaseReceivablesDto`, transaction lists, source fingerprints, findings, query states, or record counts per lease.
- Disabled, unapproved, absent, and cross-scope cases must not expose an existence oracle.
- No caching across landlord, lease, as-of, deployment, schema, or source boundaries; diagnostic routes, if ever approved, use private/no-store.
- Enforce read-only dependency interfaces and deny mutation/provider imports through tests and scans.
- Apply least-privilege service identity, network restrictions, rate/concurrency bounds, and execution timeout before any runtime pilot.
- Treat configuration and pilot manifests as restricted operational data.

The diagnostic must not represent payment initiation, settlement, custody, payout, legal delinquency, collections eligibility, accounting close, bank reconciliation, or external certification.

## 12. Test requirements before any invocation

### Source adapter and independence

- authoritative owned lease, absent lease, and cross-landlord lease;
- proof that the in-memory fallback is never called;
- property/unit/tenant/responsibility conflicts fail closed;
- every source distinguishes complete-empty from unavailable, ambiguous, timed out, partial, and truncated;
- one immutable snapshot/as-of boundary feeds both calculations;
- independent legacy projection imports no Phase 0 balance, aging, rent-roll, DTO, or normalized-transaction projection;
- fixtures prove the two paths can disagree by one cent and the comparator catches it;
- overlapping ledger/payment evidence, two legitimate same-value payments, reversals, adjustments, write-offs, allocations, and future-dated records;
- no input mutation and deterministic output.

### Invocation governance

- global flag absent/false/malformed denies before reads;
- empty, wildcard, malformed, expired, or non-matching landlord/lease manifest denies before reads;
- admin, landlord, tenant, contractor, and arbitrary service identities cannot invoke unless the exact internal authority model permits them;
- cross-landlord and cross-lease scope cannot be inferred or enumerated;
- fixed batch, concurrency, timeout, and retry bounds;
- cancellation and kill switch stop further reads;
- environment/configuration state does not leak between tests.

### No-side-effect and output safety

- write spies cover Firestore create/set/update/delete, batch, transaction, event append, notification, message, decision, allocation, payment, and provider calls;
- exact output key tests for every result category;
- serialized output/log capture contains no financial field, raw ID, display label, provider/processor term, path, fingerprint, or internal finding;
- no durable result write unless separately authorized;
- legacy ledger API/UI fixtures remain unchanged;
- all Phase 0 through Phase 0G accounting suites remain green;
- backend build, forbidden-import scans, exact-head deployment checks, and read-only manual QA pass.

## 13. Manual QA requirements if a diagnostic route/job is later added

Manual QA is not required for this docs-only audit. Before an approved internal job:

1. deploy the exact PR head to a non-production or explicitly approved diagnostic environment;
2. verify default-off behavior results in zero source reads;
3. verify empty, wildcard, expired, and non-matching manifests result in zero source reads;
4. verify only the exact approved landlord/lease pair runs;
5. verify cross-landlord, cross-lease, missing, and ambiguous records fail without existence disclosure;
6. verify equivalent, mismatch, incomplete, and unexpected paths emit only safe categories;
7. capture logs/metrics and scan for financial values, raw IDs, paths, names, emails, fingerprints, provider terms, and stack traces;
8. compare Firestore and workflow state before/after to prove no writes or mutations;
9. verify no provider/network calls beyond approved database reads;
10. verify concurrency, timeouts, cancellation, and kill switch;
11. verify existing ledger routes and frontend behavior are unchanged;
12. remove or expire the pilot manifest after the run.

If a diagnostic route is later proposed, add authenticated negative tests, rate-limit/cache checks, route-order checks, and external response inspection. No production-data mutation or auth bypass is permitted during QA.

## 14. Non-goals

- No comparator invocation, route, job, command, queue consumer, scheduler, loader, or runtime registration in Phase 0H.
- No frontend UI, API helper, navigation, dashboard, ledger replacement, or landlord-visible financial read.
- No Firestore write, migration, backfill, schema change, or durable diagnostic result store.
- No payment, allocation, reconciliation, decision, notification, message, or workflow mutation.
- No Rotessa/PAD or other provider integration, credential, API call, webhook, polling, or status claim.
- No PAD mandate, authorization, scheduling, initiation, retry, return, cancellation, or payment-method collection.
- No tenant bank data, money movement, custody, pooled rent account, trust accounting, settlement float, payout, or landlord payout liability.
- No treatment of tenant rent as RentChain revenue.
- No public financial totals, aging, rent roll, schedule, tenant balance, statement, export, general ledger, tax, close, or bank reconciliation.
- No existing ledger or RC1 demo behavior change.

## 15. Recommended next PR, if any

Proceed with one unmounted backend foundation PR:

```text
backend/phase-0i-receivables-shadow-source-snapshot-adapter-v1
```

Proposed scope:

- define injected read-only source interfaces for lease, property, unit, tenant/responsibility, ledger, payments, intents, reconciliation, obligations, and allocations;
- construct an immutable source snapshot with explicit completeness states;
- prove authoritative landlord/lease/property scope without the in-memory fallback;
- calculate an independent legacy signed-effect projection from raw legacy evidence without importing Phase 0 balance/DTO outputs;
- build a `CompareReceivablesShadowInput` for tests only;
- add exact fixtures for empty, unavailable, ambiguous, truncated, overlapping, mismatch, and equivalent cases;
- keep the adapter unmounted, uninvoked, backend-only, and free of provider/mutation dependencies;
- add no route, job, environment variable, Firestore write, UI, or runtime registration.

If the adapter cannot establish independent parity without reusing Phase 0 normalized transactions or permissive route-local helpers, do not implement an invocation. Split the unresolved mapping into another pure audit/foundation step.

After Phase 0I, perform a separate adoption-readiness audit before registering an internal job. Phase 0I merge must not be treated as authorization to run against production or pilot data.

## 16. Risks and guardrails

| Risk | Consequence | Guardrail |
| --- | --- | --- |
| Injected assertion treated as authoritative | False readiness signal | Authoritative source adapter before invocation |
| “Independent” balance is circular | Parity always appears successful | Separate legacy signed-effect code path and disagreement fixtures |
| Internal job has broad service access | Cross-portfolio financial reads | Exact landlord-and-lease manifest; least privilege; fixed batch limit |
| Allowlist expands to all landlord leases | Unreviewed scope growth | Lease-level manifest; no implicit portfolio expansion |
| Diagnostic route accidentally enabled | Externally reachable internal workflow | Prefer job; route deferred; default-off kill switch |
| Query error treated as empty | False zero/equivalence | Explicit unavailable/truncated states |
| Snapshot timing differs | Spurious or hidden mismatch | One immutable raw snapshot and as-of date |
| Failed parity triggers correction | Accounting history corruption | Observation only; manual review; no mutation |
| Logs contain amounts or IDs | Financial/privacy exposure | Bounded categories; capture-and-scan tests |
| Durable results create shadow ledger | Unreviewed financial system of record | No result store; separate approval if ever needed |
| Automatic schedule/retry broadens execution | Uncontrolled repeated reads | Manual one-shot only; no recurrence; no automatic retry |
| Admin identity becomes landlord | Authority confusion | Separate internal diagnostic authority; never impersonate implicitly |
| Comparator output becomes product API | Premature financial exposure | No UI/route; seven-field maximum; separate promotion audit |
| Pilot success implies production readiness | Insufficient evidence | Bounded evidence only; explicit later audit and approval |

## Decision

Keep the Phase 0G comparator library-only and uninvoked. Do not add a route or job yet. The next safe PR is an unmounted Phase 0I source-snapshot and independent-parity adapter. If that foundation is proven and separately audited, a manually initiated internal-only diagnostic job with exact landlord-and-lease scope is the preferred first invocation. A diagnostic route and especially a landlord-accessible shadow route remain deferred.
