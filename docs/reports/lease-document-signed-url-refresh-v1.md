# Lease Document Signed URL Refresh v1

## Executive Summary

This stabilization pass keeps lease documents private while making signed URL access refresh-safe for authorized landlord and tenant flows. Generated lease PDFs remain stored in Google Cloud Storage with time-limited signed URLs; RentChain now preserves internal storage references as metadata and can mint a fresh signed URL through scoped backend routes instead of relying only on stale persisted URLs.

No storage migration, Firestore rule change, public bucket access, auth rewrite, or document visibility expansion is introduced.

## Current Model Audited

| Surface | Current behavior | Stabilization outcome |
| --- | --- | --- |
| Lease/Schedule A generation | Generates a PDF, uploads to GCS when configured, and stores a signed URL in lease/workspace records. | Newly linked generated PDFs also retain internal `bucket`/`path` metadata for future refresh. |
| Landlord active lease list | Shows `documentUrl` directly when available. | Storage-backed responses refresh the URL on load; the UI also calls a scoped refresh endpoint before opening a document. |
| Tenant lease workspace | Shows tenant-safe `leaseDocumentContext.documentUrl`. | Storage-backed lease/attachment context refreshes the URL server-side; tenant UI calls a scoped refresh endpoint before opening. |
| Legacy URL-only records | May only have an already-signed URL and no explicit storage reference. | Legacy GCS signed URLs are parsed into internal bucket/path refs and refreshed; non-GCS legacy URLs remain a compatibility fallback when no storage metadata can be derived. |
| Unit reconciliation documents | Existing unit `leaseDocument` signed URL hydration remains unchanged. | Future follow-up can apply the same explicit click-refresh pattern if needed. |

## Signed URL Governance

- Signed URLs remain time-limited.
- Permanent public URLs are not introduced.
- Raw storage paths are internal metadata only, not primary UI labels.
- Stale persisted signed URLs are not reused when explicit storage metadata or a parseable GCS signed URL is available.
- Authorized viewers refresh through backend mediation:
  - landlord: `GET /api/leases/:leaseId/document-url`
  - tenant workspace: `GET /api/tenant/lease/document-url`
- Refresh routes preserve existing authority boundaries:
  - landlord route requires `requireLandlord`, lease capability, and landlord-scoped lease lookup.
  - tenant route requires tenant workspace identity and verifies the lease belongs to the tenant.

## Metadata Added

Generated lease PDFs now retain internal metadata where available:

- `leaseDocument.bucket`
- `leaseDocument.path`
- `leaseDocument.fileName`
- `leaseDocument.contentType`
- `leaseDocument.source`
- `leaseDocument.signedUrlExpiresAt`
- tenant ledger attachment `storageBucket`
- tenant ledger attachment `storagePath`
- tenant ledger attachment `signedUrlExpiresAt`

These fields are governance references for refresh and lineage. They are not display labels and are not public URLs.

## Tests Added

- Landlord active lease route refreshes storage-backed document URLs instead of returning stale signed URLs.
- Landlord explicit document refresh endpoint returns a fresh signed URL and marks storage refs as internal references.
- Tenant lease document refresh endpoint returns a tenant-scoped refreshed URL and does not leak the stale persisted URL.
- Legacy persisted GCS signed URLs refresh through parsed internal storage refs instead of reopening expired URLs.
- Frontend landlord lease document action calls the refresh endpoint before opening.
- Frontend tenant lease document action calls the refresh endpoint before opening.
- Lease summary export action is labelled `Print / Save PDF`.
- Property unit occupancy links tenant names to tenant profiles while keeping lease links as explicit `View lease` actions.

## Known Limitations

- Legacy records with a parseable GCS signed URL can refresh without a metadata backfill. Legacy non-GCS URLs with no storage metadata still use compatibility fallback behavior.
- Unit reconciliation document links still rely on response-time signed URL hydration and do not yet have a dedicated click-refresh endpoint.
- Evidence/export document refresh can reuse the same pattern in future missions, but this PR keeps scope to lease document continuity.

## Future Follow-Ups

1. Backfill storage metadata for legacy lease records where the GCS object path can be derived safely.
2. Add equivalent refresh endpoints for evidence and export documents after their access flows are reviewed.
3. Add optional UI messaging for legacy URL-only documents when refresh metadata is unavailable.
4. Review unit reconciliation document links for the same click-time refresh pattern.
