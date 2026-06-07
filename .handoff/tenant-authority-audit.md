# Tenant Authority Audit

Source branch: docs/phase-f-tenant-portal-environment-v1

Audited source files:
- /Users/rentchain/dev/rentchain/rentchain-api/src/services/tenantPortal/tenancyContextService.ts
- /Users/rentchain/dev/rentchain/rentchain-api/src/routes/tenantPortalRoutes.ts
- /Users/rentchain/dev/rentchain/rentchain-api/src/routes/tenantLeaseNoticeRoutes.ts
- /Users/rentchain/dev/rentchain/rentchain-api/src/routes/tenantsRoutes.ts
- /Users/rentchain/dev/rentchain/rentchain-api/src/routes/adminTenantsRoutes.ts

## Authority Model

Tenant workspace authority is resolved server-side by resolveTenancyContext in /Users/rentchain/dev/rentchain/rentchain-api/src/services/tenantPortal/tenancyContextService.ts. The accepted authority bases are:

- active_tenant: tenant record, active lease, or active tenancy relationship.
- applicant: application or rentalApplications linkage.
- invite: tenancy_invites linkage by redeemed user id or invited email.

The returned context fields are:

- ok
- authority
- propertyId
- rc_prop_id
- applicationId
- leaseId
- tenantId
- unitId
- invitedEmail
- reason when not ok

## Identity Inputs

resolveTenancyContext receives:

- uid from req.user.id
- email from req.user.email
- tenantId from req.user.tenantId
- leaseId from req.user.leaseId when present

requireTenantWorkspaceIdentity in /Users/rentchain/dev/rentchain/rentchain-api/src/routes/tenantPortalRoutes.ts requires a user id, role tenant, and tenantId before downstream context resolution. requireTenant requires role tenant and tenantId but does not itself perform the broader applicant/invite authority resolution.

## Firestore Query Paths

Context resolution queries these collections and fields:

| Collection | Query path | Authority use |
| --- | --- | --- |
| tenants | doc(tenantId) | Direct tenant record match. |
| tenants | where tenantId == tenantId | Alternate tenant record match. |
| tenants | where email == normalized email | Email-based tenant record match when exactly one record matches. |
| applications | where applicantEmail == email | Applicant candidate. |
| applications | where email == email | Applicant candidate. |
| applications | where applicant.email == email | Applicant candidate. |
| applications | where applicantUserId == uid | Applicant candidate. |
| applications | where userId == uid | Applicant candidate. |
| applications | where tenantId == tenantRecordId | Applicant candidate. |
| applications | where convertedTenantId == tenantRecordId | Applicant candidate. |
| rentalApplications | same application field set | Applicant candidate. |
| leases | where tenantId == tenantRecordId | Active tenant candidate. |
| leases | where tenantIds array-contains tenantRecordId | Active tenant candidate. |
| leases | where tenantEmail == email | Active tenant candidate. |
| leases | where email == email | Active tenant candidate. |
| leases | doc(tenantRecordLeaseId) | Active tenant candidate. |
| tenancies | where tenantId == tenantRecordId | Active tenancy candidate when status is active. |
| tenancy_invites | where redeemed_by_uid == uid | Invite candidate. |
| tenancy_invites | where invited_email == email | Invite candidate. |
| properties | doc(propertyId) | rc_prop_id resolution fallback. |

Active lease statuses considered by tenancyContextService are active, current, renewal_accepted, notice_pending, and renewal_pending.

## Fail-Closed Outcomes

| Condition | Response context | Route response |
| --- | --- | --- |
| Missing uid | reason unauthenticated | /api/tenant workspace handlers return 401 { ok: false, error: "UNAUTHORIZED" }. |
| No candidate authority | reason no_authority | resolveWorkspaceContextOrRespond returns 409 { ok: false, error: "TENANT_NOT_INITIALIZED", status: "tenant_not_initialized" }. |
| Candidates span more than one propertyId | reason ambiguous_authority | resolveWorkspaceContextOrRespond returns 403 { ok: false, error: "AMBIGUOUS_TENANCY_CONTEXT" }. |
| Role is not tenant or tenantId missing | rejected before context | requireTenantWorkspaceIdentity and requireTenant return 401 { ok: false, error: "UNAUTHORIZED" }. |

## Candidate Scoring

- Active lease candidate with direct active lease match: score 100.
- Tenant record with lease id: score 95.
- Active tenancies record: score 90.
- Tenant record without lease id: score 80.
- Redeemed invite: score 40.
- Non-redeemed non-expired invite: score 30.
- Application/rental application: score 20.

All candidates must resolve to one propertyId. The highest score candidate wins, with linked application or linked lease filled from same-property candidates when the winner lacks one of those identifiers.

## Boundary Notes

- Tenant self-service routes must use the resolved context, not client-provided propertyId, leaseId, tenantId, or unitId, for authority decisions.
- /api/tenant/lease-notices in /Users/rentchain/dev/rentchain/rentchain-api/src/routes/tenantLeaseNoticeRoutes.ts uses tenant role and getLeaseForTenantWorkflow rather than resolveTenancyContext; it must remain separately verified.
- /api/tenants routes in /Users/rentchain/dev/rentchain/rentchain-api/src/routes/tenantsRoutes.ts are landlord/admin management routes behind requireLandlord and must not be confused with tenant self-service routes.
- /api/admin/tenants routes in /Users/rentchain/dev/rentchain/rentchain-api/src/routes/adminTenantsRoutes.ts require auth plus admin permissions and are admin inspection surfaces.
