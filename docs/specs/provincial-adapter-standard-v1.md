# Provincial Adapter Standard v1

## Purpose
Provincial adapters exist to extend Identity Oracle from syntax normalization into source-aware verification without polluting the core Oracle layer with province-specific logic.

The separation of responsibilities is:
- Identity Oracle core:
  - accepts property-scoped requests
  - normalizes raw identifiers into canonical internal forms
  - persists immutable run audit records
  - updates latest property identity profile state
  - exposes internal-only execution paths
- provincial adapters:
  - interpret province/source-specific identifier semantics
  - classify identifier/source combinations
  - validate province-specific syntax constraints when needed
  - normalize source-facing lookup values
  - verify identifiers against a defined authority source
  - map source outcomes into shared verification statuses

Adapters exist so future province integrations can be added without redefining the Oracle contract every time.

## Adapter Interface Contract
Each provincial adapter must implement the four required core methods:
- `classify`
- `normalize`
- `validateSyntax`
- `verify`

`healthCheck` may be implemented as an additional operational method, but it does not replace the four core contract methods.

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

export type ProvincialAdapterClassification = {
  province: string;
  source: string;
  identifierType: string;
  sourceType: IdentityOracleSourceType;
  namespace: string;
};

export type ProvincialAdapterInput = {
  propertyId: string;
  rcPropId?: string | null;
  province: string;
  municipality?: string | null;
  source: string;
  identifierType: string;
  rawIdentifier: string;
  normalizedIdentifier?: string | null;
  actorType: "system" | "admin";
  actorId?: string | null;
};

export type ProvincialSyntaxValidation = {
  ok: boolean;
  normalizedIdentifier: string | null;
  issues: string[];
};

export type ProvincialAdapterResult = {
  namespace: string;
  identifierType: string;
  normalizedIdentifier: string;
  sourceType: IdentityOracleSourceType;
  source: string;
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
  classify(input: ProvincialAdapterInput): ProvincialAdapterClassification;
  normalize(input: ProvincialAdapterInput): string;
  validateSyntax(input: ProvincialAdapterInput): ProvincialSyntaxValidation;
  verify(input: ProvincialAdapterInput): Promise<ProvincialAdapterResult>;
  healthCheck?(): Promise<{
    source: string;
    health: IdentityOracleSourceHealth;
    checkedAtIso: string;
    notes?: string[];
  }>;
};
```

Rules:
- adapters must accept the Oracle’s normalized contract, not invent a parallel execution model
- `classify` must determine province, source, identifier type, and canonical namespace
- `normalize` must produce the exact source-facing lookup value used by verification
- `validateSyntax` must return explicit pass/fail output and never hide identifier issues
- `verify` must map real-world lookup outcomes into the shared verification taxonomy
- adapters must fail closed
- adapters must not mutate application, lease, tenant, billing, or tenant-portal state

## Namespace Rules
The canonical external identifier namespace format is:

```text
{province}:{source}:{value}
```

Examples:
- `NS:PVSC:40123456`
- `NS:HRM:REH-2024-001`
- `ON:LRO:101260418`

Rules:
- `province` must be the canonical uppercase province code
- `source` must be a stable uppercase source key, not a raw URL
- `value` must be the normalized source-facing identifier value
- the namespace must be deterministic for the same verified source input
- the namespace must not depend on transient request metadata
- the namespace must not include secrets, auth tokens, or arbitrary payload fragments

Compatibility note:
- shorthand internal profile labels such as `ca-on:pin` or `ca-ns:pid` may still exist in current core storage logic
- those labels are compatibility-oriented internal projections, not the primary provincial adapter namespace standard

## Identifier Taxonomy
Adapters must map source-specific identifiers into a shared internal taxonomy.

Required initial taxonomy:
- `pin`
- `pid`
- `registration_number`

Allowed future extension examples:
- `parcel_id`
- `roll_number`
- `registry_id`
- `manual_document_ref`

Rules:
- `pin` covers Ontario-style property identification numbers
- `pid` covers parcel/property identifiers such as Nova Scotia PID workflows
- registration numbers must remain distinct from parcel/property identifiers
- provider-native field names must be translated into internal taxonomy values before persistence
- adding a new identifier type must not silently redefine an existing one
- future extensibility must be explicit, documented, and test-covered

## Verification Status Taxonomy
All adapters must map outcomes into these statuses exactly:

- `SYNTAX_ONLY`
  - syntax validation succeeded, but real-world verification did not occur
- `VERIFIED_MATCH`
  - the source returned a strong authoritative match
- `PARTIAL_MATCH`
  - the source returned a plausible but incomplete or weakly-scoped match
- `UNREGISTERED_RISK`
  - the source returned evidence suggesting expected registration or identity presence is missing
- `UNVERIFIED`
  - verification completed but did not produce enough evidence to verify or flag risk
- `MANUAL_REVIEW_REQUIRED`
  - ambiguity, conflict, or policy rules require human review
- `SOURCE_UNAVAILABLE`
  - the source could not be trusted, reached, or parsed for the attempted verification

Rules:
- no additional persisted statuses may be invented by a provincial adapter
- `SYNTAX_ONLY` must never imply real-world verification happened
- `SOURCE_UNAVAILABLE` must not be downgraded to `UNVERIFIED`
- ambiguous or conflicting results must not be upgraded to `VERIFIED_MATCH`

## Source Taxonomy
Every adapter must classify its source as one of:

- `OPEN_DATASET`
- `FEATURE_SERVICE`
- `PAID_GATEWAY`
- `MANUAL_DOCUMENT`
- `INTERNAL_OVERRIDE`

Rules:
- source taxonomy describes authority and access model, not transport details
- one province may eventually support multiple sources with different taxonomy values
- `INTERNAL_OVERRIDE` must always be attributable to a human or controlled system actor
- adapters must declare source taxonomy explicitly, never infer it downstream

## Confidence Guidelines
Confidence is advisory metadata and must not replace verification status semantics.

Guidelines:
- `VERIFIED_MATCH`
  - usually high confidence
  - confidence should still be capped below `1.0` when key corroborating fields are absent
- `PARTIAL_MATCH`
  - moderate confidence only
  - confidence must be capped because the match is incomplete by definition
- `UNREGISTERED_RISK`
  - confidence may be set when the negative signal is strong and well-scoped
- `UNVERIFIED`
  - low confidence or `null`
- `MANUAL_REVIEW_REQUIRED`
  - `null`
- `SOURCE_UNAVAILABLE`
  - `null`
- `SYNTAX_ONLY`
  - `null`

Rules:
- confidence must be capped when the source response is partial, stale, indirect, or missing corroborating fields
- missing data lowers confidence
- ambiguous data lowers confidence and usually also changes status to `PARTIAL_MATCH` or `MANUAL_REVIEW_REQUIRED`
- syntax-only validation must not imply real-world verification and therefore must not carry verification confidence
- if confidence cannot be justified deterministically, use `null`

## Fallback Rules
Adapters must define explicit degraded behavior for failure and ambiguity.

Source unavailable:
- return `SOURCE_UNAVAILABLE`
- record the failure reason in audit data
- do not silently downgrade to `UNVERIFIED`

Schema mismatch:
- fail closed
- treat severe schema uncertainty as `SOURCE_UNAVAILABLE` or `MANUAL_REVIEW_REQUIRED`
- record the mismatch or missing field condition in audit data

Ambiguous match:
- do not upgrade to `VERIFIED_MATCH`
- return `PARTIAL_MATCH` or `MANUAL_REVIEW_REQUIRED`, depending on certainty and risk

Missing identifiers:
- reject verification or return `MANUAL_REVIEW_REQUIRED`, depending on where the failure occurs
- do not fabricate lookup values from weak heuristics

Manual-review escalation behavior:
- ambiguous or conflicting outcomes must remain visible for downstream reviewers
- manual review must be traceable to the specific run, source, and identifier involved

Fallback path rules:
- if a secondary source exists, record both the primary-source failure and the fallback-source result
- cached fallback data must retain provenance and freshness information
- no fallback path may bypass audit requirements

## Audit Requirements
Every adapter verification run must produce immutable, traceable evidence.

Minimum audit requirements:
- write an append-only record to `identity_oracle_runs`
- capture:
  - `propertyId`
  - `rc_prop_id`
  - `province`
  - `municipality`
  - `namespace`
  - `identifierType`
  - `originalIdentifier`
  - `normalizedIdentifier`
  - syntax result
  - verification status
  - source taxonomy
  - source key
  - actor type
  - actor id
  - created timestamp
  - reasons or issue notes
- update `property_identity_profiles` by reference to the latest run id

Traceability rules:
- downstream agents must be able to determine which source, status, and namespace produced the current profile state
- audit evidence must preserve enough context for Risk Agent, Compliance Agent, and future review tooling
- raw provider payloads should be stored by reference when needed, not duplicated into summary docs
- prior run records must never be overwritten

## Health & Reliability
Every external-source adapter must define operational reliability behavior.

Required expectations:
- implement source health checks
- define retry strategy for transient failures
- define schema drift handling expectations

Health checks:
- validate reachability
- validate auth/config presence where applicable
- validate expected critical fields or schema markers
- surface `healthy`, `degraded`, `unavailable`, or `schema_drift_detected`

Retry strategy:
- only retry transient failures that are known to be safe
- retries must not widen access or mutate source state
- repeated failure must still resolve to a deterministic terminal outcome

Schema drift handling:
- detect missing or renamed critical fields explicitly
- fail closed on parsing uncertainty
- record schema drift notes in audit evidence
- do not attempt silent best-effort parsing of unknown shapes

## Test Matrix
Every adapter must ship with a minimum test matrix.

Required unit tests:
- `classify` produces the expected province/source/identifier classification
- `normalize` produces deterministic source-facing identifier values
- `validateSyntax` accepts valid identifiers
- `validateSyntax` rejects malformed identifiers
- namespace generation follows `{province}:{source}:{value}`
- status mapping covers all relevant positive and negative outcomes
- confidence behavior is capped correctly when data is partial or ambiguous
- schema drift detection behaves as expected
- health check success and failure cases are covered

Required integration tests:
- successful verification flow maps to `VERIFIED_MATCH`
- incomplete but plausible verification maps to `PARTIAL_MATCH`
- missing expected registration maps to `UNREGISTERED_RISK` or `UNVERIFIED` as designed
- source outage maps to `SOURCE_UNAVAILABLE`
- audit writes include required fields
- profile projection points to the latest run correctly

Required failure scenarios:
- source unavailable
- schema mismatch
- ambiguous match
- missing identifiers
- manual-review escalation path

## Definition of Done
An adapter is not complete until:
- the required contract methods are implemented:
  - `classify`
  - `normalize`
  - `validateSyntax`
  - `verify`
- verification statuses map correctly to the approved taxonomy
- source taxonomy is declared explicitly
- audit requirements are fully met
- health checks are defined
- schema drift handling is defined
- fallback behavior is defined
- tests pass
- limitations are documented honestly
- no unrelated application state is mutated

## Compatibility Notes
The current Identity Oracle core already establishes:
- syntax normalization before external verification
- append-only `identity_oracle_runs`
- latest-state projection in `property_identity_profiles`
- internal-only execution route pattern at `/api/internal/identity-oracle/run`

Future provincial adapters must integrate into that core contract rather than inventing a parallel pipeline.
