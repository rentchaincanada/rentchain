import { apiJson } from "@/api/http";
import type { LeaseRiskSnapshot } from "@/types/leaseRisk";
import type { PropertyCredibilitySummary } from "@/types/credibilitySummary";

export type LeaseStatus = "active" | "notice_pending" | "renewal_pending" | "renewal_accepted" | "move_out_pending" | "ended" | "archived";
export type LeaseRenewalStatus = "unknown" | "offered" | "accepted" | "declined";

export interface LeaseAutomationTask {
  id: string;
  leaseId: string;
  kind:
    | "renewal_reminder"
    | "rent_increase_eligibility_check"
    | "renewal_offer_draft"
    | "move_out_reminder_30"
    | "move_out_reminder_14"
    | "move_out_reminder_3";
  mode: "draft" | "reminder";
  dueDate: string;
  reason: string;
  status: "upcoming";
  createdAt: string;
}

export interface Lease {
  id: string;
  tenantId: string;
  tenantIds?: string[];
  primaryTenantId?: string | null;
  propertyId: string;
  propertyAddress?: string | null;
  propertyName?: string | null;
  propertyLabel?: string | null;
  unitId?: string | null;
  unitLabel?: string | null;
  unitNumber: string;
  monthlyRent: number;
  startDate: string;
  endDate?: string | null;
  automationEnabled?: boolean;
  renewalStatus?: LeaseRenewalStatus;
  status: LeaseStatus;
  risk?: LeaseRiskSnapshot | null;
  riskScore?: number | null;
  riskGrade?: string | null;
  riskConfidence?: number | null;
  createdAt: string;
  updatedAt: string;
}

export type LeaseStateCoherence = {
  coherenceStatus: "coherent" | "review_required" | "unknown";
  coherenceLabel: string;
  coherenceReason: string;
  leaseExecutionState:
    | "not_started"
    | "in_progress"
    | "executed"
    | "blocked"
    | "unknown";
  leaseOperationalState:
    | "draft"
    | "pending_execution"
    | "executed_future"
    | "active"
    | "notice_period"
    | "past"
    | "archived"
    | "review_required"
    | "unknown";
  occupancyState:
    | "occupied"
    | "vacant"
    | "upcoming"
    | "notice_period"
    | "review_required"
    | "unknown";
  tenantOperationalState:
    | "applicant"
    | "pending_activation"
    | "active"
    | "past"
    | "archived"
    | "review_required"
    | "unknown";
  paymentReadinessState:
    | "not_started"
    | "provider_pending"
    | "provider_paid"
    | "recorded_activity_present"
    | "ready_to_configure"
    | "not_ready"
    | "blocked"
    | "review_required"
    | "unknown";
  sourceFields: Record<string, string | number | null | undefined>;
  flags: {
    leaseMarkedActiveBeforeExecution: boolean;
    activeLeaseOnVacantUnit: boolean;
    occupiedUnitWithoutActiveExecutedLease: boolean;
    tenantActiveWithoutExecutedOccupancy: boolean;
    paymentActivityWithoutProviderSetup: boolean;
    hasStateConflict: boolean;
    requiresReview: boolean;
  };
};

export type JurisdictionPolicyGuidance = {
  jurisdiction: "NS" | "ON" | "UNKNOWN" | "UNSUPPORTED";
  policyKey: string;
  status: "ok" | "review" | "not_applicable" | "unknown";
  severity: "info" | "warning" | "critical";
  label: string;
  reason: string;
  recommendation: string;
  sourceRuleKey: string;
  confidence: "high" | "medium" | "low";
  legalAdvice: false;
  disclaimer: string;
};

export interface LandlordActiveLease extends Lease {
  propertyName: string;
  tenantName?: string | null;
  tenantEmail?: string | null;
  documentUrl?: string | null;
  scheduleAUrl?: string | null;
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
  paymentReadiness?: {
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
  } | null;
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
  leaseLifecycleSummary?: LeaseLifecycleSummary;
  stateCoherence?: LeaseStateCoherence | null;
  jurisdictionProvince?: string | null;
  jurisdictionPolicies?: JurisdictionPolicyGuidance[];
  hiddenFromActiveLists?: boolean;
  cleanupReason?: string | null;
  cleanupBatch?: string | null;
  archivedAt?: string | null;
  archivedByUserId?: string | null;
  isArchived?: boolean;
}

export type LeaseSigningStatusResponse = {
  signingStatus: "not_started" | "pending_signature" | "signed" | "rejected" | "expired" | "cancelled" | "failed";
  derivedLeaseState: string;
  signingProviderId: string | null;
  signingRequestId: string | null;
  providerDispatchMode?: string | null;
  providerDispatchStatus?: string | null;
  providerDispatchMessage?: string | null;
  routeVersion?: string | null;
  sentAt: string | null;
  signedAt: string | null;
  documentUrl: string | null;
  events: Array<{
    id: string;
    type: string;
    occurredAt: string;
    actorRole: string;
  }>;
};

export async function sendLeaseForSignature(
  leaseId: string,
  payload: { tenantEmails: string[]; message?: string }
): Promise<LeaseSigningStatusResponse> {
  const res = await apiJson<{ ok: boolean; data: LeaseSigningStatusResponse }>(
    `/leases/${encodeURIComponent(leaseId)}/send-for-signature`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
  return res.data;
}

export async function getLeaseSigningStatus(leaseId: string): Promise<LeaseSigningStatusResponse> {
  const res = await apiJson<{ ok: boolean; data: LeaseSigningStatusResponse }>(
    `/leases/${encodeURIComponent(leaseId)}/signing-status`
  );
  return res.data;
}

export async function downloadSignedLease(leaseId: string): Promise<{ documentUrl: string; signingStatus: string; signedAt: string | null }> {
  const res = await apiJson<{ ok: boolean; data: { documentUrl: string; signingStatus: string; signedAt: string | null } }>(
    `/leases/${encodeURIComponent(leaseId)}/download-signed`,
    { method: "POST", body: "{}" }
  );
  return res.data;
}

export async function cancelLeaseSigning(leaseId: string): Promise<{ signingStatus: string; cancelledAt: string | null; derivedLeaseState: string }> {
  const res = await apiJson<{ ok: boolean; data: { signingStatus: string; cancelledAt: string | null; derivedLeaseState: string } }>(
    `/leases/${encodeURIComponent(leaseId)}/cancel-signing`,
    { method: "POST", body: "{}" }
  );
  return res.data;
}

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

export type LeaseLifecycleSummary = {
  lifecycleStatus:
    | "active"
    | "expiring_soon"
    | "renewal_pending"
    | "no_response"
    | "renewed"
    | "ending"
    | "expired"
    | "blocked";
  lifecycleLabel: string;
  lifecycleDescription: string;
  requiredNextAction:
    | "review_expiring_lease"
    | "prepare_renewal_notice"
    | "follow_up_response"
    | "review_renewal_outcome"
    | "review_move_out"
    | "none";
  renewalOutcome:
    | "not_started"
    | "pending_response"
    | "renewed"
    | "tenant_quitting"
    | "no_response"
    | "not_applicable";
  daysUntilExpiry?: number;
  history: Array<{
    type:
      | "lease_started"
      | "notice_prepared"
      | "notice_sent"
      | "tenant_response_pending"
      | "renewed"
      | "tenant_quitting"
      | "expired";
    label: string;
    occurredAt?: string;
  }>;
};

export interface LeaseReconciliationCandidate {
  id: string;
  unitId: string;
  propertyId: string;
  propertyName: string;
  unitNumber: string;
  occupantName?: string | null;
  leaseEndDate?: string | null;
  monthlyRent: number;
  leaseDocument?: {
    fileName?: string | null;
    url?: string | null;
  } | null;
  canConvert: boolean;
  blockingReasons: string[];
}

export interface LeaseNote {
  id: string;
  leaseId: string;
  landlordId: string;
  note: string;
  createdAt: number | string;
  createdBy?: string | null;
}

export interface PropertyLeaseDiagnostic {
  code?: string;
  message?: string;
  severity?: string;
}

export interface CreateLeasePayload {
  tenantId: string;
  tenantIds?: string[];
  propertyId: string;
  unitNumber: string;
  monthlyRent: number;
  startDate: string;
  endDate?: string | null;
  automationEnabled?: boolean;
  renewalStatus?: LeaseRenewalStatus;
}

export interface UpdateLeasePayload {
  monthlyRent?: number;
  startDate?: string;
  endDate?: string | null;
  automationEnabled?: boolean;
  renewalStatus?: LeaseRenewalStatus;
  status?: LeaseStatus;
}

export async function getLeasesForTenant(
  tenantId: string
): Promise<{ leases: Lease[] }> {
  return apiJson<{ leases: Lease[] }>(
    `/leases/tenant/${encodeURIComponent(tenantId)}`
  );
}

export async function getLeasesForProperty(
  propertyId: string
): Promise<{ leases: Lease[]; diagnostics?: PropertyLeaseDiagnostic[]; credibilitySummary?: PropertyCredibilitySummary | null }> {
  return apiJson<{ leases: Lease[]; diagnostics?: PropertyLeaseDiagnostic[]; credibilitySummary?: PropertyCredibilitySummary | null }>(
    `/leases/property/${encodeURIComponent(propertyId)}`
  );
}

export async function getActiveLeasesForLandlord(): Promise<{ leases: LandlordActiveLease[] }> {
  return apiJson<{ leases: LandlordActiveLease[] }>("/leases/active");
}

export async function getArchivedLeasesForLandlord(): Promise<{ leases: LandlordActiveLease[] }> {
  return apiJson<{ leases: LandlordActiveLease[] }>("/leases/archived");
}

export async function getLeaseReconciliationCandidates(): Promise<{ candidates: LeaseReconciliationCandidate[] }> {
  return apiJson<{ candidates: LeaseReconciliationCandidate[] }>("/leases/reconciliation-candidates");
}

export async function convertUnitReferenceToLease(
  unitId: string,
  payload: {
    occupantName?: string;
    tenantEmail?: string;
    tenantPhone?: string;
    coApplicantEmail?: string;
    coApplicantPhone?: string;
    startDate: string;
    endDate?: string | null;
    monthlyRent?: number;
  }
): Promise<{ ok: true; lease: LandlordActiveLease; tenant: { id: string; fullName: string; email?: string | null; phone?: string | null } }> {
  return apiJson(`/leases/reconciliation-candidates/${encodeURIComponent(unitId)}/convert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function getLeaseById(id: string): Promise<{ lease: LandlordActiveLease }> {
  return apiJson<{ lease: LandlordActiveLease }>(`/leases/${encodeURIComponent(id)}`);
}

export async function refreshLeaseDocumentUrl(id: string, options?: { document?: "lease" | "schedule-a" }): Promise<{
  documentUrl: string;
  refreshMode: "signed_url" | "legacy_url";
  expiresInSeconds: number | null;
  documentKind?: "lease" | "schedule-a";
}> {
  const documentKind = options?.document ? `?document=${encodeURIComponent(options.document)}` : "";
  return apiJson<{
    ok: true;
    documentUrl: string;
    refreshMode: "signed_url" | "legacy_url";
    expiresInSeconds: number | null;
    documentKind?: "lease" | "schedule-a";
  }>(`/leases/${encodeURIComponent(id)}/document-url${documentKind}`);
}

export async function getLeaseNotes(id: string): Promise<{ ok: true; notes: LeaseNote[] }> {
  return apiJson<{ ok: true; notes: LeaseNote[] }>(`/leases/${encodeURIComponent(id)}/notes`);
}

export async function createLeaseNote(id: string, note: string): Promise<{ ok: true; note: LeaseNote }> {
  return apiJson<{ ok: true; note: LeaseNote }>(`/leases/${encodeURIComponent(id)}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note }),
  });
}

export async function archiveLeaseRecord(id: string): Promise<{ ok: true; lease: LandlordActiveLease }> {
  return apiJson<{ ok: true; lease: LandlordActiveLease }>(`/leases/${encodeURIComponent(id)}/archive`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
}

export async function restoreLeaseRecord(id: string): Promise<{ ok: true; lease: LandlordActiveLease }> {
  return apiJson<{ ok: true; lease: LandlordActiveLease }>(`/leases/${encodeURIComponent(id)}/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
}

export async function enableLeasePaymentRail(
  id: string
): Promise<{
  ok: true;
  data: {
    leaseId: string;
    paymentRail: {
      enabled: true;
      enabledAt: string;
      processor: "stripe";
      eligibility: "eligible";
      blockedReason: null;
    };
  };
}> {
  return apiJson(`/leases/${encodeURIComponent(id)}/payment-rails/enable`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
}

export async function getLeasePaymentStatus(id: string): Promise<{
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
  const res = await apiJson<{ ok: boolean; data: any }>(`/leases/${encodeURIComponent(id)}/payments`);
  return res?.data;
}

export async function createLease(
  payload: CreateLeasePayload
): Promise<{ lease: Lease }> {
  return apiJson<{ lease: Lease }>("/leases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateLease(
  id: string,
  payload: UpdateLeasePayload
): Promise<{ lease: Lease }> {
  return apiJson<{ lease: Lease }>(`/leases/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function endLease(
  id: string,
  endDate?: string
): Promise<{ lease: Lease }> {
  return apiJson<{ lease: Lease }>(
    `/leases/${encodeURIComponent(id)}/end`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endDate }),
    }
  );
}

export async function regenerateLeaseAutomationTasks(
  id: string
): Promise<{ ok: true; tasks: LeaseAutomationTask[] }> {
  return apiJson<{ ok: true; tasks: LeaseAutomationTask[] }>(
    `/leases/${encodeURIComponent(id)}/automation/tasks/regenerate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }
  );
}

export async function getLeaseAutomationTasks(
  id: string
): Promise<{ ok: true; tasks: LeaseAutomationTask[] }> {
  return apiJson<{ ok: true; tasks: LeaseAutomationTask[] }>(
    `/leases/${encodeURIComponent(id)}/automation/tasks`
  );
}
