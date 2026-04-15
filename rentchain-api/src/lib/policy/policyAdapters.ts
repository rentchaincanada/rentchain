import type { PolicyEvaluationRequest } from "./policyTypes";

function asString(value: unknown, max = 160) {
  return String(value || "").trim().slice(0, max);
}

export function buildScreeningPolicyRequest(input: {
  action: "generate_quote" | "start_checkout";
  actorRole?: string | null;
  actorUserId?: string | null;
  applicationId: string;
  eligibility: { eligible: boolean; reasonCode?: string | null; detail?: string | null };
  application: any;
  consentComplete: boolean;
  providerReady?: boolean;
}) : PolicyEvaluationRequest {
  const applicant = input.application?.applicant || {};
  const residentialHistory = Array.isArray(input.application?.residentialHistory)
    ? input.application.residentialHistory
    : [];
  const applicationDataComplete = Boolean(
    asString(applicant?.firstName) &&
      asString(applicant?.lastName) &&
      asString(applicant?.email) &&
      asString(applicant?.dob) &&
      residentialHistory.length > 0
  );

  return {
    domain: "screening",
    action: input.action,
    actor: {
      role: input.actorRole || null,
      userId: input.actorUserId || null,
    },
    resource: {
      type: "rental_application",
      id: input.applicationId,
    },
    context: {
      eligible: input.eligibility.eligible,
      eligibilityReasonCode: input.eligibility.reasonCode || null,
      consentComplete: input.consentComplete,
      providerReady: input.providerReady ?? true,
      applicationDataComplete,
      propertyId: asString(input.application?.propertyId, 120) || null,
      unitId: asString(input.application?.unitId, 120) || null,
    },
  };
}

export function buildMaintenancePolicyRequest(input: {
  action: "approve_cost" | "review_cost";
  actorRole?: string | null;
  actorUserId?: string | null;
  workOrderId: string;
  workOrder: any;
  actualCostCents: number;
}) : PolicyEvaluationRequest {
  const evidence = Array.isArray(input.workOrder?.evidence) ? input.workOrder.evidence : [];
  const costAttachments = Array.isArray(input.workOrder?.costAttachments) ? input.workOrder.costAttachments : [];
  return {
    domain: "maintenance",
    action: input.action,
    actor: {
      role: input.actorRole || null,
      userId: input.actorUserId || null,
    },
    resource: {
      type: "work_order",
      id: input.workOrderId,
    },
    context: {
      actualCostCents: input.actualCostCents,
      hasSupportingEvidence: evidence.length > 0 || costAttachments.length > 0,
      hasExpenseLink: String(input.workOrder?.cost?.linkedExpenseStatus || "").toLowerCase() === "linked",
      propertyId: asString(input.workOrder?.propertyId, 120) || null,
      unitId: asString(input.workOrder?.unitId, 120) || null,
      maintenanceRequestId: asString(input.workOrder?.maintenanceRequestId, 120) || null,
    },
  };
}

export function buildLeaseNoticePolicyRequest(input: {
  action: "preview_notice" | "send_notice";
  actorRole?: string | null;
  actorUserId?: string | null;
  lease: any;
  leaseId: string;
  requestBody: any;
}) : PolicyEvaluationRequest {
  const hasRequiredLegalInputs = Boolean(
    asString(input.lease?.province, 40) &&
      asString(input.lease?.leaseType, 40) &&
      asString(input.lease?.tenantId, 120) &&
      asString(input.lease?.propertyId, 120) &&
      asString(input.requestBody?.newLeaseStartDate, 30) &&
      Number(input.requestBody?.responseDeadlineAt || 0) > 0
  );
  return {
    domain: "lease_notice",
    action: input.action,
    actor: {
      role: input.actorRole || null,
      userId: input.actorUserId || null,
    },
    resource: {
      type: "lease",
      id: input.leaseId,
    },
    context: {
      hasRequiredLegalInputs,
      province: asString(input.lease?.province, 40) || null,
      leaseType: asString(input.lease?.leaseType, 40) || null,
      tenantId: asString(input.lease?.tenantId, 120) || null,
      propertyId: asString(input.lease?.propertyId, 120) || null,
      unitId: asString(input.lease?.unitId, 120) || null,
    },
  };
}
