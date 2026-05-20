# Canonical Event Taxonomy v1

## 1. Executive Summary

This report defines RentChain's canonical event taxonomy language for governance, auditability, evidence lineage, projection safety, retention planning, and future institutional workflows.

This is a documentation and architecture specification only. It does not implement a runtime event framework, rewrite event emitters, migrate collections, rename collections, add middleware enforcement, alter routes, modify Firestore rules, or change product behavior.

Current posture:

- RentChain already has substantial event/audit coverage through `events`, `canonicalEvents`, `tenantEvents`, `activityEvents`, `event_log`, `leaseWorkflowEvents`, `screeningEvents`, `decisionActions`, `operatorReviewSessions`, `ledgerEvents`, `stripeEvents`, `registryAuditLog`, telemetry, and AI/governance event families.
- Existing event models use multiple shapes: canonical event helpers, generic audit events, tenant portal event logs, ledger event envelopes, domain-specific workflow events, and readiness-profile canonical events.
- This coverage is valuable, but the platform audit identified taxonomy drift as a critical governance risk before evidence infrastructure, institutional exports, review workspaces, consent governance, operational read models, and controlled agent routing expand.
- The recent collection ownership registry and sensitivity/projection registry provide the source-of-truth and sensitivity vocabulary this event taxonomy should align with.

The core objective of a canonical event is to provide deterministic, append-oriented, sensitivity-aware evidence of something that happened in a scoped operational workflow.

## 2. Canonical Event Philosophy

A canonical event is a durable semantic record of a completed observation, action, state transition, workflow signal, or governance decision.

Canonical events should answer:

- What happened?
- Who or what caused it?
- Which authority context applied?
- Which landlord, tenant, property, unit, lease, workflow, or external resource was in scope?
- When did it happen, and when was it recorded?
- What source system emitted it?
- What sensitivity and visibility rules govern projections?
- Can it be used in evidence packs, institutional exports, tenant trust exports, or operational routing?
- What lineage or correlation connects it to related events?

Canonical events should not become raw data containers. They should carry enough metadata for lineage and review, while sensitive detail remains in source collections and is projected through explicit allowlists.

## 3. Event Taxonomy Categories

| Category | Meaning | Example current sources | Governance notes |
| --- | --- | --- | --- |
| Operational workflow events | Non-financial workflow state changes and operator tasks. | `decisionActions`, `operatorReviewSessions`, `actionRequests`, operations/readiness events. | Must distinguish workflow state from financial/legal truth. |
| Financial/accounting events | Payments, ledger entries, obligations, reconciliation, adjustments, billing states. | `ledgerEvents`, `payments`, `ledgerEntries`, payment canonical events, `rentPayments`, `paymentReconciliationRecords`. | Append-only expectations are strongest here. No event should mutate ledger history. |
| Screening/reporting events | Screening orders, provider sessions, consent, reporting submissions, provider status. | `screeningEvents`, `stripeEvents`, screening/reporting routes, reporting collections. | Raw bureau/provider payloads must not propagate into canonical event payloads. |
| Tenant workspace events | Tenant portal actions, document visibility, readiness, notices, tenant trust exports. | `event_log`, `tenantEvents`, tenant trust export lifecycle events. | Tenant-safe projections must be whitelist-based. |
| Messaging/communication events | Message send/read/notification state and communication workflow signals. | `conversations`, `messages`, read receipts, notification events. | Message bodies are Sensitive and should not be broad evidence/export defaults. |
| Evidence/review events | Evidence pack creation, review sessions, redaction, restriction detection, manual review outcomes. | `operatorReviewSessions`, evidence pack derivations, readiness-profile canonical events. | Must include source lineage, redaction posture, and manual-only semantics. |
| Audit/compliance events | Audit checks, policy/readiness derivations, admin/support review, governance state. | `events`, `canonicalEvents`, audit compliance readiness, admin audit views. | Must be projection-safe and explainable. |
| Registry/oracle events | Property registry imports, matching, raw/normalized record lineage, registry audits. | `registryAuditLog`, registry import/status services. | Raw registry records remain Restricted; events should carry provenance summaries. |
| System/telemetry events | Health, usage, telemetry, observability, counters, system events. | `telemetry_events`, `telemetry_counters`, observability events, probes. | Logs/telemetry are projection surfaces and need redaction discipline. |
| AI/agent governance events | Risk agent runs, AI/task audit, controlled-agent decisions and restrictions. | `ai_events`, `risk_agent_runs`, `risk_agent_decisions`, AI readiness profiles. | Future agent routing must be manual/governed, explainable, and non-autonomous by default. |
| Consent/export events | Tenant trust exports, institutional packages, reporting consents, share/revoke lifecycle. | `tenantTrustExports`, `reportingConsents`, `reportingSubmissions`, institution export derivations. | Must include consent/authority basis, export profile, retention, and redaction metadata. |

## 4. Canonical Event Metadata Definitions

This is not a required runtime schema. It is the semantic contract future event adapters should converge toward.

| Field concept | Meaning | Guidance |
| --- | --- | --- |
| `eventId` | Stable unique event identifier. | Should be immutable after recording. |
| `eventType` | Specific event name. | Prefer domain/action naming such as `payment.recorded`, `lease.execution_review_required`, `screening.consent_requested`. |
| `eventCategory` | Taxonomy category. | One of the categories in this report. |
| `eventVersion` | Semantic version of event shape. | Needed for adapter compatibility and long-term exports. |
| `actorType` | Actor class. | `tenant`, `landlord`, `admin`, `support`, `contractor`, `system`, `service`, `provider`, `agent`. |
| `actorId` | Internal actor identifier where available. | Internal reference, not a public label. Redact or label in projections. |
| `authorityContext` | Server-resolved authority/scope used when action occurred. | Should align with the shared request authority resolver. |
| `landlordId` | Owning landlord/org scope. | Required for landlord-scoped operational events where applicable. |
| `tenantId` | Tenant scope. | Include only when the event is tenant-specific and projection-safe. |
| `propertyId` | Property scope. | Use for property/occupancy/work-order/registry events. |
| `unitId` | Unit scope. | Use for occupancy, lease, work-order, and tenancy events. |
| `leaseId` | Lease scope. | Required for lease/payment/ledger/obligation events where available. |
| `resourceType` | Primary resource type. | Example: `lease`, `payment`, `ledger_entry`, `screening_order`, `conversation`, `evidence_pack`. |
| `resourceId` | Primary resource ID. | Internal reference; display via operational labels in UI/export. |
| `parentResourceType` | Parent resource if useful. | Example: a ledger entry's parent is a lease. |
| `parentResourceId` | Parent resource ID. | Helps evidence lineage without broad joins. |
| `visibilityClass` | Default visibility. | `internal`, `landlord`, `tenant`, `admin`, `system`, or future projection-specific class. |
| `sensitivityClass` | Sensitivity classification. | Align with `firestore-sensitivity-and-projection-registry-v1.md`. |
| `eventTimestamp` | When the business event occurred. | Must be distinct from recorded timestamp. |
| `recordedAt` | When RentChain recorded the event. | Useful for ingestion/audit latency. |
| `sourceSystem` | Emitting subsystem. | Example: `lease_ledger`, `tenant_portal`, `screening_provider_adapter`, `operator_review`. |
| `correlationId` | Request/job/workflow correlation. | Connects events from one API request, import batch, webhook, or review session. |
| `lineageId` | Durable lineage chain ID. | Connects source event, derived event, evidence pack, export, or review session. |
| `causationEventId` | Direct causal predecessor. | Useful for workflow transitions and derived read models. |
| `projectionEligibility` | Whether event can appear in UI/read models. | Should be explicit for tenant, landlord, support, evidence, and institution projections. |
| `evidenceEligibility` | Whether event can be included in evidence packs. | Include redaction requirements and source lineage. |
| `exportEligibility` | Whether event can be exported. | Institutional exports should require an explicit profile. |
| `retentionClass` | Retention posture. | See retention guidance below. |
| `appendOnlyExpectation` | Whether event is immutable. | Audit/ledger/decision/review events should be append-oriented. |
| `redactionPolicy` | Redaction/minimization rule. | Should identify excluded raw/sensitive categories. |
| `operationalSummary` | Human-readable summary. | Safe, concise, no raw IDs as primary labels. |
| `internalReferences` | Labeled internal IDs or paths. | Internal use only; not primary display labels. |
| `metrics` | Numeric aggregate values. | Avoid embedding sensitive raw records. |
| `tags` | Search/routing labels. | Use normalized, human-readable categories where possible. |

## 5. Actor, Resource, and Scope Semantics

Actor semantics:

- `actorType` identifies the kind of actor, not necessarily the authorization result.
- `actorId` is an internal reference and should not be a primary operational label.
- `authorityContext` should capture the effective server-side scope used to permit the event, including landlord, tenant, admin/support, impersonation/delegation, or system authority where present.
- System/provider/agent actors must not be treated as autonomous authorization. They require an originating workflow, job, webhook, or human-reviewed policy context.

Resource semantics:

- Every event should have one primary `resourceType` and `resourceId`.
- Secondary relationships belong in explicit scope fields or `internalReferences`, not unstructured raw payloads.
- Resource IDs remain canonical product logic identifiers. UI, evidence, and exports should derive operational labels separately.

Scope semantics:

- Landlord scope is the default boundary for landlord operations.
- Tenant scope must be included only when the event is tenant-specific and should be projected by tenant-safe rules.
- Lease, property, and unit scope should be included for relationship spine continuity.
- Ambiguous authority or ambiguous resource scope should fail closed in future runtime adapters.

## 6. Visibility and Sensitivity Semantics

Visibility and sensitivity are separate:

- `visibilityClass` says who may usually see the event or a projection of it.
- `sensitivityClass` says how carefully the event must be handled.

Suggested visibility classes:

- `internal`: backend/system only.
- `landlord`: landlord operational projection allowed.
- `tenant`: tenant-safe projection may be allowed.
- `admin`: admin/support projection only.
- `system`: service/diagnostic event, not product UI by default.
- `evidence`: evidence projection may be allowed after redaction.
- `institutional_export`: export profile required before external sharing.

Sensitivity classes should reuse the sensitivity registry:

- Public
- Internal
- Operational
- Sensitive
- Restricted
- Critical

Critical data should not appear in canonical event payloads. Restricted data should appear only as redacted metadata, references, hashes, statuses, or summaries unless a future reviewed profile explicitly permits more.

## 7. Event Lineage and Correlation Guidance

Event lineage is required for evidence, exports, review workspaces, and controlled routing.

Minimum future expectations:

- `correlationId` connects events from one request, webhook, import batch, scheduled job, or review session.
- `lineageId` connects a longer lifecycle across derived events, read models, evidence packs, and exports.
- `causationEventId` identifies the event directly causing another event.
- `sourceEventIds` may be used for derived events and read models.
- Evidence packs should record the source events used to derive package sections.
- Institutional exports should record source event lineage and projection profile version.

Derived events must not pretend to be source-of-truth events. They should clearly identify derivation source and projection/redaction posture.

## 8. Audit and Evidence Eligibility Guidance

An event is audit-eligible when it records a meaningful action, observation, system transition, consent state, review decision, export action, or external provider state.

An event is evidence-eligible only when:

- It has clear actor or system source.
- It has deterministic scope.
- It has source collection/resource lineage.
- Its sensitivity class is compatible with the evidence projection.
- Raw provider, raw CSV, message body, credential, and debug data are excluded or redacted.
- It has a safe operational summary.
- It does not overstate legal, financial, or compliance conclusions.

Events that should usually be evidence-eligible:

- Payment recorded/imported/adjusted.
- Ledger entry appended.
- Obligation reconciliation derived.
- Decision reviewed/resolved/dismissed/snoozed/assigned.
- Lease generated/signed/execution review required.
- Tenant trust export prepared/revoked/expired.
- Screening consent requested/completed/status updated.
- Registry normalized match accepted/reviewed.

Events that should not be evidence-eligible by default:

- Raw provider webhook payloads.
- Raw screening/reporting reports.
- Telemetry/debug traces.
- Message bodies.
- Raw CSV import rows.
- Stack traces and route-source diagnostics.

## 9. Export and Projection Compatibility Guidance

Canonical events should be designed for projection compatibility:

- Tenant-safe projection: include only events scoped to the tenant's own application, lease, payments, messages, documents, or workspace context.
- Landlord operational projection: include landlord-scoped events with operational labels and minimal sensitive fields.
- Admin/support projection: include internal references only with labels and redaction.
- Evidence projection: include event ID, type, summary, timestamp, source lineage, sensitivity, and redaction posture.
- Institutional export projection: include only events allowed by an explicit export profile.

Canonical event payloads should not include:

- Raw provider payloads.
- Raw CSV values.
- Banking/card/account/routing identifiers.
- SIN/SSN/government ID values.
- Auth tokens, credentials, webhook secrets.
- Full message bodies unless a future explicit policy permits a tightly scoped communication evidence profile.
- Full document bodies or extracted raw document text.

## 10. Retention and Append-Only Guidance

Suggested retention terminology:

| Retention class | Meaning | Examples |
| --- | --- | --- |
| `operational_short` | Useful for near-term UI/workflow; can be summarized later. | telemetry counters, transient workflow hints. |
| `operational_history` | Durable product history for landlord/tenant workflows. | tenant activity, lease workflow events, occupancy events. |
| `financial_audit` | Long-lived accounting/payment/ledger history. | payments, ledger entries, reconciliation events. |
| `consent_record` | Consent/export/reporting authorization history. | tenant trust export consent, reporting consent, revocation. |
| `provider_audit` | Provider/webhook/idempotency history. | Stripe events, screening provider status, webhook receipts. |
| `evidence_lineage` | Source lineage for evidence/review/export artifacts. | evidence pack derivation events, operator review outcomes. |
| `support_diagnostics` | Support/debug observability with redaction. | sanitized support/telemetry events. |

Append-only expectations:

- Financial/accounting, consent, evidence, review, and provider audit events should be append-oriented.
- Corrections should be represented as new events, not mutation of historical event meaning.
- Derived/read-model events may be superseded, but source lineage should remain traceable.
- Deletion/retention policies should be explicit before expanding external or institutional exports.

## 11. Existing Collection and Event-Family Mapping

| Current family | Taxonomy category | Current role | Migration posture |
| --- | --- | --- | --- |
| `events` | Audit/compliance, operational workflow, generic audit | Generic event/audit collection with multiple shapes and payload patterns. | Keep; future adapter should normalize into canonical taxonomy without immediate migration. |
| `canonicalEvents` | Audit/compliance, evidence/review, operational workflow | Existing canonical event helper/read-model input with domain/action/resource/actor fields. | Best current foundation for future canonical adapter. |
| `tenantEvents` | Tenant workspace events | Tenant profile/activity timeline. | Keep; adapter should map tenant scope and visibility. |
| `activityEvents` | Operational workflow events | Property-scoped activity/read-model events, deduped by property/type/rule/day. | Keep as operational read-model input; map as derived/operational history. |
| `event_log` | Tenant workspace events | Tenant portal audit/event log with compact payload behavior. | Keep; future adapter should enforce tenant-safe projection and sensitivity labels. |
| `leaseWorkflowEvents` | Operational workflow events, audit/compliance | Lease/notice workflow audit. | Keep; future adapter should align lease scope, jurisdiction, and retention. |
| `screeningEvents` | Screening/reporting events | Screening workflow/provider audit. | Keep; must exclude raw provider payloads from canonical projections. |
| `decisionActions` | Operational workflow events, evidence/review | Lease ledger decision action history. | Keep append-oriented; map workflow status separately from financial status. |
| `operatorReviewSessions` | Evidence/review events | Manual review session state and outcomes. | Keep; future review workspaces should use as review session source. |
| `ledgerEvents` | Financial/accounting events | Payment/ledger processing event source. | Keep; future adapter should align with financial audit retention. |
| `stripeEvents` | Screening/reporting, provider audit, financial/accounting | Provider webhook/idempotency state. | Keep internal/provider-audit only; no routine UI/evidence projection. |
| `registryAuditLog` | Registry/oracle events | Registry import/matching/provenance audit. | Keep; map normalized provenance while excluding raw registry records. |
| `telemetry_events`, `telemetry_counters` | System/telemetry events | Product/system telemetry and counters. | Keep internal; enforce redaction and avoid evidence/export default eligibility. |
| `ai_events`, `risk_agent_runs`, `risk_agent_decisions` | AI/agent governance events | AI/risk agent audit and explainability records. | Keep governed/manual-only; future controlled agent routing must require lineage and review posture. |

## 12. Governance Risks in Current Event Fragmentation

Current risks:

- Multiple event shapes use different timestamp names: `createdAt`, `occurredAt`, `recordedAt`, `timestamp`, `created_at`.
- Actor fields are inconsistent across event families.
- Some generic `events` records can carry arbitrary `payload` or `meta` without a shared sensitivity contract.
- Domain-specific readiness profiles generate canonical-like events but do not all share a single taxonomy.
- Generic audit services overlap in name and purpose.
- Evidence and institutional export derivation currently depend on event summaries and redaction posture that are not yet platform-wide.
- Provider/webhook events and screening/reporting events require stronger default exclusion from routine projections.
- Telemetry/logging can accidentally become an event stream without sensitivity/retention semantics.

Safe direction:

- Document first.
- Add tests and adapters before runtime enforcement.
- Avoid collection migration until projection profiles and adapter semantics are reviewed.
- Treat current event families as source inputs, not as broken systems to rewrite immediately.

## 13. Future Runtime-Governance Recommendations

Recommended sequencing:

1. `docs/event-adapter-rules-v1`
   Define mapping rules from current event families into the canonical taxonomy.

2. `test/canonical-event-taxonomy-regression-v1`
   Add tests for event shape expectations, sensitivity fields, and projection eligibility on new event-producing helpers.

3. `fix/evidence-pack-event-lineage-v1`
   Add explicit event source references, lineage IDs, redaction summaries, and projection profile metadata to evidence packs.

4. `fix/institutional-export-event-lineage-v1`
   Require export packages to declare source event IDs, retention class, sensitivity class, and projection profile version.

5. `feat/canonical-event-adapter-v1`
   Add a read-only adapter that maps existing event collections into canonical event semantics without migrating records.

6. `fix/tenant-workspace-event-projection-contracts-v1`
   Document and test tenant-safe event projections from tenant event families.

7. `fix/provider-audit-event-redaction-v1`
   Formalize provider/webhook event redaction and projection exclusions.

Do not implement an event bus, event migration, or middleware enforcement until adapter rules and regression tests are in place.

## 14. Relationship to Future Governance Systems

Review workspaces:

- Need canonical actor, scope, workflow status, source event, and review outcome semantics.
- Must distinguish operational review state from financial/lease truth.

Evidence packs:

- Need event source lineage, redaction policy, evidence eligibility, and operational summaries.
- Should not ingest raw provider/debug payloads.

Institutional exports:

- Need explicit export eligibility, retention class, sensitivity class, projection profile, and source event lineage.
- Should not reuse UI event payloads directly.

Tenant trust exports:

- Need consent/export events, revocation/expiration lifecycle, tenant-safe projection, and metadata-only posture.

Operational routing:

- Needs deterministic event categories, priority/risk metadata, and workflow state without autonomous execution.

Controlled agent systems:

- Need actor/source lineage, human review posture, prompt/payload sensitivity, and clear non-autonomous governance semantics.
- AI/agent events should record decisions, restrictions, redactions, and review requirements without storing raw sensitive prompts or provider payloads.

## 15. DO NOT IGNORE

- Event coverage is not the same as event governance.
- Generic payload fields are a projection and privacy risk.
- Canonical events must not become raw provider/report/message/document storage.
- Actor identity, authority context, and resource scope must be deterministic before review workspaces expand.
- Financial/accounting event semantics must remain separate from operational workflow decisions.
- Tenant-safe event projections must be whitelists, not stripped admin objects.
- Evidence and institutional exports need event lineage, not just current UI state.
- Telemetry and logs are event-like data and need sensitivity/retention semantics.
- AI/agent governance events require manual-review posture and explainability before controlled routing expands.
- Do not migrate event collections until adapter semantics and projection tests are reviewed.
