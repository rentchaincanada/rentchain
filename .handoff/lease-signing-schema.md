# Lease Signing Schema

## Collections

### leaseSigningRequests

Purpose: immutable request metadata for a provider-backed signing workflow.

Fields:
- `leaseId`
- `landlordId`
- `providerId`
- `providerRequestRef`
- `providerRequestId`
- `tenantEmailHashes`
- `documentUrl`
- `expiresAt`
- `sentAt`
- `createdAt`
- `rawIdsIncluded: false`
- `payloadIncluded: false`

Visibility:
- Landlord-owned service access only.
- Tenant projection never exposes `providerRequestId`, `providerRequestRef`, `tenantEmailHashes`, or webhook metadata.

### leaseSigningEvents

Purpose: append-only signing event history.

Fields:
- `requestId`
- `leaseId`
- `landlordId`
- `providerId`
- `providerRequestRef`
- `providerEventRef`
- `type`
- `actorRole`
- `signerEmailHash`
- `occurredAt`
- `createdAt`
- `rawIdsIncluded: false`
- `payloadIncluded: false`

Allowed event types:
- `sent`
- `viewed`
- `signed`
- `rejected`
- `expired`
- `cancelled`
- `downloaded`

### leaseSigningWebhookDeadLetters

Purpose: metadata-only record for invalid or unprocessable webhook delivery.

Fields:
- `providerId`
- `status`
- `createdAt`
- `rawIdsIncluded: false`
- `payloadIncluded: false`

## Derived State

`not_started`: no signing request.

`pending_signature`: request sent or viewed, no terminal event.

`signed_future`: signed event exists and lease start date is in the future.

`active`: signed event exists and lease start date is current or past.

`rejected`, `expired`, `cancelled`: terminal provider or landlord event.
