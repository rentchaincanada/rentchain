# Audit Immutability Roadmap v1

## Goals

This roadmap records non-binding future options for strengthening audit immutability. It does not authorize implementation in Phase 3 and does not change current routes, services, Firestore rules, indexes, or production data.

## Current State

Canonical audit helper writes are the strongest current path. Older event collections remain append-like by convention, with partial risk from merge-based event persistence and uneven route-level guards. The immediate Phase 3 need is verification and planning, not enforcement.

## Option 1: Firestore Rules Enforcement

Add Firestore rules that deny update and delete operations on audit collections. Where feasible, require creation markers such as `metadataOnly`, `appendOnly`, `immutable`, and `rawIdsIncluded: false` for canonical audit records.

Benefits:

- Strong direct protection against client or service attempts to modify audit evidence.
- Clear enforcement boundary for audit collections.
- Good fit after write paths are normalized.

Risks:

- Rules changes can block legitimate existing writes if not staged carefully.
- Current API-local rules are fail-closed; production rules and deployment policy need a separate review.
- Rules cannot easily validate every service-layer projection or safe-reference decision.

Phase 4 readiness: defer until legacy writers are inventoried and test coverage proves no legitimate create path is blocked.

## Option 2: Schema-Level Enforcement

Normalize all audit writers through canonical helpers. Require all audit records to include an immutability schema version, creation timestamp, source collection, metadata-only posture, and unredacted-identifier-excluded markers.

Benefits:

- Consistent write contract across old and new collections.
- Easier tests for new audit records.
- Easier operator verification because records share common fields.

Risks:

- Refactor scope is broad because events, admin audit, registry audit, ledger events, and domain event writers are spread across routes and services.
- Some existing event records may not map cleanly to canonical audit semantics.
- Migration pressure could create accidental behavior changes.

Phase 4 readiness: recommended only after report-only verification identifies the most important legacy paths to normalize first.

## Option 3: Index-Based Verification

Add or reuse indexes that support read-only scans by scope and creation time. Run a report-only verification job that samples audit collections, checks timestamp/document-name stability, flags missing immutable markers, and reports merge-risk paths.

Benefits:

- Lowest operational risk.
- Does not block writes.
- Produces evidence for a later enforcement plan.
- Aligns with current collection indexes for `events` and `registryAuditLog`.

Risks:

- Detects suspicious state but does not prevent mutations.
- Needs careful report redaction and scope controls.
- Requires future implementation and operational ownership.

Phase 4 readiness: recommended first.

## Option 4: Integrity Digest Verification

Add a digest over stable audit fields and write it at creation time. Verification can recompute the digest during read-only scans and report mismatches.

Benefits:

- Stronger evidence of record changes.
- Can be added gradually to canonical audit records.

Risks:

- Requires schema change and careful handling of server timestamp fields.
- Does not prevent deletion by itself.
- Historical records without digests need a separate treatment plan.

Phase 4 readiness: defer until the append-only write contract is stable.

## Contract

Future enforcement work must preserve:

- Tenant, landlord, admin, and support separation.
- Metadata-only posture for internal audit surfaces.
- No production data mutation during verification.
- No hidden remediation or automated containment.
- No dependency drift unless explicitly approved.
- No direct user-facing exposure of sensitive audit internals.

## Recommended Phase 4 Path

Start with Option 3: report-only index-based verification. Use its findings to decide whether Firestore rules enforcement, schema-level normalization, or digest verification should follow.
