# Attestation Hash Retrieval v1

## Scope

Attestation hash retrieval exposes read-only metadata for existing attestation hash records through `/api/attestation`. The surface is limited to immutable canonical event metadata created by the attestation and hash verification services.

The route does not create, update, delete, re-sign, re-hash, deliver, or remediate evidence records. It does not expose source material, signature material, certificate material, storage paths, or internal document identifiers.

## Routes

- `GET /api/attestation/hash/:hashValue`
- `GET /api/attestation/evidence/:evidenceId/chain`
- `GET /api/attestation/evidence/:evidenceId/verify`

`hashValue` must be a SHA-256 hex value. `evidenceId` is accepted only as a safe evidence reference such as `evidence:<hash-like-reference>`; raw document identifiers are rejected.

## Authorization

All routes require authenticated context. Access is resolved server-side:

- landlord users must match the event landlord safe reference
- tenant users must have an explicit safe evidence reference in their session context
- admin and support users may inspect metadata-only attestation state
- unknown roles fail closed

The route does not widen existing auth core or entitlement behavior.

## Projection Safety

Responses use a fixed envelope:

```json
{ "success": true, "data": {}, "error": null, "code": "OK" }
```

Error responses use fixed codes only. Successful responses include only:

- hash values
- attestation safe references
- export package safe references
- evidence safe references
- signature metadata references
- certificate metadata references
- lifecycle state
- verification status
- timestamps
- metadata safety flags

Responses do not include raw Firestore document IDs, source object IDs, storage paths, provider source material, request bodies, response bodies, or cryptographic internals.

## Append Safety

This is a read-model route only. Verification calls read existing hash-chain metadata and return a computed result without appending events or mutating stored evidence, hash, export, or attestation records.

## Known Limitations

The route depends on canonical attestation audit events produced by existing attestation workflows. It does not introduce independent hash-record persistence, external certificate authorities, timestamp authorities, HSM/KMS integrations, package delivery, dashboard UI, or background processing.
