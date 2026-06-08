# Soft-Launch Certification Reproduction Checklist

Use this checklist in a controlled preview or staging environment. Do not record passwords, tokens, or raw account identifiers in repository files.

## Required Setup

1. Create or identify four distinct test accounts in the secure credential store:
   - landlord account
   - tenant account
   - contractor account
   - admin account
2. Confirm each account has the correct role claim and Firestore context.
3. Configure safe test-mode services:
   - email sender
   - storage bucket
   - Stripe test mode
   - signing test provider or mock provider
   - screening provider test configuration or manual fallback
4. Confirm no production tenant, landlord, contractor, billing, screening, or lease data will be mutated.

## Landlord Workflow

1. Log in as landlord.
2. Create a property and unit.
3. Create a tenant/application record through the supported flow.
4. Create a lease draft.
5. Generate lease documents.
6. Activate or create the lease.
7. Confirm landlord can view lease status and document readiness.
8. Confirm landlord cannot see another landlord's records through direct API calls.

Expected result: landlord workflow completes without cross-landlord data exposure.

## Tenant Workflow

1. Log in as tenant.
2. Open tenant dashboard/workspace.
3. Confirm lease appears in tenant-safe projection.
4. Confirm landlord-only notes, provider payloads, storage paths, payment provider references, and unrelated tenant data are absent.
5. Open tenant lease page.
6. Sign lease through the configured test signing flow.
7. Retrieve signed lease status.
8. Attempt direct API access to another tenant's lease or workspace reference.

Expected result: tenant sees only tenant-safe records and cross-tenant access returns 403 or 404.

## Contractor Workflow

1. Log in as landlord.
2. Create maintenance request and assign contractor.
3. Log in as contractor.
4. Open contractor dashboard and assigned jobs.
5. View assigned work order.
6. Submit status update.
7. Send a contractor message if enabled.
8. Confirm contractor cannot access lease, tenant document, billing, or landlord financial routes.
9. Confirm contractor-facing payloads do not expose raw landlord, tenant, property, unit, or lease identifiers.

Expected result: contractor can work assigned jobs only and receives safe projections.

## Lease Execution

1. Landlord sends lease for signature.
2. Tenant opens signing URL or tenant lease signing surface.
3. Tenant signs without changing lease terms.
4. Landlord checks signing status.
5. Landlord downloads signed copy.
6. Tenant retrieves signed status/document from tenant workspace.

Expected result: signed document is retrievable by the correct parties only.

## Notice Automation

1. Landlord selects an eligible lease.
2. Generate a renewal, move-out, or policy notice preview.
3. Verify notice content, dates, recipient, and jurisdiction fields.
4. Send notice.
5. Tenant views and responds where applicable.
6. Verify notice history is append-safe and original sent record is not mutated.

Expected result: notice workflow is accurate, scoped, and append-safe.

## Billing

1. Log in as landlord.
2. Open billing page.
3. Confirm subscription status returns safe fields only.
4. Run Stripe test checkout.
5. Confirm checkout success updates tier/status.
6. Simulate or verify a payment failure path.
7. Confirm no payment instrument details appear in UI, API response, or logs.
8. Confirm tier gating blocks premium-only features for free plan.

Expected result: billing works in test mode and exposes no sensitive payment details.

## Screening

1. Tenant grants screening consent.
2. Landlord starts screening request.
3. If provider is unavailable, verify manual fallback workflow.
4. Record manual report or provider test result.
5. Landlord views screening status/result.
6. Tenant verifies only tenant-safe screening state.
7. Confirm raw provider payloads and raw reports are not exposed to frontend surfaces.

Expected result: screening can proceed with provider or manual fallback, with landlord-only result access.

## Security Spot Checks

1. No token on protected landlord route returns 401.
2. Bad token on protected route returns 401.
3. Tenant token on landlord route returns 401, 403, or 404 without data.
4. Contractor token on tenant/lease/billing route returns 401, 403, or 404 without data.
5. Landlord token for another landlord's resource returns 403 or 404.
6. Admin route rejects tenant and landlord tokens.
7. Error responses contain safe codes only.
8. API responses contain no raw storage paths, tokens, secrets, provider payloads, or payment instrument details.
9. Firestore emulator/rules tests confirm deny-by-default and append-only audit rules.

Expected result: all protected surfaces fail closed and no sensitive data is exposed.

## Required Validation Commands

Run:

```bash
npm --prefix rentchain-api run test -- --run
npm --prefix rentchain-api run build
npm --prefix rentchain-frontend run test -- --run
npm --prefix rentchain-frontend run build
git diff --check
```

Expected result: all required commands pass, or failures are individually waived by release owner with launch-impact rationale.
