# Phase 0L Receivables Internal Diagnostic Job Implementation Readiness v1

Status: readiness audit only; no job, scheduler, route, provider, persistence, or runtime invocation is authorized

## 1. Executive summary

It is **not yet safe** to implement or run a manually initiated internal-only receivables diagnostic job.

Phase 0K materially improves readiness: `runReceivablesDiagnostic` is a pure, unmounted orchestration boundary that validates injected enablement, exact landlord/lease/context scope, allowlist approval, operator intent, timestamps, snapshot scope, snapshot readiness, comparator version, and exact parity. It returns only eight non-financial fields and fails closed with deterministic reason codes.

The remaining blockers are outside that pure core:

1. no production snapshot provider independently proves authoritative ownership, source completeness, one as-of boundary, and independent legacy effects;
2. no runtime operator authorization mechanism proves that the injected operator intent and allowlist decision were approved rather than fabricated by the caller;
3. no reviewed job host, service identity, deployment gate, immutable manifest, kill switch, logging policy enforcement, or zero-write dependency graph exists;
4. no approved persistence and retention model exists for diagnostic outcomes.

The next step should be a docs-only Phase 0M authoritative source-provider and read-authority design audit, not a job implementation. After that design is approved, the provider should be implemented and tested as a separate unmounted, read-only module. Only then should job implementation readiness be audited again.

The direct-settlement model remains unchanged. Tenant rent is landlord/property-manager revenue, not RentChain revenue. Rotessa, PAD, bank data, payment execution, money movement, custody, pooled funds, settlement float, and payout liabilities remain out of scope.

## 2. Current accounting foundation recap

The accounting readiness sequence is:

- **Phase 0 / PR #1396:** deterministic receivable transactions, schedules, balances, aging, rent roll, fingerprints, and append-safe reversal rules;
- **Phase 0B / PR #1397:** read-model surface separation and projection boundaries;
- **Phase 0C / PR #1398:** landlord-safe lease-receivables DTO assembly and legacy balance equivalence;
- **Phase 0D / PR #1399:** route authorization, completeness, equivalence, and fail-closed gates;
- **Phase 0E / PR #1400:** legacy source normalization, precedence, deduplication, and ambiguity rejection;
- **Phase 0F / PR #1401:** disabled shadow-route readiness gates;
- **Phase 0G / PR #1402:** pure, default-off, allowlisted, non-financial shadow comparator;
- **Phase 0H / PR #1403:** adoption audit preferring a future internal job over a route;
- **Phase 0I / PR #1404:** pure source-snapshot adapter and independent legacy signed-effect input;
- **Phase 0J / PR #1405:** diagnostic job readiness audit and unmounted-runner prerequisite;
- **Phase 0K / PR #1406:** pure, unmounted diagnostic runner core.

All implementation remains under `rentchain-api/src/lib/accounting`. No Phase 0 component is mounted as a receivables route, job, scheduler, queue consumer, command, UI, production provider, or persisted diagnostic workflow. Existing ledger and RC1 behavior remain unchanged.

## 3. What Phase 0K runner core enables

For injected data, Phase 0K provides:

- a versioned `receivables_diagnostic_runner_v1` contract;
- explicit default-off diagnostic enablement;
- exact landlord, lease, and diagnostic-context matching;
- exact allowlist approval, reason, and optional date-only expiry checks;
- explicit operator identifier, display name, diagnostic intent, reason, and scope checks;
- injected UTC timestamp and date-only as-of validation;
- target-to-snapshot landlord/lease/as-of alignment;
- optional comparator-contract version pinning;
- Phase 0I snapshot construction only after outer gates pass;
- Phase 0G comparison only for a comparator-ready snapshot;
- deterministic, sorted fail-closed reason codes;
- a fixed eight-field response containing no target identifiers or financial values;
- no Firestore, Express, environment, timer, provider, scheduler, or job-framework dependency;
- focused tests for success and every specified failure family.

This is the correct orchestration seam for a future controlled invocation. It prevents a future host from bypassing the Phase 0I/0G chain accidentally if the host supplies honest, authoritative inputs.

## 4. What Phase 0K still does not permit

Phase 0K does not authenticate or authorize anyone. `operatorIntent` and `allowlistDecision` are data assertions, not security proof.

It also does not provide or authorize:

- Firestore or other authoritative production reads;
- proof that snapshot records came from complete queries;
- proof that all relevant pages and source families were included;
- proof that independent legacy effects are independent of Phase 0 projections;
- a consistent production read/as-of boundary;
- a service identity or least-privilege data-access policy;
- a job definition, command, worker, queue, scheduler, or deployment configuration;
- runtime enablement, environment binding, immutable manifests, or kill switches;
- operator MFA, group membership, approval workflow, or second review;
- concurrency, lease-count, timeout, retry, cancellation, or cost controls;
- enforced logging, metric, tracing, alerting, or serialization redaction;
- persistence, retention, deletion, or access-control policy for results;
- permission to execute against staging or production data.

A caller able to construct Phase 0K input could assert an approved operator and authoritative snapshot. A real job must derive and verify those facts outside the runner before invoking it.

## 5. Proposed internal diagnostic job concept

The eventual concept is a manually initiated, one-shot, internal diagnostic execution for a small immutable pilot manifest. Its only purpose is to test whether authoritative legacy evidence and the Phase 0 accounting projection are exactly equivalent for approved lease contexts.

The execution sequence should be:

1. authenticate and authorize one named internal operator;
2. verify a separate reviewer-approved change/ticket and unexpired pilot manifest;
3. verify global default-off enablement, environment, deployment revision, and kill switch;
4. validate the manifest before any source reads;
5. load one authoritative, complete, read-only snapshot for each exact landlord/lease pair;
6. construct injected Phase 0K input without trusting caller-supplied authority claims;
7. invoke Phase 0K once per approved lease;
8. map the eight-field response to bounded aggregate non-financial categories;
9. stop on configured unsafe/mismatch/error thresholds;
10. emit a redacted run summary and terminate.

The job is readiness instrumentation only. It must never repair data, choose an accounting truth, update a ledger, create a task, affect a tenant or landlord workflow, or trigger a provider action.

## 6. Why manually initiated internal-only job is preferred over route/scheduler

| Option | Readiness | Reason |
| --- | --- | --- |
| Library-only Phase 0K | Current safe state | No runtime reachability or production reads |
| Manual internal one-shot job | Preferred eventual first invocation | Bounded manifest, named operator, one revision, one run, no public endpoint |
| Internal HTTP route | Deferred | Adds probeable network surface, URL/access-log IDs, request retry, and route-auth complexity |
| Scheduled job | Rejected for first adoption | Repeats reads without fresh operator intent and can become an operational dependency |
| Landlord/admin UI | Rejected | Creates product-visible financial-read expectations and client exposure |

A one-shot job is preferable only after the remaining gates exist. “Internal” is not itself an authorization boundary, and a manual CLI command run with broad credentials is not an acceptable substitute for a governed job.

## 7. Operator/admin access requirements

The future initiator must satisfy all of these requirements:

- named workforce identity; no shared operator or static bearer credential;
- phishing-resistant MFA where supported;
- dedicated accounting-diagnostic permission, separate from landlord, support, billing, deploy, and generic admin roles;
- production access granted through least privilege and time-bound elevation;
- explicit reason, ticket/change reference, environment, revision, as-of date, expiry, expected lease count, and rollback/cancellation owner;
- second-person approval for the manifest and production invocation;
- separation between the human initiator and the machine service identity;
- no client-provided role, landlord impersonation, or conversion of admin authority into ownership proof;
- restricted authorization evidence outside ordinary application logs.

The job host must derive operator authority from the selected infrastructure/IAM control. Phase 0K receives a normalized intent record only after that authority succeeds. Failure or ambiguity denies the run before data reads.

## 8. Exact allowlist governance

The allowlist must be an immutable, reviewer-approved manifest for one run:

- exact environment and deployment revision;
- exact canonical landlord ID;
- exact canonical lease IDs nested under that landlord;
- exact diagnostic context `lease_receivables`;
- one date-only as-of date;
- author, reviewer, reason, ticket/change reference, created-at, and short expiry;
- fixed small maximum lease count;
- no wildcard, prefix, substring, regex, property-wide, portfolio-wide, or query-generated scope;
- no empty landlord granting all leases;
- no runtime discovery or expansion from a landlord to current leases;
- duplicate identical entries may be rejected or normalized deterministically; conflicting entries deny the run;
- malformed, expired, unknown, or partially loaded manifests deny before reads;
- manifest identity and contents stay out of ordinary logs and result payloads.

Outer job-manifest validation does not replace Phase 0K, Phase 0I, or Phase 0G allowlist and scope gates. All layers remain active.

## 9. Invocation method and operational controls

The future invocation should be a privately registered, one-shot job mechanism supported by the existing deployment platform, not an HTTP endpoint and not an application-start hook. The exact infrastructure choice requires a separate implementation design and security review.

Required controls:

- default disabled in every environment;
- explicit version-pinned operator invocation;
- one immutable manifest supplied through a controlled configuration channel;
- dry-run validation of operator, manifest, revision, count, and dependency policy before reads;
- small fixed maximum manifest size;
- sequential or explicitly bounded low concurrency;
- per-lease and whole-run timeouts;
- no automatic retry;
- no recurring schedule or queue subscription;
- cancellation/kill switch checked before reads and between leases;
- stop thresholds for unsafe source, ambiguity, parity mismatch, and unexpected errors;
- fixed memory/output bounds;
- zero interactive target input after the run begins;
- no execution from CI, deploy hooks, web requests, or application boot.

The first approved pilot should use synthetic or isolated non-production data. Production execution requires a separate explicit operator decision after environment QA.

## 10. Input/source snapshot provider requirements

The authoritative provider is the principal unresolved blocker. Before a job can be implemented, a separately audited and tested provider must:

- accept only an already validated exact landlord/lease/as-of tuple;
- use the canonical lease record and reject the in-memory fallback;
- prove lease and property landlord ownership server-side;
- prove unit, tenant, and responsibility mappings or explicit not-applicable states;
- query every ledger, payment, intent, reconciliation, obligation, allocation, and independent legacy-effect source required by Phase 0I;
- distinguish confirmed empty from permission denial, query failure, timeout, truncation, and pagination exhaustion;
- prove pagination and result bounds before declaring completeness;
- keep one compatible read/as-of boundary across all source families;
- reject cross-scope records instead of silently filtering them;
- strip bank, provider, credential, token, admin-scope, Firestore-path, and storage-path data before adapter input;
- derive independent legacy signed effects without Phase 0 balance, DTO, aging, rent-roll, or normalized output;
- return immutable injected data only;
- perform no writes, provider calls, cache mutation, reconciliation, or correction;
- expose typed failures that map to Phase 0K-safe categories without raw source details.

The provider should first be implemented as an unmounted read-only module with emulator/synthetic fixtures. Provider merge must not register or authorize a job.

## 11. Non-financial output boundary

The job may consume the Phase 0K eight-field response internally:

- `ok`;
- `status`;
- `reasonCodes`;
- `warnings`;
- `diagnosticVersion`;
- `snapshotVersion`;
- `comparatorVersion`;
- `checkedAt`.

External job output should be narrower. It may contain:

- run/job/diagnostic versions;
- approved environment and deployment revision;
- start/end timestamps and bounded duration category;
- requested, started, completed, rejected, equivalent, cancelled, and unexpected-error aggregate counts;
- bounded safe failure-family counts;
- cancellation/kill-switch state;
- random correlation ID not derived from business identifiers.

It must not contain balances, amounts, rent, charges, deposits, payments, credits, adjustments, write-offs, allocations, aging, rent roll, schedules, tenant balances, transactions, source counts tied to leases, DTOs, fingerprints, raw findings, names, addresses, manifest contents, or landlord/lease/property/unit/tenant/responsibility/provider/bank identifiers.

## 12. Logging and observability rules

Allowed telemetry is restricted to low-cardinality, non-financial run metadata and aggregate safe categories. The logger must use a typed allowlist projection; it must not serialize input objects, provider results, thrown errors, Phase 0I packages, Phase 0G inputs, or Phase 0C DTOs.

Rules:

- log version, environment, revision, correlation ID, bounded duration, aggregate status, cancellation, and safe error category only;
- do not place canonical IDs, manifest entries, financial values, display labels, source record counts per lease, query text, collection/document paths, stack traces, or payloads in logs;
- do not use business identifiers as metric labels or trace attributes;
- sanitize exceptions to a fixed error taxonomy;
- disable debug payload logging for the job;
- capture-and-scan tests must inspect stdout/stderr, structured logger, metrics, traces, job result, and error paths;
- alert only on bounded aggregate job state, not lease-specific outcomes;
- investigate failures with synthetic fixtures or separately governed restricted access, not broader logging.

## 13. Persistence policy for diagnostic results

The first diagnostic job must have **no application result persistence**.

- no Firestore, object storage, warehouse, spreadsheet, ticket, email, message, or analytics write containing per-lease or run results;
- no persistence of Phase 0K input/output, snapshots, comparator inputs, Phase 0C DTOs, normalized transactions, source counts, financial values, fingerprints, reason details, or manifest contents;
- no accounting audit event merely because a comparison ran;
- ordinary platform execution metadata may follow existing short infrastructure retention only after confirming it satisfies the logging boundary;
- the existing controlled change/approval system may retain authorization metadata, but it must not receive financial data or raw diagnostic payloads from the job.

If durable diagnostic evidence later becomes necessary, it requires a separate persistence/retention audit. The maximum future candidate would be run-level non-financial metadata: version, environment, revision, random correlation ID, operator/reviewer governance reference, timestamps, aggregate safe categories, and cancellation state. Per-lease persistence remains deferred.

## 14. Failure handling and fail-closed rules

| Failure | Required behavior |
| --- | --- |
| Operator/approval/manifest invalid | Deny entire run before source reads |
| Disabled, wrong environment, wrong revision, expired approval | Deny entire run |
| Kill switch or cancellation | Stop before next read; no retry |
| Ownership or scope failure | Stop lease; safe category only |
| Incomplete, truncated, failed, or ambiguous source | Stop lease; never interpret as empty or zero |
| Unsafe source data | Stop lease and pilot threshold; suppress payload |
| Unsupported currency/frequency | Stop lease; no inferred conversion or schedule |
| Phase 0E normalization failure | Stop lease; no transaction selection |
| Phase 0C DTO failure | Stop lease; no partial projection |
| Phase 0G disabled/not allowed/not ready | Stop lease; preserve inner gate result family |
| Parity mismatch | Stop lease; do not choose or repair either balance |
| Unexpected provider/runner exception | Sanitize to `unexpected_error`; stop or cancel threshold |
| Output/log projection failure | Fail the run; do not fall back to raw serialization |

No failure may mutate ledger, payment, allocation, reconciliation, lease, tenant, decision, task, notice, or provider state. There is no automatic remediation and no automatic retry.

## 15. Test requirements before implementation

### Operator and invocation gates

- absent, false, malformed, or unknown enablement denies before reads;
- unauthorized, expired, missing-MFA/elevation, shared, or service-only identity denies;
- missing second approval denies production execution;
- wrong environment/revision/as-of date denies;
- empty, wildcard, malformed, expired, oversized, duplicated-conflict, cross-landlord, and expanded manifests deny;
- provider is never called for denied runs;
- cancellation and kill switch stop subsequent reads;
- fixed concurrency, timeout, maximum leases, and no-retry behavior are deterministic.

### Provider and ownership

- authoritative owned, absent, and cross-landlord lease cases;
- in-memory fallback is unreachable;
- property/unit/tenant/responsibility missing and ambiguous cases;
- confirmed-empty versus error, permission denial, timeout, truncation, and pagination overflow;
- every required source family is queried and declared explicitly;
- cross-scope evidence fails instead of being filtered;
- independent legacy effects do not import Phase 0 projections;
- immutable same-as-of snapshots;
- unsafe field/path/provider/bank/credential data is stripped or rejected;
- dependency graph proves read-only behavior.

### Runner, output, and operations

- every Phase 0K reason maps to one bounded job category;
- Phase 0K is invoked only after outer authority and provider success;
- exact equivalence, one-cent mismatch, normalization, DTO, source, and ownership failures;
- response, logs, metrics, traces, alerts, exceptions, cancellation, and platform output pass forbidden-data scans;
- raw errors and inputs cannot be serialized even when projection code fails;
- no job result persistence or application write path;
- no route, scheduler, queue, provider mutation, or payment dependency;
- all Phase 0 through Phase 0K tests remain green;
- backend production build passes.

## 16. Manual QA/operator checklist

If a job is eventually implemented, QA must use the exact candidate revision in a non-production environment first.

### Before execution

- verify named operator and second reviewer;
- verify diagnostic permission, time-bound access, environment, revision, and change reference;
- inspect exact small landlord/lease manifest in the restricted control plane;
- verify no wildcard/expansion, unexpired approval, fixed as-of date, and maximum count;
- verify default-off state, explicit one-run enablement, kill switch, no schedule, and no retry;
- verify service identity is read-only and cannot access unrelated collections/provider systems;
- verify expected Phase 0K/snapshot/comparator versions;
- verify log/metric/trace sinks and retention configuration.

### During execution

- confirm dry-run gates pass before any source reads;
- confirm only approved entries start and concurrency remains bounded;
- confirm output contains only safe aggregate categories;
- exercise cancellation and confirm later entries do not start;
- confirm failures do not retry or trigger mutations.

### After execution

- scan stdout/stderr, job output, logs, metrics, traces, alerts, and platform metadata for IDs, financial values, paths, and raw errors;
- confirm zero Firestore/application writes and zero provider/payment calls;
- confirm no durable diagnostic result was created;
- confirm no route/UI/ledger/RC1 behavior changed;
- disable the job and expire/remove the manifest and temporary access;
- record only approved governance metadata in the controlled change system;
- require separate approval before any production pilot.

## 17. Non-goals

- No job, command, worker, queue consumer, scheduler, route, or UI in Phase 0L.
- No Firestore read or write and no production snapshot provider.
- No Phase 0K runtime invocation.
- No result persistence or new accounting audit event.
- No landlord/admin receivables endpoint or financial read exposure.
- No change to legacy ledger, payments, allocations, reconciliation, leases, tenants, or RC1 behavior.
- No Rotessa, PAD, payment method, bank data, mandate, debit, settlement, payout, webhook, or provider integration.
- No money movement, custody, pooled rent account, trust account, RentChain-held funds, settlement float, or landlord payout liability.
- No treatment of tenant rent as RentChain revenue.
- No autonomous correction, retry, remediation, task, notice, reminder, or workflow mutation.

## 18. Recommended next implementation PR, if safe

An internal diagnostic job implementation is **not approved**.

The next branch should instead be:

`audit/phase-0m-receivables-authoritative-source-provider-design-v1`

That docs-only audit should inventory the exact production collections/read helpers and define:

- canonical ownership read authority;
- required source queries and pagination/completeness proofs;
- one as-of/snapshot consistency boundary;
- independent legacy-effect construction;
- least-privilege service identity and collection access;
- typed read-only failures and unsafe-field projection;
- emulator/synthetic fixtures and zero-write proof;
- cost/index/query bounds;
- separation from routes, jobs, providers, and mutations.

If Phase 0M identifies a safe design, a later backend-only PR may implement an **unmounted read-only snapshot provider**. That provider must remain uninvoked from runtime and must be audited after implementation. The runnable job can be reconsidered only after the provider, operator authorization path, execution host, log controls, and retention boundary are all proven.

## 19. Risks and guardrails

| Risk | Consequence | Guardrail |
| --- | --- | --- |
| Injected operator intent is treated as auth | Unauthorized diagnostic | Derive from dedicated IAM/operator control before Phase 0K |
| Injected ownership is treated as authoritative | Cross-landlord read or false readiness | Separately audited canonical read provider |
| Query failure becomes empty state | False equivalence | Explicit completeness states and pagination proof |
| Legacy comparison is circular | Parity always appears successful | Independent raw signed-effect path |
| Allowlist expands at runtime | Portfolio scan | Immutable exact nested manifest; no discovery |
| Broad service identity bypasses manifest | Unauthorized reads | Least-privilege provider plus application scope gates |
| HTTP convenience endpoint appears | Probeable product surface | One-shot private job only after approval |
| Manual job gains schedule/retry | Repeated uncontrolled reads | No scheduler/queue; no automatic retry |
| Logs expose IDs or amounts | Privacy/accounting exposure | Typed projection and capture-and-scan tests |
| Raw exception bypasses redaction | Source/path disclosure | Fixed error taxonomy; fail if projection fails |
| Persisted status becomes shadow ledger | Unreviewed source of truth | No application persistence in first job |
| Parity mismatch triggers correction | Accounting corruption | Observation only; no mutation/remediation |
| Pilot success becomes production claim | Premature financial exposure | Separate promotion and product-read audits |
| Job host imports payment/provider code | Money-movement risk | Dependency allowlist and forbidden-import scans |
| Tenant rent is treated as platform revenue | Accounting/legal misstatement | Explicit landlord-revenue boundary |

## Decision

Phase 0K is the correct pure orchestration core, but it does not make a runnable diagnostic job safe. The authoritative source provider, real operator authorization, immutable manifest governance, execution host controls, logging enforcement, and persistence/retention policy remain unproven. Keep Phase 0K unmounted and uninvoked. Proceed next with a docs-only Phase 0M authoritative source-provider design audit; do not implement the job yet.
