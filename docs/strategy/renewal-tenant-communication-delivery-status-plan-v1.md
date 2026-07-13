# Renewal Tenant Communication Delivery Status Plan v1

## Current State

RentChain can send renewal tenant communications through the controlled landlord API:

- `POST /api/landlord/leases/:leaseId/renewal-notice-communications`
- Service owner: `rentchain-api/src/services/renewalNoticeCommunicationService.ts`
- Route owner: `rentchain-api/src/routes/leaseNoticeLandlordRoutes.ts`
- Storage collection: `renewalNoticeCommunications`

The send path requires a saved renewal draft snapshot, an approved renewal-send decision item tied to that snapshot, explicit send confirmations, and an idempotency key. The service writes a deterministic `communicationId`, stores the exact subject/body hash linkage, records send-confirmed/send-attempted/email-sent events, and keeps legal-service flags separate from email provider acceptance.

Email dispatch currently uses `sendEmail` in `rentchain-api/src/services/emailService.ts`. The active provider path is Mailgun through `EMAIL_PROVIDER=mailgun`. The app path posts synchronously to Mailgun and treats a successful response as provider acceptance for sending. The helper currently resolves without returning a durable provider message ID. `lastEmailPreview` is in-memory only and is not an evidence or reconciliation source.

Current communication records persist:

- `communicationId`
- `leaseId`, `landlordId`, `tenantId`, `propertyId`, `unitId`
- `snapshotId`
- `approvalDecisionItemId`
- `idempotencyKeyHash`
- subject, recipient email, and body hash
- `status` as `send_attempted`, `email_sent`, or `email_failed`
- `deliveryStatus` as `delivery_status_unknown`
- `provider` as `mailgun`
- `providerMessageId` as `null`
- attempted/sent/failed timestamps
- confirmation booleans
- audit and canonical timeline event IDs
- legal-service guardrail fields: `noticeServed: false`, `legalServiceEstablished: false`, `noLegalServiceClaim: true`

Evidence packages and review timelines already include renewal tenant communications. They translate `delivery_status_unknown` into the user-facing wording:

- `Delivery confirmation: Not tracked yet.`
- `Not served; legal service not established.`
- `Legal compliance not determined by this workflow.`

The notice workflow UI also separates current draft/send readiness from previous communication history and uses the same legal-service posture.

## Goals

1. Add an implementation-ready design for provider delivery status tracking without changing the current send behavior in this PR.
2. Preserve the existing controlled-send gates: saved snapshot, source-matched approval decision, explicit confirmations, idempotency, and server-side authorization.
3. Model provider acceptance separately from provider delivery confirmation.
4. Keep legal-service status separate from email provider status.
5. Allow evidence packages, review timelines, and the notice workflow to show real provider delivery status once safely recorded.
6. Preserve compatibility for existing records whose delivery status is still unknown/not tracked.
7. Avoid storing or exposing raw provider payloads unless a later compliance-reviewed implementation explicitly approves a redacted storage contract.

## Non-Goals

This plan does not implement:

- Mailgun webhook routes.
- Mailgun polling.
- Provider delivery tracking code.
- Provider webhook signature verification code.
- New send behavior.
- Extra email sends.
- Legal notice service.
- Lease lifecycle mutation.
- Tenant-facing delivery claims.
- Provider open/click tracking as legal evidence.
- A generic communication subsystem across all product surfaces.

## Provider Assumptions And Unknowns

Mailgun generally supports event-oriented delivery tracking through webhooks and event APIs, including delivery, failure/bounce, complaint, open, and click style events depending on account configuration and tracking settings. RentChain should verify the exact available event names, payload fields, webhook signing contract, retention window, and account-level tracking configuration against current Mailgun docs and account settings before implementation.

Current RentChain implementation facts:

- The send helper does not persist a Mailgun provider message ID.
- The Mailgun API response body is currently read only for error logging and is not parsed on success.
- Renewal communication records store a RentChain `communicationId` and hashed idempotency key, but no provider event identifier.
- No provider webhook ingestion route exists for renewal communications.
- No delivery-status polling job exists.

Open provider questions for implementation:

1. Which Mailgun response field is the stable message identifier for a successful send, and is it safe to persist?
2. Can RentChain attach a custom variable such as `communicationId`, `leaseId`, or an opaque event token to the outbound message so webhook events can reconcile without relying only on recipient/subject/timestamp matching?
3. Which event types are enabled for the current Mailgun domain: delivered, failed, bounced, deferred, rejected, complained, opened, clicked, unsubscribed, or stored?
4. Does the current domain enable open/click tracking, and should RentChain disable those events for renewal notices unless product/legal explicitly approves them?
5. What webhook signature verification mechanism and replay window should be enforced?
6. What is the provider event retention window for polling fallback?

## Proposed Delivery Status Model

Use a provider-delivery status that remains separate from the existing communication send status.

Recommended internal statuses:

| Status | Meaning | User-facing wording |
| --- | --- | --- |
| `not_tracked` | No provider delivery tracking is available for the record. | Delivery confirmation: Not tracked yet. |
| `accepted_for_sending` | Provider accepted the API send request. | Email accepted for sending. Delivery confirmation not tracked yet. |
| `queued` | Provider queued the message. | Queued by email provider. |
| `sent` | Provider reports message was sent onward. | Sent by email provider. |
| `delivered` | Provider reports recipient mail server accepted delivery. | Delivery confirmed by email provider. |
| `bounced` | Provider reports a bounce. | Bounce detected by email provider. |
| `failed` | Provider reports send/delivery failure. | Email delivery failed. |
| `deferred` | Provider reports temporary deferral. | Email delivery deferred by provider. |
| `rejected` | Provider rejected the message before delivery. | Email rejected by provider. |
| `complained` | Provider reports spam complaint. | Complaint reported by provider. |
| `opened` | Optional event if tracking is enabled and approved. | Open event recorded by provider. Not legal proof of receipt. |
| `clicked` | Optional event if tracking is enabled and approved. | Click event recorded by provider. Not legal proof of receipt. |
| `unknown` | Provider event exists but cannot be classified. | Delivery confirmation unknown. |

Existing `delivery_status_unknown` records should be mapped to `not_tracked` in UI/evidence until a migration or read-time adapter changes the stored value.

Status precedence should be deterministic:

1. `complained`, `bounced`, `failed`, or `rejected` should outrank positive or intermediate events.
2. `delivered` should outrank `sent`, `queued`, and `accepted_for_sending`.
3. `sent` should outrank `queued`.
4. `accepted_for_sending` should outrank `not_tracked`.
5. `opened` and `clicked` should not override delivery, bounce, complaint, or legal-service state. If retained at all, they should be secondary engagement events.

## Proposed Database And Storage Fields

Add fields to `renewalNoticeCommunications` records in a future implementation PR:

```ts
deliveryTracking: {
  status: "not_tracked" | "accepted_for_sending" | "queued" | "sent" | "delivered" | "bounced" | "failed" | "deferred" | "rejected" | "complained" | "opened" | "clicked" | "unknown";
  statusLabel: string;
  source: "mailgun_webhook" | "mailgun_events_api" | "send_response" | "manual_reconciliation" | "not_tracked";
  provider: "mailgun";
  providerMessageId: string | null;
  providerEventId: string | null;
  providerEventType: string | null;
  providerEventTimestamp: string | null;
  firstAcceptedAt: string | null;
  firstQueuedAt: string | null;
  firstSentAt: string | null;
  firstDeliveredAt: string | null;
  firstFailedAt: string | null;
  firstBouncedAt: string | null;
  firstComplainedAt: string | null;
  lastProviderEventAt: string | null;
  lastReconciledAt: string | null;
  reconciliationState: "not_started" | "matched" | "duplicate" | "unmatched" | "ambiguous" | "ignored";
  latestReason: string | null;
}
```

Add a dedicated provider event receipt collection only if implementation needs idempotent webhook replay protection:

- Collection: `communicationProviderEventReceipts`
- Deterministic ID: provider + domain + provider event ID, or provider signature timestamp/token hash when no stable event ID exists.
- Store only metadata required for replay protection and reconciliation.
- Do not store full raw provider payloads by default.

Potential receipt fields:

- `provider`
- `providerEventId`
- `providerMessageId`
- `communicationId`
- `eventType`
- `eventTimestamp`
- `receivedAt`
- `signatureVerified`
- `reconciliationState`
- `redactedPayloadHash`
- `ignoredReason`

## Proposed Provider Webhook Or Polling Flow

Preferred flow:

1. Outbound send attaches an opaque RentChain communication reference to Mailgun, if supported.
2. `sendEmail` parses the Mailgun success response and returns a provider message ID when available and safe.
3. `renewalNoticeCommunicationService` persists `providerMessageId` and initializes `deliveryTracking.status` as `accepted_for_sending`.
4. Mailgun sends delivery events to a new authenticated/signature-verified backend webhook.
5. Webhook verifies signature and timestamp before parsing event metadata.
6. Webhook normalizes provider event type into the internal delivery status model.
7. Webhook matches event to `renewalNoticeCommunications` using, in order:
   - explicit `communicationId` custom variable
   - provider message ID
   - provider event metadata plus recipient/subject/time window as manual-review fallback only
8. Webhook writes an idempotent provider event receipt.
9. Webhook updates the communication record only when the new event has equal or higher precedence, or records the event as secondary history.
10. Webhook appends canonical review timeline/audit events for meaningful status transitions.

Polling fallback:

- Use Mailgun Events API only if webhook reliability or historical backfill requires it.
- Polling should use the same provider event receipt and reconciliation path as webhooks.
- Polling must be bounded by lease/domain/time range and should not scan broadly from user-triggered requests.

## Idempotency And Event Reconciliation

Existing send idempotency remains keyed by landlord ID, lease ID, draft snapshot ID, and caller idempotency key. Delivery tracking should add provider event idempotency without changing send idempotency.

Rules:

1. Provider event receipts must be idempotent. A repeated provider event must not duplicate evidence/timeline items.
2. Delivery status updates must be monotonic by status precedence unless a later negative event corrects a prior positive event.
3. Events that cannot be matched to a communication record should be stored only as redacted receipts with `unmatched` state or logged through an operational observability path.
4. Ambiguous matches should not update a communication record automatically.
5. Existing communication IDs remain canonical product identifiers for evidence and timelines.
6. Provider message IDs are attributes, not primary product keys.
7. The idempotency key hash must not be exposed in frontend, evidence packages, or exports.

## Evidence And Timeline Implications

Evidence packages should continue to show one first-class evidence item per renewal tenant communication. Once delivery tracking exists, the item should include:

- Communication ID.
- Recipient email.
- Sent timestamp.
- Provider acceptance/send status.
- Delivery confirmation status.
- Draft snapshot ID.
- Approval decision ID.
- Confirmation/audit status.
- Legal-service status.
- Legal compliance status.

Recommended evidence wording:

- `Email accepted for sending.`
- `Delivery confirmation: Not tracked yet.`
- `Delivery confirmed by email provider.`
- `Bounce detected by email provider.`
- `Not served; legal service not established.`
- `Legal compliance not determined by this workflow.`

Review timelines should remain historical. They can add entries such as:

- `Renewal tenant communication accepted for sending`
- `Renewal tenant communication delivery confirmed by provider`
- `Renewal tenant communication bounce detected by provider`
- `Renewal tenant communication complaint reported by provider`

Timeline descriptions must include the same legal-service guardrail and must not state that legal notice was served.

## UI Implications

Notice workflow success and history cards should read delivery tracking as an operational provider signal:

- Existing records: `Delivery confirmation: Not tracked yet`.
- Accepted only: `Email accepted for sending. Delivery confirmation not tracked yet.`
- Delivered: `Delivery confirmed by email provider. Not served; legal service not established.`
- Bounced/failed/rejected: show clear follow-up state without changing lease lifecycle automatically.
- Complaint: show high-visibility follow-up state without exposing raw provider payload.

The send review panel should continue to require explicit confirmations and snapshot-matched approval before sending. Delivery tracking must not weaken those gates.

The step-card badge layout polish included with this planning PR uses wrapping flex headers so status pills do not overlap step titles at medium widths.

## Legal-Service Guardrails

Provider delivery status must never become legal-service status.

Do not claim:

- legal notice served
- statutory notice completed
- tenant legally received notice
- tenant opened notice as legal proof
- legal compliance achieved
- enforceability
- email delivery equals legal service

Always preserve wording such as:

- `Not served; legal service not established.`
- `Legal compliance not determined by this workflow.`
- `Delivery confirmed by email provider, if available.`
- `Bounce detected by email provider, if available.`

Even `delivered`, `opened`, and `clicked` statuses are provider operational signals only.

## Security And Privacy Considerations

1. Verify Mailgun webhook signatures and reject unsigned, expired, or replayed requests.
2. Store provider event receipts with minimum metadata.
3. Do not persist raw provider payloads by default.
4. Redact recipient/provider payload fields from logs.
5. Treat provider message IDs as sensitive operational references, not user-facing primary labels.
6. Avoid exposing provider event IDs in tenant-facing UI.
7. Keep landlord-facing evidence/timeline metadata focused on communication record IDs, timestamps, statuses, and legal guardrails.
8. Do not include idempotency keys or idempotency key hashes in UI.
9. Fail closed when an event cannot be matched to a landlord-owned communication.
10. Keep webhook routes isolated from tenant routes and protected by provider signature validation.

## Failure States

Implementation should handle:

- Provider webhook signature invalid.
- Provider event replay.
- Provider event missing message ID.
- Provider event missing communication custom variable.
- Provider event cannot be matched.
- Provider event matches multiple records.
- Provider event arrives before the send record has committed.
- Provider event downgrades an earlier status.
- Bounce after delivery.
- Complaint after delivery.
- Provider API outage.
- Provider webhook outage.
- Polling rate limits.
- Malformed provider payload.
- Communication record missing or scope mismatch.

Each failure state should record enough metadata for operator follow-up without exposing raw provider payloads or changing legal-service state.

## Test Plan

Backend tests:

- Mailgun send response parser returns provider message ID when available.
- Webhook signature verification accepts valid provider events and rejects invalid/replayed events.
- Provider event normalization maps Mailgun events to internal statuses.
- Provider event receipt writes are idempotent.
- Duplicate webhook event does not duplicate timeline/evidence records.
- Unmatched provider event does not update a communication record.
- Ambiguous provider event does not update a communication record.
- Delivered event updates delivery tracking but not `noticeServed`.
- Bounce/failure/complaint event updates delivery tracking but not lease lifecycle.
- Evidence derivation shows delivery confirmation wording and legal-service guardrails.
- Timeline derivation shows historical provider events and legal-service guardrails.

Frontend tests:

- Notice workflow shows `Not tracked yet` for old records.
- Notice workflow shows provider-confirmed delivery without legal-service claims.
- Notice workflow shows bounce/failure follow-up without lease lifecycle claims.
- Previous communication cards wrap long IDs and preserve readable status fields.
- Send controls still require snapshot-matched approval and confirmations.

Validation commands should include targeted backend tests, targeted frontend tests when UI changes, backend build, frontend build when UI changes, `git diff --check`, and `git diff --cached --check`.

## Rollout Plan

1. Merge this planning PR.
2. Confirm Mailgun event payload, signature, custom variable, and account tracking behavior against current account settings.
3. Implement provider message ID capture from send response if Mailgun returns a safe stable ID.
4. Add delivery tracking fields with read-time compatibility for existing `delivery_status_unknown` records.
5. Add webhook receipt and normalization path behind tests.
6. Add evidence/timeline projection updates.
7. Add UI status rendering updates.
8. Deploy backend and verify Cloud Run revision/image freshness.
9. Perform safe controlled-send QA to an internal tenant inbox only.
10. Perform webhook replay/idempotency QA with non-production provider events or safe test events.
11. Monitor for unmatched/ambiguous provider events before enabling broader use.

## Follow-Up Implementation PR Breakdown

1. `feat/renewal-communication-provider-message-id-v1`
   - Parse and persist safe Mailgun message ID/custom variable linkage.
   - No webhook ingestion yet.

2. `feat/renewal-communication-delivery-model-v1`
   - Add delivery tracking normalization helpers, status precedence, and tests.
   - Preserve read compatibility for existing records.

3. `feat/renewal-communication-provider-webhook-v1`
   - Add Mailgun webhook route, signature verification, receipt idempotency, and event reconciliation.
   - No lease lifecycle mutation.

4. `feat/renewal-communication-delivery-evidence-timeline-v1`
   - Update evidence/timeline projection for tracked delivery statuses.
   - Preserve legal-service guardrails.

5. `feat/renewal-communication-delivery-ui-v1`
   - Update notice workflow and history cards to display provider delivery status.
   - Keep send confirmation and approval gates unchanged.

6. `qa/renewal-communication-delivery-status-live-validation-v1`
   - Run safe internal inbox QA, provider webhook replay checks, duplicate-event checks, and evidence/timeline verification.

## Planning Conclusion

Renewal tenant communication delivery tracking should be implemented as provider-status metadata layered onto the existing controlled-send workflow. The next implementation should start with safe provider identifier capture and event reconciliation, not with legal-service claims or lease lifecycle automation.
