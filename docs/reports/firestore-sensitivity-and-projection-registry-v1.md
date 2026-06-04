# Firestore Sensitivity and Projection Registry v1

## 1. Executive Summary

This registry defines RentChain's initial governance language for Firestore field sensitivity, projection safety, export allowlists, evidence handling, tenant-safe views, and future institutional exports.

This is a documentation and governance report only. It does not change Firestore schema, routes, exports, evidence packs, authorization, Firestore rules, redaction middleware, or runtime filtering behavior.

Current posture:

- `rentchain-api/firestore.rules` denies all direct client reads and writes. Firestore access is mediated through backend services using Admin SDK authority.
- Collection ownership is now documented in `docs/reports/firestore-collection-ownership-registry-v1.md`.
- Projection safety is still implicit across tenant workspace routes, landlord operational views, exports, evidence packs, screening/reporting flows, support tooling, and institutional package derivation.
- CSV import hardening already demonstrates the correct direction: strict allowlists, sensitive-column detection, and no storage of ignored banking fields.
- Future governance work needs a shared sensitivity/projection vocabulary before evidence infrastructure, institutional exports, tenant trust exports, review workspaces, and controlled operational routing expand.

This registry establishes the language and expectations for future implementation. It does not claim current runtime enforcement across every surface.

## 2. Sensitivity Classification Definitions

| Class | Definition | Examples | Default handling |
| --- | --- | --- | --- |
| Public | Information intentionally safe for public or unauthenticated display. | Public application link labels, approved marketing metadata, public status copy. | May be displayed publicly only through explicit public routes. |
| Internal | Non-public operational or system metadata that does not usually contain direct tenant financial, screening, or message content. | Internal IDs, route-source headers, deployment revision, diagnostic status, non-sensitive config keys. | Do not use as primary business labels. Label clearly when shown in support/debug contexts. |
| Operational | Day-to-day landlord/operator workflow data with limited PII or business sensitivity. | Property name, unit label, lease status, occupancy status, workflow status, operational labels. | Safe for scoped landlord operations when authority is server-side verified. |
| Sensitive | Personal, financial, tenancy, communications, or document data that can affect privacy, reputation, or obligations. | Tenant names, emails, phone numbers, applications, lease terms, payments, ledger rows, message bodies. | Whitelist projection required. Scope by actor and resource. |
| Restricted | High-risk regulated, provider, consent, report, export, document, or external-source data. | Screening results, reporting consents, tenant trust exports, ledger attachments, raw registry records. | Strongest allowlist and explicit purpose required. Not exposed in routine UI/export. |
| Critical | Secrets, credentials, raw banking/security identifiers, raw bureau reports, identity documents, tokens, and data that should almost never be copied or exported. | SIN/SSN, bank/card/account/routing/IBAN/SWIFT values, API keys, auth tokens, raw credit reports, raw provider payload dumps. | Prohibited from logs, routine projections, evidence packs, and exports unless a future reviewed system explicitly governs it. |

Classification should be assigned by the safest plausible use, not the most convenient current use. A field that is harmless in one context can become Sensitive or Restricted when exported, combined with identity fields, or shown outside its original workflow.

## 3. Projection Category Definitions

| Projection category | Audience/purpose | Allowed pattern | Prohibited pattern |
| --- | --- | --- | --- |
| Tenant-safe projection | Tenant workspace, tenant documents, tenant messages, tenant trust views. | Server-side whitelist of the tenant's own current/application/lease context. | Field stripping from landlord objects, other-tenant data, landlord internal notes, raw provider payloads. |
| Landlord operational projection | Landlord workflows for properties, leases, payments, occupancy, operations, screening status. | Scoped landlord data with operational labels and minimal necessary personal/financial fields. | Raw reports, raw banking data, unlabeled internal IDs, cross-landlord records. |
| Admin/support projection | Support and admin diagnostics for troubleshooting. | Role-gated views with clearly labeled Internal IDs and redacted sensitive payloads. | Full raw dumps by default, provider raw payloads, message/report bodies without purpose. |
| Evidence projection | Evidence packs and review bundles tied to a specific scope. | Deterministic scoped package with source lineage, redaction summary, operational labels, and sensitivity metadata. | Broad data lake export, raw provider payloads, unrelated tenant data, unlabeled internal IDs. |
| Institutional export projection | Future external/institutional package exports. | Explicit package type, actor, scope, authority, allowlist, retention, redaction policy, and audit event. | Reusing UI payloads as institutional exports, blacklist stripping, raw internal objects. |
| Internal-only projection | Backend processing, diagnostics, idempotency, workers. | Minimal internal fields needed for service execution. | Exposing internal-only data to tenant/landlord UI or exports. |
| Provider/raw projection | Provider adapters, webhook receipt, raw external import staging. | Restricted access, short lifecycle where possible, provenance, no routine projection. | Copying raw provider data into events, logs, evidence packs, tenant workspace, or landlord exports. |
| Audit-only projection | Append-oriented history and review trails. | Actor, scope, timestamp, action, outcome, and safe reason metadata. | Raw payload snapshots, mutable history, sensitive content where a reference is enough. |

## 4. Field-Type Classification Guidance

| Field type | Baseline class | Projection guidance |
| --- | --- | --- |
| Firestore document IDs, UUIDs, provider IDs | Internal | Use internally for joins/routes. Do not display as primary labels. If shown, label as `Internal ID`. |
| Property names and unit labels | Operational | Safe in landlord projections and tenant's own context. Avoid cross-landlord exposure. |
| Tenant/applicant names | Sensitive | Allowed in scoped landlord operations and tenant's own views. Avoid broad exports unless explicitly allowed. |
| Email, phone, address, emergency contacts | Sensitive | Tenant-safe only for own profile; landlord operational as needed; institutional export requires explicit allowlist. |
| Lease status, lifecycle, signing status | Operational/Sensitive | Display as operational state. Avoid legal/compliance claims. |
| Lease terms, rent amounts, dates, deposits, documents | Sensitive | Whitelist by workflow. Signed/generated documents are Restricted when exported or shared. |
| Payment amount/date/method/reference | Sensitive | Allowed in payment/ledger projections. Bank/card/account details are Critical and must not be carried through imports/exports. |
| Payment obligations and reconciliation evidence | Sensitive | Separate financial truth from workflow status. Evidence projection should include lineage and redaction policy. |
| Message metadata | Sensitive | Conversation labels/status can be projected by scope. |
| Message body/content | Sensitive | Tenant/landlord scoped only. Export requires explicit purpose and policy. |
| Screening status | Sensitive | Status-only operational projection is acceptable. |
| Screening raw report/provider payload | Restricted/Critical | Do not expose in routine UI, logs, evidence packs, or exports. |
| Reporting consent and submission metadata | Restricted | Status/timestamps can be projected carefully; raw submission/provider details remain restricted. |
| Registry normalized data | Sensitive | Use provenance-aware operational projections. |
| Registry raw records | Restricted | Internal/admin only. Do not expose by default in exports or evidence packages. |
| Audit actor/action/timestamp/scope | Sensitive | Audit-only projection; include enough context for traceability without raw payloads. |
| Logs, errors, stack traces, telemetry payloads | Internal/Restricted | Redact tokens, PII, message bodies, provider payloads, bank/card data, and raw CSV values. |
| Secrets, tokens, credentials, webhook signatures | Critical | Never project, export, or log. |

## 5. Collection-by-Collection Projection Guidance

This table documents projection expectations by collection family. It is not a runtime schema.

| Collection/family | Default sensitivity | Supported projection categories | Prohibited/default-excluded data | Notes |
| --- | --- | --- | --- | --- |
| `evidenceRecords` | Sensitive/Restricted | Evidence, audit-only, landlord operational, tenant-safe own context, admin/support, future institutional export | Raw Firestore IDs as labels, raw source payloads, provider payloads, raw reports, payment account details, identity documents, message bodies, storage paths, tokens, credentials, debug dumps | Evidence records are immutable metadata references. They must use safe evidence identifiers and allowlist projections. |
| `landlords`, `users`, `accounts` | Sensitive | Landlord operational, admin/support, internal-only | Password/auth secrets, tokens, unrelated role claims, raw session internals | Authority must resolve server-side through the shared resolver direction. |
| `properties` | Operational | Tenant-safe limited context, landlord operational, evidence, institutional export | Cross-landlord data, raw internal IDs as labels | Property labels are often safe operational anchors. |
| `units` | Operational | Tenant-safe own unit, landlord operational, evidence, institutional export | Stale occupant fields as truth, raw unit IDs as labels | Lease-derived occupancy should win for display projections. |
| `tenants` | Sensitive | Tenant-safe own profile, landlord operational, admin/support, evidence | Other-tenant records, raw lifecycle internals, unrestricted contact exports | Tenant projections should be whitelist-first. |
| `rentalApplications`, `applications`, `applicationLinks` | Sensitive/Restricted | Landlord review, tenant/applicant own context, evidence where scoped | Screening raw data, application token internals, unrelated applicant data | Applicant-to-tenant continuity requires careful lineage. |
| `leases`, `leaseDrafts`, `leaseSnapshots`, `leaseNotices`, `leaseWorkflowEvents` | Sensitive/Restricted | Tenant-safe current lease, landlord operational, evidence, institutional export | Raw draft internals, unrelated notices, legal-compliance claims | Lease documents/packages require explicit document projection rules. |
| `payments`, `ledgerEntries`, `rentPayments`, `paymentIntents`, `paymentReconciliationRecords`, `financialTransactions`, `rentCharges` | Sensitive/Restricted | Tenant-safe own ledger/payment, landlord operational, evidence, institutional export, audit-only | Bank/card/account/routing data, raw processor payloads, raw CSV values | Financial projections must preserve append-only ledger truth and due-date/reconciliation separation. |
| `ledgerImportBatches` | Sensitive | Landlord operational, admin/support, audit-only | Raw CSV, ignored columns, sensitive banking values | Current CSV import direction is a model for minimization. |
| `events`, `canonicalEvents`, `tenantEvents`, `activityEvents`, `event_log`, `leaseWorkflowEvents`, `ledgerEvents` | Sensitive | Audit-only, evidence, admin/support, selective landlord/tenant timeline | Raw payload snapshots, message bodies, provider payloads, tokens | Future event taxonomy should include sensitivity metadata. |
| `screeningOrders`, `screeningResults`, `screeningEvents`, `screeningReportExports`, `screeningReferrals`, `stripeEvents` | Restricted/Critical | Landlord status projection, admin/support, provider/raw, audit-only | Raw bureau reports, raw background reports, SIN/SSN, provider payload dumps, webhook secrets | Provider-neutral UI must not imply safe report export. |
| `reportingConsents`, `reportingSubmissions`, `tenantTrustExports`, `portfolioScoreSharing` | Restricted/Critical | Tenant-safe consent/status, landlord operational status, institutional export, audit-only | Raw reporting payloads, broad tenant history dumps, unscoped share tokens | Consent and external sharing need explicit projection lineage. |
| `conversations`, `messages`, `tenantMessageReads` | Sensitive | Tenant-safe own conversations, landlord operational, admin/support with restrictions | Other-tenant messages, message bodies in logs, broad message exports | Message content is high-sensitivity even when operational. |
| `workOrders`, `maintenanceRequests`, `workOrderUpdates`, `contractorProfiles`, `contractorInvites` | Sensitive | Tenant-safe own requests, landlord operational, vendor-scoped future projection, evidence | Raw tenant IDs as labels, unrelated tenant/property context, contractor token internals | Work-order operational label normalization is a known follow-up. |
| `operatorReviewSessions`, `landlordDecisionStates`, `decisionActions`, `actionRequests` | Sensitive | Landlord operational, evidence, audit-only, admin/support | Raw workflow serialization as visible labels, unrelated financial mutation claims | Workflow status must remain separate from financial status. |
| `tenantMoveInReadiness`, `tenancies`, `tenancy_invites`, `tenantInvites`, `tenantNotices`, `tenantNoticeReads` | Sensitive/Restricted | Tenant-safe own workspace, landlord operational, audit-only | Invite tokens, other-tenant context, landlord-only notes | Tenant workspace must remain whitelist-based. |
| `registryRecordsNormalized`, `propertyRegistryStatus` | Sensitive | Landlord operational, evidence with provenance, admin/support | Raw external records by default | Normalized registry data must carry source/provenance. |
| `registryRecordsRaw`, `registrySources`, `registryImports`, `registryAuditLog` | Restricted/Critical | Internal-only, provider/raw, audit-only | Raw external data in tenant/landlord/export UI | Raw records need retention and redaction policy before expansion. |
| `landlordUsage`, `billing_usage`, `billing_invoices` | Sensitive/Restricted | Landlord billing projection, admin/support, audit-only | Payment credentials, provider billing payloads, unrelated landlord data | Billing remains a protected area. |
| `telemetry_events`, `telemetry_counters`, `ai_events` | Internal/Sensitive | Internal-only, admin/support, audit-only | PII, message bodies, raw prompts/payloads, tokens | Logging/redaction hardening should precede broader use. |
| `config`, `settings`, integration/idempotency collections | Internal/Restricted | Internal-only, admin/support | Secrets, webhook signing material, live credentials | Configuration changes need audit trail and strict projection. |

## 6. Export Allowlist Philosophy

RentChain exports should be designed as explicit packages, not reused UI payload dumps.

Every future export profile should declare:

- Export name and version.
- Audience: tenant, landlord, support, evidence, institution, provider, internal.
- Business purpose.
- Actor and effective authority scope.
- Source collections and source timestamps.
- Allowed fields.
- Explicitly excluded fields.
- Sensitivity class.
- Redaction/minimization policy.
- Retention expectation.
- Audit event emitted.

Default export rules:

- Use allowlists, never blacklist stripping.
- Use operational labels instead of raw IDs as primary references.
- Include internal IDs only when needed and clearly labeled.
- Do not include raw provider payloads, raw CSV content, ignored CSV columns, bank/card/account/routing/IBAN/SWIFT data, SIN/SSN, auth tokens, webhook secrets, or debug dumps.
- Keep payment evidence dates separate from obligation due dates.
- Keep financial status separate from workflow status.
- Make export rows deterministic and reproducible from source data plus projection version.

## 7. Tenant-Safe Projection Philosophy

Tenant-facing projections must be purpose-built whitelists. They should never be produced by removing fields from landlord/admin objects.

Tenant-safe projections may include:

- Tenant's own profile summary.
- Current or relevant application/lease context.
- Tenant's own payments, ledger rows, messages, notices, documents, and readiness state.
- Operational property/unit labels for the tenant's own tenancy.
- Safe document statuses and links when authority is server-side verified.

Tenant-safe projections must exclude:

- Other tenants' data.
- Landlord internal notes, support/debug fields, route-source diagnostics, and internal-only workflow metadata.
- Raw screening/reporting/provider payloads.
- Raw registry data.
- Raw internal IDs as primary labels.
- Payment processor payloads and bank/card/account details.
- Admin/support annotations unless explicitly tenant-visible.

Tenant workspace linkage should be derived from canonical lease/application/tenant context and should prefer current active/upcoming lease records over stale fallback references.

## 8. Evidence Projection Philosophy

Evidence projections should be scoped, explainable, redacted packages, not raw database extracts.

Each evidence package should include:

- Evidence scope and reason.
- Operational context label.
- Source collection references and source timestamps.
- Projection version.
- Redaction/minimization summary.
- Actor and authority context.
- Sensitivity classification.
- Internal references only in explicitly labeled internal fields.

Evidence projections should not include:

- Raw bureau/screening reports.
- Raw reporting provider payloads.
- Raw CSV uploads or ignored banking columns.
- Message bodies unless the evidence scope explicitly requires them and a future policy allows it.
- Raw registry records unless a future governed evidence profile permits them.
- Unrelated tenant or property records.

The source data may remain append-oriented and complete for audit integrity. Redaction should happen in projection/export layers rather than by mutating canonical records.

### Evidence Record Field Classification

| Evidence record field group | Baseline class | Projection guidance |
| --- | --- | --- |
| `evidenceId`, `schemaVersion`, `evidenceClass`, `evidenceType`, `status`, `createdAt` | Operational/Sensitive | Safe for scoped evidence and audit projections when authority is resolved. |
| Internal Firestore document ID, `landlordId`, `resourceId` | Internal/Sensitive | Server-side joins only. Do not use as display labels or external export references. |
| `safeReference` | Sensitive | May be projected when labels and safe keys are used; raw IDs and payloads remain excluded. |
| `provenanceMetadata.createdBy`, `provenanceMetadata.authority` | Sensitive | Audit-only, admin/support, and governed evidence projections; tenant-safe only when actor context belongs to the tenant and is allowlisted. |
| `provenanceMetadata.source` | Sensitive/Restricted | Source collection and safe source key may be projected; raw source IDs and payloads must remain excluded. |
| `sensitivityMetadata` and `redactionSummary` | Operational/Sensitive | Required in evidence and export projections to explain redaction boundaries. |
| `retentionMetadata` | Internal/Sensitive | Admin/support and audit-only until retention policy is implemented. |
| Supersession fields | Sensitive | Safe evidence IDs may be projected for audit continuity; internal source IDs remain excluded. |

## 9. Institutional Export Philosophy

Institutional export support should not be implemented by broadening landlord exports. It needs a dedicated projection profile with stronger metadata and governance.

Future institutional exports should require:

- Export profile name/version.
- Institution/export recipient category.
- Landlord/tenant/property/portfolio scope.
- Authority and consent basis where applicable.
- Sensitivity classification.
- Field allowlist.
- Redaction policy.
- Retention policy.
- Audit trail and export hash/checksum if appropriate.
- Human-readable operational labels plus labeled internal references when needed.

Institutional exports should be blocked from including Critical data by default. Restricted data should require explicit future policy and review.

## 10. Restricted, Raw, and Provider Data Handling Guidance

Provider/raw data is not operational display data.

Raw or provider-originated data includes:

- Screening/bureau/background report payloads.
- Credit/reporting submission payloads.
- Stripe/provider webhook payload details beyond idempotency metadata.
- Raw registry/oracle records.
- Raw CSV uploads and ignored bank-export fields.
- Document binary contents or raw extracted text.
- Support/debug dumps.

Handling expectations:

- Store only when operationally necessary.
- Scope access tightly to internal/provider/admin-support contexts.
- Do not copy raw payloads into generic event collections.
- Do not log raw payloads.
- Do not embed raw payloads in evidence packs or tenant trust exports.
- Prefer sanitized summaries, status fields, hashes, provider reference IDs, and provenance metadata.
- Document retention/deletion expectations before expanding provider integrations.

## 11. Messaging and Privacy Guidance

Messaging data requires high-sensitivity treatment because message bodies can include maintenance issues, payment disputes, personal circumstances, legal concerns, and attachments or copied sensitive data.

Messaging projections should:

- Scope by landlord, tenant, conversation, and current lease/application/unit context.
- Show operational labels instead of raw conversation/resource IDs.
- Keep read/unread and latest-message metadata separate from message body export policy.
- Avoid logging message bodies.
- Avoid including message bodies in general evidence or institutional exports unless a future reviewed evidence profile explicitly allows it.
- Preserve tenant/landlord isolation even when conversations are linked by unit or lease rather than tenant ID.

Email notification payloads should use minimal preview content and should not expose unrelated operational data.

## 12. Screening and Reporting Guidance

Screening/reporting workflows should expose workflow status, consent status, provider option status, and operational next steps without exposing raw provider results by default.

Allowed operational projections:

- Screening not started / consent needed / awaiting applicant / in progress / completed / manual review.
- Provider path availability: available, manual, requires setup, coming soon.
- Consent state and timestamp where scoped.
- High-level review status and audit references.

Restricted/default-excluded:

- Raw credit reports.
- Raw background reports.
- Raw bureau/provider payloads.
- SIN/SSN/government identity values.
- Detailed adverse data unless a future reviewed reporting profile governs it.
- Provider credentials, tokens, webhook signatures.

Manual/offline screening references should remain workflow metadata, not a place to store raw report files without a future restricted document policy.

## 13. Registry and Oracle Raw-Data Guidance

Property registry/oracle data has two different projection classes:

- Normalized registry data can support property identity, provenance, and operational context.
- Raw registry records remain Restricted and should not be exposed by default.

Guidance:

- Preserve source/provenance metadata for normalized registry values.
- Do not expose raw external records to tenant/landlord UI by default.
- Evidence packages should use normalized labels and source summaries unless a future profile explicitly permits raw source excerpts.
- Registry audit logs should capture source, actor/system, timestamp, and outcome without dumping unrelated raw record payloads.

## 14. Logging and Redaction Guidance

Logging should be treated as a projection surface.

Never log:

- Secrets, API keys, auth tokens, session cookies, webhook signatures.
- SIN/SSN/government identity values.
- Bank account, card, routing, transit, institution, IBAN/SWIFT, authorization numbers.
- Raw CSV rows or ignored CSV columns.
- Raw screening/reporting/provider payloads.
- Full message bodies.
- Full signed/generated document contents.

Prefer structured logs with:

- Route/source.
- Actor type and safe actor reference when needed.
- Landlord/tenant/property/lease scope as internal references only where operationally necessary.
- Error code and sanitized reason.
- Correlation/request ID where available.

Future logging work should define a shared redaction helper and tests for known sensitive field names.

## 15. Future Implementation Recommendations

Recommended sequencing:

1. `test/projection-safety-regression-v1`
   Add tests that tenant workspace, exports, evidence packs, and operations payloads do not expose raw IDs, provider payloads, or restricted fields as primary display data.

2. `docs/canonical-event-taxonomy-v1`
   Define event names, actors, scopes, payload sensitivity, retention, and evidence eligibility.

3. `fix/evidence-pack-projection-profile-v1`
   Add explicit evidence projection profiles with source lineage, redaction metadata, and sensitivity class.

4. `fix/institutional-export-allowlist-v1`
   Define export package profiles before expanding institutional exports.

5. `fix/tenant-safe-projection-contracts-v1`
   Convert tenant workspace surfaces to documented projection contracts where not already explicit.

6. `fix/structured-logging-redaction-v1`
   Add shared logging/redaction guidance and tests for sensitive field-name suppression.

7. `feat/projection-registry-runtime-adapter-v1`
   Only after specs and tests exist, consider a small runtime projection registry adapter for high-risk export/evidence surfaces.

Safe-to-defer:

- Full runtime projection framework.
- Broad schema tagging.
- Data migrations.
- Institutional export implementation.
- Provider raw-data retention automation.

Must-fix-soon before institutional/export expansion:

- Evidence projection profiles.
- Tenant-safe projection contracts.
- Logging/redaction hardening.
- Event taxonomy with sensitivity metadata.

## 16. DO NOT IGNORE

- Blacklist stripping is not enough. Tenant, evidence, and institutional projections must be explicit allowlists.
- Raw provider data must not leak through events, logs, evidence packs, tenant trust exports, institutional exports, or support views.
- Message bodies are Sensitive data, not routine operational metadata.
- Screening/reporting data is Restricted even when the workflow status is safe to display.
- Internal IDs are product logic identifiers, not human-facing operational labels.
- Projection redaction should not mutate canonical source records or append-only audit history.
- Server-side authority resolution must decide projection scope. The frontend must not infer authority.
- Evidence packages need projection lineage before they can become institutional-grade artifacts.
- Export rows must be deterministic, scoped, and sensitivity-aware.
- Logs are projections. Treat them with the same privacy discipline as exports.
