type LeaseExecutionStatus =
  | "draft"
  | "ready_for_tenant_signature"
  | "tenant_signed"
  | "ready_for_landlord_signature"
  | "landlord_signed"
  | "fully_executed"
  | "blocked";

type LeaseExecutionNextAction =
  | "complete_lease_details"
  | "tenant_signature"
  | "landlord_signature"
  | "review_signed_lease"
  | "none";

type LeaseExecutionSignatureStatus =
  | "not_required"
  | "needed"
  | "completed"
  | "blocked";

type LeaseExecutionPdfStatus =
  | "not_ready"
  | "ready"
  | "generated"
  | "blocked";

export type LeaseExecution = {
  executionStatus: LeaseExecutionStatus;
  executionLabel: string;
  executionDescription: string;
  requiredNextAction: LeaseExecutionNextAction;
  tenantSignatureStatus: LeaseExecutionSignatureStatus;
  landlordSignatureStatus: LeaseExecutionSignatureStatus;
  pdfStatus: LeaseExecutionPdfStatus;
  completedAt: string | null;
};

function asString(value: unknown): string | null {
  const next = String(value || "").trim();
  return next || null;
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
  return millis == null ? asString(value) : new Date(millis).toISOString();
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

type DeriveLeaseExecutionInput = {
  leaseId?: string | null;
  documentUrl?: string | null;
  startDate?: string | null;
  monthlyRent?: number | null;
  status?: string | null;
  raw?: any;
};

export function deriveLeaseExecution(input: DeriveLeaseExecutionInput): LeaseExecution {
  const raw = input.raw || {};
  const leaseId = asString(input.leaseId) || asString(raw?.leaseId) || asString(raw?.id);
  const documentUrl =
    asString(input.documentUrl) ||
    asString(raw?.documentUrl) ||
    asString(raw?.approvedDocumentUrl) ||
    asString(raw?.documentRef);
  const startDate =
    asString(input.startDate) || asString(raw?.startDate) || asString(raw?.leaseStart) || asString(raw?.leaseStartDate);
  const monthlyRent =
    asNumber(input.monthlyRent) ??
    asNumber(raw?.monthlyRent) ??
    asNumber(raw?.rentAmount) ??
    (typeof raw?.rentCents === "number" ? Math.round(raw.rentCents) / 100 : null);
  const normalizedStatus = normalizeStatus(input.status || raw?.status);

  const tenantSignedAt =
    firstIso(raw?.tenantSignature, ["signedAt"]) ||
    firstIso(raw, ["tenantSignedAt", "tenantSignatureCompletedAt"]);
  const landlordSignedAt =
    firstIso(raw?.landlordSignature, ["signedAt"]) ||
    firstIso(raw, ["landlordSignedAt", "landlordSignatureCompletedAt"]);
  const fullyExecutedAt = firstIso(raw, ["fullyExecutedAt"]);
  const signatureWorkflowStartedAt = firstIso(raw, [
    "sentAt",
    "sharedAt",
    "leaseSentAt",
    "leaseSharedAt",
    "signatureRequestedAt",
    "tenantSignatureRequestedAt",
  ]);

  const hasCoreLeaseDetails = Boolean(leaseId && startDate && typeof monthlyRent === "number" && monthlyRent > 0);
  const tenantSignatureCaptured = Boolean(tenantSignedAt);
  const landlordSignatureCaptured = Boolean(landlordSignedAt);
  const statusImpliesReadyForTenant = [
    "sent",
    "awaiting_tenant_signature",
    "pending_tenant_signature",
    "ready_for_signature",
    "signature_requested",
  ].includes(normalizedStatus);
  const statusImpliesReadyForLandlord = [
    "awaiting_landlord_signature",
    "pending_landlord_signature",
    "signed_by_tenant",
  ].includes(normalizedStatus);
  const hasExplicitSignatureWorkflow = Boolean(
    signatureWorkflowStartedAt ||
      statusImpliesReadyForTenant ||
      statusImpliesReadyForLandlord ||
      tenantSignatureCaptured ||
      landlordSignatureCaptured ||
      fullyExecutedAt
  );

  const executed = Boolean(tenantSignatureCaptured && landlordSignatureCaptured);
  const landlordSigned = Boolean(!executed && landlordSignatureCaptured);
  const readyForLandlord = Boolean(!executed && !landlordSigned && statusImpliesReadyForLandlord);
  const tenantSigned = Boolean(
    !executed && !landlordSigned && !readyForLandlord && tenantSignatureCaptured
  );
  const readyForTenant = Boolean(
    !executed &&
      !landlordSigned &&
      !readyForLandlord &&
      !tenantSigned &&
      documentUrl &&
      statusImpliesReadyForTenant &&
      hasExplicitSignatureWorkflow
  );

  const pdfStatus: LeaseExecutionPdfStatus = (() => {
    if (documentUrl) return "generated";
    if (!leaseId) return "blocked";
    if (tenantSigned || readyForLandlord || landlordSigned || executed) return "blocked";
    if (hasCoreLeaseDetails) return "ready";
    return "not_ready";
  })();

  const executionStatus: LeaseExecutionStatus = (() => {
    if (!leaseId) return "blocked";
    if (executed) return "fully_executed";
    if (landlordSigned) return "landlord_signed";
    if (readyForLandlord) return "ready_for_landlord_signature";
    if (tenantSigned) return "tenant_signed";
    if (readyForTenant) return "ready_for_tenant_signature";
    if (hasCoreLeaseDetails) return "draft";
    return "blocked";
  })();

  const tenantSignatureStatus: LeaseExecutionSignatureStatus = (() => {
    if (!leaseId) return "blocked";
    if (tenantSigned || readyForLandlord || executed) return "completed";
    if (landlordSigned) return "needed";
    if (readyForTenant) return "needed";
    if (hasCoreLeaseDetails) return "blocked";
    return "not_required";
  })();

  const landlordSignatureStatus: LeaseExecutionSignatureStatus = (() => {
    if (!leaseId) return "blocked";
    if (landlordSigned || executed) return "completed";
    if (readyForLandlord || tenantSigned) return "needed";
    if (readyForTenant || hasCoreLeaseDetails) return "blocked";
    return "not_required";
  })();

  const completedAt =
    executionStatus === "fully_executed"
      ? fullyExecutedAt || landlordSignedAt || tenantSignedAt || null
      : executionStatus === "landlord_signed"
      ? landlordSignedAt || null
      : null;

  switch (executionStatus) {
    case "fully_executed":
      return {
        executionStatus,
        executionLabel: "Lease fully executed",
        executionDescription: "The visible lease record indicates the current execution flow is complete.",
        requiredNextAction: "none",
        tenantSignatureStatus,
        landlordSignatureStatus,
        pdfStatus,
        completedAt,
      };
    case "landlord_signed":
      return {
        executionStatus,
        executionLabel: "Landlord signature completed",
        executionDescription: tenantSignatureCaptured
          ? "Landlord signature is recorded. Review the signed lease details to confirm the current file is settled."
          : "Landlord signature is recorded. Tenant signature is still required before the lease is fully executed.",
        requiredNextAction: tenantSignatureCaptured ? "review_signed_lease" : "tenant_signature",
        tenantSignatureStatus,
        landlordSignatureStatus,
        pdfStatus,
        completedAt,
      };
    case "ready_for_landlord_signature":
      return {
        executionStatus,
        executionLabel: "Waiting for landlord signature",
        executionDescription: "Tenant signing appears complete and the next visible execution step belongs to the landlord.",
        requiredNextAction: "landlord_signature",
        tenantSignatureStatus,
        landlordSignatureStatus,
        pdfStatus,
        completedAt,
      };
    case "tenant_signed":
      return {
        executionStatus,
        executionLabel: "Tenant signature completed",
        executionDescription: "Tenant signature is recorded. The next supported execution step depends on landlord follow-through.",
        requiredNextAction: "landlord_signature",
        tenantSignatureStatus,
        landlordSignatureStatus,
        pdfStatus,
        completedAt,
      };
    case "ready_for_tenant_signature":
      return {
        executionStatus,
        executionLabel: "Waiting for tenant signature",
        executionDescription: "The lease document is ready and the next execution step belongs to the tenant.",
        requiredNextAction: "tenant_signature",
        tenantSignatureStatus,
        landlordSignatureStatus,
        pdfStatus,
        completedAt,
      };
    case "draft":
      return {
        executionStatus,
        executionLabel: "Lease details ready",
        executionDescription: "A lease record is visible, but the execution flow has not reached a tenant-signature step yet.",
        requiredNextAction: "complete_lease_details",
        tenantSignatureStatus,
        landlordSignatureStatus,
        pdfStatus,
        completedAt,
      };
    default:
      return {
        executionStatus: "blocked",
        executionLabel: "Some lease details are still needed",
        executionDescription: "The current lease record does not expose enough execution detail to move forward safely.",
        requiredNextAction: "complete_lease_details",
        tenantSignatureStatus,
        landlordSignatureStatus,
        pdfStatus,
        completedAt: null,
      };
  }
}
