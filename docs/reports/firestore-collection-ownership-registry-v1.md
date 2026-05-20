# Firestore Collection Ownership Registry v1

## 1. Executive Summary

This registry documents current Firestore collection ownership, source-of-truth expectations, relationship dependencies, sensitivity levels, and export/projection risks in RentChain.

This is an audit and governance document only. It does not propose a schema rewrite, rename collections, migrate data, change routes, change authorization, or alter Firestore rules.

Current posture:

- `rentchain-api/firestore.rules` denies all direct client reads/writes. Runtime access is mediated through the backend/Admin SDK.
- Core operational source-of-truth collections are implicit in route/service usage rather than formally registered.
- Several domains now have canonicalization helpers, but collection ownership and projection rules are still documented unevenly.
- Export/evidence/read-model surfaces depend on many collections and need a formal sensitivity/projection registry before institutional exports expand.

## 2. Classification Language

| Classification | Meaning |
| --- | --- |
| Source of truth | Primary collection for a business entity or immutable record. |
| Derived/read model | Computed or denormalized view built from source data. Should be rebuildable or treated as secondary. |
| Event/audit | Append-oriented operational history, evidence, or audit signal. |
| Export/projection-sensitive | Data can leave normal product UI contexts or needs whitelist projection. |
| Operational coordination | Review queues, decisions, reminders, state handling, or operator workflows. |
| Ephemeral/system | Temporary jobs, redirects, probes, imports, usage counters, or external integration state. |

Sensitivity classes:

- Low: operational metadata with low PII exposure.
- Medium: landlord/property/unit/lease operational details.
- High: tenant/applicant identity, payment, screening, messages, documents, evidence, exports, audit trails.
- Restricted: provider payloads, raw reports, banking/security data, tokens, secrets, debug/system internals.

## 3. Collection Ownership Matrix

| Collection | Owner domain/service | Canonical purpose | ID semantics | Scope fields | Visibility expectation | Sensitivity | Export/projection risk | Event/audit dependencies | Relationships | Derived/read-model status | Mutation authority | Retention/lifecycle notes | Governance relevance |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `landlords` | Auth/account/entitlements | Landlord account/org profile and entitlement context | Usually auth/user or landlord doc ID | `landlordId`, `email` | Admin + owning landlord through server routes | High | Medium | `events`, `canonicalEvents`, usage docs | `users`, `accounts`, properties, leases | Source of truth | Auth/account/admin services | Retain account history; deletion rules not centralized | Critical for authority, billing, governance |
| `users` | Auth/session | User profile/session hydration source | Auth user ID | `landlordId`, `tenantId`, `role` | Server-authenticated only | High | Medium | Auth/session events where present | `accounts`, `landlords`, `tenants` | Source of truth / auth mirror | Auth/session services | Account lifecycle dependent | Critical for server authority resolver |
| `accounts` | Auth/session | Alternate account profile for hydration | User/account ID | `landlordId`, `tenantId`, `role` | Server-authenticated only | High | Medium | Auth/session events where present | `users`, `landlords`, `tenants` | Source of truth / auth mirror | Auth/session services | Account lifecycle dependent | Must be reconciled with `users` |
| `properties` | Properties/portfolio | Canonical property record | Firestore doc ID | `landlordId`, `ownerId`, `userId` | Owning landlord/admin; tenant via projection only | Medium | Medium | `activityEvents`, `events`, risk summaries | `units`, `leases`, tenants, work orders | Source of truth | Property/unit routes/services | Keep while active/archived portfolio exists | Core operational entity |
| `units` | Properties/occupancy | Canonical rentable unit record | Firestore doc ID; sometimes deterministic imported unit IDs | `landlordId`, `propertyId` | Owning landlord/admin; tenant via projection only | Medium | Medium | occupancy sync/audit events | `properties`, `leases`, tenants | Source of truth with stale occupant fallbacks | Unit/property/lease services | Lease-derived display should win over stale fields | Critical for occupancy coherence |
| `tenants` | Tenant lifecycle/workspace | Canonical tenant profile | Firestore doc ID; may differ from auth user ID | `landlordId`, `tenantId`, `propertyId`, `unitId` | Owning landlord/admin; tenant via whitelist projection | High | High | `tenantEvents`, `events`, tenant portal events | `leases`, `rentalApplications`, `payments`, documents | Source of truth | Tenant routes/services | Past/archived handling needs consistent lifecycle policy | Critical for privacy and workspace isolation |
| `rentalApplications` | Applications/screening | Current applicant/application source | Firestore doc ID | `landlordId`, `tenantId`, `propertyId`, `unitId` | Landlord/admin; applicant/tenant via controlled flows | High | High | `screeningEvents`, financial transactions | `applicationLinks`, screening orders, tenants, leases | Source of truth | Public application, screening, landlord review routes | May convert to tenant/lease; preserve applicant history | Critical for applicant-to-tenant lifecycle |
| `applications` | Legacy/application risk | Legacy or alternate application records | Firestore doc ID | `landlordId`, `tenantId`, `convertedTenantId` | Landlord/admin | High | High | Risk/application events | tenants, leases, screening | Legacy/source depending route | Legacy/risk services | Needs eventual consolidation with `rentalApplications` | Migration risk |
| `applicationLinks` | Public application links | Public application token/link metadata | Link doc ID/token hash | `landlordId`, `propertyId`, `unitId` | Public token flow + landlord/admin | High | High | link usage/application events | properties, units, rentalApplications | Source of truth for public link state | Public/landlord application link routes | Expiry/supersession lifecycle present | Consent and public exposure sensitive |
| `leases` | Lease/occupancy/payment | Canonical lease record and lease lifecycle anchor | Firestore doc ID; sometimes UUID-style IDs | `landlordId`, `tenantId`, `tenantIds`, `propertyId`, `unitId` | Landlord/admin; tenant via current lease projection | High | High | `leaseWorkflowEvents`, decision actions, ledger entries | tenants, properties, units, payments, docs | Source of truth | Lease routes/services | Active/upcoming/archived lifecycle must remain coherent | Central relationship spine |
| `leaseDrafts` | Lease generation | Draft lease package inputs | Draft ID | `landlordId`, `tenantId`, `propertyId`, `unitId` | Landlord/admin; tenant only when surfaced safely | High | High | generation/snapshot events | leases, leaseSnapshots | Source/draft state | Lease generation routes/services | May become stale after activation | Document linkage sensitive |
| `leaseSnapshots` | Lease generation/documents | Generated lease/package snapshot | Snapshot ID | `landlordId`, `leaseId`, `draftId` | Landlord/admin; tenant via document context | High | High | generation events | leaseDrafts, leases, generated files | Source for generated package | Lease generation routes/services | Must not mutate signed/generated history casually | Evidence/export relevant |
| `leaseNotices` | Lease notice workflow | Operational notice workflow records | Notice ID | `landlordId`, `tenantId`, `leaseId`, `propertyId`, `unitId` | Landlord/admin; tenant for own notices | High | High | `leaseWorkflowEvents`, events | leases, tenants, properties | Source of truth for notice workflow | Notice routes/services | Legal/workflow retention needs formal policy | Jurisdiction governance sensitive |
| `leaseWorkflowEvents` | Lease workflow audit | Lease/notice workflow events | Event ID | `landlordId`, `leaseId`, `noticeId` | Admin/landlord; tenant only via projection | High | High | N/A | leases, leaseNotices | Event/audit | Lease notice workflow service | Append-oriented | Evidence readiness |
| `payments` | Payments/canonical ledger linkage | Canonical recorded payment docs | Payment doc ID | `landlordId`, `tenantId`, `leaseId`, `propertyId`, `unitId` | Landlord/admin; tenant via payment projection | High | High | `ledgerEntries`, `events`, reconciliation | leases, tenants, ledgerEntries | Source of truth for canonical payments | Payment/import/manual record routes | Edits append adjustment ledger entries | Critical financial truth |
| `ledgerEntries` | Lease ledger | Immutable ledger rows for charges/payments/adjustments | Ledger entry ID | `landlordId`, `tenantId`, `leaseId`, `propertyId`, `unitId` | Landlord/admin; tenant via ledger projection | High | High | `ledgerEvents`, payment events | leases, payments, obligations | Source of truth / append-only ledger | Lease/payment/import routes | Append-only; do not mutate history | Critical audit/accounting record |
| `rentPayments` | Stripe/payment processor | Processor checkout/payment-intent rows | Processor/payment doc ID | `landlordId`, `tenantId`, `leaseId`, `propertyId`, `unitId` | Landlord/admin; tenant via payment projection | High | High | `paymentReconciliationRecords`, events | leases, paymentIntents, payments | Source for processor state, not manual payment truth | Stripe/payment routes/services | Processor lifecycle dependent | Payment reconciliation input |
| `paymentIntents` | Payment setup | Payment intent/setup state | Intent doc ID | `landlordId`, `tenantId`, `leaseId` | Landlord/admin; tenant via projection | High | High | reconciliation records | leases, rentPayments | Source for payment initiation | Payment/decision routes | Processor lifecycle dependent | Obligation readiness input |
| `paymentReconciliationRecords` | Reconciliation | Payment/obligation reconciliation evidence | Reconciliation doc ID | `leaseId`, `subjectId`, `paymentIntentId`, `rentPaymentId` | Landlord/admin; tenant via financial projection only | High | High | decisions/delinquency | leases, rentPayments, paymentIntents | Derived/evidence record | Reconciliation services | Must preserve evidence history | Critical for financial vs workflow separation |
| `ledgerImportBatches` | CSV import/audit | Sanitized payment import batch metadata | Import batch ID | `landlordId`, `createdBy` | Landlord/admin | High | High | payment/ledger writes | payments, ledgerEntries | Audit/import metadata | Ledger import routes | Must never store raw CSV/sensitive values | Import audit and duplicate prevention |
| `financialTransactions` | Financial operations | Cross-domain financial transaction tracking | Transaction ID | `landlordId`, `tenantId`, `propertyId`, `unitId`, `applicationId`, `workOrderId` | Landlord/admin; tenant projection only when appropriate | High | High | events/canonical events | screening, maintenance, payments | Source of truth for operational financial tx | Financial transaction service | Needs retention and export policy | Institutional/export sensitive |
| `rentCharges` | Rent charge workflow | Rent charge records | Charge ID | `landlordId`, `tenantId`, `propertyId` | Landlord/admin; tenant projection possible | High | High | `events` | tenants, payments | Source/legacy charge model | Rent charge service/routes | Relationship to lease obligations needs clarity | Potential overlap with obligations |
| `events` | General audit/timeline | Generic product/audit event records | Event ID | varies: `landlordId`, `tenantId`, `propertyId`, resource fields | Depends on projection; generally landlord/admin | High | High | N/A | all domains | Event/audit | Multiple services/routes | Append-oriented expectation, but taxonomy inconsistent | Critical event taxonomy candidate |
| `canonicalEvents` | Analytics/evidence | Canonicalized analytics/evidence events | Event ID | `landlordId`, resource fields | Landlord/admin/evidence projections | High | High | N/A | analytics, decisions, evidence | Event/audit/read-model input | Analytics/event services | Needs formal taxonomy and redaction classes | Governance foundation blocker |
| `tenantEvents` | Tenant activity | Tenant profile/activity events | Event ID | `landlordId`, `tenantId`, `leaseId`, `propertyId`, `unitId` | Landlord/admin; tenant projection only | High | Medium | tenant activity timelines | tenants, leases, payments | Event/audit | Tenant activity flows | Date/telemetry normalization follow-up noted | Tenant chronology coherence |
| `activityEvents` | Property activity | Property-scoped activity signals | Deterministic property/type/rule/day ID | `propertyId` | Landlord/admin | Medium | Medium | N/A | properties | Event/read-model hybrid | Activity event service | Deduped by day/rule | Operational summary input |
| `event_log` | Tenant portal audit | Tenant portal event log | Event ID | `landlordId`, tenant context | Tenant/admin/landlord projections | High | High | N/A | tenant workspace | Event/audit | Tenant portal event service | Append-oriented | Tenant workspace audit |
| `screeningOrders` | Screening provider workflow | Screening order/provider session state | Order ID | `landlordId`, `tenantId`, `applicationId` | Landlord/admin; tenant only via safe status | Restricted | High | `screeningEvents`, `stripeEvents`, financialTransactions | rentalApplications, screeningResults | Source of truth for screening order state | Screening/Stripe/webhook services | Provider payloads must remain minimized | Provider governance critical |
| `screeningResults` | Screening result summary | Stored screening result summaries | Result ID | `landlordId`, `tenantId`, `applicationId`, `orderId` | Landlord/admin; tenant access only if policy allows | Restricted | High | screening events/audit | screeningOrders, applications | Source/summary; raw payload must not be stored | Screening services | Retention/redaction policy needed | High privacy risk |
| `screeningEvents` | Screening audit | Screening workflow event records | Event ID | `landlordId`, `tenantId`, `applicationId`, `orderId` | Landlord/admin; tenant projection maybe status-only | Restricted | High | N/A | screeningOrders, applications | Event/audit | Screening events service | Append-oriented | Consent/provider audit |
| `screeningReportExports` | Screening exports | Screening report export metadata/files | Export ID | `landlordId`, `tenantId`, `applicationId` | Admin/landlord, tightly controlled | Restricted | Critical | export events | screening results/orders | Export/projection-sensitive | Screening report export service | Retention and access logging required | Institutional/privacy blocker |
| `screeningReferrals` | Screening metrics/referrals | Referral tracking and metrics | Referral ID/hash | `landlordId` | Admin/internal; maybe landlord metrics | High | Medium | metrics reports | screening orders | Derived/metrics | Referral tracking service | Retention policy unclear | Provider reporting |
| `stripeEvents` | Stripe webhook audit | Stripe event idempotency/state | Stripe event ID | order/payment references | Internal/admin | Restricted | High | N/A | screeningOrders, rentPayments | Event/audit/system | Stripe finalize service | Should retain for idempotency/audit | Webhook safety |
| `workOrders` | Maintenance | Canonical work-order/maintenance workflow | Work order ID | `landlordId`, `tenantId`, `propertyId`, `unitId` | Landlord/admin; tenant only own work orders; contractor scoped | High | High | workOrderUpdates, financialTransactions | properties, units, tenants, contractors | Source of truth | Work order routes/services | Needs operational label normalization follow-up | Vendor/institution ops |
| `maintenanceRequests` | Maintenance legacy/requests | Maintenance request records | Request ID | `landlordId`, `tenantId`, `propertyId`, `unitId` | Landlord/admin; tenant own requests | High | High | events/evidence | workOrders, properties, tenants | Source/legacy depending route | Maintenance routes | Relationship with `workOrders` needs clarity | Migration risk |
| `workOrderUpdates` | Maintenance audit | Work order update history | Update ID | `landlordId`, `workOrderId`, `tenantId` | Landlord/admin; tenant/contractor scoped | High | High | N/A | workOrders | Event/audit | Work-order routes/contractor assignment | Append-style expected | Evidence/export relevant |
| `contractorProfiles` | Marketplace/vendor | Contractor/vendor profile | Contractor ID | `landlordId`, network fields | Landlord/admin; contractor scoped if auth exists | High | Medium | work order assignment events | workOrders | Source of truth | Marketplace contractor routes | Retention for vendor history | Vendor workflow governance |
| `contractorInvites` | Marketplace/vendor | Contractor invitation state | Invite ID | `landlordId`, email | Landlord/admin | High | Medium | invite events | contractorProfiles | Ephemeral/source | Marketplace routes | Token/expiry policy needed | Vendor onboarding |
| `conversations` | Messaging | Conversation/thread metadata | Conversation ID, often deterministic landlord/tenant/unit | `landlordId`, `tenantId`, `leaseId`, `propertyId`, `unitId` | Landlord/tenant scoped | High | High | messages, read receipts | tenants, leases, units | Source of truth | Messages/tenant communications routes | Must preserve isolation and linkage | Privacy critical |
| `messages` | Messaging | Message body records | Message ID | `conversationId`, sender role | Landlord/tenant scoped by conversation | High | High | conversation metadata | conversations | Source of truth | Messaging services/routes | Retention and export policy needed | Privacy and legal discovery risk |
| `tenantMessageReads` | Messaging read state | Tenant message read receipts | Read ID | `tenantId`, conversation/message context | Tenant/landlord scoped | Medium | Medium | messages | conversations/messages | Read-model/state | Tenant portal messaging | Ephemeral-ish but audit relevant | UX/state consistency |
| `operatorReviewSessions` | Operational review | Review workspace/session records | Review session ID | `landlordId`, `scope`, `scopeId` | Landlord/admin/operator | High | High | events, evidence packs | decisions, evidence, resources | Source of truth for review sessions | Operator review routes | Append notes/outcomes expected | Review workspaces blocker |
| `landlordDecisionStates` | Decision workflow | Persisted workflow states for generated decisions | Composite `landlordId__decisionId` | `landlordId`, `decisionId` | Landlord/admin | High | Medium | decision actions/events | analytics decisions | Source state overlay | Decision state service | Derived decisions depend on this overlay | Workflow/financial separation |
| `decisionActions` | Lease ledger decisions | Action history for lease ledger decision cards | Deterministic action record ID | `landlordId`, `leaseId`, `decisionId` | Landlord/admin | High | Medium | decision workflow trail | leases, decisions | Event/audit/action state | Decision routes | Append/action history | Auditability of review actions |
| `actionRequests` | Action/workflow | Operational action request records | Request ID | `landlordId`, tenant/workflow fields | Landlord/admin; tenant dev bypass exists in some envs | High | Medium | events | tenant/workflow resources | Operational coordination | Action request routes | Needs route/authority review | Future routing surface |
| `tenantMoveInReadiness` | Tenant workspace/readiness | Tenant move-in/readiness read model + subevents | Tenant ID doc + `events` subcollection | `tenantId`, `landlordId`, `leaseId` | Tenant/landlord scoped | High | Medium | subcollection events | tenants, leases, units | Derived/read model | Tenant readiness service | Rebuild strategy unclear | Tenant workspace coherence |
| `tenancies` | Tenant portal context | Tenancy link/context records | Tenancy ID | `tenantId`, `landlordId`, `leaseId`, `propertyId`, `unitId` | Tenant/landlord scoped | High | High | tenant portal events | tenants, leases, units | Source/link model | Tenancies service | Relationship with leases/tenant records needs clarity | Tenant workspace authority |
| `tenancy_invites` | Tenant portal invites | Tenant invite state/token hash | Token hash/invite ID | `landlord_id`, `tenant_id`, property/unit | Public token + landlord/admin | High | High | invite supersession events | tenants, leases, units | Source of truth for invite flow | Tenant invite service | Token expiry/supersession critical | Public exposure risk |
| `tenantInvites` | Legacy tenant invites | Legacy invite records | Invite ID | `landlordId`, `tenantId` | Landlord/admin; tenant token flow | High | High | invite events | tenants | Legacy/source | Tenant details/routes | Consolidate with `tenancy_invites` later | Migration risk |
| `tenantNotices` | Tenant notices | Tenant notice records | Notice ID | `landlordId`, `tenantId` | Tenant/landlord scoped | High | Medium | read receipts | tenants | Source of truth | Tenant notices routes | Retention policy needed | Communications governance |
| `tenantNoticeReads` | Tenant notices read state | Read receipts | Read ID | tenant/notice context | Tenant/landlord scoped | Medium | Low | tenant notices | tenantNotices | Read-model/state | Tenant notice routes | Ephemeral-ish | UX/state |
| `reportingConsents` | Credit/reporting consent | Tenant reporting consent records | Consent ID | `landlordId`, `tenantId` | Tenant/landlord/admin | Restricted | Critical | reporting submissions/events | tenants, reporting providers | Source of truth | Tenant reporting routes | Consent retention required | Consent governance blocker |
| `reportingSubmissions` | Credit/reporting queue | Reporting submission state | Submission ID | landlord/tenant context | Internal/admin; tenant/landlord status projection | Restricted | Critical | reporting events | reportingConsents, payments | System/export-sensitive | Reporting worker/sweeper | Queue lifecycle and retry policy | External reporting governance |
| `tenantTrustExports` | Tenant export/share | Tenant trust/share export records | Export ID | `tenantId`, `landlordId`, lease context | Tenant/landlord scoped | Restricted | Critical | export audit | tenants, leases, payments, documents | Export/projection-sensitive | Tenant trust export service | Strong retention/redaction needed | Institutional export readiness |
| `portfolioScoreSharing` | Portfolio sharing | Public/controlled portfolio score sharing records | Share ID/token | `landlordId` | Public token/admin/landlord | High | High | share events | portfolio scores/properties | Source/share state | Portfolio score sharing routes | Expiry/revocation needed | External exposure |
| `ledgerAttachments` | Lease ledger docs | Attachments tied to ledger/lease context | Attachment ID/hash | `landlordId`, `leaseId` | Landlord/admin; tenant if explicitly shared | Restricted | Critical | ledger/evidence | leases, ledger entries | Source of truth for attachment metadata | Lease routes/storage | Document retention needed | Evidence/export sensitive |
| `screeningReportExports`, `ledgerAttachments`, generated storage refs | Document/export layer | Export/document metadata referencing object storage | Export/attachment IDs | landlord/tenant/lease context | Strict projection only | Restricted | Critical | audit events | source domain collections | Export-sensitive metadata | Domain services | Retention/access logging needed | Institutional readiness blocker |
| `importJobs` | Imports | Import job state | Deterministic landlord/property/key ID | `landlordId`, `propertyId` | Landlord/admin/internal | Medium | Medium | import events | properties/units/tenants | Ephemeral/system | Import services | Should expire or remain as audit? unclear | Operational import governance |
| `ledgerEvents` | Ledger/event processing | Payment event processing source | Event ID | tenant/landlord context | Internal/admin | High | Medium | processing jobs | payments/ledger | Event/system | Event processor service | Append/process lifecycle unclear | Event taxonomy candidate |
| `risk_agent_runs` | Risk/AI audit | Risk agent run records | Run ID | entity IDs, landlord context | Admin/landlord projection | High | High | `risk_agent_decisions` | properties/tenants/applications | Event/audit/system | Risk agent persistence | Future AI governance sensitive | Controlled agent routing blocker |
| `risk_agent_decisions` | Risk/AI audit | Risk agent decision audit records | Decision ID | `landlordId`, resource IDs | Admin/landlord projection | High | High | risk agent runs | applications/tenants/leases | Event/audit/system | Risk decision audit service | Must preserve explainability | AI governance sensitive |
| `risk_agent_latest` | Risk read model | Latest risk summary per entity | Deterministic entity key | entity ID/type | Landlord/admin projection | Medium | Medium | risk runs | source domain entity | Derived/read model | Risk persistence service | Rebuild strategy needed | Read-model registry candidate |
| `registryRecordsNormalized` | Registry/oracle | Normalized property registry records | Source/record ID | registry source fields | Internal/admin; landlord projection as needed | High | High | registry audit/imports | properties | Source/external normalized | Identity oracle services | External data provenance needed | Property identity governance |
| `registryRecordsRaw` | Registry/oracle | Raw registry records | Source/record ID | registry fields | Internal/admin only | Restricted | Critical | registry audit/imports | normalized records | Raw external/source | Registry import services | Strong retention/redaction needed | Raw-data governance |
| `registrySources` | Registry/oracle | Registry source metadata | Source key | N/A | Internal/admin | Medium | Low | registry audit | registry records | Source metadata | Registry services | Retain source provenance | Data lineage |
| `registryImports` | Registry/oracle | Registry import job metadata | Import ID | source fields | Internal/admin | High | Medium | registry audit | raw/normalized records | Import/system | Registry import routes/services | Retention policy needed | Data lineage |
| `registryAuditLog` | Registry/oracle | Registry audit events | Event ID | source/record refs | Internal/admin | High | High | N/A | registry records/imports | Event/audit | Registry services | Append-oriented | Evidence/data lineage |
| `propertyRegistryStatus` | Registry/oracle | Property registry match/readiness status | Property/status ID | `propertyId`, `landlordId` | Landlord/admin | Medium | Medium | registry audit | properties, registry records | Derived/read model | Registry status services | Rebuild strategy needed | Identity normalization |
| `landlordUsage` | Entitlements/usage | Usage counters by landlord | Landlord ID | `landlordId` | Landlord/admin/internal | Medium | Low | billing/usage events | landlords/properties/units | Derived/counter | Entitlement/usage services | Recomputable from source counts? partly | Billing/plan governance |
| `billing_usage`, `billing_invoices` | Billing | Billing usage/invoice records | Billing IDs | `landlordId`, account IDs | Admin/landlord | Restricted | Critical | billing events | landlords, Stripe/customer data | Source of billing truth | Billing services | Financial/legal retention needed | Protected area |
| `telemetry_events`, `telemetry_counters` | Telemetry | Product telemetry and counters | Event/counter IDs | varies | Internal/admin | Medium to High | Medium | N/A | routes/frontend events | Event/derived | Telemetry routes/services | Avoid PII/raw payloads | Privacy/logging governance |
| `ai_events` | AI/task audit | AI agent event records | Event ID | task/user context | Internal/admin | High | High | N/A | AI tasks | Event/audit | AI agent service | Must avoid sensitive prompts/payloads | Future controlled agent governance |
| `config`, `settings` | Runtime config | Runtime settings/config docs | Config key | global/landlord context | Internal/admin | Medium | Medium | admin/config events | services | Source/system config | Config services | Change audit needed | Deployment/governance |

## 4. Canonical Source-of-Truth Map

Core entity sources of truth:

- Landlord/account: `landlords`, `users`, `accounts`
- Property/unit: `properties`, `units`
- Tenant/applicant: `tenants`, `rentalApplications`, legacy `applications`
- Lease/document workflow: `leases`, `leaseDrafts`, `leaseSnapshots`, `leaseNotices`
- Payments/accounting: `payments`, `ledgerEntries`, `rentPayments`, `paymentIntents`, `paymentReconciliationRecords`, `financialTransactions`
- Maintenance/vendor: `workOrders`, `maintenanceRequests`, `workOrderUpdates`, `contractorProfiles`
- Messaging/workspace: `conversations`, `messages`, read receipt collections
- Screening/reporting: `screeningOrders`, `screeningResults`, `screeningEvents`, `screeningReportExports`, `reportingConsents`, `reportingSubmissions`
- Operational review: `operatorReviewSessions`, `landlordDecisionStates`, `decisionActions`, `actionRequests`
- Audit/events: `events`, `canonicalEvents`, `tenantEvents`, `activityEvents`, `event_log`, workflow-specific audit collections

## 5. Relationship Map

Primary relationship spine:

```text
landlords/users/accounts
  -> properties
    -> units
      -> leases
        -> tenants
        -> payments
        -> ledgerEntries
        -> rentPayments/paymentIntents
        -> paymentReconciliationRecords
        -> leaseDrafts/leaseSnapshots/leaseNotices
        -> decisions/operatorReviewSessions/evidence packs
```

Tenant/applicant relationship:

```text
applicationLinks -> rentalApplications/applications -> tenants -> leases -> tenant workspace
```

Financial relationship:

```text
payments <-> ledgerEntries
rentPayments/paymentIntents -> paymentReconciliationRecords -> obligation/delinquency decisions
financialTransactions -> maintenance/screening/payment operational costs
```

Messaging/workspace relationship:

```text
tenants + landlordId + lease/unit/application context -> conversations -> messages -> read receipts
```

Screening relationship:

```text
rentalApplications -> screeningOrders -> screeningEvents/screeningResults/report exports
screeningOrders -> stripeEvents/financialTransactions
```

## 6. Sensitivity Classification Summary

Restricted collections:

- `screeningOrders`, `screeningResults`, `screeningEvents`, `screeningReportExports`
- `reportingConsents`, `reportingSubmissions`
- `ledgerAttachments`, document/export metadata
- `registryRecordsRaw`
- billing collections and provider webhook/idempotency collections

High-sensitivity collections:

- `tenants`, `rentalApplications`, `applications`
- `leases`, `leaseDrafts`, `leaseSnapshots`, `leaseNotices`
- `payments`, `ledgerEntries`, `rentPayments`, `paymentIntents`, `paymentReconciliationRecords`, `financialTransactions`
- `conversations`, `messages`
- `events`, `canonicalEvents`, `tenantEvents`, `operatorReviewSessions`, `decisionActions`

Medium-sensitivity collections:

- `properties`, `units`, operational read models, registry status, usage counters

## 7. Export/Projection Risk Summary

Highest-risk export/projection domains:

1. Screening and reporting outputs: raw bureau/provider data must never leak into routine exports.
2. Ledger/evidence/document exports: tenant/payment/lease data must use whitelist projection and operational labels.
3. Institutional export packages: must include sensitivity class, redaction policy, actor, scope, and retention metadata.
4. Messaging exports: message bodies are high-sensitivity and need explicit legal/privacy policy before broad export.
5. Registry raw records: raw external records need provenance and redaction controls.

Existing direction is good where CSV imports avoid sensitive banking values and evidence packs normalize visible labels. The missing layer is a reusable sensitivity/projection registry.

## 8. Event/Audit Dependency Summary

Event collections are fragmented by domain:

- Generic: `events`
- Canonical analytics/evidence: `canonicalEvents`
- Tenant activity: `tenantEvents`
- Property activity: `activityEvents`
- Tenant portal audit: `event_log`
- Screening: `screeningEvents`, screening audit collections
- Lease workflow: `leaseWorkflowEvents`
- Decision workflow: `decisionActions`, `landlordDecisionStates`, operator review sessions
- Registry: `registryAuditLog`
- Stripe/provider: `stripeEvents`

Current risk: event taxonomy and actor/resource/sensitivity fields are not yet standardized across all event families.

## 9. Read-Model / Derived-Data Observations

Likely derived/read-model collections:

- `risk_agent_latest`
- `tenantSummaries`
- `propertyRegistryStatus`
- `landlordUsage`
- `landlordAnalyticsSnapshots`, `analyticsSnapshots`
- `tenantMoveInReadiness`
- some decision/portfolio/score sharing surfaces

Risk: some read models are operationally important but do not consistently document rebuildability, source collections, or freshness semantics.

## 10. Current Governance Risks

Critical:

- Collection ownership is implicit in code paths and hard to review at PR time.
- Tenant/applicant/lease/payment relationships cross many collections and can drift without relationship tests.
- Export/evidence flows read across high-sensitivity collections without a formal sensitivity registry.
- Screening/reporting collections are restricted-risk but not yet governed by a dedicated projection taxonomy.

Medium:

- `rentalApplications` and legacy `applications` overlap.
- `tenantInvites` and `tenancy_invites` overlap.
- `workOrders` and `maintenanceRequests` overlap.
- Generic `events`, `canonicalEvents`, and domain-specific event collections lack a common event contract.
- Derived/read-model collections do not consistently document rebuild strategy.

Low:

- Naming inconsistencies: snake_case collections (`tenancy_invites`, `landlord_leads`) coexist with camelCase collections.
- Some ephemeral/system collections need retention labels.
- Usage/telemetry collections need explicit PII logging boundaries.

## 11. Institutional-Readiness Blockers

Must fix before institutional exports expand:

- Sensitivity/projection registry for collections and fields.
- Canonical event taxonomy with actor/resource/scope metadata.
- Export package audit trail and retention metadata standards.
- Clear consent mapping for reporting/screening/share exports.
- Read-model lineage metadata for institutional-facing summaries.

Must fix before review workspaces deepen:

- Explicit owner domain for decision/action/review collections.
- Centralized authority resolver adoption across review and work-order routes.
- Relationship tests proving lease/tenant/property/unit/payment context consistency.

## 12. Recommended Future Migration Priorities

1. `docs/firestore-sensitivity-and-projection-registry-v1`
   - Define field-level sensitivity and whitelist projection rules for exports, evidence packs, and tenant workspace views.

2. `docs/canonical-event-taxonomy-v1`
   - Standardize actor, resource, scope, event type, retention, and sensitivity metadata.

3. `test/firestore-relationship-continuity-v1`
   - Add fixture-driven tests for tenant/property/unit/lease/payment/document relationship consistency.

4. `fix/tenant-application-collection-consolidation-plan-v1`
   - Document and stage `rentalApplications` vs `applications` cleanup without migration execution.

5. `fix/work-orders-maintenance-collection-ownership-v1`
   - Clarify `workOrders` vs `maintenanceRequests` ownership and projection semantics.

6. `fix/read-model-lineage-registry-v1`
   - Document read-model source collections, freshness, rebuildability, and staleness behavior.

## 13. Safe-To-Defer Items

- CamelCase/snake_case naming cleanup.
- Physical collection renames.
- Full schema migration planning.
- Read-model rebuild jobs.
- Field-level projection implementation.

These should follow governance registry approval and should not be bundled into feature work.

## 14. DO NOT IGNORE

- `payments`, `ledgerEntries`, `rentPayments`, and `paymentReconciliationRecords` must remain coherently linked or financial truth will drift.
- `leases`, `tenants`, `properties`, and `units` are the relationship spine; stale unit/tenant fields must not override canonical lease-derived context.
- Screening/reporting/export collections are restricted-risk and must not leak raw provider, credit, banking, or consent data.
- `events` and `canonicalEvents` are becoming evidence infrastructure inputs; taxonomy drift will become expensive.
- Tenant workspace projections must remain whitelist-based, not field-stripping-based.
