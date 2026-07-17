# PAD Data Model v1

Status: conceptual Firestore design only; no collections, migrations or indexes are implemented

## Design Rules

- Canonical internal IDs drive authorization and joins; provider and legacy IDs are attributes.
- All money uses integer cents and ISO currency (`cad` for the first beta).
- Dates are UTC instants plus explicit local due-date/time-zone context where required.
- Operational history is append-safe. Corrections supersede or reverse rather than rewrite.
- Provider payloads are evidence inputs, not product records.
- Tenant, landlord/PM and support responses are separate whitelist projections.
- Unknown ownership, authorization, status or reconciliation fails closed.

Collection names are proposals. A build mission must reconcile them with existing `paymentIntents`, `rentPayments`, `paymentProviderEventReceipts`, `paymentReconciliationRecords`, canonical events and ledger entries before writing data.

## Relationship Model

```text
lease 1 -> many rentObligations
lease + tenant 1 -> many padMandates (at most one active per approved responsibility context)
rentObligation 1 -> many paymentAttempts
paymentAttempt 1 -> many providerEventReceipts
paymentAttempt 1 -> many reconciliation versions
successful reconciled paymentAttempt 1 -> zero/one receipt
all material records -> many canonical audit events
```

For multi-tenant leases, responsibility must be explicit. Do not assume every lease party authorizes or owes the full amount. A future `paymentResponsibilityId` or allocation record should define who is authorized for which obligation share.

## Payment Mandate

Proposed collection: `padMandates`

| Field | Type | Rule |
| --- | --- | --- |
| `id` | string | Canonical opaque mandate ID. |
| `landlordId`, `tenantId`, `leaseId`, `propertyId`, `unitId` | string | Internal authority/context; never user-facing labels. |
| `paymentResponsibilityId` | string/null | Required when multiple payors or allocated responsibility exists. |
| `provider` | enum | `stripe_acss` or approved future adapter key. |
| `providerAccountContextRef` | string | Opaque payee/connected-account context; restricted. |
| `providerCustomerId` | string | Opaque restricted reference. |
| `providerSetupIntentId` | string | Opaque restricted reference. |
| `providerPaymentMethodId` | string | Opaque restricted reference. |
| `providerMandateId` | string | Opaque restricted reference. |
| `status` | enum | State below; never defaults directly to active. |
| `authorizationType` | enum | `personal`, `business`, or provider/counsel-approved class. |
| `amountType` | enum | `fixed`, `variable`, `combined` only after counsel/provider mapping. |
| `authorizedAmountCents` | integer/null | Required only where agreement terms require a fixed/capped amount. |
| `currency` | string | First beta: `cad`. |
| `scheduleDescription` | string | Versioned, counsel-approved interval/trigger text. |
| `agreementVersion`, `agreementDigest` | string | Exact presented agreement identity; no raw document body in broad projections. |
| `authorizationEvidenceRef` | string | Safe evidence reference, not a public URL. |
| `authorizedAt`, `verifiedAt` | timestamp/null | Provider-confirmed milestones. |
| `cancellationRequestedAt`, `cancelledAt`, `effectiveCancellationAt` | timestamp/null | Preserve request and effective timing separately. |
| `cancellationReasonCode` | enum/null | Allowlisted; free text restricted to reviewed support record. |
| `createdBy`, `updatedBy` | actor reference | Safe actor/authority context. |
| `createdAt`, `updatedAt` | timestamp | Server timestamps. |
| `version` | integer | Optimistic concurrency / transition guard. |

Mandate statuses:

`draft`, `pending_authorization`, `pending_verification`, `active`, `suspended`, `cancellation_pending`, `cancelled`, `revoked`, `expired`, `failed_review`

Only verified provider evidence plus complete authorization evidence may transition a mandate to `active`. `cancelled`, `revoked` and `expired` are terminal for new attempts.

## Rent Obligation

Proposed collection: `rentObligations`

| Field | Type | Rule |
| --- | --- | --- |
| `id` | string | Deterministic from lease, responsibility, period and obligation version. |
| `landlordId`, `leaseId`, `tenantId`, `propertyId`, `unitId` | string | Canonical context. |
| `paymentResponsibilityId` | string/null | Payor/allocation context. |
| `periodStart`, `periodEnd` | local date | Non-overlapping rental period under approved policy. |
| `dueDate`, `dueTimeZone` | date/string | Business due date and zone. |
| `amountCents` | integer | Positive expected amount; never floating point. |
| `currency` | string | First beta: `cad`. |
| `status` | enum | Derived/transitioned state below. |
| `source` | enum | `lease_schedule`, `renewal`, `manual_adjustment`, `migration_opening_balance`. |
| `sourceLeaseVersion`, `sourceTermsDigest` | string | Exact terms used to generate it. |
| `scheduleRunId`, `previewFingerprint` | string | Generation/apply provenance and stale-preview protection. |
| `adjustments` | array of refs | References to append-safe adjustment records, not mutable inline history. |
| `supersedesObligationId` | string/null | Version lineage. |
| `collectionEligibility` | enum | `eligible`, `held`, `manual_only`, `requires_review`. |
| `createdAt`, `updatedAt` | timestamp | Server timestamps. |
| `version` | integer | Concurrency guard. |

Obligation statuses:

`scheduled`, `due`, `pending_payment`, `partially_paid`, `paid`, `failed`, `returned`, `overdue`, `waived`, `adjusted`, `cancelled`, `manual_review_required`

`failed` and `returned` do not erase the obligation. Paid amount should be derived from append-safe allocations across PAD, card and manual payments. `waived` requires an authorized adjustment record.

## Obligation Adjustment / Allocation

Use separate append-safe records rather than mutating obligation history:

- `rentObligationAdjustments`: amount delta, reason code, actor, approval, effective date, source and supersession.
- `paymentAllocations`: payment source/attempt, obligation, allocated cents, status, created/reversed timestamps and actor.

This supports partial payments, manual/offline payments, credits, reversals and one payment covering multiple obligations without representing non-PAD money as PAD.

## Payment Attempt

Proposed collection: `paymentAttempts`

| Field | Type | Rule |
| --- | --- | --- |
| `id` | string | Canonical attempt ID. |
| `rentObligationId`, `mandateId` | string | Required execution context. |
| `landlordId`, `tenantId`, `leaseId`, `propertyId` | string | Denormalized for scoped queries; validated from authority. |
| `provider`, `providerAccountContextRef` | enum/string | Restricted provider context. |
| `providerPaymentIntentId` | string/null | Opaque execution reference or equivalent provider ID. |
| `status` | enum | Lifecycle below. |
| `amountCents`, `currency` | integer/string | Must match approved obligation/adjustment. |
| `attemptNumber` | integer | Starts at one; retries create new records. |
| `retryOfPaymentAttemptId` | string/null | Explicit lineage. |
| `idempotencyKey` | string | Deterministic and unique for one approved attempt. |
| `noticeEvidenceRef` | string | Required proof that applicable notice gate passed. |
| `initiatedAt`, `pendingSettlementAt`, `settledAt`, `failedAt`, `returnedAt`, `cancelledAt` | timestamp/null | Provider-evidenced milestones. |
| `failureCategory`, `failureCodeRef` | enum/string/null | Normalized category and restricted provider code reference. |
| `failureMessagePublic` | string/null | Allowlisted tenant-safe copy only; no raw provider message. |
| `collectionDecisionRef` | string | Approval/policy version that allowed initiation. |
| `createdAt`, `updatedAt` | timestamp | Server timestamps. |
| `version` | integer | Concurrency guard. |

Attempt statuses:

`created`, `notice_pending`, `ready`, `initiation_queued`, `processing`, `pending_settlement`, `succeeded`, `failed`, `returned`, `cancelled`, `retry_scheduled`, `manual_review_required`

## Provider Event Receipt

Extend the existing receipt concept rather than store raw webhook bodies in product collections.

| Field | Rule |
| --- | --- |
| `receiptId` | Deterministic from provider, account context and provider event ID. |
| `providerEventId`, `providerEventType` | Restricted references/type. |
| `signatureVerified` | Must be true before processing. |
| `receivedAt`, `providerCreatedAt` | Timing and ordering evidence. |
| `normalizedStatus` | Provider-neutral status or `unknown`. |
| `subjectType`, `subjectId`, `paymentAttemptId` | Server-resolved links. |
| `amountCents`, `currency` | Minimal reconciliation facts. |
| `processingState` | `received`, `matched`, `unmatched`, `duplicate`, `ignored`, `failed`, `manual_review_required`. |
| `payloadDigest`, `schemaVersion` | Integrity/version metadata; not raw payload. |
| `processedAt`, `processingErrorCode` | Replay/recovery metadata. |

If forensic raw payload retention is required, counsel/security must approve a separate encrypted, tightly restricted store and retention policy. It must never enter tenant/landlord projections or logs.

## Payment Reconciliation

Extend `paymentReconciliationRecords` with versioned comparison facts:

- obligation/attempt/mandate/provider receipt references;
- expected vs observed amount/currency/payee context;
- settlement and return evidence;
- reconciliation state, reasons and policy version;
- `requiresManualReview`, `automationEligible` and reviewer decision reference;
- created/updated timestamps without overwriting prior decision history.

States: `pending`, `reconciled`, `failed`, `mismatch`, `duplicate_risk`, `returned`, `manual_review_required`.

## Payment Event / Audit Event

Use `canonicalEvents`, not an unrestricted mutable event log.

Conceptual fields:

- `eventId`, `eventType`, `occurredAt`, `createdAt`;
- safe actor and authority references;
- safe subject/parent references for mandate, obligation or attempt;
- `source`: tenant, landlord, system, provider, support;
- safe provider-event reference when applicable;
- allowlisted metadata summary and policy/version references;
- append-only/immutable flags.

Never include bank details, secrets, raw provider payloads, agreement bodies, raw internal IDs as visible labels or free-form failure messages.

## Receipt

Proposed collection: `paymentReceipts`

| Field | Rule |
| --- | --- |
| `id`, `receiptNumber` | Opaque canonical ID and stable human-safe number. |
| `paymentAttemptId`, `rentObligationId`, `leaseId`, `tenantId`, `landlordId` | Internal scoped references. |
| `amountCents`, `currency`, `issuedAt`, `paidPeriod` | Reconciled payment facts. |
| `status` | `issued`, `superseded`, `reversed`; never issued for pending initiation. |
| `providerReferencePublic` | Optional safe reference, not raw provider ID. |
| `documentObjectRef` | Restricted storage reference if a PDF is generated. Never expose raw storage path. |
| `supersedesReceiptId` | Correction lineage. |
| `createdAt` | Server timestamp. |

Downloads should use short-lived authorized URLs. A returned payment creates a return/reversal record and superseding receipt status; it does not delete the original receipt.

## Access And Projection Rules

- All reads resolve landlord/PM authority or tenant lease ownership server-side.
- Landlord projections exclude bank data, tenant agreement bodies and unrestricted provider/support data.
- Tenant projections include only the tenant's mandate, obligations, attempts, receipts and approved failure/support copy.
- Support projections are purpose-limited and audited; they do not grant mutation authority.
- Cross-landlord collection reads and client-supplied authority scopes are prohibited.
- Exports use safe public references and explicit columns; they never serialize Firestore documents wholesale.

## Sensitive Data That Must Never Be Stored

- Raw bank account, transit or institution numbers in RentChain product records.
- Online banking credentials, verification answers or micro-deposit values.
- Secret/restricted API keys, webhook signing secrets or client secrets after their short-lived use.
- Raw provider webhook/request/response payloads in logs, analytics, canonical events or user records.
- Unredacted dispute documents or unrelated financial/identity data.
- Bank information copied from the legacy PAP prototype.

## Retention

Retention is a counsel/privacy/security gate. The existing evidence policy uses a seven-year planning schedule for payment evidence, but this design does not declare that legally sufficient or automatically applicable. Define separate schedules for agreement evidence, provider receipts, payment/reconciliation records, notices, support decisions, exports and any restricted forensic payload store. Legal holds must fail closed and lifecycle changes must be append-safe.

## Index And Scale Planning

Before implementation, enumerate Firestore indexes for landlord/property/lease/tenant scopes, mandate status, obligation due date/eligibility, attempt status, provider event ID and reconciliation exception queues. Test query pagination and bounded worker batches at 3,000-unit and multi-month volumes. No unbounded collection scan or per-item N+1 provider lookup is acceptable.
