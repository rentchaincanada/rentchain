# Post-Incident Analysis Procedures v1

## Scope

This document defines manual post-incident analysis for Phase 3 incidents. It does not create post-incident storage, routes, status mutation, dashboards, or automation.

## When Required

Run post-incident analysis for:

- every `high` or `critical` incident;
- any confirmed tenant data exposure;
- any credential or secret exposure;
- any production environment separation failure;
- any recovery workflow incident that affects production state;
- any audit integrity concern;
- any support/admin unauthorized access concern;
- any incident where containment was delayed by unclear procedure.

## Timeline Reconstruction

Use append-safe and metadata-only sources first:

- `canonicalEvents`;
- admin audit events;
- support console canonical events;
- support telemetry summaries;
- recovery intents, logs, and timeline entries;
- deployment events from approved platforms;
- environment separation runbook evidence;
- manual support intake timestamps.

Timeline entry format:

```text
Time:
State:
System:
Safe source ref:
Actor role:
Action:
Evidence ref:
Raw IDs included: no
```

## Affected Resource Enumeration

List affected resources by safe reference only.

Allowed:

- resource type;
- safe label;
- safe ref;
- landlord scope as safe ref where required;
- tenant scope as safe ref only when necessary and authorized;
- visibility class;
- sensitivity class.

Prohibited:

- raw tenant IDs;
- raw landlord IDs;
- raw lease/unit/payment IDs;
- raw document paths;
- provider payloads;
- credential values.

## Root Cause Template

```text
Root cause analysis:
Incident ID:
Category:
Severity:
Primary failed control:
Secondary failed controls:
Human/process factors:
Technical factors:
Configuration factors:
Detection gap:
Containment gap:
Audit gap:
Projection gap:
What worked:
What failed:
```

## Failed Control Types

Use one or more:

- auth/session boundary;
- support/admin scope governance;
- projection allowlist;
- recovery gate or intent;
- audit append linkage;
- deployment/environment separation;
- credential management;
- runbook clarity;
- test coverage;
- operational ownership;
- communication timing.

## Remediation Tracking

Every remediation item must include:

```text
Remediation:
Control improvement:
Owner:
Deadline:
Verification plan:
Deployment or docs impact:
Risk if deferred:
Status:
```

Do not perform remediation inside the analysis unless separately authorized.

## Lessons Learned

Capture:

- what signal detected the incident;
- whether severity was correct;
- whether escalation was timely;
- whether safe references were sufficient;
- whether containment preserved evidence;
- whether any audience boundary was unclear;
- which runbook needs an update;
- what future mission should address.

## Follow-Up Control Validation

Validation may include:

- focused route or service tests after an approved fix;
- `git diff --check` for documentation updates;
- manual preview QA for user-visible changes;
- Cloud Run revision verification for backend deployment freshness;
- audit event review for append-safe evidence;
- projection review for tenant, landlord, admin/support, export, dashboard, and timeline audiences.

## Closure Criteria

An incident can close only when:

- category and severity are final;
- containment is verified;
- affected scope is documented with safe refs;
- root cause is recorded;
- remediation is complete or tracked with owner and deadline;
- audit and evidence refs are preserved;
- communications are complete;
- residual risk is documented;
- follow-up mission is named when needed.

## Post-Incident Summary Template

```text
Post-incident analysis:
Incident ID:
Category:
Severity:
Opened:
Closed:
Owner:

Summary:
Affected systems:
Affected scope safe refs:

Timeline:
- observed:
- triaged:
- investigating:
- contained:
- remediated:
- closed:

Root cause:
Failed controls:
Containment actions:
Remediation completed:
Remediation deferred:
Verification:
Residual risk:
Runbook updates:
Recommended next mission:
```

## Retention And Redaction

Post-incident analysis records must remain internal unless a future tenant-safe notification model is explicitly approved. Redact raw identifiers, credentials, provider payloads, raw documents, storage paths, stack traces, private messages, and unrestricted debug data.
