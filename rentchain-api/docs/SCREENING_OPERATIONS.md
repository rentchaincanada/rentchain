# Screening Operations Runbook

## Local Webhook Test

Register a local test provider in the runtime process, then POST a provider-shaped payload:

```bash
curl -X POST "$API_BASE_URL/api/webhook/screening/test-provider" \
  -H "Content-Type: application/json" \
  -H "X-Signature: test-signature" \
  -d '{"requestId":"screening_request","status":"completed"}'
```

Expected result for an unregistered provider:

```json
{ "ok": false, "code": "PROVIDER_NOT_CONFIGURED", "error": "PROVIDER_NOT_CONFIGURED" }
```

## Backlog Monitoring

Query `screeningRequests` for statuses:

- `pending`
- `provider_pending`
- `failed`

Requests in pending states should have an active consent and a recent `requestedAt` timestamp.

## Webhook Failure Handling

Review `screeningWebhookLogs` by provider id. Each log contains a payload digest and safe status, not raw provider payload content. Rejected logs indicate missing provider configuration, invalid signature, or parser failure.

## Audit Export

Admin review uses:

- `GET /api/admin/screening/auditLog`
- `GET /api/admin/screening/webhookLogs/:providerId`

Export only safe metadata, status values, payload digests, and audit entries. Do not export raw provider payloads or tenant private documents.

## Manual Report Fallback

Landlords may upload PDF, JPEG, or PNG report files to complete a request manually when provider integration is unavailable. Storage requires `GCS_UPLOAD_BUCKET` to be configured.
