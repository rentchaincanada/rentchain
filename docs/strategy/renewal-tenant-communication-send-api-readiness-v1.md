# Renewal Tenant Communication Send API Readiness v1

Branch: `audit/renewal-tenant-communication-send-api-readiness-v1`

Scope: docs/audit-only. This PR does not implement live email send, tenant notification, notice service, legal delivery status, lease lifecycle mutation, evidence mutation, frontend send enablement, backend endpoint changes, provider changes, Firestore rule changes, or data migration.

Future target: `feat/renewal-tenant-communication-send-api-v1`

## Objective

Determine the safest backend/API architecture for sending renewal tenant communication only after all of the following are true:

- A renewal notice draft snapshot has been saved.
- A renewal/send-approval decision exists and is approved.
- Recipient details are confirmed.
- The exact message subject and body are persisted.
- Explicit send confirmation is accepted.
- Delivery status is tracked without overclaiming legal service.
- Audit events are recorded.
- Evidence and review timeline projections remain safe.
- Email delivery is separated from legal notice service.

## Current State

Recently completed work provides the pre-send foundation:

- `/leases/:leaseId/workflows/renewal` saves renewal operator inputs and generates conservative draft copy.
- `/leases/:leaseId/workflows/notice` presents a notice review workspace, not a send workflow.
- `POST /api/landlord/leases/:id/renewal-notice-draft-snapshots` saves draft snapshots.
- Draft snapshot save writes `renewalNoticeDraftSnapshots`, legacy `events`, and landlord-visible `canonicalEvents`.
- `/evidence-packs?scope=lease&scopeId=<leaseId>` groups repeated saved draft snapshots.
- `/review-timeline?scope=lease&scopeId=<leaseId>` shows historical `Renewal notice draft saved` events.
- `/api/landlord/decision-queue` supports persisted decision items and lifecycle actions.
- `/leases/:leaseId/workflows/notice` can create and approve an internal `renewal_notice_send_review` decision.
- The UI clearly states send remains disabled after internal approval.

Still intentionally disabled:

- Live email send.
- Tenant notification.
- Notice creation/service for the saved-draft workflow.
- Legal delivery status.
- Lease lifecycle mutation.

## Files Reviewed

Backend:

- `rentchain-api/src/routes/leaseNoticeLandlordRoutes.ts`
- `rentchain-api/src/services/leaseNoticeWorkflowService.ts`
- `rentchain-api/src/routes/tenantLeaseNoticeRoutes.ts`
- `rentchain-api/src/routes/tenantNoticesRoutes.ts`
- `rentchain-api/src/routes/messagesRoutes.ts`
- `rentchain-api/src/services/emailService.ts`
- `rentchain-api/src/config/requiredEnv.ts`
- `rentchain-api/src/routes/landlordDecisionQueueRoutes.ts`
- `rentchain-api/src/services/landlordDecisionQueue/landlordDecisionQueueService.ts`
- `rentchain-api/src/services/landlordDecisionQueue/landlordDecisionQueueLifecycleService.ts`
- `rentchain-api/src/lib/evidencePacks/deriveEvidencePack.ts`
- `rentchain-api/src/lib/reviewTimeline/deriveCanonicalReviewTimeline.ts`
- `rentchain-api/src/services/tenantPortal/tenantInstitutionAccessService.ts`

Frontend:

- `rentchain-frontend/src/pages/LandlordLeaseWorkflowPage.tsx`
- `rentchain-frontend/src/components/leases/LeaseRenewalNoticeDraftCard.tsx`
- `rentchain-frontend/src/api/landlordLeaseRenewalApi.ts`
- `rentchain-frontend/src/api/landlordDecisionQueueApi.ts`
- `rentchain-frontend/src/pages/DecisionInboxPage.tsx`
- `rentchain-frontend/src/pages/OperationalCommandCenterPage.tsx`
- `rentchain-frontend/src/pages/DashboardPage.tsx`

Tests and prior strategy:

- `rentchain-api/src/routes/__tests__/leaseNoticeLandlordRoutes.test.ts`
- `rentchain-api/src/services/__tests__/leaseNoticeWorkflowService.renewalDraftSnapshot.test.ts`
- `rentchain-api/src/routes/__tests__/landlordDecisionQueueRoutes.test.ts`
- `rentchain-api/src/lib/evidencePacks/__tests__/deriveEvidencePack.test.ts`
- `rentchain-api/src/lib/reviewTimeline/__tests__/deriveCanonicalReviewTimeline.test.ts`
- `rentchain-frontend/src/pages/LandlordLeaseWorkflowPage.test.tsx`
- `docs/strategy/renewal-tenant-communication-send-readiness-v1.md`

## Existing Infrastructure Findings

### Email Provider

`rentchain-api/src/services/emailService.ts` provides a generic `sendEmail` function backed by Mailgun when `EMAIL_PROVIDER=mailgun`.

Findings:

- Mailgun dispatch exists and is used by several routes/services.
- `sendEmail` accepts `to`, `from`, `replyTo`, `cc`, `bcc`, `subject`, `text`, and `html`.
- Provider errors are logged with masked recipient context.
- A local `lastEmailPreview` stores masked diagnostic preview data.
- The service does not return a durable provider message ID.
- The service does not provide an idempotency contract.
- The audited renewal send-review flow does not currently call `sendEmail`.
- No delivery webhook/status ingestion was found for renewal notice communication.

Conclusion: email dispatch exists, but renewal send v1 needs a higher-level communication service that persists exact sent content, recipient state, idempotency, provider response metadata, audit links, and delivery status.

### Legacy Lease Notice Send

The existing landlord route `POST /api/landlord/leases/:id/send-notice` is mounted through `leaseNoticeLandlordRoutes.ts` and calls `performLeaseNoticeSendFromPreviewInput`.

Findings:

- It derives a preview from request body inputs, not from the saved draft snapshot.
- It resolves tenant email using `lookupUserEmail(lease.tenantId, ["tenants", "users"])`.
- It creates a `leaseNotices` record.
- It mutates the lease to `status: "renewal_pending"`.
- It sets `latestNoticeId`, renewal fields, notice rule fields, and response deadline fields on the lease.
- It sends an email immediately via `sendLeaseWorkflowEmail`.
- It marks `deliveryStatus` as `sent` or `failed`.
- It appends workflow events such as `lease_notice_due`, `lease_notice_sent`, and `landlord_notified`.
- It does not require the #1352 approval decision.
- It does not require snapshot ID, approval decision ID, explicit confirmation booleans, or idempotency key.
- It does not persist the exact `/workflows/notice` draft body that the landlord reviewed.

Risk conclusion: this route is unsafe to wire directly into the saved-draft renewal workflow because it sends immediately, creates notice records, mutates lease lifecycle state, and uses a different body/source contract.

### Tenant Notices and Tenant Lease Notices

`tenantNoticesRoutes.ts` and `tenantLeaseNoticeRoutes.ts` provide tenant-facing notice infrastructure.

Findings:

- `tenantLeaseNoticeRoutes.ts` projects `leaseNotices` to tenants and tracks tenant viewing/responding.
- Tenant responses can transition lease state toward renewal or move-out flows.
- `tenantNoticesRoutes.ts` can create generic tenant notices and attempt email.
- These routes are useful prior art for tenant-safe projection and response handling.
- They should not be reused for renewal communication send v1 because the current mission requires no notice service, no legal delivery status, and no lease lifecycle mutation.

### Messages and Unified Inbox

`messagesRoutes.ts` supports landlord/tenant conversations and best-effort notification email.

Findings:

- Message sends create `messages` documents and update `conversations`.
- Tenant email can be resolved from conversation, tenant, lease, and application context.
- Notification email is best effort and not the message source-of-truth.
- Existing message records are not linked to renewal draft snapshot ID, approval decision ID, legal-service separation, or delivery status.

Conclusion: unified inbox may become a reply/follow-up surface later, but renewal send v1 should create its own communication record and only integrate inbox behavior after the communication source-of-truth is defined.

### Decision Queue

`landlordDecisionQueueRoutes.ts` supports:

- `GET /api/landlord/decision-queue`
- `POST /api/landlord/decision-queue/items`
- `PATCH /api/landlord/decision-queue/items/:decisionItemId`

Findings:

- `renewal_notice_send_review` is an accepted source type.
- Persisted decision items can be created and lifecycle-updated.
- Approved state is internal approval only.
- Audit events include guardrail metadata:
  - `noSendBehavior: true`
  - `noTenantNotification: true`
  - `noNoticeServed: true`
  - `noLeaseLifecycleMutation: true`
- The decision queue does not currently enforce snapshot-to-approval binding for a future send endpoint.

Conclusion: future send API must verify a persisted `renewal_notice_send_review` decision belongs to the same landlord, lease, route, and snapshot, and has status `approved`.

### Draft Snapshot

`saveRenewalNoticeDraftSnapshot` persists `renewalNoticeDraftSnapshots`.

Findings:

- Snapshot input requires draft text and source values.
- It rejects delivery flags if `emailSent`, `noticeServed`, or `tenantNotified` are true.
- Stored snapshot includes tenant, property/unit, current rent, renewal rent, current lease end, proposed term, tenant response target date, generated draft text, actor, and no-delivery flags.
- It writes legacy and canonical audit events with summary: `Renewal notice draft saved. Not sent, not served, tenant not notified.`
- It does not mark a notice as sent or served.

Conclusion: future send API should derive exact body from the saved snapshot, not from mutable frontend text.

### Evidence and Timeline

Current evidence and timeline projections include saved draft snapshots.

Findings:

- Evidence preview groups repeated `renewal_notice_draft_saved` events into a clear item.
- Timeline keeps historical `Renewal notice draft saved` events.
- No labels exist yet for send confirmed, send attempted, email accepted/sent, failed, delivery pending, delivered, bounced, or delivery unknown.
- Evidence preview does not yet include a sent communication record.

Conclusion: future send API must introduce clear event/projection copy that says communication/email status without claiming legal service.

## Recipient Model Findings

Current recipient sources are fragmented:

- Legacy lease notice send uses `lease.tenantId` and `lookupUserEmail` against `tenants` then `users`.
- Frontend notice workflow uses the lease projection's `tenantEmail` and `tenantName` when available.
- Message routes contain richer fallback logic across conversation, tenant, lease, and application context.
- Multi-tenant/co-tenant behavior is explicitly deferred in the current send review UI.

Open decisions for future implementation:

- Whether recipient confirmation stores the current recipient projection or a snapshot of recipient values.
- Whether send should use current tenant email at send time or recipient values captured in confirmation.
- Whether changed tenant contact details after snapshot save should stale the approval.
- Whether v1 blocks multi-recipient leases or supports per-recipient status.

Recommendation:

- Future API should load recipients server-side and compare them against frontend-confirmed recipient data.
- V1 should block if the required tenant email is missing or invalid.
- V1 should either block multi-recipient leases with a clear reason or implement per-recipient status from the start. Blocking is safer for first send.
- Store recipient confirmation with timestamp, actor, tenant IDs, display names, emails, and hash/fingerprint of the confirmed recipient set.

## Approval Dependency Design

Future send API must require an approved persisted decision item.

Required checks:

- `approvalDecisionItemId` exists.
- Item is landlord-scoped to the authenticated landlord.
- `sourceType === "renewal_notice_send_review"`.
- `leaseId` matches route `leaseId`.
- `sourceRoute === /leases/:leaseId/workflows/notice` or otherwise matches the server-derived route.
- `sourceSnapshot.draftSnapshotId` or `metadata.draftSnapshotId` matches the `snapshotId` in the send request.
- `status === "approved"`.
- Status is not `returned`, `deferred`, `dismissed`, `resolved`, or stale.

Staleness rule:

- Approving one snapshot must not authorize sending a different snapshot.
- If a new snapshot is saved after approval, the send endpoint should require a new or refreshed approval tied to the latest snapshot.

## Draft Snapshot Dependency Design

Future send API must treat `renewalNoticeDraftSnapshots` as the source of truth for the outgoing body.

Required checks:

- `snapshotId` exists.
- Snapshot belongs to `leaseId`.
- Snapshot belongs to authenticated landlord.
- Snapshot status is `draft_saved`.
- Snapshot flags still indicate not sent, not served, and tenant not notified.
- Snapshot body is non-empty.
- Snapshot source values are available for audit/evidence context.

Request body should not be trusted as the canonical message body. If the frontend sends draft text for confirmation display, the API should either ignore it or compare it to the saved snapshot and reject mismatches.

## Confirmation Contract

Recommended future endpoint:

`POST /api/landlord/leases/:leaseId/renewal-notice-communications`

Required payload:

```json
{
  "snapshotId": "snapshot-id",
  "approvalDecisionItemId": "decision-item-id",
  "confirmationAccepted": true,
  "recipientReviewed": true,
  "bodyReviewed": true,
  "legalServiceAcknowledged": true,
  "noLegalServiceClaim": true,
  "idempotencyKey": "client-generated-or-server-compatible-key"
}
```

Server-derived values:

- Exact draft body from saved snapshot.
- Subject from server-side template/version.
- Recipients from server-side tenant/lease context and/or stored recipient confirmation.
- Actor from auth.
- Lease/property/tenant scope from server data.
- Approval/snapshot linkage from persisted decision item.

The API should reject if any required confirmation flag is missing or false.

Recommended response:

```json
{
  "ok": true,
  "communicationId": "communication-id",
  "status": "email_sent",
  "deliveryStatus": "delivery_status_pending",
  "attemptedAt": "2026-07-12T00:00:00.000Z",
  "sentAt": "2026-07-12T00:00:01.000Z",
  "providerMessageId": null,
  "auditEventId": "event-id",
  "canonicalEventId": "canonical-event-id"
}
```

## Recommended Data Model

Proposed collection: `renewalNoticeCommunications`

Recommended document shape:

```ts
type RenewalNoticeCommunication = {
  id: string;
  leaseId: string;
  landlordId: string;
  propertyId: string | null;
  unitId: string | null;
  snapshotId: string;
  approvalDecisionItemId: string;
  tenantIds: string[];
  recipients: Array<{
    tenantId: string | null;
    displayName: string | null;
    email: string;
    recipientReviewed: true;
    deliveryStatus: "send_pending" | "send_attempted" | "email_sent" | "email_failed" | "delivery_pending" | "delivered" | "bounced" | "delivery_status_unknown";
    providerMessageId?: string | null;
    attemptedAt?: string | null;
    sentAt?: string | null;
    failedAt?: string | null;
    errorCode?: string | null;
    errorMessageSafe?: string | null;
  }>;
  subject: string;
  body: string;
  bodyHash: string;
  actorId: string | null;
  actorEmail: string | null;
  status: "send_pending" | "send_attempted" | "email_sent" | "email_failed" | "partial_failure";
  deliveryStatus: "delivery_pending" | "delivered" | "bounced" | "delivery_status_unknown";
  provider: "mailgun";
  providerMessageId?: string | null;
  attemptedAt: string | null;
  sentAt: string | null;
  failedAt: string | null;
  errorCode?: string | null;
  errorMessageSafe?: string | null;
  confirmation: {
    accepted: true;
    recipientReviewed: true;
    bodyReviewed: true;
    legalServiceAcknowledged: true;
    noLegalServiceClaim: true;
    acceptedAt: string;
    acceptedBy: string | null;
  };
  noLegalServiceClaim: true;
  noComplianceClaim: true;
  noticeServed: false;
  legalServiceStatus: "not_established";
  tenantNotified: boolean;
  idempotencyKey: string;
  auditEventIds: string[];
  metadata: {
    apiVersion: "renewal_tenant_communication_send_api_v1";
    sourceWorkflow: "renewal_notice_review";
  };
  createdAt: string;
  updatedAt: string;
};
```

Notes:

- `tenantNotified` should mean communication was accepted for email send, not legal notice service.
- `noticeServed` must remain `false` in this v1.
- Store a `bodyHash` for duplicate detection and tamper-evident audit context.
- Do not store raw provider payloads unless redacted and explicitly approved.

## Delivery Status Model

Recommended v1 statuses:

- `send_review_approved`
- `send_pending`
- `send_attempted`
- `email_sent`
- `email_failed`
- `delivery_pending`
- `delivered`
- `bounced`
- `delivery_status_unknown`

Immediate statuses:

- `send_pending` when record is created before provider call.
- `send_attempted` when provider call starts.
- `email_sent` when provider accepts the send.
- `email_failed` when provider rejects or app/provider errors.
- `delivery_status_unknown` when provider accepts the message but no webhook/status confirmation exists.

Webhook-dependent statuses:

- `delivered`
- `bounced`
- `complained`
- `suppressed`
- `opened` if ever tracked and legally/product-approved.

Because no renewal delivery webhook path was found, v1 should report provider acceptance separately from delivery. It should not claim delivered unless a safe provider status source exists.

## Idempotency and Duplicate Send Prevention

Future send API must be idempotent.

Recommended requirements:

- Require an `idempotencyKey`.
- Scope idempotency to landlord, lease, snapshot, recipient set, and delivery method.
- Store idempotency key on the communication record.
- If the same key is retried, return the existing communication result.
- If the same snapshot/recipient set is sent with a different key, reject unless a future explicit resend workflow exists.
- Treat provider timeout carefully: persist attempted state before send, then reconcile as unknown instead of retrying blindly.

## Audit and Canonical Events

Recommended events:

- `renewal_notice_send_confirmed`
- `renewal_notice_email_send_attempted`
- `renewal_notice_email_sent`
- `renewal_notice_email_failed`
- `renewal_notice_delivery_status_updated`
- `renewal_notice_communication_recorded`

Each event should include:

- `leaseId`
- `landlordId`
- `tenantIds`
- `propertyId`
- `unitId`
- `actorId`
- `actorEmail`
- `snapshotId`
- `approvalDecisionItemId`
- `communicationId`
- `recipientCount`
- `recipientHash` or redacted recipient summary
- `subject`
- `bodyHash`
- `provider`
- `providerMessageId` if safe
- `status`
- `deliveryStatus`
- `noticeServed: false`
- `legalServiceStatus: "not_established"`
- `noLegalServiceClaim: true`
- `noComplianceClaim: true`

Decision queue integration:

- Send API should require approved decision.
- After a successful send attempt, it may update decision status to `resolved` or a future `sent_review_complete` equivalent if supported.
- If provider send fails, it should keep or move the decision to `blocked`/`returned`/`in_review` with a safe failure reason.
- Decision lifecycle update must be audited.
- Approval must never automatically send.

## Evidence and Timeline Projection

Timeline should distinguish each step:

- `Renewal tenant communication send confirmed`
- `Renewal tenant communication email send attempted`
- `Renewal tenant communication email accepted`
- `Renewal tenant communication email failed`
- `Renewal tenant communication delivery status updated`

Evidence preview should show:

- Communication subject.
- Exact body or a redacted/expandable body reference according to evidence policy.
- Recipients.
- Actor.
- Snapshot ID only if user-safe or hidden behind technical metadata.
- Approval decision linkage.
- Attempted/sent/failed timestamps.
- Provider accepted status.
- Delivery status.
- Guardrail: `Email delivery does not establish legal notice service.`

Evidence and timeline must not say:

- `Notice served`
- `Legally delivered`
- `Legally compliant`
- `Tenant legally notified`
- `Statutory notice satisfied`
- `Enforceable notice`

## Security, Auth, and Scoping

Required server-side checks:

- Require authenticated landlord authority.
- Resolve landlord ID server-side.
- Verify lease belongs to landlord.
- Verify snapshot belongs to lease and landlord.
- Verify approval decision belongs to landlord and lease.
- Verify recipients are tenant-safe and lease-linked.
- Fail closed for missing/ambiguous tenant contact.
- Do not trust frontend tenant IDs, emails, body, subject, or approval state as source-of-truth.
- Do not expose raw provider payloads, tokens, storage paths, or internal IDs as primary user-facing labels.
- Rate-limit future endpoint or enforce duplicate prevention strongly enough to avoid repeated sends.
- Keep tenant-facing projections whitelist-based.

Delegated/property-manager access:

- If delegated landlord access can operate lease workflows, the send API should resolve permissions server-side before allowing send.
- Actor attribution must preserve the actual authenticated user and delegated context, not only landlord ID.

## UI Implications

Before enabling send, `/leases/:leaseId/workflows/notice` needs:

- Latest saved snapshot status.
- Approved decision status tied to that snapshot.
- Server-derived recipient preview.
- Confirmation modal with exact recipients, subject, body, delivery method, and guardrails.
- Required checkboxes:
  - recipient reviewed
  - body reviewed
  - send communication acknowledged
  - no legal service acknowledged
- Disabled/blocked states for:
  - missing snapshot
  - stale approval
  - missing or invalid recipient
  - multiple recipients if v1 blocks co-tenants
  - prior sent communication for same snapshot
  - provider unavailable
- Post-send state:
  - attempted
  - email accepted
  - failed
  - delivery status unknown/pending
  - not served/service not established

Existing route impacts:

- `/decision-inbox` should show approval/send follow-up status without implying send happened before provider acceptance.
- `/operations` should surface failed or pending communication items compactly.
- `/dashboard` should remain high-level and should not duplicate the full workflow.
- `/review-timeline?scope=lease&scopeId=<leaseId>` should show communication events.
- `/evidence-packs?scope=lease&scopeId=<leaseId>` should include communication evidence only after the evidence projection is implemented.

## Legal and Product Copy Guardrails

Allowed:

- `Email sent`
- `Communication sent`
- `Provider accepted`
- `Delivery pending`
- `Delivery failed`
- `Tenant communication record`
- `Not legal notice service`
- `Legal service not established`
- `Delivery status unknown`

Avoid:

- `Notice served`
- `Legally delivered`
- `Legally compliant`
- `Enforceable`
- `Tenant legally notified`
- `Statutory notice satisfied`
- `Must respond by`
- `Must serve by`

Required distinction:

- Email provider acceptance is not legal service.
- Delivery confirmation is not a compliance guarantee.
- Tenant communication does not determine statutory timing.

## Recommended Future Implementation Sequence

1. `feat/renewal-tenant-communication-send-api-v1`
   - Add backend communication record and confirmation-gated send endpoint.
   - Require snapshot, approved decision, confirmation booleans, idempotency key, and server-derived recipients.
   - No lease lifecycle mutation or notice service state.
2. `feat/renewal-tenant-communication-send-confirmation-ui-v1`
   - Enable confirmation modal and live send button only after backend endpoint exists.
   - Keep exact body/recipient review visible.
3. `feat/renewal-tenant-communication-delivery-status-v1`
   - Add provider delivery status webhook or polling if safe provider identifiers are available.
4. `feat/renewal-communication-evidence-inclusion-v1`
   - Add sent communication records to evidence preview and timeline projection.
5. `feat/tenant-renewal-response-workflow-v1`
   - Add tenant response tracking separately from email send and legal service.

## Non-Goals and Deferred Items

This audit PR does not implement:

- Live tenant email send.
- Tenant notification.
- Notice service.
- Legal delivery status.
- Lease lifecycle mutation.
- New backend endpoint.
- Frontend send enablement.
- Legacy `send-notice` wiring.
- Email provider changes.
- Delivery webhook ingestion.
- Evidence mutation.
- Tenant-facing changes.
- Database migration.
- Firestore rules changes.
- Legal deadline engine.
- Jurisdiction-aware send rules.
- Multi-recipient send handling.
- Tenant response workflow.

## Readiness Conclusion

RentChain has the core prerequisites for a future supervised renewal tenant communication send workflow: saved draft snapshots, internal approval decisions, canonical audit events, evidence preview, review timeline, and a disabled send-review UI.

The system is not ready to safely enable live send by wiring existing `send-notice` or generic email paths. The safe v1 needs a new confirmation-gated API that binds one approved decision to one saved snapshot, derives recipients and body server-side, records a durable communication source-of-truth, enforces idempotency, preserves audit/evidence/timeline separation, and keeps email delivery distinct from legal notice service.
