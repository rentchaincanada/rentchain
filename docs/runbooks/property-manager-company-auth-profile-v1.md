# Property Manager Company Auth Profile Setup v1

## Purpose

This runbook documents the governed setup path for a PM company app profile. It exists so a PM Company Owner/Admin can authenticate as a non-landlord actor and have company authority resolved from `propertyManagerCompanyMemberships`.

This setup is required before #1229 manual QA can continue with:

- `admin+propertymanager@rentchain.ai`
- `Acme Property Management QA`
- active `company_admin` membership

## Safety Rules

- Do not use the landlord-profile creation routes for PM company users.
- Do not create `landlords/{uid}`.
- Do not create a landlord workspace.
- Do not create customer data.
- Do not grant billing/settings authority.
- Do not print raw user IDs or document IDs in normal output.
- Dry-run first; write only after explicit operator approval.

## Target Profile Shape

The setup path creates or updates only:

- `users/{uid}`
- `accounts/{uid}`

Safe profile fields include:

- `role: property_manager_company`
- `accountType: property_manager_company`
- `landlordId: null`
- `status: active`
- `approved: true`
- `qaProfile: true`
- `managedBy.source: feat/property-manager-company-auth-profile-v1`

Company authority is not granted by these profile documents. Company authority is granted only by active `propertyManagerCompanyMemberships`.

## Prerequisites

1. Confirm the target Firebase/Firestore project is the approved preview/QA project.
2. Confirm the Firebase Auth user already exists.
3. Confirm the user has an active PM company membership if company-admin route access is expected.
4. Confirm application-default credentials are authenticated for the preview/QA project.
5. Use a dedicated QA account, not a landlord owner account.

Current QA target:

```text
admin+propertymanager@rentchain.ai
```

## Dry Run

From repo root:

```bash
cd rentchain-api
PM_COMPANY_AUTH_PROFILE_SETUP_ENABLED=true \
ALLOW_LOCAL_PROD_FIRESTORE=true \
PM_COMPANY_QA_USER_EMAIL=admin+propertymanager@rentchain.ai \
npm run setup:pm-company-auth-profile
```

Expected safe output shape:

```json
{
  "ok": true,
  "mode": "dry-run",
  "userProfile": {
    "action": "create",
    "email": "admin+propertymanager@rentchain.ai",
    "role": "property_manager_company",
    "accountType": "property_manager_company",
    "landlordId": null,
    "status": "active",
    "approved": true,
    "qaProfile": true
  },
  "accountProfile": {
    "action": "create",
    "email": "admin+propertymanager@rentchain.ai",
    "role": "property_manager_company",
    "accountType": "property_manager_company",
    "landlordId": null,
    "status": "active",
    "approved": true,
    "qaProfile": true
  },
  "landlordProfileAction": "none",
  "rawIdsPrinted": false,
  "writePerformed": false
}
```

`action` may be `update` when the safe profile already exists.

## Write

Only after dry-run review and explicit operator approval:

```bash
cd rentchain-api
PM_COMPANY_AUTH_PROFILE_SETUP_ENABLED=true \
ALLOW_LOCAL_PROD_FIRESTORE=true \
PM_COMPANY_QA_USER_EMAIL=admin+propertymanager@rentchain.ai \
npm run setup:pm-company-auth-profile -- --write
```

Write mode requires both:

- `PM_COMPANY_AUTH_PROFILE_SETUP_ENABLED=true`
- `--write`

## Cleanup

No hard-delete cleanup is provided in this mission. If the QA profile should be disabled later, use a separately reviewed profile-suspension mission or manual operator procedure that preserves audit/history and does not delete PM company relationship or assignment records.

## Post-Setup Validation

After approved write:

1. Login as `admin+propertymanager@rentchain.ai`.
2. Confirm `/api/me` reports a non-landlord PM company role.
3. Confirm `/api/property-manager-companies/my-companies` returns `Acme Property Management QA`.
4. Confirm landlord owner routes fail closed for the PM company user.
5. Resume #1229 manual QA.
