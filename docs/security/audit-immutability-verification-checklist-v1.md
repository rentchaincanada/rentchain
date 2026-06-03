# Audit Immutability Verification Checklist v1

## Goals

This checklist gives reviewers, QA, and operators practical steps to verify audit immutability without changing production data. It is designed for manual use and does not require new tooling.

## Current State

Audit verification currently depends on source review, local tests, index-supported Firestore queries, and role/scope spot checks. This mission adds a contract test and documentation checklist, but it does not add production scanners or enforcement jobs.

## Design-Time PR Checks

Use these checks during code review:

- New audit writes should use `appendCanonicalAuditEvent` where possible.
- If a new writer uses `writeCanonicalEvent`, confirm generated IDs or document why deterministic IDs cannot collide.
- New audit writes must not use `update()`.
- New audit writes must not use `delete()`.
- New audit writes must not use `set(..., { merge: true })` unless the PR documents why idempotent patching is required and how evidence integrity is preserved.
- New audit records must carry creation time and actor/resource context.
- Tenant-facing audit reads must use explicit tenant scope.
- Landlord-facing audit reads must use explicit landlord or property scope.
- Admin/support audit reads must require authenticated admin authority.
- User-safe projections must not include sensitive payloads, bearer values, provider payloads, storage paths, or unrestricted internal metadata.

## Operator Runtime Checks

These checks are read-only. Run them in staging first, then production only with the approved operational access model.

### Collection Sequence Scan

For each collection, query by the collection's creation timestamp and document name:

```text
collection: events
order: occurredAt descending, __name__ descending
sample size: 100
check: no duplicate document names in the sample; timestamps are present; records are not rewritten during repeated reads
```

```text
collection: adminAuditEvents
order: occurredAt descending, __name__ descending
sample size: 100
check: every record has category, action, label, occurredAt or createdAt
```

```text
collection: registryAuditLog
order: createdAt descending, __name__ descending
sample size: 100
check: every record has sourceKey, eventType, actorType, createdAt
```

```text
collection: canonicalEvents
order: recordedAt or timestamp descending, __name__ descending
sample size: 100
check: canonical audit records include metadataOnly, appendOnly, immutable, and rawIdsIncluded false when written by the canonical audit helper
```

### Repeat-Read Stability Check

Run the same read-only query twice five minutes apart. Compare document names, creation timestamps, event types, and immutable markers. A changed record requires manual investigation.

### Role And Scope Spot Checks

- Admin audit: sign in as an admin and verify `/api/admin/audit` returns sectioned admin audit summaries. Then try a non-admin account and confirm access is denied.
- Tenant audit: verify a tenant-scoped route only returns events for the requested tenant and does not show another tenant's events.
- Property audit: verify a landlord-scoped property event route only returns events for a property owned by that landlord.
- Debug relay: verify debug event relay remains internal-review-only and is not used as a user-facing audit surface.

### Curl Templates

Use approved test tokens in staging only:

```bash
curl -H "Authorization: Bearer <admin-token>" https://<api-host>/api/admin/audit
```

```bash
curl -H "Authorization: Bearer <tenant-token>" https://<api-host>/api/events/tenants/<tenant-ref>/events
```

```bash
curl -H "Authorization: Bearer <landlord-token>" https://<api-host>/api/events/properties/<property-ref>/events
```

Expected result: responses are scoped, redacted, and limited to the caller's authorized resource context. If a route cannot prove that scope, record the finding as a future fix rather than altering data.

## Risks

- Query stability does not prove no historical mutation occurred; it only detects current drift and visible inconsistencies.
- Index support helps operator queries but does not enforce append-only writes.
- Route spot checks are only as strong as the test identities and seeded data chosen.
- Debug routes require extra caution because they may expose broader event details.

## Contract

A verification pass requires:

- Source scan shows no `update()` or `delete()` on primary audit collections.
- Source scan shows no undocumented `merge: true` on primary audit writes.
- Admin audit routes remain permission-gated.
- General event routes are flagged if they lack visible route-level guards.
- Canonical audit helper records include metadata-only and immutable markers.
- No verification step writes, patches, deletes, or backfills production data.

## Roadmap

Phase 4 should turn this checklist into a report-only scheduled verification job. Enforcement should wait until legacy event paths are normalized or explicitly excepted.
