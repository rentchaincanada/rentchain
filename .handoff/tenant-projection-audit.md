# Tenant Projection Audit

Source branch: docs/phase-f-tenant-portal-environment-v1

Audited source files:
- /Users/rentchain/dev/rentchain/rentchain-api/src/services/tenantPortal/tenantProjectionService.ts
- /Users/rentchain/dev/rentchain/rentchain-api/src/services/tenantPortal/tenantSafeProjectionContract.ts
- /Users/rentchain/dev/rentchain/rentchain-api/src/services/tenantPortal/tenantProfileService.ts
- /Users/rentchain/dev/rentchain/rentchain-api/src/services/tenantPortal/tenantCommunicationsService.ts
- /Users/rentchain/dev/rentchain/rentchain-api/src/services/tenantPortal/tenantNotificationsService.ts
- /Users/rentchain/dev/rentchain/rentchain-api/src/routes/tenantPortalRoutes.ts

## Projection Metadata

All tenant-safe projection metadata uses TENANT_SAFE_PROJECTION_VERSION tenant_safe_projection_v1 from /Users/rentchain/dev/rentchain/rentchain-api/src/services/tenantPortal/tenantSafeProjectionContract.ts.

Common metadata fields:

- projectionProfile
- projectionVersion
- sensitivityClass: sensitive
- authorityBasis: authenticated_tenant_scope
- redactionSummary
- sourceCollections
- sourceRefs

Projection audience is tenant_workspace. Internal reference policy says internal IDs are scoped references for navigation and traceability, not primary display labels.

## Allowed Field Groups

| Scope | Allowed field groups |
| --- | --- |
| tenant_current_lease | tenant_visible_lease_summary, tenant_visible_document_status, tenant_signature_status, payment_readiness_summary, scoped_source_references, operational_labels |
| tenant_workspace_context | tenant_workspace_context, tenant_visible_profile_summary, tenant_visible_application_summary, tenant_visible_lease_summary, tenant_visible_maintenance_summary, derived_identity_signals, scoped_source_references, operational_labels |
| tenant_profile | tenant_visible_profile_summary, tenant_visible_identity_status, tenant_visible_document_status, tenant_visible_application_summary, tenant_visible_lease_summary, scoped_source_references, operational_labels |
| tenant_application | tenant_visible_application_summary, tenant_visible_document_status, scoped_source_references, operational_labels |
| tenant_application_reuse | tenant_owned_reuse_profile, tenant_visible_application_reuse_fields, scoped_source_references, operational_labels |
| tenant_communications | tenant_visible_communications_thread, tenant_visible_message_bodies, tenant_read_state_summary, scoped_source_references, operational_labels |
| tenant_maintenance | tenant_visible_maintenance_summary, tenant_visible_maintenance_lifecycle, tenant_safe_evidence, scoped_source_references, operational_labels |
| tenant_property | tenant_visible_property_summary, tenant_visible_unit_summary, scoped_source_references, operational_labels |
| tenant_lease_notice | tenant_visible_lease_notice_summary, tenant_visible_notice_text, tenant_visible_response_options, tenant_response_state, scoped_source_references, operational_labels |
| tenant_document_access | tenant_visible_document_status, tenant_scoped_signed_url, tenant_visible_document_labels, scoped_source_references, operational_labels |
| tenant_attachment | tenant_visible_attachment_summary, tenant_visible_document_status, tenant_safe_evidence, scoped_source_references, operational_labels |
| tenant_ledger | tenant_visible_ledger_summary, tenant_visible_payment_lifecycle, tenant_visible_charge_summary, tenant_visible_balance_summary, operational_labels |
| tenant_payment | tenant_visible_payment_lifecycle, tenant_visible_receipt_summary, tenant_visible_payment_rail_status, operational_labels |
| tenant_balance | tenant_visible_balance_summary, tenant_visible_payment_lifecycle, tenant_visible_charge_summary, operational_labels |

Excluded field groups for tenant projections:

- landlord_only_notes
- other_tenant_records
- raw_provider_payloads
- raw_screening_reports
- raw_csv_values
- payment_account_details
- debug_payloads
- route_source_metadata
- stack_traces
- private_message_bodies
- storage_paths
- provider_delivery_payloads
- landlord_internal_workflow_state
- raw_financial_transaction_ids
- payment_provider_references
- settlement_metadata
- internal_ledger_ids

## Field Whitelists By Projection

Tenant property projection fields from projectTenantProperty:

- propertyId
- rc_prop_id
- street1
- street2
- city
- province
- postalCode
- features
- projection metadata fields

Tenant lease projection fields from projectTenantLease:

- leaseId
- startDate
- endDate
- monthlyRent
- dueDay
- status
- documentUrl
- signatureStatus
- signatureReadinessLabel
- signatureReadinessDescription
- tenantSignature.signedAt
- tenantSignature.signatureMethod
- tenantSignature.signatureDisplayName
- leasePdfStatus
- leasePdfLabel
- leasePdfDescription
- leaseExecution
- paymentReadiness
- projection metadata fields

Tenant application projection fields from projectTenantApplication:

- applicationId
- status
- missingSteps
- nextActions
- createdAt
- updatedAt
- projection metadata fields

Tenant maintenance projection fields from projectTenantMaintenance:

- requestId
- status
- category
- priority
- title
- summary
- assignedContractorName
- contractorStatus
- serviceStartedAt
- serviceCompletedAt
- lastExecutionUpdateAt
- completionSummary
- completionOutcome
- completionConfirmedByLandlordAt
- reopenedAt
- reopenedByActorRole
- reopenReason
- serviceWindowStartAt
- serviceWindowEndAt
- accessRequired
- tenantConfirmationStatus
- tenantConfirmationUpdatedAt
- accessAcknowledgedAt
- resolutionStatus
- landlordApprovedAt
- tenantSignoffStatus
- tenantSignedOffAt
- tenantDeclinedAt
- tenantDeclineReason
- followUpRequired
- followUpReason
- finalResolvedAt
- reworkCycle.cycleNumber
- reworkCycle.status
- reworkCycle.createdAt
- reworkCycle.assignedAt
- reworkCycle.startedAt
- reworkCycle.completedAt
- reworkCycle.completionSummary
- reworkCycle.schedule.scheduledFor
- reworkCycle.schedule.timeWindowStart
- reworkCycle.schedule.timeWindowEnd
- reworkCycle.schedule.status
- reworkCycle.schedule.requiresTenantAccess
- reworkCycle.schedule.tenantAccessStatus
- reworkCycle.schedule.tenantAccessNote
- reworkHistory.cycleNumber
- reworkHistory.startedAt
- reworkHistory.completedAt
- reworkHistory.outcome
- reworkHistory.notes
- reworkReview.status
- reworkReview.reviewedAt
- reworkReview.tenantSignoffStatus
- reworkReview.tenantSignedOffAt
- reworkReview.tenantDeclinedAt
- reworkReview.tenantDeclineReason
- reworkReview.closureOutcome
- reworkReview.closedAt
- notifications.tenant.requiresAccessConfirmation
- notifications.tenant.requiresSignoff
- notifications.tenant.requiresReworkAwareness
- evidence.id
- evidence.url
- evidence.filename
- evidence.contentType
- evidence.uploadedAt
- evidence.uploadedByActorRole
- evidence.evidenceType
- evidence.caption
- evidence.visibility tenant_safe
- createdAt
- updatedAt
- read
- readAt
- statusHistory.status
- statusHistory.actorRole
- statusHistory.message
- statusHistory.createdAt
- projection metadata fields

Tenant profile projection fields from loadTenantProfileProjection:

- context.authority
- context.propertyId
- context.rc_prop_id
- context.applicationId
- context.leaseId
- context.tenantId
- context.unitId
- context.invitedEmail
- profile.displayName
- profile.email
- profile.phone
- profile.authorityLabel
- profile.property
- profile.unit.unitId
- profile.unit.label
- profile.application
- profile.lease
- identity.overallStatus
- identity.identityVerification.status
- identity.identityVerification.label
- identity.identityVerification.note
- identity.identityVerification.updatedAt
- identity.documentChecklist.code
- identity.documentChecklist.label
- identity.documentChecklist.status
- identity.documentChecklist.nextStep
- identity.nextSteps
- projection metadata fields

Tenant application reuse projection fields:

- applicant.firstName
- applicant.lastName
- applicant.email
- applicant.phone
- currentAddress.line1
- currentAddress.line2
- currentAddress.city
- currentAddress.provinceState
- currentAddress.postalCode
- currentAddress.country
- timeAtCurrentAddressMonths
- currentRentAmountCents
- employment.employerName
- employment.jobTitle
- employment.incomeAmountCents
- employment.incomeFrequency
- employment.monthsAtJob
- workReference.name
- workReference.phone
- nextOfKin.name
- nextOfKin.relationship
- nextOfKin.phone
- nextOfKin.address
- projection metadata fields

Tenant communications projection fields from tenantCommunicationsService:

- canSend
- canSendReason
- thread.id
- thread.landlordLabel
- thread.propertyId
- thread.unitId
- thread.unreadCount
- thread.lastMessageAt
- thread.messages.id
- thread.messages.senderRole
- thread.messages.body
- thread.messages.createdAt
- thread.messages.createdAtMs
- projection metadata fields

Tenant notification item fields from tenantNotificationsService:

- id
- type
- title
- summary
- createdAt
- status
- relatedPath
- sourceRefs.sourceType
- sourceRefs.referenceKey
- sourceRefs.label
- read
- readAt

## Raw Reference Handling

- projectTenantMaintenance uses tenantSafeMaintenanceReferenceKey to return requestId as maintenance:<hash>, not the raw maintenance request document id.
- deriveTenantSafeHashedSourceRefs hashes sourceIds for maintenance projections.
- tenantProfileService safeSourceRef returns sourceCollection-ref-<hash> values for profile source refs.
- tenantNotificationsService safeNotificationId and safeSourceRef hash notification references.
- projectTenantLease and projectTenantProperty still include leaseId and propertyId in current projection objects. Phase G/H should treat these as scoped references for navigation only and should not use them as user-facing labels.

## Projection Checklist

- Tenant routes must prefer explicit allowlists over broad object spreading.
- Tenant-visible message bodies are allowed only in tenant communications surfaces.
- Raw screening reports, provider payloads, storage paths, payment provider references, payment tokens, landlord-only notes, and debug payloads are excluded.
- Tenant detail bundles under /api/tenants and /api/admin/tenants are not tenant workspace projections and must stay out of /api/tenant responses.
