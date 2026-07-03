import { createHash } from "crypto";
import { deriveLeaseExecution, type LeaseExecution } from "../leaseExecution/deriveLeaseExecution";
import { derivePaymentReadiness, type PaymentReadiness } from "../paymentReadiness/derivePaymentReadiness";
import {
  deriveTenantSafeProjectionMetadata,
  deriveTenantSafeProjectionProfile,
  deriveTenantSafeSourceRefs,
  type TenantSafeProjectionMetadata,
  type TenantSafeProjectionProfile,
  type TenantSafeProjectionSourceReference,
} from "./tenantSafeProjectionContract";

type TenantProjectionMetadataFields = TenantSafeProjectionMetadata & {
  sourceCollections: string[];
  sourceRefs: TenantSafeProjectionSourceReference[];
};

type TenantPropertyProjection = TenantProjectionMetadataFields & {
  propertyId: string;
  rc_prop_id: string | null;
  street1: string | null;
  street2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  features: string[];
};

type TenantLeaseProjection = TenantProjectionMetadataFields & {
  leaseId: string;
  startDate: string | null;
  endDate: string | null;
  monthlyRent: number | null;
  dueDay?: number | null;
  status: string | null;
  documentUrl: string | null;
  signatureStatus:
    | "not_started"
    | "awaiting_tenant_signature"
    | "awaiting_landlord_signature"
    | "signed"
    | "unavailable";
  signatureReadinessLabel: string;
  signatureReadinessDescription: string;
  tenantSignature: {
    signedAt: string | null;
    signatureMethod: "typed" | "drawn" | null;
    signatureDisplayName: string | null;
  } | null;
  leasePdfStatus: "available" | "pending" | "not_available";
  leasePdfLabel: string;
  leasePdfDescription: string;
  leaseExecution: LeaseExecution;
  paymentReadiness: PaymentReadiness;
};

type TenantApplicationProjection = TenantProjectionMetadataFields & {
  applicationId: string;
  status: string | null;
  missingSteps: string[];
  nextActions: string[];
  createdAt: string | null;
  updatedAt: string | null;
};

type TenantMaintenanceProjection = TenantProjectionMetadataFields & {
  requestId: string;
  status: string | null;
  category: string | null;
  priority: string | null;
  title: string | null;
  summary: string | null;
  assignedContractorName: string | null;
  contractorStatus: string | null;
  serviceStartedAt: number | null;
  serviceCompletedAt: number | null;
  lastExecutionUpdateAt: number | null;
  completionSummary: string | null;
  completionOutcome: "completed" | "partially_completed" | "follow_up_required" | null;
  completionConfirmedByLandlordAt: number | null;
  reopenedAt: number | null;
  reopenedByActorRole: "tenant" | "landlord" | "admin" | null;
  reopenReason: string | null;
  serviceWindowStartAt: number | null;
  serviceWindowEndAt: number | null;
  accessRequired: boolean | null;
  tenantConfirmationStatus: "confirmed" | "needs_schedule_change" | null;
  tenantConfirmationUpdatedAt: number | null;
  accessAcknowledgedAt: number | null;
  resolutionStatus:
    | "completed_pending_review"
    | "landlord_approved"
    | "tenant_pending_signoff"
    | "resolved"
    | "follow_up_required"
    | null;
  landlordApprovedAt: number | null;
  tenantSignoffStatus: "pending" | "accepted" | "declined" | null;
  tenantSignedOffAt: number | null;
  tenantDeclinedAt: number | null;
  tenantDeclineReason: string | null;
  followUpRequired: boolean | null;
  followUpReason: string | null;
  finalResolvedAt: number | null;
  reworkCycle: {
    cycleNumber: number;
    status: "not_started" | "assigned" | "in_progress" | "completed" | "cancelled";
    createdAt: number | null;
    assignedAt: number | null;
    startedAt: number | null;
    completedAt: number | null;
    completionSummary: string | null;
    schedule: {
      scheduledFor: number | null;
      timeWindowStart: number | null;
      timeWindowEnd: number | null;
      status: "not_scheduled" | "scheduled" | "contractor_confirmed" | "tenant_pending" | "confirmed" | "reschedule_requested" | "cancelled" | null;
      requiresTenantAccess: boolean | null;
      tenantAccessStatus: "pending" | "confirmed" | "denied" | "not_required" | null;
      tenantAccessNote: string | null;
    } | null;
  } | null;
  reworkHistory: Array<{
    cycleNumber: number;
    startedAt: number | null;
    completedAt: number | null;
    outcome: "resolved" | "failed" | "partial" | null;
    notes: string | null;
  }>;
  reworkReview: {
    status: "pending_review" | "landlord_approved" | "tenant_pending_signoff" | "closed" | "follow_up_required" | null;
    reviewedAt: number | null;
    tenantSignoffStatus: "pending" | "accepted" | "declined" | null;
    tenantSignedOffAt: number | null;
    tenantDeclinedAt: number | null;
    tenantDeclineReason: string | null;
    closureOutcome: "resolved" | "partial" | "needs_more_followup" | null;
    closedAt: number | null;
  } | null;
  notifications: {
    tenant: {
      requiresAccessConfirmation: boolean;
      requiresSignoff: boolean;
      requiresReworkAwareness: boolean;
    };
  };
  evidence: Array<{
    id: string;
    url: string | null;
    filename: string | null;
    contentType: string | null;
    uploadedAt: number | null;
    uploadedByActorRole: string | null;
    evidenceType: string | null;
    caption: string | null;
    visibility: "tenant_safe";
  }>;
  createdAt: number | null;
  updatedAt: number | null;
  read: boolean;
  readAt: number | null;
  statusHistory: Array<{
    status: string | null;
    actorRole: string | null;
    message: string | null;
    createdAt: number | null;
  }>;
};

function asString(value: unknown): string | null {
  const next = String(value || "").trim();
  return next || null;
}

function safeHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

export function tenantSafeMaintenanceReferenceKey(recordId: string): string {
  return `maintenance:${safeHash(`maintenanceRequests:${String(recordId || "").trim() || "request"}`)}`;
}

function safeSourceRef(sourceCollection: string, sourceId: string | null): TenantSafeProjectionSourceReference | null {
  const normalizedCollection = asString(sourceCollection);
  const normalizedSourceId = asString(sourceId);
  if (!normalizedCollection || !normalizedSourceId) return null;
  return {
    sourceCollection: normalizedCollection,
    sourceId: `${normalizedCollection}:${safeHash(`${normalizedCollection}:${normalizedSourceId}`)}`,
  };
}

function deriveTenantSafeHashedSourceRefs(input: {
  leaseId?: string | null;
  propertyId?: string | null;
  unitId?: string | null;
  tenantId?: string | null;
  maintenanceRequestId?: string | null;
}): TenantSafeProjectionSourceReference[] {
  const rawRefs = deriveTenantSafeSourceRefs({
    leaseId: input.leaseId,
    propertyId: input.propertyId,
    unitId: input.unitId,
    tenantId: input.tenantId,
  });
  const refs = rawRefs
    .map((ref) => safeSourceRef(ref.sourceCollection, ref.sourceId))
    .filter((ref): ref is TenantSafeProjectionSourceReference => Boolean(ref));
  const maintenanceRef = safeSourceRef("maintenanceRequests", input.maintenanceRequestId || null);
  if (maintenanceRef) refs.push(maintenanceRef);

  const byKey = new Map<string, TenantSafeProjectionSourceReference>();
  for (const ref of refs) byKey.set(`${ref.sourceCollection}:${ref.sourceId}`, ref);
  return Array.from(byKey.values()).sort((left, right) =>
    `${left.sourceCollection}:${left.sourceId}`.localeCompare(`${right.sourceCollection}:${right.sourceId}`)
  );
}

function isScheduleADocumentUrl(value: unknown): boolean {
  const normalized = String(value || "").trim().toLowerCase();
  return Boolean(normalized) && (normalized.includes("schedule-a") || normalized.includes("schedule_a"));
}

function asNumber(value: unknown): number | null {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function toMillis(value: any): number | null {
  if (!value) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  return null;
}

function toIso(value: any): string | null {
  const millis = toMillis(value);
  return millis ? new Date(millis).toISOString() : asString(value);
}

function normalizeStatus(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function firstIso(input: any, keys: string[]): string | null {
  for (const key of keys) {
    const value = toIso(input?.[key]);
    if (value) return value;
  }
  return null;
}

function firstString(input: any, keys: string[]): string | null {
  for (const key of keys) {
    const value = asString(input?.[key]);
    if (value) return value;
  }
  return null;
}

function normalizeSignatureMethod(value: unknown): "typed" | "drawn" | null {
  const normalized = normalizeStatus(value);
  if (normalized === "typed") return "typed";
  if (normalized === "drawn") return "drawn";
  return null;
}

export type TenantSafeLeaseReadinessMetadata = Pick<
  TenantLeaseProjection,
  | "signatureStatus"
  | "signatureReadinessLabel"
  | "signatureReadinessDescription"
  | "tenantSignature"
  | "leasePdfStatus"
  | "leasePdfLabel"
  | "leasePdfDescription"
  | "leaseExecution"
>;

export function deriveTenantSafeLeaseReadinessMetadata(
  data: any,
  options?: { documentUrl?: string | null; leaseId?: string | null }
): TenantSafeLeaseReadinessMetadata {
  const documentUrl = asString(options?.documentUrl) ?? asString(data?.documentUrl) ?? asString(data?.approvedDocumentUrl) ?? asString(data?.documentRef);
  const normalizedLeaseStatus = normalizeStatus(data?.status);
  const tenantSignedAt =
    firstIso(data?.tenantSignature, ["signedAt"]) ||
    firstIso(data, ["tenantSignedAt", "tenantSignatureCompletedAt"]);
  const landlordSignedAt =
    firstIso(data?.landlordSignature, ["signedAt"]) ||
    firstIso(data, ["landlordSignedAt", "landlordSignatureCompletedAt"]);
  const fullyExecutedAt = firstIso(data, ["fullyExecutedAt"]);
  const signatureWorkflowStartedAt = firstIso(data, [
    "sentAt",
    "sharedAt",
    "leaseSentAt",
    "leaseSharedAt",
    "signatureRequestedAt",
    "tenantSignatureRequestedAt",
  ]);
  const statusImpliesReadyForTenant = [
    "sent",
    "awaiting_tenant_signature",
    "pending_tenant_signature",
    "ready_for_signature",
    "signature_requested",
  ].includes(normalizedLeaseStatus);
  const tenantSignatureMethod =
    normalizeSignatureMethod(data?.tenantSignature?.signatureMethod) ||
    normalizeSignatureMethod(data?.tenantSignature?.type) ||
    normalizeSignatureMethod(data?.tenantSignatureMethod);
  const tenantSignatureDisplayName =
    firstString(data?.tenantSignature, ["signatureDisplayName", "displayName", "typedName"]) ||
    firstString(data, ["tenantSignatureDisplayName", "tenantSignedByName"]);
  const documentWorkflowStartedAt = firstIso(data, [
    "documentGeneratedAt",
    "documentPreparedAt",
    "leaseDocumentGeneratedAt",
    "leaseDocumentPreparedAt",
    "pdfGeneratedAt",
    "scheduleAGeneratedAt",
  ]);
  const normalizedDocumentStatus = normalizeStatus(
    data?.documentStatus || data?.leaseDocumentStatus || data?.pdfStatus || data?.generationStatus
  );
  const normalizedSigningStatus = normalizeStatus(
    data?.currentSigningStatus || data?.signingStatus || data?.leaseSigningStatus || data?.providerSigningStatus
  );
  const documentWorkflowPending =
    Boolean(documentWorkflowStartedAt) ||
    ["pending", "preparing", "generating", "generated", "ready_for_review", "review_pending"].includes(
      normalizedDocumentStatus
    );

  const tenantSignature =
    tenantSignedAt || tenantSignatureMethod || tenantSignatureDisplayName
      ? {
          signedAt: tenantSignedAt,
          signatureMethod: tenantSignatureMethod,
          signatureDisplayName: tenantSignatureDisplayName,
        }
      : null;

  const leasePdfStatus: TenantLeaseProjection["leasePdfStatus"] = documentUrl
    ? "available"
    : documentWorkflowPending
    ? "pending"
    : "not_available";

  const leasePdfLabel =
    leasePdfStatus === "available"
      ? "Lease document available"
      : leasePdfStatus === "pending"
      ? "Document preparation needed"
      : "Lease document not available";
  const leasePdfDescription =
    leasePdfStatus === "available"
      ? "A tenant-safe lease document is available in this workspace."
      : leasePdfStatus === "pending"
      ? "A lease document workflow is visible, but no approved tenant-safe lease document link is available yet."
      : "No approved lease document link is available in this workspace yet.";

  const signatureStatus: TenantLeaseProjection["signatureStatus"] = (() => {
    if (["signed", "completed", "complete"].includes(normalizedSigningStatus)) {
      return "signed";
    }
    if (["sent", "viewed", "pending", "pending_signature"].includes(normalizedSigningStatus)) {
      return "awaiting_tenant_signature";
    }
    if (tenantSignedAt && landlordSignedAt) {
      return "signed";
    }
    if (tenantSignedAt) return "awaiting_landlord_signature";
    if (landlordSignedAt) return "awaiting_tenant_signature";
    if (
      ["tenant_signed", "signed_by_tenant", "awaiting_landlord_signature", "pending_landlord_signature"].includes(
        normalizedLeaseStatus
      )
    ) {
      return "awaiting_landlord_signature";
    }
    if (documentUrl && statusImpliesReadyForTenant && (signatureWorkflowStartedAt || statusImpliesReadyForTenant)) {
      return "awaiting_tenant_signature";
    }
    if (normalizedLeaseStatus) return "not_started";
    return "unavailable";
  })();

  const signatureReadinessLabel =
    signatureStatus === "signed"
      ? "Lease signing complete"
      : signatureStatus === "awaiting_landlord_signature"
      ? "Awaiting landlord signature"
      : signatureStatus === "awaiting_tenant_signature"
      ? "Awaiting tenant signature"
      : signatureStatus === "not_started"
      ? "Lease signing not started"
      : "Lease signing unavailable";

  const signatureReadinessDescription =
    signatureStatus === "signed"
      ? "The visible lease record shows the current signing stage as complete."
      : signatureStatus === "awaiting_landlord_signature"
      ? "Tenant review appears complete, and the next visible signing step belongs to the landlord."
      : signatureStatus === "awaiting_tenant_signature"
      ? "A tenant-safe lease document is available, and the next visible signing step belongs to the tenant."
      : signatureStatus === "not_started"
      ? "A lease record is visible, but tenant signing has not started and no tenant-safe signing step is available yet."
      : "Lease signing details are not available in this workspace yet.";

  return {
    signatureStatus,
    signatureReadinessLabel,
    signatureReadinessDescription,
    tenantSignature,
    leasePdfStatus,
    leasePdfLabel,
    leasePdfDescription,
    leaseExecution: deriveLeaseExecution({
      leaseId: asString(options?.leaseId) || asString(data?.leaseId) || asString(data?.id),
      documentUrl,
      startDate: asString(data?.startDate) || asString(data?.leaseStart),
      monthlyRent:
        asNumber(data?.monthlyRent) ??
        asNumber(data?.rentAmount) ??
        (typeof data?.rentCents === "number" ? Math.round(data.rentCents) / 100 : null),
      status: asString(data?.status),
      raw: data,
    }),
  };
}

function projectFeatureList(input: any): string[] {
  const list = Array.isArray(input) ? input : Array.isArray(input?.selected) ? input.selected : [];
  return list
    .map((value: unknown) => asString(value))
    .filter((value: string | null): value is string => Boolean(value))
    .slice(0, 8);
}

function uniqueSourceCollections(sourceRefs: TenantSafeProjectionSourceReference[]): string[] {
  return Array.from(new Set(sourceRefs.map((item) => item.sourceCollection))).sort((a, b) => a.localeCompare(b));
}

export function projectTenantProperty(recordId: string, data: any): TenantPropertyProjection {
  const tenantId = asString(data?.tenantId) || asString(data?.primaryTenantId);
  const unitId = asString(data?.unitId) || asString(data?.unitNumber) || asString(data?.unit);
  const sourceRefs = deriveTenantSafeSourceRefs({
    propertyId: recordId,
    unitId,
    tenantId,
  });
  const sourceCollections = uniqueSourceCollections(sourceRefs);
  const metadata = deriveTenantSafeProjectionMetadata({
    projectionName: "tenant_safe_property_projection",
    scopeType: "tenant_property",
    sourceCollections,
    relationshipBasis: "Property projection must be derived from the authenticated tenant workspace context.",
  });

  return {
    ...metadata,
    sourceCollections,
    sourceRefs,
    propertyId: recordId,
    rc_prop_id: asString(data?.rc_prop_id) || asString(data?.propertyId) || recordId,
    street1: asString(data?.street1) || asString(data?.addressLine1) || asString(data?.address),
    street2: asString(data?.street2) || asString(data?.addressLine2),
    city: asString(data?.city) || asString(data?.municipality),
    province: asString(data?.province),
    postalCode: asString(data?.postalCode) || asString(data?.postal_code),
    features: projectFeatureList(data?.features || data?.amenities),
  };
}

export function projectTenantLease(recordId: string, data: any): TenantLeaseProjection {
  const rawDocumentUrl =
    asString(data?.documentUrl) || asString(data?.approvedDocumentUrl) || asString(data?.documentRef);
  const documentUrl = isScheduleADocumentUrl(rawDocumentUrl) ? null : rawDocumentUrl;
  const startDate = asString(data?.startDate) || asString(data?.leaseStart);
  const endDate = asString(data?.endDate) || asString(data?.leaseEnd);
  const monthlyRent =
    asNumber(data?.monthlyRent) ??
    asNumber(data?.rentAmount) ??
    (typeof data?.rentCents === "number" ? Math.round(data.rentCents) / 100 : null);
  const dueDay = asNumber(data?.dueDay);
  const leaseReadiness = deriveTenantSafeLeaseReadinessMetadata(data, { documentUrl, leaseId: recordId });
  const leaseExecution = leaseReadiness.leaseExecution;
  const tenantId = asString(data?.primaryTenantId) || asString(data?.tenantId) || asString(data?.tenantIds?.[0]);
  const propertyId = asString(data?.propertyId);
  const unitId = asString(data?.unitId) || asString(data?.unitNumber) || asString(data?.unit);
  const sourceRefs = deriveTenantSafeSourceRefs({
    leaseId: recordId,
    propertyId,
    unitId,
    tenantId,
  });
  const sourceCollections = uniqueSourceCollections(sourceRefs);
  const projectionProfile = deriveTenantSafeProjectionProfile({
    scopeType: "tenant_current_lease",
    sourceCollections,
  });
  const metadata = deriveTenantSafeProjectionMetadata({
    projectionName: projectionProfile.projectionName,
    scopeType: projectionProfile.scopeType,
    sourceCollections,
    allowedFieldGroups: projectionProfile.allowedFieldGroups,
    excludedFieldGroups: projectionProfile.excludedFieldGroups,
    relationshipBasis: projectionProfile.relationshipBasis,
    internalReferencePolicy: projectionProfile.internalReferencePolicy,
    redactionPolicy: projectionProfile.redactionPolicy,
  });

  return {
    ...metadata,
    leaseId: recordId,
    sourceCollections,
    sourceRefs,
    startDate,
    endDate,
    monthlyRent,
    dueDay,
    status: asString(data?.status),
    documentUrl,
    ...leaseReadiness,
    paymentReadiness: derivePaymentReadiness({
      leaseId: recordId,
      monthlyRent,
      startDate,
      endDate,
      dueDay,
      tenantId,
      propertyId,
      unitId,
      leaseExecution,
    }),
  };
}

export function projectTenantApplication(recordId: string, data: any): TenantApplicationProjection {
  const missingSteps = Array.isArray(data?.missingSteps)
    ? data.missingSteps.map((value: unknown) => asString(value)).filter((value: string | null): value is string => Boolean(value))
    : [];
  const nextActions = Array.isArray(data?.nextActions)
    ? data.nextActions.map((value: unknown) => asString(value)).filter((value: string | null): value is string => Boolean(value))
    : [];
  const tenantId = asString(data?.tenantId) || asString(data?.applicantTenantId) || asString(data?.convertedTenantId);
  const sourceRefs = deriveTenantSafeSourceRefs({
    leaseId: asString(data?.leaseId),
    propertyId: asString(data?.propertyId),
    unitId: asString(data?.unitId) || asString(data?.unitApplied) || asString(data?.unit),
    tenantId,
  });
  const sourceCollections = uniqueSourceCollections(sourceRefs);
  const metadata = deriveTenantSafeProjectionMetadata({
    projectionName: "tenant_safe_application_projection",
    scopeType: "tenant_application",
    sourceCollections,
    relationshipBasis: "Application projection must be derived from the authenticated tenant workspace context.",
  });

  return {
    ...metadata,
    sourceCollections,
    sourceRefs,
    applicationId: recordId,
    status: asString(data?.status),
    missingSteps,
    nextActions,
    createdAt: toIso(data?.createdAt) || toIso(data?.submittedAt),
    updatedAt: toIso(data?.updatedAt) || toIso(data?.updatedAtServer),
  };
}

export function projectTenantMaintenance(recordId: string, data: any): TenantMaintenanceProjection {
  const statusHistory = Array.isArray(data?.statusHistory)
    ? data.statusHistory
        .map((entry: any) => ({
          status: asString(entry?.status),
          actorRole: asString(entry?.actorRole),
          message: asString(entry?.message),
          createdAt: toMillis(entry?.createdAt),
        }))
        .filter(
          (entry: { status: string | null; actorRole: string | null; message: string | null; createdAt: number | null }) =>
            Boolean(entry.status || entry.actorRole || entry.message || entry.createdAt)
        )
    : [];
  const sourceRefs = deriveTenantSafeHashedSourceRefs({
    leaseId: asString(data?.leaseId),
    propertyId: asString(data?.propertyId),
    unitId: asString(data?.unitId) || asString(data?.unitNumber) || asString(data?.unit),
    tenantId: asString(data?.tenantId),
    maintenanceRequestId: recordId,
  });
  const sourceCollections = uniqueSourceCollections(sourceRefs);
  const metadata = deriveTenantSafeProjectionMetadata({
    projectionName: "tenant_safe_maintenance_projection",
    scopeType: "tenant_maintenance",
    sourceCollections,
    relationshipBasis: "Maintenance projection must be derived from the authenticated tenant workspace context.",
  });

  return {
    ...metadata,
    sourceCollections,
    sourceRefs,
    requestId: tenantSafeMaintenanceReferenceKey(recordId),
    status: asString(data?.status),
    category: asString(data?.category),
    priority: asString(data?.priority),
    title: asString(data?.title),
    summary: asString(data?.summary) || asString(data?.description),
    assignedContractorName: asString(data?.assignedContractorName),
    contractorStatus: asString(data?.contractorStatus),
    serviceStartedAt: toMillis(data?.serviceStartedAt),
    serviceCompletedAt: toMillis(data?.serviceCompletedAt),
    lastExecutionUpdateAt: toMillis(data?.lastExecutionUpdateAt),
    completionSummary: asString(data?.completionSummary),
    completionOutcome:
      data?.completionOutcome === "completed" ||
      data?.completionOutcome === "partially_completed" ||
      data?.completionOutcome === "follow_up_required"
        ? data.completionOutcome
        : null,
    completionConfirmedByLandlordAt: toMillis(data?.completionConfirmedByLandlordAt),
    reopenedAt: toMillis(data?.reopenedAt),
    reopenedByActorRole:
      data?.reopenedByActorRole === "tenant" ||
      data?.reopenedByActorRole === "landlord" ||
      data?.reopenedByActorRole === "admin"
        ? data.reopenedByActorRole
        : null,
    reopenReason: asString(data?.reopenReason),
    serviceWindowStartAt: toMillis(data?.serviceWindowStartAt),
    serviceWindowEndAt: toMillis(data?.serviceWindowEndAt),
    accessRequired: typeof data?.accessRequired === "boolean" ? data.accessRequired : null,
    tenantConfirmationStatus:
      data?.tenantConfirmationStatus === "confirmed" || data?.tenantConfirmationStatus === "needs_schedule_change"
        ? data.tenantConfirmationStatus
        : null,
    tenantConfirmationUpdatedAt: toMillis(data?.tenantConfirmationUpdatedAt),
    accessAcknowledgedAt: toMillis(data?.accessAcknowledgedAt),
    resolutionStatus:
      data?.resolutionStatus === "completed_pending_review" ||
      data?.resolutionStatus === "landlord_approved" ||
      data?.resolutionStatus === "tenant_pending_signoff" ||
      data?.resolutionStatus === "resolved" ||
      data?.resolutionStatus === "follow_up_required"
        ? data.resolutionStatus
        : null,
    landlordApprovedAt: toMillis(data?.landlordApprovedAt),
    tenantSignoffStatus:
      data?.tenantSignoffStatus === "pending" ||
      data?.tenantSignoffStatus === "accepted" ||
      data?.tenantSignoffStatus === "declined"
        ? data.tenantSignoffStatus
        : null,
    tenantSignedOffAt: toMillis(data?.tenantSignedOffAt),
    tenantDeclinedAt: toMillis(data?.tenantDeclinedAt),
    tenantDeclineReason: asString(data?.tenantDeclineReason),
    followUpRequired: typeof data?.followUpRequired === "boolean" ? data.followUpRequired : null,
    followUpReason: asString(data?.followUpReason),
    finalResolvedAt: toMillis(data?.finalResolvedAt),
    reworkCycle:
      data?.reworkCycle && typeof data.reworkCycle === "object"
        ? {
            cycleNumber: Number(data.reworkCycle.cycleNumber || 1),
            status:
              data.reworkCycle.status === "not_started" ||
              data.reworkCycle.status === "assigned" ||
              data.reworkCycle.status === "in_progress" ||
              data.reworkCycle.status === "completed" ||
              data.reworkCycle.status === "cancelled"
                ? data.reworkCycle.status
                : "not_started",
            createdAt: toMillis(data.reworkCycle.createdAt),
            assignedAt: toMillis(data.reworkCycle.assignedAt),
            startedAt: toMillis(data.reworkCycle.startedAt),
            completedAt: toMillis(data.reworkCycle.completedAt),
            completionSummary: asString(data.reworkCycle.completionSummary),
            schedule:
              data.reworkCycle.schedule && typeof data.reworkCycle.schedule === "object"
                ? {
                    scheduledFor: toMillis(data.reworkCycle.schedule.scheduledFor),
                    timeWindowStart: toMillis(data.reworkCycle.schedule.timeWindowStart),
                    timeWindowEnd: toMillis(data.reworkCycle.schedule.timeWindowEnd),
                    status:
                      data.reworkCycle.schedule.status === "not_scheduled" ||
                      data.reworkCycle.schedule.status === "scheduled" ||
                      data.reworkCycle.schedule.status === "contractor_confirmed" ||
                      data.reworkCycle.schedule.status === "tenant_pending" ||
                      data.reworkCycle.schedule.status === "confirmed" ||
                      data.reworkCycle.schedule.status === "reschedule_requested" ||
                      data.reworkCycle.schedule.status === "cancelled"
                        ? data.reworkCycle.schedule.status
                        : null,
                    requiresTenantAccess:
                      typeof data.reworkCycle.schedule.requiresTenantAccess === "boolean"
                        ? data.reworkCycle.schedule.requiresTenantAccess
                        : null,
                    tenantAccessStatus:
                      data.reworkCycle.schedule.tenantAccessStatus === "pending" ||
                      data.reworkCycle.schedule.tenantAccessStatus === "confirmed" ||
                      data.reworkCycle.schedule.tenantAccessStatus === "denied" ||
                      data.reworkCycle.schedule.tenantAccessStatus === "not_required"
                        ? data.reworkCycle.schedule.tenantAccessStatus
                        : null,
                    tenantAccessNote: asString(data.reworkCycle.schedule.tenantAccessNote),
                  }
                : null,
          }
        : null,
    reworkHistory: Array.isArray(data?.reworkHistory)
      ? data.reworkHistory.map((entry: any) => ({
          cycleNumber: Number(entry?.cycleNumber || 1),
          startedAt: toMillis(entry?.startedAt),
          completedAt: toMillis(entry?.completedAt),
          outcome:
            entry?.outcome === "resolved" || entry?.outcome === "failed" || entry?.outcome === "partial"
              ? entry.outcome
              : null,
          notes: asString(entry?.notes),
        }))
      : [],
    reworkReview:
      data?.reworkReview && typeof data.reworkReview === "object"
        ? {
            status:
              data.reworkReview.status === "pending_review" ||
              data.reworkReview.status === "landlord_approved" ||
              data.reworkReview.status === "tenant_pending_signoff" ||
              data.reworkReview.status === "closed" ||
              data.reworkReview.status === "follow_up_required"
                ? data.reworkReview.status
                : null,
            reviewedAt: toMillis(data.reworkReview.reviewedAt),
            tenantSignoffStatus:
              data.reworkReview.tenantSignoffStatus === "pending" ||
              data.reworkReview.tenantSignoffStatus === "accepted" ||
              data.reworkReview.tenantSignoffStatus === "declined"
                ? data.reworkReview.tenantSignoffStatus
                : null,
            tenantSignedOffAt: toMillis(data.reworkReview.tenantSignedOffAt),
            tenantDeclinedAt: toMillis(data.reworkReview.tenantDeclinedAt),
            tenantDeclineReason: asString(data.reworkReview.tenantDeclineReason),
            closureOutcome:
              data.reworkReview.closureOutcome === "resolved" ||
              data.reworkReview.closureOutcome === "partial" ||
              data.reworkReview.closureOutcome === "needs_more_followup"
                ? data.reworkReview.closureOutcome
                : null,
            closedAt: toMillis(data.reworkReview.closedAt),
          }
        : null,
    notifications: {
      tenant: {
        requiresAccessConfirmation: data?.notifications?.tenant?.requiresAccessConfirmation === true,
        requiresSignoff: data?.notifications?.tenant?.requiresSignoff === true,
        requiresReworkAwareness: data?.notifications?.tenant?.requiresReworkAwareness === true,
      },
    },
    evidence: Array.isArray(data?.evidence)
      ? data.evidence
          .map((entry: any) => ({
            id: asString(entry?.id),
            url: asString(entry?.url),
            filename: asString(entry?.filename),
            contentType: asString(entry?.contentType),
            uploadedAt: toMillis(entry?.uploadedAt),
            uploadedByActorRole: asString(entry?.uploadedByActorRole),
            evidenceType: asString(entry?.evidenceType),
            caption: asString(entry?.caption),
            visibility: entry?.visibility === "tenant_safe" ? "tenant_safe" : null,
          }))
          .filter((entry: any) => entry.id && entry.visibility === "tenant_safe")
      : [],
    createdAt: toMillis(data?.createdAt),
    updatedAt: toMillis(data?.updatedAt),
    read: false,
    readAt: null,
    statusHistory,
  };
}
