# Provincial Adapter Standard v1

## Purpose
Define the reusable adapter contract for all Identity Oracle provincial verification adapters.

This standard is the source of truth for:
- adapter shape
- namespace behavior
- identifier handling
- verification status mapping
- source behavior
- audit and health expectations
- schema drift handling
- test coverage expectations

This standard applies to all future Identity Oracle provincial adapters, including open-data, feature-service, paid-gateway, manual-document, and internal-override sources.

## Scope
In scope:
- property identity verification adapters
- source normalization rules
- verification result mapping
- health and drift handling
- audit requirements

Out of scope:
- tenant portal UX
- application/lease/tenant lifecycle mutation
- billing or provider payment automation
- compliance-law automation beyond verification signaling

## 1. Adapter Interface
Each provincial adapter must implement a stable internal contract.

Reference shape:
```ts
export type IdentityOracleVerificationStatus =
  | "SYNTAX_ONLY"
  | "VERIFIED_MATCH"
  | "PARTIAL_MATCH"
  | "UNREGISTERED_RISK"
  | "UNVERIFIED"
  | "MANUAL_REVIEW_REQUIRED"
  | "SOURCE_UNAVAILABLE";

export type IdentityOracleSourceType =
  | "OPEN_DATASET"
  | "FEATURE_SERVICE"
  | "PAID_GATEWAY"
  | "MANUAL_DOCUMENT"
  | "INTERNAL_OVERRIDE";

export type IdentityOracleSourceHealth =
  | "healthy"
  | "degraded"
  | "unavailable"
  | "schema_drift_detected";

export type ProvincialAdapterInput = {
  propertyId: string;
  rcPropId?: string | null;
  province: string;
  municipality?: string | null;
  identifierType: string;
  normalizedIdentifier: string;
  actorType: "system" | "admin";
  actorId?: string | null;
};

export type ProvincialAdapterResult = {
  namespaceKey: string;
  identifierType: string;
  normalizedIdentifier: string;
  sourceType: IdentityOracleSourceType;
  sourceKey: string;
  verificationStatus: IdentityOracleVerificationStatus;
  confidence: number | null;
  matchedAtIso: string | null;
  sourceRecordId?: string | null;
  sourceRecordVersion?: string | null;
  sourcePayloadRef?: string | null;
  reasons: string[];
  health: IdentityOracleSourceHealth;
};

export type ProvincialIdentityAdapter = {
  sourceKey: string;
  supportsProvince(province: string): boolean;
  supportsIdentifierType(identifierType: string): boolean;
  buildNamespaceKey(input: { province: string; municipality?: string | null; identifierType: string }): string;
  verify(input: ProvincialAdapterInput): Promise<ProvincialAdapterResult>;
  healthCheck(): Promise<{
    sourceKey: string;
    health: IdentityOracleSourceHealth;
    checkedAtIso: string;
    notes?: string[];
  }>;
};
```

Rules:
- adapters must accept normalized identifiers, not raw user-entry strings
- syntax-only normalization remains the responsibility of the Identity Oracle core layer
- adapters must not mutate application, lease, tenant, or billing state
- adapters must fail closed

## 2. Namespace Conventions
Namespace keys must be deterministic and human-auditable.

Canonical format:
```text
ca-<province-lower>[:<municipality-lower-slug>]:<identifier-type-lower>
```

Examples:
- `ca-on:pin`
- `ca-ns:pid`
- `ca-ns:halifax:registry-id`

Rules:
- province segment is always required
- municipality segment is included only when the source scope or identifier authority is municipality-specific
- identifier segment must use stable internal taxonomy values, not provider labels
- namespace keys must not include raw source URLs or opaque vendor IDs

## 3. Identifier Taxonomy
Identifier types must map to a shared internal vocabulary.

Initial allowed types:
- `pin`
- `pid`
- `registry_id`
- `roll_number`
- `parcel_id`
- `manual_document_ref`

Rules:
- internal identifier taxonomy must stay source-agnostic
- provider-native field names must be mapped into internal taxonomy before persistence
- adapters may support only a subset of the taxonomy
- unsupported identifier types must fail with `MANUAL_REVIEW_REQUIRED` or request rejection, not silent coercion

## 4. Verification Status Taxonomy
All adapters must map results into the following statuses exactly:

- `SYNTAX_ONLY`
  - identifier passed normalization, but no external source verification was attempted or available
- `VERIFIED_MATCH`
  - source returned a strong authoritative match for the identifier and property context
- `PARTIAL_MATCH`
  - source returned a plausible but incomplete match that needs additional context or review
- `UNREGISTERED_RISK`
  - source returned evidence suggesting the property should exist but is absent, missing, or non-compliant in source context
- `UNVERIFIED`
  - verification attempt completed without enough evidence to verify or flag risk
- `MANUAL_REVIEW_REQUIRED`
  - source response or input ambiguity requires human review
- `SOURCE_UNAVAILABLE`
  - the source could not be reached, parsed, or trusted at verification time

Rules:
- adapters must never invent additional statuses in persisted verification records
- ambiguous or conflicting source data must not be upgraded to `VERIFIED_MATCH`
- source-health failure maps to `SOURCE_UNAVAILABLE`, not `UNVERIFIED`

## 5. Source Taxonomy
All adapters must classify the verification source as one of:

- `OPEN_DATASET`
- `FEATURE_SERVICE`
- `PAID_GATEWAY`
- `MANUAL_DOCUMENT`
- `INTERNAL_OVERRIDE`

Rules:
- source type is about how authority is obtained, not how data is transported
- the same province may eventually have multiple source types
- `INTERNAL_OVERRIDE` must always be auditable and attributable to an actor

## 6. Confidence Guidance
Confidence is advisory and must not override status semantics.

Guidance:
- `VERIFIED_MATCH`
  - usually `0.9` to `1.0`
- `PARTIAL_MATCH`
  - usually `0.4` to `0.89`
- `UNREGISTERED_RISK`
  - optional; only set when the signal itself has measurable strength
- `UNVERIFIED`
  - `null` or low confidence
- `MANUAL_REVIEW_REQUIRED`
  - `null`
- `SOURCE_UNAVAILABLE`
  - `null`
- `SYNTAX_ONLY`
  - `null`

Rules:
- confidence must never be used as a substitute for verification status
- confidence must be deterministic from adapter logic
- if confidence cannot be justified, use `null`

## 7. Fallback And Source-Unavailable Behavior
Adapters must define predictable degraded behavior.

Required behavior:
- if the source is unavailable, return `SOURCE_UNAVAILABLE`
- if source data is reachable but insufficient, return `UNVERIFIED` or `PARTIAL_MATCH`
- if verification is skipped intentionally because only syntax validation is in scope, return `SYNTAX_ONLY`
- if a fallback path exists, record both primary-source failure and fallback-source result in audit data
- if no fallback exists, fail closed and preserve the last known verified state separately from the current run result

Rules:
- do not silently downgrade `SOURCE_UNAVAILABLE` to `UNVERIFIED`
- do not fabricate fallback matches from stale cache without marking provenance
- cached results must remain attributable to their source and capture staleness

## 8. Audit Requirements
Every verification run must produce immutable audit evidence.

Minimum audit requirements:
- store a run record in `identity_oracle_runs`
- capture:
  - `propertyId`
  - `rc_prop_id`
  - `province`
  - `municipality`
  - `namespaceKey`
  - `identifierType`
  - `originalIdentifier`
  - `normalizedIdentifier`
  - syntax result
  - verification status
  - source type
  - source key
  - actor type/id
  - created timestamp
- record health or schema-drift notes when relevant
- profile updates in `property_identity_profiles` must point back to the latest run id

Rules:
- run records are append-only
- adapters must never overwrite prior run records
- raw provider payloads should be stored by reference when needed, not sprayed into summary documents

## 9. Health Check Expectations
Every external-source adapter must expose health behavior.

Minimum expectations:
- explicit `healthCheck()` implementation
- record source reachability
- validate authentication/config presence where applicable
- validate minimum expected fields or schema markers
- surface:
  - `healthy`
  - `degraded`
  - `unavailable`
  - `schema_drift_detected`

Rules:
- health checks must be safe to run without mutating source state
- health failures must not widen access or bypass verification controls
- health results should be observable by internal-only routes or operational tooling

## 10. Schema Drift Handling Expectations
Adapters must guard against source shape changes.

Required behavior:
- validate presence of critical fields before trusting a response
- explicitly detect missing/renamed identifiers or status fields
- fail closed on parsing uncertainty
- classify drift impact in audit notes
- map severe drift to `SOURCE_UNAVAILABLE` or `MANUAL_REVIEW_REQUIRED`, depending on certainty

Rules:
- no best-effort silent parsing of unknown schemas
- provider schema assumptions must be test-covered
- adapters must document the minimum field contract they depend on

## 11. Test Matrix
Each adapter must ship with a minimum test matrix.

Required test categories:
- syntax-valid identifier passes through to adapter
- unsupported identifier type rejects cleanly
- namespace key generation is deterministic
- verified full match maps to `VERIFIED_MATCH`
- partial source response maps to `PARTIAL_MATCH`
- absent or suspicious source response maps to `UNREGISTERED_RISK` or `UNVERIFIED` as designed
- unavailable source maps to `SOURCE_UNAVAILABLE`
- schema drift or missing required fields is detected
- health check success and failure cases
- cache hit behavior, if caching exists
- audit write shape includes required fields
- profile projection/update points to latest run correctly

## 12. Definition Of Done
An adapter is done only when:
- it implements the standard interface
- namespace logic is deterministic and documented
- identifier taxonomy mapping is explicit
- verification statuses are limited to the approved taxonomy
- source type is declared explicitly
- fallback behavior is defined
- health checks exist
- schema drift guards exist
- immutable audit writes exist
- tests cover the required matrix
- no unrelated application state is mutated

## Identity Oracle Core Compatibility
The current Identity Oracle core already establishes:
- syntax normalization before verification
- append-only `identity_oracle_runs`
- latest-state projection in `property_identity_profiles`
- internal-only execution route pattern at `/api/internal/identity-oracle/run`

All future provincial adapters must integrate into that core contract rather than inventing a parallel pipeline.
