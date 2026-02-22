# Lease Pack v1 (Nova Scotia)

## Scope
- Province scope for v1 is Nova Scotia only (`province = "NS"`).
- Output scope is Schedule A addendum only.
- This flow does not generate or replace Nova Scotia Form P.

## What It Generates
- A PDF named `schedule-a-v1.pdf` from template version `ns-schedule-a-v1`.
- Storage path pattern:
  - `leases/{landlordId}/{draftId}/schedule-a-v1.pdf`
- Draft and snapshot records in Firestore:
  - `leaseDrafts`
  - `leaseSnapshots` (immutable output records)

## Draft Fields
- `landlordId`, `propertyId`, `unitId`, `tenantIds[]`
- `province` (`NS`)
- `termType`, `startDate`, `endDate`
- `baseRentCents`, `parkingCents`, `dueDay`
- `paymentMethod`, `nsfFeeCents` (optional)
- `utilitiesIncluded[]`, `depositCents` (optional)
- `additionalClauses`
- `status` (`draft | generated`)
- `templateVersion` (`ns-schedule-a-v1`)
- `createdAt`, `updatedAt`

## Snapshot Fields
- All draft fields at generation time
- `generatedAt`
- `generatedFiles[]` with:
  - `kind`
  - `url`
  - `sha256`
  - `sizeBytes`

## API Surface (v1)
- `POST /api/leases/drafts`
- `GET /api/leases/drafts/:id`
- `PATCH /api/leases/drafts/:id`
- `POST /api/leases/drafts/:id/generate`
- `GET /api/leases/snapshots/:id`

## Validation Rules (v1)
- Landlord-scoped access only.
- Province must be `NS`.
- Date format must be `YYYY-MM-DD`.
- `dueDay` must be in valid monthly range (`1-31`).
- Amount fields are integer cents and non-negative.
- Fixed term requires `endDate`.

## Template Versioning and New Provinces
- Version key controls renderer and PDF output contract.
- v1 key: `ns-schedule-a-v1`.
- To add new provinces:
  - Add a new template version key (for example, `on-schedule-a-v1`).
  - Add a province-specific HTML template + renderer.
  - Keep snapshot schema stable; only add fields when needed.
  - Route behavior should branch by `province` and `templateVersion`.

## Retention and Audit Notes
- Keep snapshots immutable for auditability.
- Store hash (`sha256`) and file size to support integrity checks.
- Drafts are mutable until generation; snapshots are generation-time records.
- Recommended operational controls:
  - Lifecycle policy for file retention in storage.
  - Access logs for snapshot reads.
  - Periodic verification of stored hash vs downloaded bytes.
