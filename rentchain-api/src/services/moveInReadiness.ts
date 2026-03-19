export type MoveInReadinessStatus = "not-started" | "in-progress" | "ready" | "completed" | "unknown";

export interface MoveInReadiness {
  status: MoveInReadinessStatus;
  readinessPercent?: number | null;
  leaseSigned?: boolean | null;
  portalInviteSent?: boolean | null;
  portalActivated?: boolean | null;
  depositRequired?: boolean | null;
  depositReceived?: boolean | null;
  insuranceRequired?: boolean | null;
  insuranceReceived?: boolean | null;
  utilitySetupRequired?: boolean | null;
  utilitySetupReceived?: boolean | null;
  inspectionScheduled?: boolean | null;
  inspectionCompleted?: boolean | null;
  keysReleaseReady?: boolean | null;
  outstandingItems?: string[];
  completedItems?: string[];
  lastUpdatedAt?: string | null;
}

export interface MoveInReadinessInviteState {
  createdAt?: string | number | null;
  sentAt?: string | number | null;
  redeemedAt?: string | number | null;
  status?: string | null;
}

export interface MoveInReadinessParams {
  lease?: any;
  leaseRaw?: Record<string, unknown> | null;
  tenant?: any;
  tenancy?: any;
  invite?: MoveInReadinessInviteState | null;
  payments?: Array<{ notes?: unknown; method?: unknown }>;
  ledger?: Array<{ notes?: unknown; type?: unknown }>;
}

function toMillis(value: unknown): number | null {
  if (!value) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof (value as any)?.toMillis === "function") return (value as any).toMillis();
  if (typeof (value as any)?.seconds === "number") return (value as any).seconds * 1000;
  return null;
}

function toIso(value: unknown): string | null {
  const ts = toMillis(value);
  if (ts == null) return null;
  return new Date(ts).toISOString();
}

function hasTruthyBoolean(value: unknown): boolean | null {
  if (value === true) return true;
  if (value === false) return false;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "yes", "completed", "received", "done", "active", "redeemed"].includes(normalized)) return true;
    if (["false", "no", "pending", "not_started", "not-started"].includes(normalized)) return false;
  }
  return null;
}

function firstIso(source: Record<string, unknown> | null | undefined, keys: string[]): string | null {
  if (!source) return null;
  for (const key of keys) {
    const value = (source as any)?.[key];
    const iso = toIso(value);
    if (iso) return iso;
  }
  return null;
}

function firstBoolean(source: Record<string, unknown> | null | undefined, keys: string[]): boolean | null {
  if (!source) return null;
  for (const key of keys) {
    const result = hasTruthyBoolean((source as any)?.[key]);
    if (result != null) return result;
  }
  return null;
}

function includesKeyword(value: unknown, keywords: string[]) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return false;
  return keywords.some((keyword) => text.includes(keyword));
}

function hasDepositReceiptEvidence(payments: Array<{ notes?: unknown; method?: unknown }>, ledger: Array<{ notes?: unknown; type?: unknown }>) {
  const keywords = ["deposit", "security deposit"];
  return payments.some((payment) =>
    includesKeyword(payment.notes, keywords) || includesKeyword(payment.method, keywords)
  ) || ledger.some((entry) => includesKeyword(entry.notes, keywords) || includesKeyword(entry.type, keywords));
}

function unique(items: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const item of items) {
    const value = String(item || "").trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(value);
  }
  return output;
}

export function buildMoveInReadiness(params: MoveInReadinessParams): MoveInReadiness {
  const leaseRaw = params.leaseRaw || null;
  const lease = params.lease || null;
  const tenant = params.tenant || null;
  const tenancy = params.tenancy || null;
  const invite = params.invite || null;
  const payments: Array<{ notes?: unknown; method?: unknown }> = Array.isArray(params.payments) ? params.payments : [];
  const ledger: Array<{ notes?: unknown; type?: unknown }> = Array.isArray(params.ledger) ? params.ledger : [];

  const leaseSigned = Boolean(
    firstIso(leaseRaw, ["tenantSignedAt", "fullySignedAt", "signedAt", "signatureCompletedAt"]) ||
      firstBoolean(leaseRaw, ["leaseSigned", "isSigned", "signed"]) ||
      ["signed", "active"].includes(String((leaseRaw as any)?.status || (lease as any)?.status || "").trim().toLowerCase())
  );

  const portalInviteSent = Boolean(
    firstIso(invite as any, ["sentAt", "createdAt"]) || firstBoolean(invite as any, ["inviteSent"]) || String(invite?.status || "").trim().length
  )
    ? true
    : null;

  const portalActivated = Boolean(
    firstIso(invite as any, ["redeemedAt"]) ||
      String(invite?.status || "").trim().toLowerCase() === "redeemed" ||
      String(tenant?.source || "").trim().toLowerCase() === "invite"
  )
    ? true
    : portalInviteSent === true
    ? false
    : null;

  const depositAmount = Number((leaseRaw as any)?.depositCents ?? (leaseRaw as any)?.securityDepositCents ?? 0);
  const depositRequired = Number.isFinite(depositAmount) && depositAmount > 0
    ? true
    : firstBoolean(leaseRaw, ["depositRequired", "securityDepositRequired"]);
  const depositReceived = depositRequired === true
    ? Boolean(
        firstIso(leaseRaw, ["depositReceivedAt", "securityDepositReceivedAt"]) ||
          firstBoolean(leaseRaw, ["depositReceived", "securityDepositReceived"]) ||
          hasDepositReceiptEvidence(payments, ledger)
      )
    : depositRequired === false
    ? false
    : hasDepositReceiptEvidence(payments, ledger)
    ? true
    : null;

  const insuranceRequired = firstBoolean(leaseRaw, ["insuranceRequired", "tenantInsuranceRequired"]);
  const insuranceReceived = insuranceRequired === true
    ? Boolean(
        firstIso(leaseRaw, ["insuranceReceivedAt", "tenantInsuranceReceivedAt"]) ||
          firstBoolean(leaseRaw, ["insuranceReceived", "tenantInsuranceReceived"]) ||
          (leaseRaw as any)?.insurancePolicyNumber
      )
    : insuranceRequired === false
    ? false
    : null;

  const utilitySetupRequired = firstBoolean(leaseRaw, ["utilitySetupRequired", "utilitiesRequired"]);
  const utilitySetupReceived = utilitySetupRequired === true
    ? Boolean(
        firstIso(leaseRaw, ["utilitySetupReceivedAt", "utilitiesConfirmedAt"]) ||
          firstBoolean(leaseRaw, ["utilitySetupReceived", "utilitiesConfirmed"]) ||
          (leaseRaw as any)?.utilityAccountNumber
      )
    : utilitySetupRequired === false
    ? false
    : null;

  const inspectionScheduled = Boolean(
    firstIso(leaseRaw, ["inspectionScheduledAt", "moveInInspectionScheduledAt"]) ||
      firstBoolean(leaseRaw, ["inspectionScheduled", "moveInInspectionScheduled"])
  )
    ? true
    : null;
  const inspectionCompleted = Boolean(
    firstIso(leaseRaw, ["inspectionCompletedAt", "moveInInspectionCompletedAt"]) ||
      firstBoolean(leaseRaw, ["inspectionCompleted", "moveInInspectionCompleted"])
  )
    ? true
    : inspectionScheduled === true
    ? false
    : null;

  const keysReleased = Boolean(
    firstIso(leaseRaw, ["keysReleasedAt", "moveInCompletedAt"]) ||
      firstBoolean(leaseRaw, ["keysReleased", "moveInCompleted"])
  );

  const hasLeaseContext = Boolean(lease || leaseRaw || tenancy);

  const knownRequiredSteps = [
    { label: "Lease signed", required: hasLeaseContext, complete: leaseSigned },
    { label: "Tenant portal invite sent", required: portalInviteSent != null, complete: portalInviteSent },
    { label: "Tenant portal activated", required: portalActivated != null, complete: portalActivated },
    { label: "Deposit received", required: depositRequired === true, complete: depositReceived },
    { label: "Insurance received", required: insuranceRequired === true, complete: insuranceReceived },
    { label: "Utility setup confirmed", required: utilitySetupRequired === true, complete: utilitySetupReceived },
    { label: "Inspection completed", required: inspectionCompleted != null || inspectionScheduled != null, complete: inspectionCompleted },
  ].filter((step) => step.required);

  const completedItems = unique([
    leaseSigned ? "Lease signed" : null,
    portalInviteSent ? "Tenant portal invite sent" : null,
    portalActivated ? "Tenant portal activated" : null,
    depositRequired === true && depositReceived ? "Deposit received" : null,
    insuranceRequired === true && insuranceReceived ? "Insurance received" : null,
    utilitySetupRequired === true && utilitySetupReceived ? "Utility setup confirmed" : null,
    inspectionScheduled ? "Inspection scheduled" : null,
    inspectionCompleted ? "Inspection completed" : null,
    keysReleased ? "Keys released" : null,
    tenancy?.moveInAt ? "Move-in recorded" : null,
  ]);

  const outstandingItems = unique([
    !leaseSigned ? "Lease signature pending" : null,
    portalInviteSent !== true ? "Send tenant portal invite" : null,
    portalActivated === false ? "Tenant portal activation pending" : null,
    depositRequired === true && depositReceived !== true ? "Collect deposit" : null,
    insuranceRequired === true && insuranceReceived !== true ? "Collect tenant insurance proof" : null,
    utilitySetupRequired === true && utilitySetupReceived !== true ? "Confirm utility setup" : null,
    inspectionScheduled !== true ? "Schedule move-in inspection" : null,
    inspectionScheduled === true && inspectionCompleted !== true ? "Complete move-in inspection" : null,
  ]);

  const completedRequiredCount = knownRequiredSteps.filter((step) => step.complete === true).length;
  const knownRequiredCount = knownRequiredSteps.length;
  const readinessPercent = knownRequiredCount > 0 ? Math.round((completedRequiredCount / knownRequiredCount) * 100) : null;

  const keysReleaseReady = knownRequiredCount > 0 && outstandingItems.length === 0 && !keysReleased;

  let status: MoveInReadinessStatus = "unknown";
  if (keysReleased || tenancy?.moveInAt) {
    status = "completed";
  } else if (keysReleaseReady) {
    status = "ready";
  } else if (!hasLeaseContext && knownRequiredCount === 0 && completedItems.length === 0) {
    status = "unknown";
  } else if (knownRequiredCount === 0) {
    status = "unknown";
  } else if (completedRequiredCount === 0) {
    status = "not-started";
  } else {
    status = "in-progress";
  }

  const lastUpdatedAt = unique([
    firstIso(leaseRaw, ["updatedAt", "createdAt", "tenantSignedAt", "fullySignedAt", "depositReceivedAt", "insuranceReceivedAt", "utilitySetupReceivedAt", "inspectionCompletedAt", "keysReleasedAt"]),
    toIso(invite?.redeemedAt),
    toIso(invite?.sentAt),
    toIso(tenancy?.updatedAt),
    toIso(tenancy?.moveInAt),
    toIso(tenant?.updatedAt),
  ])[0] || null;

  return {
    status,
    readinessPercent,
    leaseSigned,
    portalInviteSent,
    portalActivated,
    depositRequired,
    depositReceived,
    insuranceRequired,
    insuranceReceived,
    utilitySetupRequired,
    utilitySetupReceived,
    inspectionScheduled,
    inspectionCompleted,
    keysReleaseReady,
    outstandingItems,
    completedItems,
    lastUpdatedAt,
  };
}
