type TenantPropertyProjection = {
  propertyId: string;
  rc_prop_id: string | null;
  street1: string | null;
  street2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  features: string[];
};

type TenantLeaseProjection = {
  leaseId: string;
  startDate: string | null;
  endDate: string | null;
  monthlyRent: number | null;
  status: string | null;
  documentUrl: string | null;
};

type TenantApplicationProjection = {
  applicationId: string;
  status: string | null;
  missingSteps: string[];
  nextActions: string[];
  createdAt: string | null;
  updatedAt: string | null;
};

type TenantMaintenanceProjection = {
  requestId: string;
  status: string | null;
  category: string | null;
  priority: string | null;
  title: string | null;
  summary: string | null;
  assignedContractorName: string | null;
  contractorStatus: string | null;
  serviceWindowStartAt: number | null;
  serviceWindowEndAt: number | null;
  accessRequired: boolean | null;
  tenantConfirmationStatus: "confirmed" | "needs_schedule_change" | null;
  tenantConfirmationUpdatedAt: number | null;
  accessAcknowledgedAt: number | null;
  createdAt: number | null;
  updatedAt: number | null;
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

function projectFeatureList(input: any): string[] {
  const list = Array.isArray(input) ? input : Array.isArray(input?.selected) ? input.selected : [];
  return list
    .map((value: unknown) => asString(value))
    .filter((value: string | null): value is string => Boolean(value))
    .slice(0, 8);
}

export function projectTenantProperty(recordId: string, data: any): TenantPropertyProjection {
  return {
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
  return {
    leaseId: recordId,
    startDate: asString(data?.startDate) || asString(data?.leaseStart),
    endDate: asString(data?.endDate) || asString(data?.leaseEnd),
    monthlyRent:
      asNumber(data?.monthlyRent) ??
      asNumber(data?.rentAmount) ??
      (typeof data?.rentCents === "number" ? Math.round(data.rentCents) / 100 : null),
    status: asString(data?.status),
    documentUrl: asString(data?.documentUrl) || asString(data?.approvedDocumentUrl) || asString(data?.documentRef),
  };
}

export function projectTenantApplication(recordId: string, data: any): TenantApplicationProjection {
  const missingSteps = Array.isArray(data?.missingSteps)
    ? data.missingSteps.map((value: unknown) => asString(value)).filter((value: string | null): value is string => Boolean(value))
    : [];
  const nextActions = Array.isArray(data?.nextActions)
    ? data.nextActions.map((value: unknown) => asString(value)).filter((value: string | null): value is string => Boolean(value))
    : [];

  return {
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

  return {
    requestId: recordId,
    status: asString(data?.status),
    category: asString(data?.category),
    priority: asString(data?.priority),
    title: asString(data?.title),
    summary: asString(data?.summary) || asString(data?.description),
    assignedContractorName: asString(data?.assignedContractorName),
    contractorStatus: asString(data?.contractorStatus),
    serviceWindowStartAt: toMillis(data?.serviceWindowStartAt),
    serviceWindowEndAt: toMillis(data?.serviceWindowEndAt),
    accessRequired: typeof data?.accessRequired === "boolean" ? data.accessRequired : null,
    tenantConfirmationStatus:
      data?.tenantConfirmationStatus === "confirmed" || data?.tenantConfirmationStatus === "needs_schedule_change"
        ? data.tenantConfirmationStatus
        : null,
    tenantConfirmationUpdatedAt: toMillis(data?.tenantConfirmationUpdatedAt),
    accessAcknowledgedAt: toMillis(data?.accessAcknowledgedAt),
    createdAt: toMillis(data?.createdAt),
    updatedAt: toMillis(data?.updatedAt),
    statusHistory,
  };
}
