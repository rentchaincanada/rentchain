# Renewal Tenant Communication Send Readiness v1

Branch: `audit/renewal-tenant-communication-send-readiness-v1`
Scope: audit and design only. No live email send, tenant notification, notice service, lease lifecycle mutation, backend endpoint, frontend send control, data model migration, or evidence mutation is implemented by this PR.

## 1. Current Workflow State After #1348

The renewal workflow stack now supports a safe pre-send lifecycle:

- `/leases#renewal-pipeline` surfaces upcoming renewal work.
- `/leases/:leaseId/workflows/renewal` lets the landlord enter and save renewal operator inputs.
- `/leases/:leaseId/workflows/renewal` and `/leases/:leaseId/workflows/notice` can generate a conservative tenant-facing renewal draft from saved operator inputs.
- `/leases/:leaseId/workflows/notice` presents the notice workflow as a review workspace, not a send workflow.
- The landlord can save a renewal notice draft snapshot.
- Saving a draft snapshot writes:
  - `renewalNoticeDraftSnapshots`
  - legacy `events`
  - landlord-visible `canonicalEvents`
- `/review-timeline?scope=lease&scopeId=<leaseId>` shows historical `Renewal notice draft saved` events.
- `/evidence-packs?scope=lease&scopeId=<leaseId>` groups repeated saved snapshots into a readable evidence-preview item.
- The UI and audit copy explicitly preserve the current state: not sent, not served, tenant not notified.

This is the right foundation for live communication, but it is intentionally not a communication-send system yet.

## 2. Existing Infrastructure Audit

### Renewal notice workflow routes and services

Relevant files:

- `rentchain-api/src/routes/leaseNoticeLandlordRoutes.ts`
- `rentchain-api/src/services/leaseNoticeWorkflowService.ts`
- `rentchain-api/src/routes/tenantLeaseNoticeRoutes.ts`
- `rentchain-frontend/src/pages/LandlordLeaseWorkflowPage.tsx`
- `rentchain-frontend/src/components/leases/LeaseRenewalNoticeDraftCard.tsx`
- `rentchain-frontend/src/api/landlordLeaseRenewalApi.ts`

Findings:

- Existing landlord lease-notice endpoints include:
  - `GET /api/landlord/leases/expiring`
  - `GET /api/landlord/leases/:id/renewal-inputs`
  - `PUT /api/landlord/leases/:id/renewal-inputs`
  - `POST /api/landlord/leases/:id/renewal-notice-draft-snapshots`
  - `POST /api/landlord/leases/:id/notice-preview`
  - `POST /api/landlord/leases/:id/send-notice`
  - `GET /api/landlord/leases/:id/renewal-status`
- `notice-preview` can also trigger automation when automation is requested in the request body.
- `send-notice` calls `performLeaseNoticeSendFromPreviewInput`.
- `performLeaseNoticeSendFromPreviewInput` creates a `leaseNotices` record, updates the lease to `renewal_pending`, sets `latestNoticeId`, sends email, then updates `deliveryStatus` to `sent` or `failed`.
- This legacy send path is not built from the saved renewal draft snapshot contract introduced by #1348.
- This legacy send path does not require an explicit confirmation token or modal-level acknowledgement that tenant communication will be sent.
- This legacy send path does not persist the exact tenant-facing draft body from `/workflows/notice`; it composes its own email intro and tenant portal link.
- This legacy send path mutates lease lifecycle state, which is outside the desired first live tenant-communication send contract.

Conclusion: existing lease-notice send code is useful prior art, but it should not be wired directly into the #1348 renewal draft workflow without a new guarded endpoint and UI confirmation layer.

### Email provider infrastructure

Relevant files:

- `rentchain-api/src/services/emailService.ts`
- `rentchain-api/src/config/requiredEnv.ts`

Findings:

- `sendEmail` currently supports Mailgun only through `EMAIL_PROVIDER=mailgun`.
- Mailgun sends are synchronous from the app path.
- Provider success returns no durable provider message ID from `sendEmail`; only an in-memory `lastEmailPreview` is updated.
- Provider errors are logged with a correlation ID and redacted recipient preview.
- There is no general delivery webhook ingestion in the audited path for delivered, opened, bounced, complained, or suppressed states.
- There is no generic idempotency key or duplicate-send ledger in `sendEmail`.

Conclusion: email infrastructure can dispatch an email, but it is not sufficient by itself for renewal notice communication because delivery status, idempotency, exact sent body, and audit linkage must be modeled above it.

### General landlord/tenant messaging

Relevant files:

- `rentchain-api/src/routes/messagesRoutes.ts`
- `rentchain-frontend/src/pages/LandlordUnifiedInboxPage.tsx`

Findings:

- `/landlord/messages/conversations/:id` supports landlord messages to a tenant conversation.
- `/tenant/messages/conversation/:id` supports tenant replies.
- Message sends create `messages` documents and update `conversations`.
- Email notification for new messages is best-effort and throttled through `lastNotifiedAtTenantMs` / `lastNotifiedAtLandlordMs`.
- Messaging can resolve tenant email from conversation, tenant, lease, and application context.
- Messaging does not store a renewal-specific communication record, delivery provider response, provider message ID, legal-service disclaimer, snapshot ID, or evidence-ready source chain.
- Unified Inbox is a strong future read/reply surface, but it should not be the only record of a renewal notice communication.

Conclusion: unified inbox should be integrated as a communication/reply surface in a later phase, but a renewal notice send needs its own source-of-truth communication record.

### Tenant notice infrastructure

Relevant files:

- `rentchain-api/src/routes/tenantNoticesRoutes.ts`
- `rentchain-api/src/routes/tenantLeaseNoticeRoutes.ts`

Findings:

- `tenantNoticesRoutes` can create generic tenant notices and attempts a non-blocking email.
- It does not implement renewal draft snapshot linkage, explicit landlord confirmation, delivery ledger, canonical events, or legal-service separation.
- `tenantLeaseNoticeRoutes` projects `leaseNotices` to tenants, tracks tenant view as `tenant_viewed_notice`, and supports tenant response to lease notices.
- Tenant response can update lease state to `renewal_accepted` or `move_out_pending`.
- Tenant lease-notice projection is scoped to the authenticated tenant and uses tenant-safe projection metadata.

Conclusion: tenant lease-notice projection has useful tenant-safe display and response concepts, but renewal communication v1 should not create tenant response obligations or lease lifecycle transitions until the communication/send contract is separately approved.

### Audit, evidence, and timeline

Relevant files:

- `rentchain-api/src/services/auditEventsService.ts`
- `rentchain-api/src/types/events.ts`
- `rentchain-api/src/lib/events/buildEvent.ts`
- `rentchain-api/src/lib/evidencePacks/deriveEvidencePack.ts`
- `rentchain-api/src/lib/reviewTimeline/deriveCanonicalReviewTimeline.ts`

Findings:

- The legacy `events` type currently includes `renewal_notice_draft_saved`.
- #1348 writes landlord-visible canonical events for draft snapshots.
- Evidence preview can include grouped draft snapshot context from `canonicalEvents`.
- Review timeline can show historical canonical events.
- There are no canonical labels or event contracts yet for renewal communication send review, send confirmation, send attempted, email sent, email failed, delivery updated, bounced, or delivered.
- Evidence preview does not yet have a sent-communication evidence item type or delivery status model.

Conclusion: audit/timeline/evidence infrastructure can support the future workflow if new event types and projection labels are introduced deliberately.

## 3. Current Gaps

The existing system is not ready for safe live renewal tenant communication without additional implementation.

Current gaps:

- No renewal-draft-based live send endpoint.
- No recipient preview endpoint tied to saved `renewalNoticeDraftSnapshots`.
- No explicit confirmation token or confirmation acceptance contract.
- No duplicate-send/idempotency protection for a saved snapshot.
- No dedicated `renewalNoticeCommunications` record or equivalent source-of-truth.
- No durable provider message ID capture from Mailgun.
- No delivery webhook/status update path for delivered, opened, bounced, complained, or suppressed states.
- No partial-success model for multiple tenants.
- No multiple-recipient lease model for co-tenants.
- No exact sent body/subject persisted in a renewal communication record.
- No evidence projection for sent renewal communication records.
- No canonical timeline labels for send attempt/sent/failed/delivery update.
- No legal-service boundary field such as `legalServiceStatus: "not_established"`.
- Existing legacy `send-notice` mutates lease status and creates `leaseNotices`; that is too broad for the first communication-send v1.
- Tenant email source resolution exists in several places but is not centralized into a recipient preview projection for renewal notices.

## 4. Recommended v1 Send Architecture

The first live implementation should be a new supervised communication workflow, not a direct reuse of legacy `send-notice`.

Recommended flow:

1. Landlord saves a renewal notice draft snapshot.
2. Landlord opens `/leases/:leaseId/workflows/notice`.
3. The notice workflow shows:
   - latest saved snapshot status
   - exact draft body
   - recipient preview
   - tenant email validation state
   - sender/context
   - lease/property/unit context
   - delivery method: email
   - audit/evidence explanation
   - legal/product guardrail copy
4. Landlord clicks `Review send details`.
5. A confirmation modal opens.
6. The modal requires:
   - recipient list review
   - subject/body preview
   - delivery method review
   - checkbox: `I understand this sends communication to tenant(s).`
   - checkbox or explicit acknowledgement: `I understand email delivery does not establish legal service.`
7. Only after confirmation does the frontend call the live send endpoint.
8. Backend creates a communication record before provider send is attempted.
9. Backend records audit events for review/confirmation/attempt/sent/failed.
10. Backend stores the exact sent body, subject, recipients, actor, snapshot ID, timestamps, provider response metadata, and delivery status.
11. Timeline shows communication events without using legal-service language.
12. Evidence preview includes the sent communication record and delivery status as review context.

Recommended future endpoint:

`POST /api/landlord/leases/:leaseId/renewal-notice-communications`

Possible request payload:

```json
{
  "snapshotId": "snapshot-id",
  "subject": "Renewal details for review",
  "draftText": "Exact draft body being sent",
  "recipients": [
    {
      "tenantId": "tenant-id",
      "email": "tenant@example.com",
      "displayName": "Tenant Name"
    }
  ],
  "deliveryMethod": "email",
  "confirmationAccepted": true,
  "noLegalServiceClaim": true,
  "idempotencyKey": "lease-id:snapshot-id:email:v1"
}
```

Possible response:

```json
{
  "ok": true,
  "communicationId": "communication-id",
  "auditEventId": "event-id",
  "canonicalEventId": "canonical-event-id",
  "deliveryStatus": "email_sent",
  "attemptedAt": "2026-07-11T17:00:00.000Z",
  "sentAt": "2026-07-11T17:00:01.000Z",
  "providerMessageId": "provider-message-id-if-safe"
}
```

## 5. Required Backend Behavior

Future backend implementation should:

- Require landlord authentication and server-side lease ownership.
- Load the saved draft snapshot by `snapshotId`.
- Verify the snapshot belongs to the same lease and landlord.
- Verify the snapshot has not been superseded or explicitly choose latest-only behavior.
- Resolve tenant recipients server-side from tenant/lease records.
- Return a recipient preview before send or include recipient validation in the confirmation-readiness load.
- Require `confirmationAccepted: true`.
- Require `noLegalServiceClaim: true`.
- Require `deliveryMethod: "email"` for v1.
- Persist a `renewalNoticeCommunications` record before send attempt.
- Store:
  - `communicationId`
  - `snapshotId`
  - `leaseId`
  - `landlordId`
  - tenant recipient IDs/emails
  - subject
  - exact body sent
  - actor ID/email
  - attempted/sent/failed timestamps
  - provider name
  - provider message ID if available and safe
  - delivery status
  - legal service status explicitly set to `not_established`
  - no-service/no-compliance claim flags
- Write append-only legacy and canonical audit events.
- Avoid updating lease lifecycle state in v1.
- Avoid creating a legal notice served status in v1.
- Fail closed when tenant email is missing or invalid.
- For multiple recipients, either:
  - block until all required recipients are valid, or
  - support per-recipient status with clear partial-success semantics.
- Enforce idempotency by snapshot ID + delivery method + recipient set, or by caller-provided idempotency key.
- Reject duplicate sends unless the landlord explicitly starts a new communication attempt.

## 6. Required Frontend Behavior

Future `/leases/:leaseId/workflows/notice` implementation should add a secondary send-readiness section below the existing draft snapshot controls.

Required frontend surfaces:

- Draft snapshot status:
  - no snapshot saved
  - snapshot saved
  - latest snapshot timestamp/actor
- Recipient preview:
  - tenant display name
  - email
  - validation state
  - missing/unverified state
- Send readiness checklist:
  - draft snapshot saved
  - recipient email available
  - exact draft body available
  - landlord confirmation required
  - legal-service status not established
- Action:
  - `Review send details`
  - disabled until readiness passes
- Confirmation modal:
  - exact subject/body
  - recipients
  - delivery method
  - checkboxes for tenant communication and no legal-service claim
- Post-send state:
  - send attempted
  - email sent
  - email failed
  - delivery status pending
  - not served / service status not established
- Navigation:
  - open review timeline
  - open evidence preview
  - open unified inbox only after a communication/reply thread exists or can be safely resolved

The frontend must not show `Send renewal notice` until the backend contract and confirmation flow exist. Safer labels are:

- `Review send details`
- `Send tenant communication`
- `Email tenant communication`

## 7. Required Audit Events

Recommended canonical event types:

- `renewal_notice_send_review_opened`
- `renewal_notice_send_confirmed`
- `renewal_notice_email_send_attempted`
- `renewal_notice_email_sent`
- `renewal_notice_email_failed`
- `renewal_notice_delivery_status_updated`
- `renewal_notice_communication_recorded`

Optional later events:

- `renewal_notice_email_delivered`
- `renewal_notice_email_bounced`
- `renewal_notice_email_opened`
- `renewal_notice_tenant_reply_received`

Each audit event should include:

- lease ID
- landlord ID
- tenant IDs
- property ID
- unit ID
- actor ID/email
- snapshot ID
- communication ID
- delivery method
- delivery status
- legal service status
- no legal-service claim flag
- no compliance/enforceability claim flag

## 8. Required Evidence / Timeline Behavior

Timeline should show:

- `Renewal notice send review opened`
- `Renewal notice communication send confirmed`
- `Renewal notice email send attempted`
- `Renewal notice communication sent`
- `Renewal notice email failed`
- `Renewal notice delivery status updated`

Timeline must not show:

- `Notice served`
- `Tenant legally notified`
- `Statutory notice satisfied`
- `Legal delivery completed`

Evidence preview should include:

- saved draft snapshot source
- exact sent subject/body
- recipient list
- delivery method
- delivery status
- sent/attempted/failed timestamps
- actor
- provider metadata if safe
- legal service status: `Not established`

Evidence preview should not imply:

- legal service
- enforceability
- statutory compliance
- official notice delivery

## 9. Required Delivery Status Model

Recommended v1 statuses:

- `draft_saved`
- `ready_for_send_review`
- `send_pending`
- `send_attempted`
- `email_sent`
- `email_failed`
- `delivery_status_pending`
- `email_delivered`
- `email_bounced`
- `email_opened`
- `not_served`
- `service_status_not_established`

Recommended communication record shape:

```ts
type RenewalNoticeCommunication = {
  communicationId: string;
  snapshotId: string;
  leaseId: string;
  landlordId: string;
  recipients: Array<{
    tenantId: string | null;
    email: string;
    displayName: string | null;
    deliveryStatus: "pending" | "email_sent" | "email_failed" | "delivered" | "bounced";
    providerMessageId?: string | null;
    attemptedAt?: string | null;
    sentAt?: string | null;
    failedAt?: string | null;
    failureReason?: string | null;
  }>;
  subject: string;
  body: string;
  deliveryMethod: "email";
  communicationStatus: "send_attempted" | "email_sent" | "email_failed" | "partial_failure";
  legalServiceStatus: "not_established";
  noLegalServiceClaim: true;
  noComplianceClaim: true;
  actor: { id: string | null; email: string | null };
  createdAt: string;
  updatedAt: string;
};
```

## 10. Legal / Product Copy Guardrails

Allowed copy:

- `Send tenant communication`
- `Email delivery`
- `Communication sent`
- `Delivery status pending`
- `Draft snapshot saved`
- `Audit captured`
- `Evidence record`
- `Service status not established`
- `Review official lease documents and current requirements before relying on timing or notice requirements.`

Avoid copy:

- `Notice served`
- `Legally delivered`
- `Legally compliant`
- `Enforceable notice`
- `Statutory notice satisfied`
- `Tenant legally notified`
- `Must respond by`
- `Must serve by`

Required distinction:

- Email sent does not mean legal notice served.
- Delivery confirmation does not mean legal enforceability.
- Tenant communication does not determine statutory timing.

## 11. Risks

Key risks:

- Accidentally reusing legacy `send-notice` could create a lease lifecycle state change.
- Sending directly from a preview action could bypass explicit confirmation.
- Missing tenant email could produce inconsistent audit state.
- Multi-tenant leases could produce partial delivery without clear operator semantics.
- Provider success may only prove provider acceptance, not delivery.
- Bounce/delivery webhooks may be unavailable or unlinked.
- Copy could imply legal service if labels use `notice served` or `tenant notified`.
- Duplicate clicks could send duplicate emails without idempotency.
- Storing raw provider responses could leak sensitive data.
- A tenant reply could land in unified inbox without enough lease/snapshot context unless linked deliberately.

## 12. Non-goals

This audit PR does not implement:

- live email send
- tenant notification
- notice service
- legal delivery status
- legal deadline engine
- statutory compliance decisioning
- tenant-facing renewal acceptance flow
- tenant reply workflow
- attachment/document inclusion
- provider delivery webhook ingestion
- evidence package mutation
- lease lifecycle state changes
- Firestore rules changes
- infrastructure or secret changes

## 13. Implementation Sequence

Recommended future PR sequence:

1. Backend recipient/readiness preview.
   - Add a read-only endpoint for latest saved draft snapshot and tenant recipient preview.
   - No send behavior.
2. Frontend send readiness UI.
   - Add recipient preview and disabled `Review send details` state.
   - No send behavior.
3. Backend communication record and confirmation endpoint.
   - Add `POST /api/landlord/leases/:leaseId/renewal-notice-communications`.
   - Require saved snapshot, confirmation, idempotency, and no legal-service claim.
   - Store exact sent content and audit events.
4. Frontend confirmation modal.
   - Require explicit acknowledgement before calling send endpoint.
5. Evidence and timeline projection.
   - Add sent communication and delivery status to evidence preview and review timeline.
6. Delivery webhook/status hardening.
   - Add provider webhook linkage if Mailgun event payload and safe identifiers are available.
7. Unified inbox linkage.
   - Link tenant replies or follow-up messages to renewal communication context.

## 14. Manual QA Checklist

Before enabling live send:

- Landlord can see recipient preview before send.
- Missing tenant email blocks send.
- Invalid tenant email blocks send.
- Multiple recipients are either blocked or clearly handled.
- Confirmation modal displays exact recipients, subject, and body.
- Send button is disabled until confirmation checkboxes are complete.
- Duplicate click does not create duplicate emails.
- Send success creates a communication record.
- Send failure creates a failed communication record.
- Exact sent body is persisted.
- Timeline shows attempted/sent/failed communication events.
- Evidence preview shows sent communication context and delivery status.
- UI still distinguishes email delivery from legal service.
- No UI says notice served, legally delivered, legally compliant, or statutory notice satisfied.
- Tenant-facing route shows only tenant-safe communication/notice data.
- No raw provider payload, token, internal storage path, or raw ID appears as a primary label.
- Backend authorization rejects landlord access to another landlord's lease.
- Backend authorization rejects tenant access to landlord-only communication records.
- Provider/network failure does not mark email sent.
- Provider accepted state does not mark notice served.

## 15. Explicit Deferred Items

Deferred until separate approval:

- live tenant email send implementation
- tenant notification creation
- legal notice service workflow
- legal delivery or service status
- statutory deadline engine
- jurisdiction-aware send rules
- attachment/document inclusion
- saved communication templates
- tenant response workflow
- multi-recipient partial-success UX
- provider delivery webhook ingestion
- bounce/complaint/suppression handling
- unified inbox reply threading
- evidence package persistence beyond read-only projection
- lease lifecycle state changes from communication send

## Readiness Conclusion

RentChain has enough underlying pieces to design a safe renewal tenant communication workflow, but the existing live-send infrastructure is not sufficient to connect directly to the #1348 saved draft workflow.

The safe v1 implementation should introduce a new confirmation-gated communication record and endpoint, backed by explicit recipient preview, idempotency, exact-body persistence, append-only audit events, evidence/timeline projection, and copy that keeps email delivery separate from legal notice service.

Until that contract exists, `/leases/:leaseId/workflows/notice` should continue to present live tenant communication as deferred.
