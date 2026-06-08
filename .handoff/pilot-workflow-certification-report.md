# Pilot Workflow Certification Report

Certification Status: PASS WITH CONDITIONS
Date: 2026-06-08
Evidence: Manual browser QA completed using test accounts.

## Summary

- Total workflows tested: 3 (landlord, tenant, contractor)
- Total critical blockers: 0
- Total findings: 22
- Medium findings: 6
- Low findings: 11
- Info/condition findings: 5

## Workflow Results

### Landlord: PASS

- Property creation: PASS
- Unit creation: PASS
- Application invite and workflow: PASS
- Application review with screening summary: PASS
- Lease operations: PASS
- Lease signing status workflow: PASS
- Lease signing provider email delivery: condition, provider credentials pending
- Maintenance workflow: PASS
- Contractor invite and network management: PASS
- Notice creation: PASS
- Messaging with tenants, bidirectional: PASS
- Tenant profile management: PASS

### Tenant: PASS

- Login and workspace access: PASS
- Lease access and view: PASS
- Maintenance request submission: PASS
- Maintenance status tracking: PASS
- Messages with landlord, bidirectional: PASS
- Screening consent workflow: PASS
- Application submission: PASS
- Documents vault UI: PASS
- Documents vault upload: condition, GCS bucket configuration pending

### Contractor: PASS WITH CONDITIONS

- Invite receipt and acceptance: PASS
- Joins landlord network: PASS
- Dashboard, Jobs, Profile navigation: PASS
- Work order assignment: condition, blocked by frontend property dropdown binding bug
- Pending invite visibility in contractor portal: condition, pending invite not visible in portal

## Pilot Conditions

These conditions do not block a controlled pilot but must be tracked before broader launch:

1. Signing provider credentials pending for Dropbox Sign or BoldSign.
2. Email provider not configured; `EMAIL_NOT_CONFIGURED` observed.
3. GCS bucket not configured for document uploads.
4. Certn screening provider pending.
5. Work order property dropdown frontend bug.
6. Contractor invite not visible in portal.

## Findings

### Medium

- FINDING 10: Contractor invite not visible in contractor portal.
- FINDING 11: Maintenance missing Create Work Order button per request.
- FINDING 12: Work order property dropdown frontend binding bug.
- FINDING 16: Viewing request confirmation tenant email not sent.
- FINDING 23: Landing page Log in button not prominent.
- FINDING 24: Login page too many options, causing decision paralysis.

### Low

- FINDING 1: City and Province text input should be dropdown.
- FINDING 2: Co-applicant employment fields not marked required upfront.
- FINDING 3: Vehicle year accepts text.
- FINDING 4: Send Application modal property not pre-selected.
- FINDING 8: Maintenance attachment upload coming soon.
- FINDING 9: Property shows Selected property in maintenance email.
- FINDING 13: Work order invite contractors auto-selects all.
- FINDING 17: Applications viewing requests mobile layout broken.
- FINDING 18: Maintenance calendar has excessive space.
- FINDING 20: No dedicated notices page.
- FINDING 21: Tenant documents vault empty due to test data.

### Info and Conditions

- FINDING 5: Primary lease document unavailable because GCS is pending.
- FINDING 7: Lease signing email not delivered because provider configuration is pending.
- FINDING 14: Contractor assigned but maintenance shows unassigned.
- FINDING 19: Notice email not delivered because email configuration is pending.
- FINDING 22: Communication fragmentation; strategic note for v1.0.

## Certification Decision

Result: PASS WITH CONDITIONS

Manual browser QA completed across landlord, tenant, and contractor personas. No critical blockers were found for a controlled pilot preparation path. The remaining conditions are configuration, frontend polish, or workflow visibility issues that should be tracked, but they do not prevent controlled pilot preparation.

## Recommended Next Missions

1. Resolve work order property dropdown binding and contractor invite visibility.
2. Configure signing provider credentials for controlled test delivery.
3. Configure email provider for tenant and notice delivery.
4. Configure GCS bucket for document upload and lease document retrieval.
5. Complete Certn screening provider readiness.
