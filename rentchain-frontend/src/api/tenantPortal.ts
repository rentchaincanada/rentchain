import { tenantApiFetch } from "./tenantApiFetch";

export type TenantWorkspaceContext = {
  ok?: boolean;
  authority: "applicant" | "active_tenant" | "invite" | null;
  propertyId: string | null;
  rc_prop_id: string | null;
  applicationId: string | null;
  leaseId: string | null;
  tenantId: string | null;
  unitId: string | null;
  invitedEmail: string | null;
};

export type TenantWorkspaceProperty = {
  propertyId: string;
  rc_prop_id: string | null;
  street1: string | null;
  street2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  features: string[];
};

export type TenantWorkspaceUnit = {
  unitId?: string | null;
  label: string | null;
};

export type TenantWorkspaceApplication = {
  applicationId: string;
  status: string | null;
  missingSteps: string[];
  nextActions: string[];
  createdAt: string | null;
  updatedAt: string | null;
};

export type TenantWorkspaceLease = {
  leaseId: string;
  startDate: string | null;
  endDate: string | null;
  monthlyRent: number | null;
  dueDay?: number | null;
  status: string | null;
  documentUrl: string | null;
  leaseDocumentContext?: TenantLeaseDocumentContext | null;
  signatureStatus?: "not_started" | "awaiting_tenant_signature" | "awaiting_landlord_signature" | "signed" | "unavailable";
  signatureReadinessLabel?: string | null;
  signatureReadinessDescription?: string | null;
  tenantSignature?: {
    signedAt: string | null;
    signatureMethod: "typed" | "drawn" | null;
    signatureDisplayName: string | null;
  } | null;
  leasePdfStatus?: "available" | "pending" | "not_available";
  leasePdfLabel?: string | null;
  leasePdfDescription?: string | null;
  leaseExecution?: {
    executionStatus:
      | "draft"
      | "ready_for_tenant_signature"
      | "tenant_signed"
      | "ready_for_landlord_signature"
      | "landlord_signed"
      | "fully_executed"
      | "blocked";
    executionLabel: string;
    executionDescription: string;
    requiredNextAction:
      | "complete_lease_details"
      | "tenant_signature"
      | "landlord_signature"
      | "review_signed_lease"
      | "none";
    tenantSignatureStatus: "not_required" | "needed" | "completed" | "blocked";
    landlordSignatureStatus: "not_required" | "needed" | "completed" | "blocked";
    pdfStatus: "not_ready" | "ready" | "generated" | "blocked";
    completedAt: string | null;
  } | null;
  paymentReadiness?: PaymentReadiness | null;
  depositCents?: number | null;
  depositRequired?: boolean | null;
  depositReceived?: boolean | null;
  depositReceivedAt?: string | null;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  paymentRequestedAt?: string | null;
  paymentCompletedAt?: string | null;
  rentPaymentSummary?: {
    paymentRail: {
      enabled: boolean;
      enabledAt: string | null;
      processor: "stripe" | null;
      blockedReason: string | null;
    };
    latestPayment: {
      id: string;
      amountCents: number;
      currency: "cad";
      status: "setup_required" | "checkout_created" | "payment_pending" | "paid" | "failed" | "canceled" | "expired";
      createdAt: string;
      updatedAt: string;
      paidAt: string | null;
    } | null;
    paymentExperience: PaymentExperience;
  } | null;
};

export type TenantLeaseDocumentContext = {
  leaseId?: string | null;
  tenantId?: string | null;
  propertyId?: string | null;
  unitId?: string | null;
  leaseStatus?: string | null;
  signingStatus?: string | null;
  documentStatus: "signed" | "generated" | "pending" | "missing";
  documentId?: string | null;
  documentUrl?: string | null;
  displayLabel: string;
  source: string;
  confidence: "high" | "medium" | "low";
  warnings: string[];
};

export type RentPaymentHistoryItem = {
  id: string;
  amountCents: number;
  currency: "cad";
  status: "setup_required" | "checkout_created" | "payment_pending" | "paid" | "failed" | "canceled" | "expired";
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
};

export type PaymentExperience = {
  history: RentPaymentHistoryItem[];
  latestStatus: "pending" | "paid" | "failed" | "canceled" | null;
  retryAvailable: boolean;
  receiptSummary: {
    available: boolean;
    label: string;
    amountCents: number | null;
    paidAt: string | null;
    leaseReference: string | null;
  };
};

export type PaymentReadiness = {
  readinessStatus: "not_ready" | "ready_to_configure" | "blocked";
  readinessLabel: string;
  readinessDescription: string;
  requiredNextAction: "complete_lease_details" | "review_rent_terms" | "confirm_payment_setup_later" | "none";
  rentTerms: {
    rentAmountAvailable: boolean;
    dueDateAvailable: boolean;
    leaseDatesAvailable: boolean;
    tenantLinked: boolean;
    leaseExecuted: boolean;
  };
  paymentSetup: {
    processorConnected: false;
    moneyMovementEnabled: false;
    storedPaymentMethod: false;
  };
};

export type TenantWorkspaceMaintenance = {
  requestId: string;
  id?: string;
  status: string | null;
  category: string | null;
  priority: string | null;
  title: string | null;
  summary: string | null;
  assignedContractorName?: string | null;
  contractorStatus?: string | null;
  serviceStartedAt?: number | null;
  serviceCompletedAt?: number | null;
  lastExecutionUpdateAt?: number | null;
  completionSummary?: string | null;
  completionOutcome?: "completed" | "partially_completed" | "follow_up_required" | null;
  completionConfirmedByLandlordAt?: number | null;
  reopenedAt?: number | null;
  reopenedByActorId?: string | null;
  reopenedByActorRole?: "tenant" | "landlord" | "admin" | null;
  reopenReason?: string | null;
  serviceWindowStartAt?: number | null;
  serviceWindowEndAt?: number | null;
  accessRequired?: boolean | null;
  tenantConfirmationStatus?: "confirmed" | "needs_schedule_change" | null;
  tenantConfirmationUpdatedAt?: number | null;
  accessAcknowledgedAt?: number | null;
  resolutionStatus?: "completed_pending_review" | "landlord_approved" | "tenant_pending_signoff" | "resolved" | "follow_up_required" | null;
  landlordApprovedAt?: number | null;
  tenantSignoffStatus?: "pending" | "accepted" | "declined" | null;
  tenantSignedOffAt?: number | null;
  tenantDeclinedAt?: number | null;
  tenantDeclineReason?: string | null;
  followUpRequired?: boolean | null;
  followUpReason?: string | null;
  finalResolvedAt?: number | null;
  reworkCycle?: {
    cycleNumber: number;
    status: "not_started" | "assigned" | "in_progress" | "completed" | "cancelled";
    createdAt?: number | null;
    assignedAt?: number | null;
    startedAt?: number | null;
    completedAt?: number | null;
    completionSummary?: string | null;
    schedule?: {
      scheduledFor?: number | null;
      timeWindowStart?: number | null;
      timeWindowEnd?: number | null;
      status?: "not_scheduled" | "scheduled" | "contractor_confirmed" | "tenant_pending" | "confirmed" | "reschedule_requested" | "cancelled" | null;
      requiresTenantAccess?: boolean | null;
      tenantAccessStatus?: "pending" | "confirmed" | "denied" | "not_required" | null;
      tenantAccessNote?: string | null;
    } | null;
  } | null;
  reworkHistory?: Array<{
    cycleNumber: number;
    startedAt?: number | null;
    completedAt?: number | null;
    outcome?: "resolved" | "failed" | "partial" | null;
    notes?: string | null;
  }>;
  reworkReview?: {
    status?: "pending_review" | "landlord_approved" | "tenant_pending_signoff" | "closed" | "follow_up_required" | null;
    reviewedAt?: number | null;
    tenantSignoffStatus?: "pending" | "accepted" | "declined" | null;
    tenantSignedOffAt?: number | null;
    tenantDeclinedAt?: number | null;
    tenantDeclineReason?: string | null;
    closureOutcome?: "resolved" | "partial" | "needs_more_followup" | null;
    closedAt?: number | null;
  } | null;
  notifications?: {
    tenant: {
      requiresAccessConfirmation: boolean;
      requiresSignoff: boolean;
      requiresReworkAwareness: boolean;
    };
  };
  evidence?: Array<{
    id: string;
    url: string | null;
    filename?: string | null;
    contentType?: string | null;
    uploadedAt?: number | null;
    uploadedByActorRole?: string | null;
    evidenceType?: string | null;
    caption?: string | null;
    visibility?: "tenant_safe";
  }>;
  createdAt: number | null;
  updatedAt: number | null;
  statusHistory?: Array<{
    status: string | null;
    actorRole: string | null;
    actorId?: string | null;
    message: string | null;
    createdAt: number | null;
  }>;
};

export type TenantIdentityRecord = {
  identityStatus: "incomplete" | "ready" | "verified" | "limited";
  profile: {
    completionStatus: "complete" | "in_progress" | "missing" | "needs_attention";
  };
  application: {
    reusable: boolean;
    lastSubmittedAt: string | null;
  };
  documents: {
    completionStatus: "complete" | "in_progress" | "missing" | "needs_attention";
    missingCategories: string[];
  };
  screening: {
    status: "not_started" | "in_progress" | "completed" | "needs_attention" | "blocked";
    lastCompletedAt: string | null;
  };
  leases: {
    activeCount: number;
    historicalCount: number;
    lastSignedAt: string | null;
  };
  verification: {
    level: "none" | "partial" | "strong";
  };
  readinessLabel: string;
  readinessDescription: string;
};

export type TenantCredibilitySignals = {
  signals: Array<{
    key:
      | "profile_complete"
      | "application_reusable"
      | "documents_available"
      | "screening_completed"
      | "lease_history_present";
    label: string;
    description: string;
    status: "not_available" | "available" | "verified" | "incomplete";
  }>;
  summary: {
    completenessLevel: "low" | "medium" | "high";
    verificationLevel: "none" | "partial" | "strong";
    summaryLabel: string;
    summaryDescription: string;
  };
};

export type IdentityTimeline = {
  events: Array<{
    type:
      | "application.created"
      | "application.submitted"
      | "screening_consent_confirmed"
      | "screening.completed"
      | "lease.created"
      | "lease.activated"
      | "lease.tenant_signed";
    label: string;
    description: string;
    occurredAt: string;
  }>;
};

export type PortableIdentity = {
  portabilityStatus: "not_ready" | "ready" | "limited";
  portabilityLabel: string;
  portabilityDescription: string;
  reusableAcrossApplications: boolean;
  identityReference: {
    referenceType: "tenant_identity";
    referenceStatus: "active" | "limited";
  };
  readiness: {
    identityReady: boolean;
    applicationReusable: boolean;
    credibilityReady: boolean;
    sharingEnabled: boolean;
  };
  nextAction: "complete_identity" | "enable_sharing" | "review_reusability" | "none";
};

export type InstitutionalIdentityPackage = {
  identitySummary: {
    identityStatus: "incomplete" | "ready" | "verified" | "limited";
    verificationLevel: "none" | "partial" | "strong";
    completenessLevel: "low" | "medium" | "high";
    readinessLabel: string;
  };
  credibilitySummary: {
    completenessLevel: "low" | "medium" | "high";
    verificationLevel: "none" | "partial" | "strong";
    summaryLabel: string;
    summaryDescription: string;
  };
  leaseSummary: {
    activeLease: boolean;
    leaseExecutionStatus:
      | "draft"
      | "ready_for_tenant_signature"
      | "tenant_signed"
      | "ready_for_landlord_signature"
      | "landlord_signed"
      | "fully_executed"
      | "blocked"
      | "not_available";
  };
  paymentReadinessSummary: {
    readinessStatus: "not_ready" | "ready_to_configure" | "blocked" | "not_available";
    readinessLabel: string;
    readinessDescription: string;
  };
  auditSummary: {
    totalEvents: number;
    recentActivity: Array<{
      type:
        | "application.created"
        | "application.submitted"
        | "screening_consent_confirmed"
        | "screening.completed"
        | "lease.created"
        | "lease.activated"
        | "lease.tenant_signed";
      label: string;
      occurredAt: string;
    }>;
  };
  portabilitySummary?: {
    portabilityStatus: "not_ready" | "ready" | "limited";
    portabilityLabel: string;
    reusableAcrossApplications: boolean;
  };
  metadata: {
    generatedAt: string;
    dataScope: "tenant_controlled_institutional_readiness";
    consentRequired: true;
  };
};

export type InstitutionalSchemaVersion = "1.0" | "2.0";

export type InstitutionalExportV2 = {
  schema: {
    name: "rentchain.institutional_identity_package";
    version: "2.0";
    generatedAt: string;
    jurisdiction: "CA";
    dataScope: "tenant_controlled_export";
    consentRequired: true;
  };
  subject: {
    subjectType: "tenant";
    identityStatus: "incomplete" | "limited" | "ready" | "verified";
    verificationLevel: "none" | "partial" | "strong";
    completenessLevel: "low" | "medium" | "high";
  };
  identity: {
    portabilityStatus: "not_ready" | "limited" | "ready";
    identityReadiness: "incomplete" | "limited" | "ready" | "verified";
    credibilityReadiness: "low" | "medium" | "high";
  };
  rentalHistory: {
    activeLeaseAvailable: boolean;
    leaseExecutionStatus: "not_available" | "draft" | "pending_signature" | "executed" | "blocked";
    leaseSummaryAvailable: boolean;
  };
  paymentReadiness: {
    rentTermsReady: boolean;
    paymentRailAvailable: boolean;
    latestPaymentStatus?: "not_available" | "checkout_created" | "pending" | "paid" | "failed" | "canceled" | "expired";
  };
  audit: {
    auditTrailAvailable: boolean;
    totalIdentityEvents: number;
    recentActivityAvailable: boolean;
  };
  validation: {
    status: "valid" | "valid_with_warnings" | "invalid";
    warnings: string[];
    missingRecommendedFields: string[];
  };
  complianceReadiness: {
    readinessStatus: "not_ready" | "partial" | "ready";
    readinessLabel: string;
    readinessDescription: string;
    checks: Array<{
      key:
        | "schema_validated"
        | "identity_trace_available"
        | "consent_controls_available"
        | "export_tenant_controlled"
        | "sensitive_data_minimized";
      status: "pass" | "warning" | "missing";
      label: string;
      description: string;
    }>;
    exportTraceability: {
      exportAvailable: boolean;
      schemaVersion: "2.0";
      exportStorage: "not_stored";
      outboundTransfer: "none";
    };
    auditTraceability: {
      traceabilityStatus: "limited" | "ready";
      traceabilityLabel: string;
      traceabilityDescription: string;
      evidenceCoverage: {
        identityTimelineAvailable: boolean;
        exportGeneratedOnDemand: true;
        exportStoredByRentChain: false;
        handoffDraftMetadataAvailable: boolean;
        manualReleasePreparationAvailable: boolean;
        observabilityCoverage: "draft_creation_only" | "none";
        canonicalInstitutionEventsAvailable: false;
      };
      readinessGaps: Array<
        | "institutional_export_events_not_recorded"
        | "institutional_handoff_lifecycle_events_limited"
        | "access_audit_summary_not_available"
      >;
    };
  };
  extensions: {
    reserved: Record<string, never>;
  };
};

export type InstitutionalHandoffSummary = {
  id: string;
  tenantId: string;
  institutionProfile: {
    institutionType: "bank" | "lender" | "insurer" | "regulator" | "internal_review";
    displayName: string;
    integrationMode: "sandbox" | "manual_export";
    status: "draft_only" | "not_connected";
  };
  schema: {
    name: "rentchain.institutional_identity_package";
    version: "2.0";
  };
  compliance: {
    readinessStatus: "not_ready" | "partial" | "ready";
    validationStatus: "valid" | "valid_with_warnings" | "invalid";
  };
  handoffStatus:
    | "draft"
    | "ready_for_manual_review"
    | "ready_for_tenant_managed_release"
    | "blocked"
    | "voided";
  exportStorage: "metadata_only";
  outboundTransfer: "none";
  createdAt: string;
  updatedAt: string;
};

export type TenantWorkspaceSummary = {
  context: TenantWorkspaceContext;
  property: TenantWorkspaceProperty | null;
  unit: TenantWorkspaceUnit | null;
  application: TenantWorkspaceApplication | null;
  lease: TenantWorkspaceLease | null;
  maintenance: TenantWorkspaceMaintenance[];
  tenantIdentityRecord?: TenantIdentityRecord | null;
  tenantCredibilitySignals?: TenantCredibilitySignals | null;
  portableIdentity?: PortableIdentity | null;
  identityTimeline?: IdentityTimeline | null;
};

export async function getTenantWorkspace(): Promise<TenantWorkspaceSummary> {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantWorkspaceSummary }>("/tenant/workspace");
  return res?.data;
}

export async function exportTenantIdentityPackage(schemaVersion?: "1.0"): Promise<InstitutionalIdentityPackage>;
export async function exportTenantIdentityPackage(schemaVersion: "2.0"): Promise<InstitutionalExportV2>;
export async function exportTenantIdentityPackage(
  schemaVersion: InstitutionalSchemaVersion = "1.0"
): Promise<InstitutionalIdentityPackage | InstitutionalExportV2> {
  const res = await tenantApiFetch<{ ok: boolean; data: InstitutionalIdentityPackage | InstitutionalExportV2 }>(
    "/tenant/identity/export",
    {
      method: "POST",
      body: JSON.stringify({ schemaVersion }),
    }
  );
  return res?.data;
}

export async function createInstitutionalHandoffDraft(payload: {
  institutionProfile: {
    institutionType: "bank" | "lender" | "insurer" | "regulator" | "internal_review";
    displayName?: string;
    integrationMode?: "sandbox" | "manual_export";
  };
}): Promise<InstitutionalHandoffSummary> {
  const res = await tenantApiFetch<{ ok: boolean; data: InstitutionalHandoffSummary }>("/tenant/institutional/handoffs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res?.data;
}

export async function listInstitutionalHandoffDrafts(): Promise<InstitutionalHandoffSummary[]> {
  const res = await tenantApiFetch<{ ok: boolean; data: { items: InstitutionalHandoffSummary[] } }>(
    "/tenant/institutional/handoffs"
  );
  return Array.isArray(res?.data?.items) ? res.data.items : [];
}

export async function voidInstitutionalHandoffDraft(handoffId: string): Promise<InstitutionalHandoffSummary> {
  const res = await tenantApiFetch<{ ok: boolean; data: InstitutionalHandoffSummary }>(
    `/tenant/institutional/handoffs/${encodeURIComponent(handoffId)}`,
    {
      method: "DELETE",
    }
  );
  return res?.data;
}

export async function getTenantApplicationStatus(): Promise<TenantWorkspaceApplication | null> {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantWorkspaceApplication | null }>("/tenant/application-status");
  return res?.data ?? null;
}

export async function getTenantLeaseWorkspace(): Promise<TenantWorkspaceLease | null> {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantWorkspaceLease | null }>("/tenant/lease");
  return res?.data ?? null;
}

export async function refreshTenantLeaseDocumentUrl(): Promise<{
  documentUrl: string;
  displayLabel: string;
  documentStatus: string;
  source: string;
  expiresInSeconds: number;
}> {
  const res = await tenantApiFetch<{
    ok: boolean;
    data: {
      documentUrl: string;
      displayLabel: string;
      documentStatus: string;
      source: string;
      expiresInSeconds: number;
    };
  }>("/tenant/lease/document-url");
  return res.data;
}

export async function createTenantLeasePaymentCheckout(
  leaseId: string
): Promise<{ rentPaymentId: string; status: "checkout_created"; redirectUrl: string }> {
  const res = await tenantApiFetch<{ ok: boolean; data: { rentPaymentId: string; status: "checkout_created"; redirectUrl: string } }>(
    `/tenant/leases/${encodeURIComponent(leaseId)}/payments/checkout`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }
  );
  return res?.data;
}

export async function getTenantLeasePaymentStatus(
  leaseId: string
): Promise<{
  paymentRail: {
    enabled: boolean;
    enabledAt: string | null;
    processor: "stripe" | null;
    blockedReason: string | null;
  };
  latestPayment: {
    id: string;
    amountCents: number;
    currency: "cad";
    status: "setup_required" | "checkout_created" | "payment_pending" | "paid" | "failed" | "canceled" | "expired";
    createdAt: string;
    updatedAt: string;
    paidAt: string | null;
  } | null;
  paymentExperience: PaymentExperience;
}> {
  const res = await tenantApiFetch<{ ok: boolean; data: any }>(`/tenant/leases/${encodeURIComponent(leaseId)}/payments`);
  return res?.data;
}

export async function signTenantLease(leaseId: string): Promise<TenantWorkspaceLease | null> {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantWorkspaceLease | null }>(
    `/tenant/leases/${encodeURIComponent(leaseId)}/sign`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }
  );
  return res?.data ?? null;
}

export async function listTenantWorkspaceMaintenance(): Promise<TenantWorkspaceMaintenance[]> {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantWorkspaceMaintenance[] }>("/tenant/maintenance-requests");
  return Array.isArray(res?.data) ? res.data : [];
}

export async function getTenantWorkspaceMaintenance(id: string): Promise<TenantWorkspaceMaintenance | null> {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantWorkspaceMaintenance | null }>(
    `/tenant/maintenance-requests/${encodeURIComponent(id)}`
  );
  return res?.data ?? null;
}

export async function createTenantWorkspaceMaintenance(payload: {
  title: string;
  description: string;
  category: string;
  priority: string;
}) {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantWorkspaceMaintenance }>(
    "/tenant/maintenance-requests",
    {
      method: "POST",
      body: payload,
    }
  );
  return res?.data;
}

export async function updateTenantWorkspaceMaintenanceConfirmation(
  id: string,
  payload: {
    confirmationStatus?: "confirmed" | "needs_schedule_change";
    acknowledgeAccess?: boolean;
  }
) {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantWorkspaceMaintenance }>(
    `/tenant/maintenance-requests/${encodeURIComponent(id)}/confirmation`,
    {
      method: "POST",
      body: payload,
    }
  );
  return res?.data;
}

export async function updateTenantWorkspaceMaintenanceSignoff(
  id: string,
  payload: {
    decision: "resolved" | "not_resolved";
    reason?: string;
  }
) {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantWorkspaceMaintenance }>(
    `/tenant/maintenance/${encodeURIComponent(id)}/signoff`,
    {
      method: "POST",
      body: payload,
    }
  );
  return res?.data;
}

export async function updateTenantWorkspaceMaintenanceReopen(
  id: string,
  payload: {
    reason: string;
  }
) {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantWorkspaceMaintenance }>(
    `/tenant/maintenance/${encodeURIComponent(id)}/reopen`,
    {
      method: "POST",
      body: payload,
    }
  );
  return res?.data;
}

export async function updateTenantWorkspaceReworkAccess(
  id: string,
  payload: {
    decision: "confirm" | "deny";
    note?: string;
  }
) {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantWorkspaceMaintenance }>(
    `/tenant/maintenance/${encodeURIComponent(id)}/confirm-rework-access`,
    {
      method: "POST",
      body: payload,
    }
  );
  return res?.data;
}

export async function updateTenantWorkspaceReworkSignoff(
  id: string,
  payload: {
    decision: "resolved" | "not_resolved";
    reason?: string;
  }
) {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantWorkspaceMaintenance }>(
    `/tenant/maintenance/${encodeURIComponent(id)}/rework-signoff`,
    {
      method: "POST",
      body: payload,
    }
  );
  return res?.data;
}

export async function redeemTenantWorkspaceInvite(token: string) {
  const res = await tenantApiFetch<{
    ok: boolean;
    data: {
      inviteId: string | null;
      propertyId: string | null;
      applicationId: string | null;
      rc_prop_id: string | null;
      status: string | null;
    };
  }>("/tenant/invite/redeem", {
    method: "POST",
    body: { token },
  });
  return res?.data;
}
