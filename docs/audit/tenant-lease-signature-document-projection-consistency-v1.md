# Tenant Lease Signature Document Projection Consistency Audit v1

Date: 2026-07-03
Issue: #1283
Related PR: #1282 `fix/lease-conversion-date-validation-and-notification-gating-v1`
Related merge commit: `3535b8182157b89d8c6fd258bfedf4e2280c12f0`

## Scope

This is a docs-only audit of the tenant portal lease, signing, execution, and document projections. It does not change signing provider behavior, tenant portal UI, lease conversion, payment readiness, backend schema, or document storage.

## Observed inconsistency

After signing, the tenant portal can show all of the following at the same time:

- Lease summary status: `Active`
- Lease signing: `Lease signature complete`
- Provider signing: `Signed`
- Derived lease state: `Active`
- Signed at: `Jul 3, 2026`
- Signature workflow: `Not started`
- Execution: `Not completed`
- Lease document: `No lease document available yet`
- Document status: `Missing`
- Document vault: `0 documents`

This is contradictory from a tenant perspective. The portal says provider-backed signing is complete, but the tenant cannot see a tenant-safe signed lease document, execution evidence, or a completed workflow.

## Source files reviewed

### Backend

- `rentchain-api/src/services/tenantPortal/tenantProjectionService.ts`
- `rentchain-api/src/routes/tenantPortalRoutes.ts`
- `rentchain-api/src/services/signing/leaseSigningService.ts`
- `rentchain-api/src/routes/webhooks/signingWebhookRoutes.ts`
- `rentchain-api/src/services/leaseExecution/deriveLeaseExecution.ts`
- `rentchain-api/src/routes/__tests__/tenantPortalRoutes.test.ts`
- `rentchain-api/src/routes/__tests__/leaseRoutes.active.test.ts`

### Frontend

- `rentchain-frontend/src/pages/tenant/TenantLeasePage.tsx`
- `rentchain-frontend/src/pages/tenant/TenantWorkspacePage.tsx`
- `rentchain-frontend/src/pages/tenant/activeTenancyWorkspaceState.ts`
- `rentchain-frontend/src/pages/tenant/tenantDocumentVault.ts`
- `rentchain-frontend/src/api/tenantPortal.ts`

## Current source-of-truth map

| Tenant-facing field | Current source of truth | Notes |
| --- | --- | --- |
| Lease summary status | Tenant lease projection from `projectTenantLease(...)` in `tenantProjectionService.ts`, based on the active lease record selected by `loadTenantWorkspaceData(...)`. | A lease can be `active` independent of document availability. |
| Payment readiness | `paymentReadiness` and rent payment summary assembled in tenant portal routes from lease rent fields, due day, payment rail state, and tenant-safe payment projection. | Payment readiness can remain incomplete even when the lease is active or signed. |
| Lease document availability | `getTenantLeaseDocumentContext(...)` in `tenantPortalRoutes.ts`. | Requires a tenant-safe primary/signed document URL or storage-backed document context. Schedule A is intentionally handled separately and does not satisfy primary lease document readiness. |
| Document status | `TenantLeaseDocumentContext.documentStatus`. | Values are `signed`, `generated`, `pending`, or `missing`. The observed state means no tenant-safe primary document link was found. |
| Provider signing: Signed | `loadLeaseSigningSnapshot(...)` in `leaseSigningService.ts`, backed by `leaseSigningRequests.currentSigningStatus` and `leaseSigningEvents`. | A provider signed event can exist without a tenant-safe signed document link. |
| Signed at | Latest signing event of type `signed` returned by `loadLeaseSigningSnapshot(...)`. | This is lifecycle evidence, not document availability evidence. |
| Derived lease state | `deriveLeaseSigningState(...)` called by the signing snapshot. | This belongs to signing lifecycle projection, not document vault projection. |
| Signature workflow / execution | `deriveLeaseExecution(...)` in `leaseExecution/deriveLeaseExecution.ts`, fed by the lease projection data. | It uses document URL, lease fields, signature timestamps, and execution markers on the lease record. It does not automatically use the provider signing snapshot that the frontend displays separately. |
| Document vault count | `/tenant/attachments` route builds `buildTenantDocumentWorkspace(...)` from tenant attachments plus `leaseDocumentContext` and `scheduleADocumentContext`. | Provider signing lifecycle alone is not a vault document. A signed lease appears only when the tenant-safe document context or attachment exists. |

## Why the contradictory state can happen

The tenant portal currently combines separate projections:

1. `loadTenantWorkspaceData(...)` loads the lease and builds `leaseDocumentContext`.
2. The same route separately calls `loadLeaseSigningSnapshot(...)`.
3. The response merges provider signing fields into the tenant lease payload:
   - `providerSigningStatus`
   - `providerSignedAt`
   - `providerDerivedLeaseState`
   - `providerSigningAvailable`
4. `TenantLeasePage.tsx` renders the Lease Signing card from the provider signing fields.
5. The Lease Execution card renders from `leaseExecution`, which is derived from lease/document fields and does not use the provider signing fields as a workflow-complete signal.
6. The Lease Document card and document vault render from tenant-safe document context, not from provider signing lifecycle.

That means a signing webhook can mark the signing request as `signed`, while the tenant-safe primary/signed document URL remains missing. In that state, the Lease Signing card says signing is complete, while the Lease Document, Lease Execution, and Document Vault cards still say no tenant-safe document or execution evidence is available.

## Signing webhook and signed document linkage

`processSigningWebhook(...)` records provider events through `appendSigningEvent(...)`. A signed provider event updates `leaseSigningRequests.currentSigningStatus` to `signed` and records append-safe signing evidence.

The signed document itself is a separate concern. `downloadSignedLease(...)` can download the provider document, store it in GCS, and write `signedDocument`, `signedDocumentHash`, and `signedDocumentStoredAt` to the signing request. Tests also cover refreshing signed document URLs from signing request storage metadata.

The audit did not find evidence that every provider `signed` webhook automatically stores or links a tenant-safe signed document URL into the tenant lease document context. If the signed document is not stored or not discoverable through `getTenantLeaseDocumentContext(...)`, the tenant document projection remains `missing` even though provider signing is complete.

## Existing guardrails that are working

- Schedule A is deliberately separate from the primary lease document and does not satisfy tenant primary document availability.
- Tenant document URL refresh avoids exposing raw storage paths, provider request IDs, or stale signed URLs.
- The document vault only surfaces tenant-safe attachments or tenant-safe lease document context.
- Existing tests cover that missing documents should not be paired with completed lease execution semantics when only lease-level completion fields are present.

These guardrails are correct, but they also make the mismatch visible when the provider signing lifecycle advances without a tenant-safe signed document projection.

## Root-cause classification

Primary classification: missing signed document linkage / projection.

The provider signing lifecycle can reach `signed`, but the signed document is not guaranteed to be stored, linked, refreshed, and exposed through `getTenantLeaseDocumentContext(...)`.

Secondary classification: UI copy and source-of-truth mismatch.

The tenant UI renders provider signing completion and tenant-safe execution/document availability as separate facts without explaining the intermediate state. `Lease signature complete` reads like the tenant should also have a signed lease document, but the document and execution projections can still be unavailable.

Possible contributing classification: fixture/demo data issue.

The observed QA record may contain signing request lifecycle data without corresponding signed document storage metadata or tenant-visible lease attachment data. That is still a valuable case because production can hit the same state if signed-document ingestion or linkage fails after provider completion.

Not the primary classification:

- Not a payment readiness issue.
- Not a lease conversion email gating issue.
- Not a broad tenant portal redesign issue.
- Not necessarily a signing provider integration bug until the signed document ingestion path is traced for the specific provider event.

## Recommended tenant-facing behavior

When provider signing is complete but no tenant-safe signed document is available:

- Do not show `Signature workflow not started`.
- Show a transitional state such as `Signing complete; signed copy pending`.
- Explain that signing is complete, but the signed lease document is still being processed or has not yet been made available in the tenant workspace.
- Keep document access unavailable until a tenant-safe signed document URL exists.
- Do not expose raw provider IDs, signing request IDs, storage paths, or internal lease IDs.

When provider signing is complete and a tenant-safe signed document exists:

- Show the primary lease document as `Signed lease document`.
- Mark execution as complete or otherwise align it with the signed lifecycle.
- Surface the signed lease in the document vault.
- Keep Schedule A separate from the primary signed lease document.

## Recommended follow-up mission

Recommended implementation mission:

`fix/tenant-lease-signed-document-projection-v1`

### Proposed implementation scope

- Align tenant lease signing, execution, and document projections when provider signing is complete.
- Add a tenant-safe intermediate state for provider-signed-without-signed-document.
- Ensure signed document storage metadata from signing requests can feed tenant-safe lease document context when available.
- Surface the signed lease in the tenant document vault only when a tenant-safe document URL/context exists.
- Preserve Schedule A separation from primary lease document readiness.
- Preserve existing send-for-signature behavior.

### Proposed acceptance criteria

- Provider signing `signed` without a tenant-safe signed document no longer renders as `Signature workflow not started`.
- The tenant sees clear copy that signing is complete but the signed copy is not yet available.
- Provider signing `signed` with signed document storage metadata surfaces a tenant-safe signed lease document link.
- The document vault includes the signed lease when the tenant-safe signed document exists.
- Schedule A alone does not satisfy primary signed lease document availability.
- No raw signing request IDs, provider IDs, lease IDs, storage paths, or internal document references are exposed.
- Tests cover:
  - provider signed without tenant-safe signed document
  - provider signed with signed document storage metadata
  - Schedule A still separate
  - tenant dashboard, tenant lease page, and document vault projections stay consistent

## Validation for this audit

- Docs-only scope.
- No frontend, backend, schema, route, signing provider, payment, or tenant portal implementation changed.
- Required validation:
  - `git diff --check`
  - competitor-name scan
  - docs-only PR review
