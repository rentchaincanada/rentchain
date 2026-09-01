# Domain authority writer census

Exact baseline: `569d5b5aded36a6a7f34695a211bf1c43f1a15cc`

This census summarizes material writer families. Exact entries and source
references are in `authority-inventory.json`.

## Governed authority writers

- Lease creation, explicit start, renewal continuity, end lifecycle, and bounded
  occupancy resolution services.
- Transactional signing service and normalized signing-provider callbacks.
- Application and screening orchestrator transitions.
- Payment intent, provider-receipt, reconciliation, and canonical payment
  writers.
- Notice and maintenance workflow routes/services.
- Evidence manifest, provenance, hash, and attestation services.

## Projection writers

- Standalone and embedded property-unit occupancy writes performed within the
  canonical start/resolution transaction.
- Tenant `currentLeaseId` and relationship status written within governed
  lifecycle transitions.
- Lease risk, dashboard, timeline, trust/export, and role-safe API projections.

## Compatibility and administrative writers

Legacy `applications`, legacy signing aliases, old notice events, and selected
lease/status aliases remain compatibility inputs or writes. Admin lease review
acknowledgement/history is append-safe and does not edit canonical lease state.
Admin/demo and general tenant update paths are certification concerns whenever
deployed outside their bounded environment or allowed-field validation.

No material unsupported alternate writer was identified as a second legitimate
owner of lease execution, occupancy, or tenant-relationship truth. P0-05 must
still convert this human census into enforced repository-wide writer checks.

## Core source-confirmed invariants

```text
PASSIVE_EXPIRY_AUTO_VACANCY = FORBIDDEN
LEGACY_ACTIVE_STATUS_CAN_OVERRIDE_PAST_TERM = NO
DRAFT_LEASE_CAN_DRIVE_ACTIVE_OCCUPANCY = NO
MULTIPLE_CURRENT_LEASES = FAIL_CLOSED
STALE_SIGNED_EVENT_CAN_FORCE_EXECUTION_STATE = NO
UNSIGNED_SOURCE_CAN_BE_SIGNED_DOCUMENT = NO
```

## Frontend P0-02 boundary

The following current surfaces contain signing/document presentation derivation
or legacy fallbacks and must be reviewed by P0-02:

- `rentchain-frontend/src/pages/LandlordActiveLeasesPage.tsx`
- `rentchain-frontend/src/pages/LandlordLeaseSummaryPage.tsx`
- `rentchain-frontend/src/pages/leaseSigningWorkspaceState.ts`
- `rentchain-frontend/src/pages/leaseExecutionWorkspace.ts`
- `rentchain-frontend/src/pages/leasePreparationWorkspaceState.ts`
- `rentchain-frontend/src/pages/moveInReadinessWorkspaceState.ts`
- `rentchain-frontend/src/pages/tenant/activeTenancyWorkspaceState.ts`
- `rentchain-frontend/src/pages/tenant/TenantProfilePage.tsx`
- `rentchain-frontend/src/pages/tenant/TenantWorkspacePage.tsx`

Document retrieval URLs remain valid delivery inputs. URL presence alone is not
proof of canonical execution or signed-document state.
