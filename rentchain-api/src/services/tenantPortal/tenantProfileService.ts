import { db } from "../../config/firebase";
import type { TenancyContext } from "./tenancyContextService";
import {
  projectTenantApplication,
  projectTenantLease,
  projectTenantProperty,
} from "./tenantProjectionService";

export type TenantVisibleStatus = "verified" | "pending" | "missing" | "needs_review";

export type TenantProfileProjection = {
  context: Pick<
    TenancyContext,
    "authority" | "propertyId" | "rc_prop_id" | "applicationId" | "leaseId" | "tenantId" | "unitId" | "invitedEmail"
  >;
  profile: {
    displayName: string | null;
    email: string | null;
    phone: string | null;
    authorityLabel: string;
    property: ReturnType<typeof projectTenantProperty> | null;
    unit: {
      unitId: string | null;
      label: string | null;
    } | null;
    application: ReturnType<typeof projectTenantApplication> | null;
    lease: ReturnType<typeof projectTenantLease> | null;
  };
  identity: {
    overallStatus: TenantVisibleStatus;
    identityVerification: {
      status: TenantVisibleStatus;
      label: string;
      note: string | null;
      updatedAt: string | null;
    };
    documentChecklist: Array<{
      code: string;
      label: string;
      status: TenantVisibleStatus;
      nextStep: string | null;
    }>;
    nextSteps: string[];
  };
};

export type TenantApplicationReuseProjection = {
  applicant: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
  };
  currentAddress: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    provinceState: string | null;
    postalCode: string | null;
    country: string | null;
  } | null;
  timeAtCurrentAddressMonths: number | null;
  currentRentAmountCents: number | null;
  employment: {
    employerName: string | null;
    jobTitle: string | null;
    incomeAmountCents: number | null;
    incomeFrequency: "monthly" | "annual" | null;
    monthsAtJob: number | null;
  } | null;
  workReference: {
    name: string | null;
    phone: string | null;
  } | null;
  nextOfKin: {
    name: string | null;
    relationship: string | null;
    phone: string | null;
    address: string | null;
  } | null;
};

export type TenantIdentityStatus = "incomplete" | "ready" | "verified" | "limited";
export type TenantIdentityVerificationLevel = "none" | "partial" | "strong";
export type TenantIdentityCompletionStatus = "complete" | "in_progress" | "missing" | "needs_attention";
export type TenantIdentityScreeningStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "needs_attention"
  | "blocked";

export type TenantIdentityRecord = {
  identityStatus: TenantIdentityStatus;
  profile: {
    completionStatus: TenantIdentityCompletionStatus;
  };
  application: {
    reusable: boolean;
    lastSubmittedAt: string | null;
  };
  documents: {
    completionStatus: TenantIdentityCompletionStatus;
    missingCategories: string[];
  };
  screening: {
    status: TenantIdentityScreeningStatus;
    lastCompletedAt: string | null;
  };
  leases: {
    activeCount: number;
    historicalCount: number;
    lastSignedAt: string | null;
  };
  verification: {
    level: TenantIdentityVerificationLevel;
  };
  readinessLabel: string;
  readinessDescription: string;
};

export type TenantIdentitySummary = Pick<
  TenantIdentityRecord,
  "identityStatus" | "readinessLabel" | "readinessDescription"
> & {
  verification: TenantIdentityRecord["verification"];
};

function asString(value: unknown): string | null {
  const next = String(value || "").trim();
  return next || null;
}

function normalizeEmail(value: unknown): string | null {
  const next = String(value || "").trim().toLowerCase();
  return next || null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
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
  return millis ? new Date(millis).toISOString() : null;
}

function splitNameParts(value: string | null) {
  const normalized = asString(value);
  if (!normalized) {
    return { firstName: null, lastName: null };
  }
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { firstName: parts[0] || null, lastName: null };
  }
  return {
    firstName: parts[0] || null,
    lastName: parts.slice(1).join(" ") || null,
  };
}

async function loadDocument(collectionName: string, docId: string | null) {
  const id = asString(docId);
  if (!id) return null;
  try {
    const snap = await db.collection(collectionName).doc(id).get();
    if (!snap.exists) return null;
    return { id: snap.id, data: (snap.data() as any) || {} };
  } catch {
    return null;
  }
}

async function loadApplicationDocument(docId: string | null) {
  const id = asString(docId);
  if (!id) return null;
  return (await loadDocument("applications", id)) || (await loadDocument("rentalApplications", id));
}

async function queryFirst(
  collectionName: string,
  field: string,
  value: string | null,
  operator: "==" | "array-contains" = "=="
) {
  const normalized = asString(value);
  if (!normalized) return null;
  try {
    const snap = await db.collection(collectionName).where(field, operator, normalized).limit(5).get();
    const doc = snap.docs?.[0];
    if (!doc) return null;
    return { id: doc.id, data: (doc.data() as any) || {} };
  } catch {
    return null;
  }
}

async function queryFirstApplication(
  field: string,
  value: string | null,
  operator: "==" | "array-contains" = "=="
) {
  return (await queryFirst("applications", field, value, operator)) || (await queryFirst("rentalApplications", field, value, operator));
}

async function queryMany(
  collectionName: string,
  field: string,
  value: string | null,
  operator: "==" | "array-contains" = "==",
  limitCount = 25
) {
  const normalized = operator === "array-contains" ? value : asString(value);
  if (!normalized) return [];
  try {
    const snap = await db.collection(collectionName).where(field, operator, normalized).limit(limitCount).get();
    return snap.docs.map((doc: any) => ({ id: doc.id, data: (doc.data() as any) || {} }));
  } catch {
    return [];
  }
}

async function loadWorkspaceDocuments(context: TenancyContext) {
  const property = await loadDocument("properties", context.propertyId);

  let application = await loadApplicationDocument(context.applicationId);
  if (!application && context.tenantId) {
    application =
      (await queryFirstApplication("tenantId", context.tenantId)) ||
      (await queryFirstApplication("convertedTenantId", context.tenantId)) ||
      (await queryFirstApplication("applicantTenantId", context.tenantId));
  }
  if (!application && context.invitedEmail) {
    const match = await queryFirstApplication("applicantEmail", context.invitedEmail);
    if (match && String(match.data?.propertyId || "") === String(context.propertyId || "")) {
      application = match;
    }
  }
  if (!application && context.invitedEmail) {
    const match = await queryFirstApplication("email", context.invitedEmail);
    if (match && String(match.data?.propertyId || "") === String(context.propertyId || "")) {
      application = match;
    }
  }
  if (!application && context.invitedEmail) {
    const match = await queryFirstApplication("applicant.email", context.invitedEmail);
    if (match && String(match.data?.propertyId || "") === String(context.propertyId || "")) {
      application = match;
    }
  }

  let lease = await loadDocument("leases", context.leaseId);
  if (!lease && context.tenantId) {
    const match = await queryFirst("leases", "tenantId", context.tenantId);
    if (match && String(match.data?.propertyId || "") === String(context.propertyId || "")) {
      lease = match;
    }
  }
  if (!lease && context.tenantId) {
    const match = await queryFirst("leases", "tenantIds", context.tenantId, "array-contains");
    if (match && String(match.data?.propertyId || "") === String(context.propertyId || "")) {
      lease = match;
    }
  }

  let tenant = await loadDocument("tenants", context.tenantId);
  if (!tenant && context.invitedEmail) {
    tenant = await queryFirst("tenants", "email", context.invitedEmail);
  }

  return { property, application, lease, tenant };
}

function isLikelyRawId(value: string | null): boolean {
  if (!value) return false;
  return /^[A-Za-z0-9_-]{12,}$/.test(value);
}

function firstSafeDisplayString(values: unknown[], rawIds: unknown[]): string | null {
  const blocked = new Set(
    rawIds
      .map((value) => asString(value))
      .filter(isLikelyRawId)
      .filter((value): value is string => Boolean(value))
  );
  for (const value of values) {
    const candidate = asString(value);
    if (!candidate || blocked.has(candidate)) continue;
    return candidate;
  }
  return null;
}

async function loadTenantProfileUnitProjection(params: {
  context: TenancyContext;
  propertyData?: any;
  tenantData?: any;
  leaseData?: any;
}): Promise<TenantProfileProjection["profile"]["unit"]> {
  const unitIdCandidates = Array.from(
    new Set(
      [
        params.context.unitId,
        params.tenantData?.unitId,
        params.leaseData?.unitId,
        params.tenantData?.unit,
        params.leaseData?.unit,
      ]
        .map((value) => asString(value))
        .filter((value): value is string => Boolean(value))
    )
  );
  const unitDocs = (await Promise.all(unitIdCandidates.map((candidate) => loadDocument("units", candidate)))).filter(
    (doc): doc is { id: string; data: any } => Boolean(doc?.data)
  );
  const propertyUnitDocs = params.context.propertyId
    ? await queryMany("units", "propertyId", params.context.propertyId, "==", 250)
    : [];
  const propertyEmbeddedUnits = Array.isArray(params.propertyData?.units)
    ? params.propertyData.units.map((unit: any, index: number) => ({ id: asString(unit?.id) || `property-unit-${index}`, data: unit }))
    : [];
  const scopedUnitDocs = [...unitDocs, ...propertyUnitDocs, ...propertyEmbeddedUnits];
  const matchedUnitDocs = scopedUnitDocs.filter((doc) => {
    const identifiers = [
      doc.id,
      doc.data?.id,
      doc.data?.unitId,
      doc.data?.unit_id,
      doc.data?.unitNumber,
      doc.data?.unitLabel,
      doc.data?.label,
      doc.data?.name,
    ]
      .map((value) => asString(value))
      .filter(Boolean);
    return identifiers.some((identifier) => unitIdCandidates.includes(identifier!));
  });
  const resolvedUnitDocs = matchedUnitDocs.length ? matchedUnitDocs : unitDocs;
  const unitId = resolvedUnitDocs.find((doc) => isLikelyRawId(doc.id))?.id || unitIdCandidates.find(isLikelyRawId) || null;
  const rawIds = [unitId, params.context.unitId, params.tenantData?.unitId, params.leaseData?.unitId];
  const label = firstSafeDisplayString(
    [
      params.tenantData?.unitLabel,
      params.tenantData?.unitNumber,
      params.tenantData?.unit,
      params.leaseData?.unitLabel,
      params.leaseData?.unitNumber,
      params.leaseData?.unit,
      ...resolvedUnitDocs.flatMap((doc) => [doc.data?.unitNumber, doc.data?.unitLabel, doc.data?.label, doc.data?.name]),
    ],
    rawIds
  );
  if (!unitId && !label) return null;
  return {
    unitId,
    label,
  };
}

async function loadApplicationReuseSource(params: { context: TenancyContext; userEmail?: string | null }) {
  const { context, userEmail } = params;
  const workspace = await loadWorkspaceDocuments(context);

  let application = workspace.application;
  if (!application && userEmail) {
    const byApplicantEmail = await queryFirstApplication("applicantEmail", normalizeEmail(userEmail));
    application = byApplicantEmail || application;
  }
  if (!application && userEmail) {
    const byEmail = await queryFirstApplication("email", normalizeEmail(userEmail));
    application = byEmail || application;
  }
  if (!application && userEmail) {
    const byNestedEmail = await queryFirstApplication("applicant.email", normalizeEmail(userEmail));
    application = byNestedEmail || application;
  }

  return {
    tenant: workspace.tenant,
    application,
  };
}

function normalizeAuthorityLabel(authority: TenancyContext["authority"]): string {
  switch (authority) {
    case "applicant":
      return "Applicant";
    case "active_tenant":
      return "Active tenant";
    case "invite":
      return "Invite-linked tenant";
    default:
      return "Tenant";
  }
}

function titleCaseWords(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeIdentityCompletionStatus(status: TenantVisibleStatus): TenantIdentityCompletionStatus {
  switch (status) {
    case "verified":
      return "complete";
    case "pending":
      return "in_progress";
    case "needs_review":
      return "needs_attention";
    case "missing":
    default:
      return "missing";
  }
}

function uniq(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => asString(value)).filter((value): value is string => Boolean(value))));
}

function deriveReusableApplicationState(reuse: TenantApplicationReuseProjection): boolean {
  const applicantReady = Boolean(
    reuse.applicant.firstName && reuse.applicant.lastName && reuse.applicant.email && reuse.applicant.phone
  );
  const addressReady = Boolean(
    reuse.currentAddress?.line1 &&
      reuse.currentAddress?.city &&
      reuse.currentAddress?.provinceState &&
      reuse.currentAddress?.postalCode
  );
  const employmentReady = Boolean(
    reuse.employment?.employerName &&
      reuse.employment?.jobTitle &&
      reuse.employment?.incomeAmountCents != null &&
      reuse.employment?.monthsAtJob != null
  );

  return applicantReady && addressReady && employmentReady;
}

function deriveScreeningStatusFromVisibleStatus(status: TenantVisibleStatus): TenantIdentityScreeningStatus {
  switch (status) {
    case "verified":
      return "completed";
    case "pending":
      return "in_progress";
    case "needs_review":
      return "needs_attention";
    case "missing":
    default:
      return "not_started";
  }
}

async function loadTenantLeaseHistorySignals(context: TenancyContext, userEmail?: string | null) {
  let leases = context.tenantId ? await queryMany("leases", "tenantId", context.tenantId) : [];
  if (!leases.length && context.tenantId) {
    leases = await queryMany("leases", "tenantIds", context.tenantId, "array-contains");
  }
  if (!leases.length && userEmail) {
    leases = await queryMany("leases", "tenantEmail", normalizeEmail(userEmail));
  }

  let activeCount = 0;
  let historicalCount = 0;
  let lastSignedAt: string | null = null;

  leases.forEach((lease) => {
    const status = String(lease.data?.status || "").trim().toLowerCase();
    if (status === "active") {
      activeCount += 1;
    } else {
      historicalCount += 1;
    }
    const signedAt =
      toIso(lease.data?.tenantSignature?.signedAt) ||
      toIso(lease.data?.tenantSignedAt) ||
      toIso(lease.data?.tenantSignatureCompletedAt);
    if (signedAt && (!lastSignedAt || Date.parse(signedAt) > Date.parse(lastSignedAt))) {
      lastSignedAt = signedAt;
    }
  });

  return {
    activeCount,
    historicalCount,
    lastSignedAt,
  };
}

function deriveTenantIdentityVerificationLevel(input: {
  applicationReusable: boolean;
  documentStatus: TenantIdentityCompletionStatus;
  screeningStatus: TenantIdentityScreeningStatus;
  leaseSignals: {
    activeCount: number;
    historicalCount: number;
    lastSignedAt: string | null;
  };
}): TenantIdentityVerificationLevel {
  const hasLeaseEvidence =
    input.leaseSignals.activeCount > 0 || input.leaseSignals.historicalCount > 0 || Boolean(input.leaseSignals.lastSignedAt);

  if (input.screeningStatus === "completed" && input.documentStatus === "complete" && hasLeaseEvidence) {
    return "strong";
  }

  if (
    input.applicationReusable ||
    input.documentStatus === "complete" ||
    input.documentStatus === "in_progress" ||
    input.screeningStatus === "completed" ||
    hasLeaseEvidence
  ) {
    return "partial";
  }

  return "none";
}

function deriveTenantIdentityStatus(input: {
  profileStatus: TenantIdentityCompletionStatus;
  applicationReusable: boolean;
  documentStatus: TenantIdentityCompletionStatus;
  screeningStatus: TenantIdentityScreeningStatus;
  verificationLevel: TenantIdentityVerificationLevel;
}): TenantIdentityStatus {
  if (input.verificationLevel === "strong") {
    return "verified";
  }

  if (
    input.profileStatus === "complete" &&
    input.applicationReusable &&
    input.documentStatus !== "missing" &&
    input.screeningStatus !== "needs_attention" &&
    input.screeningStatus !== "blocked"
  ) {
    return "ready";
  }

  if (
    input.profileStatus !== "missing" ||
    input.applicationReusable ||
    input.documentStatus !== "missing" ||
    input.screeningStatus !== "not_started"
  ) {
    return "incomplete";
  }

  return "limited";
}

function deriveTenantIdentityReadinessCopy(
  status: TenantIdentityStatus,
  verificationLevel: TenantIdentityVerificationLevel
) {
  switch (status) {
    case "verified":
      return {
        readinessLabel: "Well established",
        readinessDescription:
          verificationLevel === "strong"
            ? "Your rental identity includes completed verification signals and visible lease history."
            : "Your rental identity is established and ready for ongoing rental workflows.",
      };
    case "ready":
      return {
        readinessLabel: "Ready to apply",
        readinessDescription:
          "Your core profile, reusable application details, and supporting records are ready for most rental workflows.",
      };
    case "incomplete":
      return {
        readinessLabel: "Almost ready",
        readinessDescription:
          "A few important identity details are still missing, but your rental record is already taking shape.",
      };
    case "limited":
    default:
      return {
        readinessLabel: "Getting started",
        readinessDescription:
          "Add your core profile and supporting records to build a stronger reusable rental identity.",
      };
  }
}

function toLandlordSafeTenantIdentitySummary(
  record: TenantIdentityRecord
): TenantIdentitySummary {
  return {
    identityStatus: record.identityStatus,
    verification: record.verification,
    readinessLabel: record.readinessLabel,
    readinessDescription: record.readinessDescription,
  };
}

function deriveTenantIdentityRecordFromSignals(input: {
  profileStatus: TenantIdentityCompletionStatus;
  applicationReusable: boolean;
  lastSubmittedAt: string | null;
  documentStatus: TenantIdentityCompletionStatus;
  missingCategories: string[];
  screeningStatus: TenantIdentityScreeningStatus;
  screeningCompletedAt: string | null;
  leaseSignals: {
    activeCount: number;
    historicalCount: number;
    lastSignedAt: string | null;
  };
}): TenantIdentityRecord {
  const verificationLevel = deriveTenantIdentityVerificationLevel({
    applicationReusable: input.applicationReusable,
    documentStatus: input.documentStatus,
    screeningStatus: input.screeningStatus,
    leaseSignals: input.leaseSignals,
  });
  const identityStatus = deriveTenantIdentityStatus({
    profileStatus: input.profileStatus,
    applicationReusable: input.applicationReusable,
    documentStatus: input.documentStatus,
    screeningStatus: input.screeningStatus,
    verificationLevel,
  });
  const copy = deriveTenantIdentityReadinessCopy(identityStatus, verificationLevel);

  return {
    identityStatus,
    profile: {
      completionStatus: input.profileStatus,
    },
    application: {
      reusable: input.applicationReusable,
      lastSubmittedAt: input.lastSubmittedAt,
    },
    documents: {
      completionStatus: input.documentStatus,
      missingCategories: input.missingCategories,
    },
    screening: {
      status: input.screeningStatus,
      lastCompletedAt: input.screeningCompletedAt,
    },
    leases: input.leaseSignals,
    verification: {
      level: verificationLevel,
    },
    readinessLabel: copy.readinessLabel,
    readinessDescription: copy.readinessDescription,
  };
}

function deriveProfileCompletionStatusFromApplication(application: any): TenantIdentityCompletionStatus {
  const hasApplicantName = Boolean(asString(application?.applicant?.firstName) || asString(application?.firstName));
  const hasApplicantEmail = Boolean(
    normalizeEmail(application?.applicant?.email) ||
      normalizeEmail(application?.applicantEmail) ||
      normalizeEmail(application?.email)
  );
  const hasTypedSignature = Boolean(asString(application?.applicantProfile?.signature?.typedName));

  if (hasApplicantName && hasApplicantEmail && hasTypedSignature) {
    return "complete";
  }
  if (hasApplicantName || hasApplicantEmail || hasTypedSignature) {
    return "in_progress";
  }
  return "missing";
}

export function deriveLandlordSafeApplicationReusableFromApplication(application: any): boolean {
  const currentAddress = application?.applicantProfile?.currentAddress || {};
  const employment = application?.applicantProfile?.employment || {};

  return Boolean(
    (asString(application?.applicant?.firstName) || asString(application?.firstName)) &&
      (asString(application?.applicant?.lastName) || asString(application?.lastName)) &&
      (normalizeEmail(application?.applicant?.email) ||
        normalizeEmail(application?.applicantEmail) ||
        normalizeEmail(application?.email)) &&
      asString(currentAddress?.line1) &&
      asString(currentAddress?.city) &&
      asString(currentAddress?.provinceState) &&
      asString(currentAddress?.postalCode) &&
      asString(employment?.employerName) &&
      asString(employment?.jobTitle) &&
      asNumber(employment?.incomeAmountCents) != null
  );
}

function deriveDocumentSignalsFromApplication(application: any) {
  const documentCount = Array.isArray(application?.documentRefs)
    ? application.documentRefs.length
    : Array.isArray(application?.documents)
    ? application.documents.length
    : 0;

  if (documentCount > 0) {
    return {
      completionStatus: "complete" as TenantIdentityCompletionStatus,
      missingCategories: [] as string[],
    };
  }

  return {
    completionStatus: "missing" as TenantIdentityCompletionStatus,
    missingCategories: ["Supporting documents"],
  };
}

function deriveScreeningSignalsFromApplication(application: any) {
  const rawStatus = String(application?.screeningStatus || application?.screening?.status || "").trim().toLowerCase();
  const completedAt =
    toIso(application?.screening?.completedAt) ||
    toIso(application?.screeningCompletedAt) ||
    toIso(application?.screeningResultCompletedAt);

  let status: TenantIdentityScreeningStatus = "not_started";
  if (["complete", "completed", "verified"].includes(rawStatus)) {
    status = "completed";
  } else if (["manual_review", "manual_review_required", "failed", "ineligible"].includes(rawStatus)) {
    status = "needs_attention";
  } else if (["blocked"].includes(rawStatus)) {
    status = "blocked";
  } else if (rawStatus) {
    status = "in_progress";
  }

  return { status, completedAt };
}

function normalizeChecklist(input: any, nextActions: string[]): TenantProfileProjection["identity"]["documentChecklist"] {
  const explicitChecklist = Array.isArray(input?.documentChecklist) ? input.documentChecklist : [];
  if (explicitChecklist.length) {
    return explicitChecklist
      .map((entry: any) => {
        const code = asString(entry?.code) || asString(entry?.id);
        if (!code) return null;
        const rawStatus = String(entry?.status || "").trim().toLowerCase();
        const status: TenantVisibleStatus =
          rawStatus === "verified" || rawStatus === "complete" || rawStatus === "completed"
            ? "verified"
            : rawStatus === "needs_review" || rawStatus === "manual_review_required"
            ? "needs_review"
            : rawStatus === "pending" || rawStatus === "uploaded" || rawStatus === "submitted"
            ? "pending"
            : "missing";
        return {
          code,
          label: asString(entry?.label) || titleCaseWords(code),
          status,
          nextStep: asString(entry?.nextStep),
        };
      })
      .filter((entry: {
        code: string;
        label: string;
        status: TenantVisibleStatus;
        nextStep: string | null;
      } | null): entry is {
        code: string;
        label: string;
        status: TenantVisibleStatus;
        nextStep: string | null;
      } => Boolean(entry));
  }

  const missingSteps = Array.isArray(input?.missingSteps)
    ? input.missingSteps
        .map((entry: unknown) => asString(entry))
        .filter((entry: string | null): entry is string => Boolean(entry))
    : [];
  const checklist = missingSteps.map((code: string) => ({
    code,
    label: titleCaseWords(code),
    status: "missing" as TenantVisibleStatus,
    nextStep: nextActions.find((step) => step.toLowerCase().includes(code.toLowerCase())) || null,
  }));

  const documentRefs = Array.isArray(input?.documentRefs)
    ? input.documentRefs.length
    : Array.isArray(input?.documents)
    ? input.documents.length
    : 0;
  if (!checklist.length && documentRefs > 0) {
    checklist.push({
      code: "uploaded_documents",
      label: "Uploaded documents",
      status: "pending",
      nextStep: null,
    });
  }

  return checklist;
}

function deriveIdentityStatuses(params: {
  application: any;
  screeningRequest: any;
  screeningResult: any;
}) {
  const nextActions = Array.isArray(params.application?.nextActions)
    ? params.application.nextActions
        .map((entry: unknown) => asString(entry))
        .filter((entry: string | null): entry is string => Boolean(entry))
    : [];
  const checklist = normalizeChecklist(params.application, nextActions);

  const requestStatus = String(params.screeningRequest?.status || "").trim().toLowerCase();
  const resultStatus = String(params.screeningResult?.status || "").trim().toLowerCase();
  const identityVerified = params.screeningResult?.identityVerified === true;

  let verificationStatus: TenantVisibleStatus = "missing";
  let verificationLabel = "Not started";
  let verificationNote: string | null = null;

  if (identityVerified || resultStatus === "completed") {
    verificationStatus = identityVerified ? "verified" : "pending";
    verificationLabel = identityVerified ? "Verified" : "Completed";
    verificationNote = identityVerified
      ? "Your identity verification is complete."
      : "Verification has completed, but some records may still be updating.";
  } else if (["manual_review_required", "inconclusive", "failed"].includes(resultStatus) || ["manual_review_required", "failed"].includes(requestStatus)) {
    verificationStatus = "needs_review";
    verificationLabel = "Needs attention";
    verificationNote = "A team member may need to review your verification details.";
  } else if (
    ["requested", "consent_pending", "consented", "in_progress", "pending_review"].includes(requestStatus) ||
    ["pending", "in_progress"].includes(resultStatus)
  ) {
    verificationStatus = "pending";
    verificationLabel = "Pending";
    verificationNote = "Verification is still in progress.";
  }

  let documentsStatus: TenantVisibleStatus = "verified";
  if (checklist.some((entry) => entry.status === "needs_review")) {
    documentsStatus = "needs_review";
  } else if (checklist.some((entry) => entry.status === "missing")) {
    documentsStatus = "missing";
  } else if (checklist.some((entry) => entry.status === "pending")) {
    documentsStatus = "pending";
  }

  const order: Record<TenantVisibleStatus, number> = {
    verified: 0,
    pending: 1,
    missing: 2,
    needs_review: 3,
  };
  const overallStatus = order[verificationStatus] >= order[documentsStatus] ? verificationStatus : documentsStatus;

  return {
    overallStatus,
    verificationStatus,
    verificationLabel,
    verificationNote,
    checklist,
    nextActions,
  };
}

export async function loadTenantProfileProjection(params: {
  context: TenancyContext;
  userId: string;
  userEmail?: string | null;
}) : Promise<TenantProfileProjection> {
  const { context, userEmail } = params;
  const { property, application, lease, tenant } = await loadWorkspaceDocuments(context);

  const screeningRequest =
    (context.tenantId ? await queryFirst("screening_requests", "applicantTenantId", context.tenantId) : null) ||
    (context.applicationId ? await queryFirst("screening_requests", "rentalApplicationId", context.applicationId) : null);

  let screeningResult: { id: string; data: any } | null = null;
  const latestResultId = asString(screeningRequest?.data?.latestResultId);
  if (latestResultId) {
    screeningResult = await loadDocument("screening_results", latestResultId);
  }

  const identity = deriveIdentityStatuses({
    application: application?.data || {},
    screeningRequest: screeningRequest?.data || {},
    screeningResult: screeningResult?.data || {},
  });
  const unit = await loadTenantProfileUnitProjection({
    context,
    propertyData: property?.data,
    tenantData: tenant?.data,
    leaseData: lease?.data,
  });

  return {
    context: {
      authority: context.authority,
      propertyId: context.propertyId,
      rc_prop_id: context.rc_prop_id,
      applicationId: context.applicationId,
      leaseId: context.leaseId,
      tenantId: context.tenantId,
      unitId: context.unitId,
      invitedEmail: context.invitedEmail,
    },
    profile: {
      displayName:
        asString(tenant?.data?.fullName) ||
        asString(tenant?.data?.name) ||
        asString(application?.data?.applicantName) ||
        (normalizeEmail(userEmail) ? normalizeEmail(userEmail)!.split("@")[0] : null),
      email:
        normalizeEmail(tenant?.data?.email) ||
        normalizeEmail(application?.data?.applicantEmail) ||
        normalizeEmail(userEmail) ||
        context.invitedEmail,
      phone: asString(tenant?.data?.phone) || asString(application?.data?.phone),
      authorityLabel: normalizeAuthorityLabel(context.authority),
      property: property ? projectTenantProperty(property.id, property.data) : null,
      unit,
      application: application ? projectTenantApplication(application.id, application.data) : null,
      lease: lease ? projectTenantLease(lease.id, lease.data) : null,
    },
    identity: {
      overallStatus: identity.overallStatus,
      identityVerification: {
        status: identity.verificationStatus,
        label: identity.verificationLabel,
        note: identity.verificationNote,
        updatedAt: toIso(screeningResult?.data?.updatedAt) || toIso(screeningRequest?.data?.updatedAt),
      },
      documentChecklist: identity.checklist,
      nextSteps: identity.nextActions.slice(0, 6),
    },
  };
}

export async function loadTenantApplicationReuseProjection(params: {
  context: TenancyContext;
  userEmail?: string | null;
}): Promise<TenantApplicationReuseProjection> {
  const { tenant, application } = await loadApplicationReuseSource(params);
  const profile = application?.data?.applicantProfile || {};
  const employment = profile?.employment || {};
  const workReference = profile?.workReference || {};
  const nextOfKin = application?.data?.nextOfKin || null;
  const candidateName =
    asString(tenant?.data?.fullName) ||
    asString(application?.data?.firstName && application?.data?.lastName
      ? `${application.data.firstName} ${application.data.lastName}`
      : null) ||
    asString(application?.data?.applicantFullName) ||
    asString(application?.data?.applicantName) ||
    asString(application?.data?.fullName);
  const name = splitNameParts(candidateName);

  return {
    applicant: {
      firstName: asString(application?.data?.firstName) || name.firstName,
      lastName: asString(application?.data?.lastName) || name.lastName,
      email:
        normalizeEmail(application?.data?.applicantEmail) ||
        normalizeEmail(application?.data?.email) ||
        normalizeEmail(tenant?.data?.email) ||
        normalizeEmail(params.userEmail) ||
        null,
      phone:
        asString(application?.data?.applicantPhone) ||
        asString(application?.data?.phone) ||
        asString(tenant?.data?.phone),
    },
    currentAddress: profile?.currentAddress
      ? {
          line1: asString(profile.currentAddress?.line1),
          line2: asString(profile.currentAddress?.line2),
          city: asString(profile.currentAddress?.city),
          provinceState: asString(profile.currentAddress?.provinceState),
          postalCode: asString(profile.currentAddress?.postalCode),
          country: asString(profile.currentAddress?.country) || "CA",
        }
      : null,
    timeAtCurrentAddressMonths: asNumber(profile?.timeAtCurrentAddressMonths),
    currentRentAmountCents: asNumber(profile?.currentRentAmountCents),
    employment:
      profile?.employment
        ? {
            employerName: asString(employment?.employerName),
            jobTitle: asString(employment?.jobTitle),
            incomeAmountCents: asNumber(employment?.incomeAmountCents),
            incomeFrequency:
              employment?.incomeFrequency === "monthly" || employment?.incomeFrequency === "annual"
                ? employment.incomeFrequency
                : null,
            monthsAtJob: asNumber(employment?.monthsAtJob),
          }
        : null,
    workReference:
      profile?.workReference
        ? {
            name: asString(workReference?.name),
            phone: asString(workReference?.phone),
          }
        : null,
    nextOfKin: nextOfKin
      ? {
          name: asString(nextOfKin?.name),
          relationship: asString(nextOfKin?.relationship),
          phone: asString(nextOfKin?.phone),
          address: asString(nextOfKin?.address),
        }
      : null,
  };
}

export async function loadTenantIdentityRecord(params: {
  context: TenancyContext;
  userId: string;
  userEmail?: string | null;
}): Promise<TenantIdentityRecord> {
  const { context, userEmail } = params;
  const [profileProjection, reuseProjection, leaseSignals] = await Promise.all([
    loadTenantProfileProjection(params),
    loadTenantApplicationReuseProjection({ context, userEmail }),
    loadTenantLeaseHistorySignals(context, userEmail),
  ]);

  const profileStatus = profileProjection.profile.displayName &&
    profileProjection.profile.email &&
    profileProjection.profile.phone
      ? "complete"
      : profileProjection.profile.displayName || profileProjection.profile.email || profileProjection.profile.phone
      ? "in_progress"
      : "missing";

  const documentStatuses = profileProjection.identity.documentChecklist.map((entry) => entry.status);
  const documentStatus =
    documentStatuses.includes("needs_review")
      ? "needs_attention"
      : documentStatuses.includes("missing")
      ? "missing"
      : documentStatuses.includes("pending")
      ? "in_progress"
      : profileProjection.identity.documentChecklist.length
      ? "complete"
      : "missing";

  const missingCategories = uniq(
    profileProjection.identity.documentChecklist
      .filter((entry) => entry.status === "missing")
      .map((entry) => entry.label)
  );

  const applicationReusable = deriveReusableApplicationState(reuseProjection);
  const screeningStatus = deriveScreeningStatusFromVisibleStatus(
    profileProjection.identity.identityVerification.status
  );

  return deriveTenantIdentityRecordFromSignals({
    profileStatus,
    applicationReusable,
    lastSubmittedAt:
      profileProjection.profile.application?.status === "submitted"
        ? profileProjection.profile.application?.updatedAt || profileProjection.profile.application?.createdAt || null
        : null,
    documentStatus,
    missingCategories,
    screeningStatus,
    screeningCompletedAt:
      screeningStatus === "completed"
        ? profileProjection.identity.identityVerification.updatedAt
        : null,
    leaseSignals,
  });
}

export async function loadLandlordSafeTenantIdentitySummary(params: {
  applicationId: string;
  application: any;
}): Promise<TenantIdentitySummary> {
  const profileStatus = deriveProfileCompletionStatusFromApplication(params.application);
  const applicationReusable = deriveLandlordSafeApplicationReusableFromApplication(params.application);
  const documentSignals = deriveDocumentSignalsFromApplication(params.application);
  const screeningSignals = deriveScreeningSignalsFromApplication(params.application);

  const leaseSignals = {
    activeCount: 0,
    historicalCount: 0,
    lastSignedAt: null,
  };

  const record = deriveTenantIdentityRecordFromSignals({
    profileStatus,
    applicationReusable,
    lastSubmittedAt:
      toIso(params.application?.submittedAt) ||
      toIso(params.application?.updatedAt) ||
      toIso(params.application?.createdAt),
    documentStatus: documentSignals.completionStatus,
    missingCategories: documentSignals.missingCategories,
    screeningStatus: screeningSignals.status,
    screeningCompletedAt: screeningSignals.completedAt,
    leaseSignals,
  });

  return toLandlordSafeTenantIdentitySummary(record);
}
