export type MoveInRequirementKey =
  | "lease_signed"
  | "portal_invited"
  | "portal_activated"
  | "deposit_received"
  | "insurance_received"
  | "utility_setup_received"
  | "inspection_scheduled"
  | "inspection_completed"
  | "keys_release_ready";

export type MoveInRequirementState = "complete" | "pending" | "not-required" | "unknown";
export type MoveInRequirementsStatus = "not-started" | "in-progress" | "complete" | "unknown";

export interface MoveInRequirementsItem {
  key: MoveInRequirementKey;
  label: string;
  required: boolean;
  state: MoveInRequirementState;
  source?: string | null;
  updatedAt?: string | null;
  note?: string | null;
}

export interface MoveInRequirements {
  status: MoveInRequirementsStatus;
  items: MoveInRequirementsItem[];
  completedCount: number;
  requiredCount: number;
  progressPercent?: number | null;
  lastUpdatedAt?: string | null;
}

export interface MoveInRequirementsInviteState {
  createdAt?: string | number | null;
  sentAt?: string | number | null;
  redeemedAt?: string | number | null;
  status?: string | null;
}

export interface MoveInRequirementsParams {
  lease?: any;
  leaseRaw?: Record<string, unknown> | null;
  tenant?: any;
  tenancy?: any;
  invite?: MoveInRequirementsInviteState | null;
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

function latestIso(values: Array<unknown>): string | null {
  const millis = values
    .map((value) => ({ value, ts: toMillis(value) }))
    .filter((entry) => entry.ts != null)
    .sort((a, b) => Number(b.ts) - Number(a.ts));
  if (!millis.length) return null;
  return toIso(millis[0].value);
}

function buildItem(input: {
  key: MoveInRequirementKey;
  label: string;
  required: boolean;
  complete: boolean | null;
  source?: string | null;
  updatedAt?: string | null;
  note?: string | null;
  unknownWhenOptional?: boolean;
}): MoveInRequirementsItem {
  let state: MoveInRequirementState = "unknown";
  if (input.required) {
    state = input.complete === true ? "complete" : "pending";
  } else if (input.complete === true) {
    state = "complete";
  } else if (input.complete === false) {
    state = "not-required";
  } else {
    state = input.unknownWhenOptional ? "unknown" : "not-required";
  }

  return {
    key: input.key,
    label: input.label,
    required: input.required,
    state,
    source: input.source ?? null,
    updatedAt: input.updatedAt ?? null,
    note: input.note ?? null,
  };
}

export function buildMoveInRequirements(params: MoveInRequirementsParams): MoveInRequirements {
  const leaseRaw = params.leaseRaw || null;
  const lease = params.lease || null;
  const tenant = params.tenant || null;
  const tenancy = params.tenancy || null;
  const invite = params.invite || null;
  const payments: Array<{ notes?: unknown; method?: unknown }> = Array.isArray(params.payments) ? params.payments : [];
  const ledger: Array<{ notes?: unknown; type?: unknown }> = Array.isArray(params.ledger) ? params.ledger : [];

  const hasLeaseContext = Boolean(lease || leaseRaw || tenancy);

  const leaseSignedAt = firstIso(leaseRaw, ["tenantSignedAt", "fullySignedAt", "signedAt", "signatureCompletedAt"]);
  const leaseSigned = Boolean(
    leaseSignedAt ||
      firstBoolean(leaseRaw, ["leaseSigned", "isSigned", "signed"]) ||
      ["signed", "active"].includes(String((leaseRaw as any)?.status || (lease as any)?.status || "").trim().toLowerCase())
  );

  const portalInviteUpdatedAt = latestIso([invite?.sentAt, invite?.createdAt]);
  const portalInviteSent = Boolean(
    portalInviteUpdatedAt || firstBoolean(invite as any, ["inviteSent"]) || String(invite?.status || "").trim().length
  )
    ? true
    : null;

  const portalActivatedAt = toIso(invite?.redeemedAt);
  const portalActivated = Boolean(
    portalActivatedAt ||
      String(invite?.status || "").trim().toLowerCase() === "redeemed" ||
      String(tenant?.source || "").trim().toLowerCase() === "invite"
  )
    ? true
    : portalInviteSent === true
    ? false
    : null;

  const depositAmount = Number((leaseRaw as any)?.depositCents ?? (leaseRaw as any)?.securityDepositCents ?? 0);
  const explicitDepositRequired = firstBoolean(leaseRaw, ["depositRequired", "securityDepositRequired"]);
  const depositRequired = Number.isFinite(depositAmount) && depositAmount > 0 ? true : explicitDepositRequired;
  const depositReceivedAt = firstIso(leaseRaw, ["depositReceivedAt", "securityDepositReceivedAt"]);
  const depositEvidence = hasDepositReceiptEvidence(payments, ledger);
  const depositReceived = depositRequired === true
    ? Boolean(
        depositReceivedAt ||
          firstBoolean(leaseRaw, ["depositReceived", "securityDepositReceived"]) ||
          depositEvidence
      )
    : depositRequired === false
    ? false
    : depositEvidence
    ? true
    : null;

  const insuranceRequired = firstBoolean(leaseRaw, ["insuranceRequired", "tenantInsuranceRequired"]);
  const insuranceReceivedAt = firstIso(leaseRaw, ["insuranceReceivedAt", "tenantInsuranceReceivedAt"]);
  const insuranceReceived = insuranceRequired === true
    ? Boolean(
        insuranceReceivedAt ||
          firstBoolean(leaseRaw, ["insuranceReceived", "tenantInsuranceReceived"]) ||
          (leaseRaw as any)?.insurancePolicyNumber
      )
    : insuranceRequired === false
    ? false
    : null;

  const utilitySetupRequired = firstBoolean(leaseRaw, ["utilitySetupRequired", "utilitiesRequired"]);
  const utilitySetupReceivedAt = firstIso(leaseRaw, ["utilitySetupReceivedAt", "utilitiesConfirmedAt"]);
  const utilitySetupReceived = utilitySetupRequired === true
    ? Boolean(
        utilitySetupReceivedAt ||
          firstBoolean(leaseRaw, ["utilitySetupReceived", "utilitiesConfirmed"]) ||
          (leaseRaw as any)?.utilityAccountNumber
      )
    : utilitySetupRequired === false
    ? false
    : null;

  const inspectionScheduledAt = firstIso(leaseRaw, ["inspectionScheduledAt", "moveInInspectionScheduledAt"]);
  const inspectionScheduled = Boolean(
    inspectionScheduledAt || firstBoolean(leaseRaw, ["inspectionScheduled", "moveInInspectionScheduled"])
  )
    ? true
    : null;
  const inspectionCompletedAt = firstIso(leaseRaw, ["inspectionCompletedAt", "moveInInspectionCompletedAt"]);
  const inspectionCompleted = Boolean(
    inspectionCompletedAt || firstBoolean(leaseRaw, ["inspectionCompleted", "moveInInspectionCompleted"])
  )
    ? true
    : inspectionScheduled === true
    ? false
    : null;

  const keysReleasedAt = firstIso(leaseRaw, ["keysReleasedAt", "moveInCompletedAt"]);
  const keysReleased = Boolean(
    keysReleasedAt || firstBoolean(leaseRaw, ["keysReleased", "moveInCompleted"]) || tenancy?.moveInAt
  );

  const preReleaseItems = [
    buildItem({
      key: "lease_signed",
      label: "Lease signed",
      required: hasLeaseContext,
      complete: hasLeaseContext ? leaseSigned : null,
      source: leaseSignedAt ? "lease" : hasLeaseContext ? "lease_status" : null,
      updatedAt: leaseSignedAt,
      note: leaseSigned ? null : "Lease signature pending",
      unknownWhenOptional: true,
    }),
    buildItem({
      key: "portal_invited",
      label: "Tenant portal invite sent",
      required: hasLeaseContext,
      complete: portalInviteSent,
      source: portalInviteUpdatedAt ? "tenant_invite" : null,
      updatedAt: portalInviteUpdatedAt,
      note: portalInviteSent === true ? null : "Send tenant portal invite",
      unknownWhenOptional: true,
    }),
    buildItem({
      key: "portal_activated",
      label: "Tenant portal activated",
      required: hasLeaseContext,
      complete: portalActivated,
      source: portalActivatedAt ? "tenant_invite" : String(tenant?.source || "").trim() ? "tenant_profile" : null,
      updatedAt: portalActivatedAt,
      note: portalActivated === true ? null : "Tenant portal activation pending",
      unknownWhenOptional: true,
    }),
    buildItem({
      key: "deposit_received",
      label: "Deposit received",
      required: depositRequired === true,
      complete: depositReceived,
      source: depositReceivedAt ? "lease" : depositEvidence ? "payments" : explicitDepositRequired != null || depositAmount > 0 ? "lease_terms" : null,
      updatedAt: depositReceivedAt,
      note: depositRequired === true && depositReceived !== true ? "Collect deposit" : depositRequired == null ? "Deposit requirement has not been configured yet." : null,
      unknownWhenOptional: true,
    }),
    buildItem({
      key: "insurance_received",
      label: "Insurance received",
      required: insuranceRequired === true,
      complete: insuranceReceived,
      source: insuranceReceivedAt ? "lease" : insuranceRequired != null ? "lease_terms" : null,
      updatedAt: insuranceReceivedAt,
      note: insuranceRequired === true && insuranceReceived !== true ? "Collect tenant insurance proof" : insuranceRequired == null ? "Insurance requirement is not configured yet." : null,
      unknownWhenOptional: true,
    }),
    buildItem({
      key: "utility_setup_received",
      label: "Utility setup received",
      required: utilitySetupRequired === true,
      complete: utilitySetupReceived,
      source: utilitySetupReceivedAt ? "lease" : utilitySetupRequired != null ? "lease_terms" : null,
      updatedAt: utilitySetupReceivedAt,
      note: utilitySetupRequired === true && utilitySetupReceived !== true ? "Confirm utility setup" : utilitySetupRequired == null ? "Utility setup requirement is not configured yet." : null,
      unknownWhenOptional: true,
    }),
    buildItem({
      key: "inspection_scheduled",
      label: "Inspection scheduled",
      required: hasLeaseContext,
      complete: inspectionScheduled,
      source: inspectionScheduledAt ? "lease" : null,
      updatedAt: inspectionScheduledAt,
      note: inspectionScheduled === true ? null : "Schedule move-in inspection",
      unknownWhenOptional: true,
    }),
    buildItem({
      key: "inspection_completed",
      label: "Inspection completed",
      required: hasLeaseContext,
      complete: inspectionCompleted,
      source: inspectionCompletedAt ? "lease" : inspectionScheduledAt ? "lease" : null,
      updatedAt: inspectionCompletedAt || inspectionScheduledAt,
      note: inspectionCompleted === true ? null : "Complete move-in inspection",
      unknownWhenOptional: true,
    }),
  ]

  const allPreReleaseComplete = preReleaseItems
    .filter((item) => item.required)
    .every((item) => item.state === "complete");

  const keysReleaseReadyItem = buildItem({
    key: "keys_release_ready",
    label: "Keys release ready",
    required: hasLeaseContext,
    complete: hasLeaseContext ? (keysReleased || allPreReleaseComplete) : null,
    source: keysReleasedAt ? "lease" : tenancy?.moveInAt ? "tenancy" : hasLeaseContext ? "derived" : null,
    updatedAt: latestIso([keysReleasedAt, tenancy?.moveInAt]),
    note: keysReleased || allPreReleaseComplete ? "All known pre-move-in requirements are satisfied." : "Finish the required pre-move-in items before key release.",
    unknownWhenOptional: true,
  });

  const items = [...preReleaseItems, keysReleaseReadyItem];
  const requiredItems = items.filter((item) => item.required);
  const completedCount = requiredItems.filter((item) => item.state === "complete").length;
  const requiredCount = requiredItems.length;
  const progressPercent = requiredCount > 0 ? Math.round((completedCount / requiredCount) * 100) : null;

  const meaningfulData =
    requiredCount > 0 ||
    items.some((item) => item.state === "complete" || item.state === "pending" || item.state === "not-required");

  let status: MoveInRequirementsStatus = "unknown";
  if (!meaningfulData) {
    status = "unknown";
  } else if (requiredCount > 0 && completedCount === requiredCount) {
    status = "complete";
  } else if (requiredCount > 0 && completedCount === 0) {
    status = "not-started";
  } else if (requiredCount > 0) {
    status = "in-progress";
  }

  const lastUpdatedAt = latestIso(
    items.map((item) => item.updatedAt).filter(Boolean)
  );

  return {
    status,
    items,
    completedCount,
    requiredCount,
    progressPercent,
    lastUpdatedAt,
  };
}
