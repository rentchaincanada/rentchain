# Property Manager Company Preview Fixtures v1

## Purpose

This runbook documents the controlled QA fixture path for Property Manager Company Management preview QA.

PR #1229 depends on at least one active Property Manager Company record being discoverable by safe company label. Without this fixture, landlord-side relationship creation QA cannot exercise:

1. Search active PM company.
2. Select PM company.
3. Create pending relationship.
4. PM Company Owner/Admin accepts.
5. Company admin assigns staff.

This fixture path creates or updates exactly one QA PM company and one active Company Owner/Admin membership. It does not create customer data, landlord data, relationships, assignments, billing records, tenant records, contractor records, or emails.

## Fixture Records

The fixture script targets deterministic Firestore document keys derived from `PM_COMPANY_QA_FIXTURE_KEY`. Normal output reports safe labels and statuses only; it does not print raw document IDs or user IDs.

The setup path writes:

- one `propertyManagerCompanies` record
- one `propertyManagerCompanyMemberships` record

Default company label:

```text
Acme Property Management QA
```

Default fixture key:

```text
pm-company-preview-qa-v1
```

The records include:

- `qaFixture: true`
- `qaFixtureKey`
- `managedBy.source: chore/property-manager-company-preview-fixtures-v1`
- `managedBy.purpose: Property Manager Company preview QA fixture`
- timestamps

## Prerequisites

Before running the script:

1. Confirm the target Firebase/Firestore project is the approved preview/QA project.
2. Confirm `gcloud` or application-default credentials are authenticated for that project.
3. Confirm the PM company admin QA user already exists in Firebase Auth.
4. Use a dedicated QA email, not a customer or production operator account.
5. Do not paste passwords, tokens, service account keys, or raw internal IDs into logs or PR comments.
6. Use `ALLOW_LOCAL_PROD_FIRESTORE=true` only for this explicitly approved preview fixture operation.

Required identity input:

- `PM_COMPANY_QA_USER_EMAIL`, or
- `PM_COMPANY_QA_USER_ID`

If the user cannot be resolved through Firebase Auth, the script fails closed and writes nothing.

## Dry Run

Dry-run is the default. It still requires the explicit enable flag so operators do not accidentally probe the wrong environment.

From repo root:

```bash
cd rentchain-api
PM_COMPANY_QA_FIXTURE_ENABLED=true \
ALLOW_LOCAL_PROD_FIRESTORE=true \
PM_COMPANY_QA_USER_EMAIL=pm-company-admin-qa@example.test \
npm run fixture:pm-company-preview
```

Optional overrides:

```bash
PM_COMPANY_QA_FIXTURE_ENABLED=true \
ALLOW_LOCAL_PROD_FIRESTORE=true \
PM_COMPANY_QA_FIXTURE_KEY=pm-company-preview-qa-v1 \
PM_COMPANY_QA_COMPANY_LABEL="Acme Property Management QA" \
PM_COMPANY_QA_USER_EMAIL=pm-company-admin-qa@example.test \
PM_COMPANY_QA_ROLE=company_admin \
npm run fixture:pm-company-preview
```

Expected safe dry-run output shape:

```json
{
  "ok": true,
  "mode": "dry-run",
  "fixtureMode": "upsert",
  "company": {
    "action": "create",
    "label": "Acme Property Management QA",
    "status": "active",
    "qaFixture": true,
    "qaFixtureKey": "pm-company-preview-qa-v1"
  },
  "membership": {
    "action": "create",
    "staffLabel": "pm-company-admin-qa@example.test",
    "role": "company_admin",
    "status": "active",
    "qaFixture": true,
    "qaFixtureKey": "pm-company-preview-qa-v1"
  },
  "rawIdsPrinted": false,
  "writePerformed": false
}
```

`action` may be `update` when the deterministic fixture already exists.

## Write Fixture

Only run write mode after the dry-run output has been reviewed and the operator approves preview fixture setup.

```bash
cd rentchain-api
PM_COMPANY_QA_FIXTURE_ENABLED=true \
ALLOW_LOCAL_PROD_FIRESTORE=true \
PM_COMPANY_QA_USER_EMAIL=pm-company-admin-qa@example.test \
npm run fixture:pm-company-preview -- --write
```

Write mode requires both:

- `PM_COMPANY_QA_FIXTURE_ENABLED=true`
- `--write`

If either is missing, the script writes nothing.

Expected safe write output is the same as dry-run except:

```json
{
  "mode": "write",
  "writePerformed": true
}
```

## Cleanup / Suspend

Do not hard-delete fixture records by default. To remove the fixture from active QA discovery while preserving history, run suspend mode after approval:

```bash
cd rentchain-api
PM_COMPANY_QA_FIXTURE_ENABLED=true \
ALLOW_LOCAL_PROD_FIRESTORE=true \
PM_COMPANY_QA_USER_EMAIL=pm-company-admin-qa@example.test \
npm run fixture:pm-company-preview -- --suspend --write
```

Suspend mode updates the deterministic fixture records:

- company status becomes `archived`
- membership status becomes `removed`
- membership removal metadata is set

Expected safe output includes:

```json
{
  "fixtureMode": "suspend",
  "company": {
    "status": "archived"
  },
  "membership": {
    "status": "removed"
  },
  "writePerformed": true
}
```

## Validation After Write

After setup:

1. Open the #1229 Vercel preview.
2. Log in as a landlord owner.
3. Navigate to PM Company Management.
4. Search for `Acme Property Management QA`.
5. Confirm the safe company label appears and no raw IDs are visible.
6. Select the company.
7. Confirm `Selected Company` appears.
8. Create the pending relationship.
9. Confirm the relationship appears as `Pending`.
10. Confirm the landlord cannot activate it directly.
11. Log in as the QA Company Owner/Admin.
12. Accept the pending relationship.
13. Continue assignment QA as scoped by #1229.

## Safety Notes

- This script is not a broad demo seed.
- It does not create landlord, tenant, lease, property, unit, contractor, billing, or email records.
- It must not be used for production customer data.
- It fails closed when the QA user cannot be resolved.
- It should be run only against the approved preview/QA project.
- Normal script output must not be modified to print raw document IDs or user IDs.
- `ALLOW_LOCAL_PROD_FIRESTORE=true` is required by the existing Firestore safety guard for approved local preview diagnostics and writes. Do not commit it to env templates.
