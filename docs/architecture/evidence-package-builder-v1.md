# Evidence Package Builder v1

## Purpose

Evidence Package Builder v1 implements the service-layer assembly engine for authorized institutional export requests.

The builder converts an `ExportProfile`, `ExportRequest`, server-resolved assembly context, and landlord-scoped evidence records into an `ExportPackage` entity. It is metadata-only, projection-safe, and request-scoped. It does not add routes, persist packages, sign packages, deliver exports, call external systems, or mutate evidence records.

## Assembly Algorithm

The builder follows a deterministic five-step flow:

1. Validate the export profile, export request, and assembly context.
2. Authorize the request against the export framework authorization rules.
3. Materialize landlord-scoped evidence records from the evidence record collection.
4. Filter records by evidence class, date range, unit scope, lifecycle status, and retention metadata.
5. Project included records into metadata-only institutional export evidence references, generate a manifest, calculate a checksum, construct an `ExportPackage`, and validate the package.

The pure assembly helper accepts in-memory evidence records. The async entrypoint performs read-only materialization through a narrow Firestore-like query adapter and then delegates to the pure assembly helper.

## Filtering Rules

Evidence records must match all of the following:

- `landlordId` must match the export profile, request, and assembly context.
- `evidenceClass` must be approved by the profile.
- request evidence class filters must be subsets of the approved profile classes.
- `createdAt` must fall inside the request date range when supplied.
- unit scope overrides must not include profile-excluded unit references.
- default lifecycle status inclusion is `active` only.
- `superseded`, `archived`, and `redacted` records are excluded by default.
- audit status inclusion may include `superseded` and `archived` only through explicit audit context.
- deletion-eligible records are excluded unless legal hold metadata is active.

Filtering is deterministic and does not mutate source evidence records.

## Projection Rules

`projectEvidenceForExport` emits `ProjectedEvidenceRecord` objects for institutional export audience only. Projections include safe labels, safe evidence references, class/type metadata, source collection metadata, status, timestamps, sensitivity class, redaction summaries, and retention metadata.

Projection never includes:

- raw Firestore IDs
- raw landlord, tenant, unit, or lease IDs
- storage paths
- tokens or credentials
- provider payloads
- screening reports
- identity documents
- payment account details
- unrestricted message bodies
- debug payloads

The `Full` level still remains metadata-only. It includes allowed field group labels but not raw payloads. `Redacted` removes sensitive allowed field groups. `RedactedSensitive` emits only minimal status, timestamp, safe reference, and redaction category field groups.

## Manifest And Checksum

Package manifests record:

- included evidence count
- excluded evidence count
- excluded evidence reasons
- applied evidence classes
- applied date range
- applied unit scope
- allowed lifecycle statuses
- redaction policy applied

The package checksum uses SHA256 over deterministic evidence record identity metadata and manifest metadata. It is intended for package integrity comparison only. It is not a signature, attestation, or delivery receipt.

## Firestore Read Contract

Materialization is read-only and uses landlord-scoped query patterns:

- collection: `evidenceRecords`
- filters: `landlordId == <context landlord>` and `evidenceClass == <approved class>`
- order: `createdAt desc`
- limit: 100 records per evidence class

The materializer validates that every returned record still matches the requested landlord scope before assembly.

## Governance Boundaries

The builder preserves the institutional export framework boundaries:

- authorization is server-resolved from `ExportAssemblyContext`
- request scope must tighten, not widen, profile scope
- redaction override must tighten, not loosen, profile minimization
- exports are landlord-scoped only
- tenant-facing export awareness and recipient visibility remain out of scope
- raw IDs and raw payloads remain excluded from package and projection outputs
- source records, evidence records, and audit trails are not mutated

## Deferred Work

This mission does not implement:

- API routes
- Firestore package persistence
- audit trail persistence
- package signing
- delivery mechanics
- recipient consent workflows
- recipient access controls
- tenant-facing workflows
- external integrations
- background workers, queues, scheduled jobs, or Pub/Sub flows

Future missions should add append-only export audit trails first, then persistence, signing, and delivery mechanics behind explicit authorization and projection checks.
