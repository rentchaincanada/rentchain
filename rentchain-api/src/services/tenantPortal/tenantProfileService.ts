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

function asString(value: unknown): string | null {
  const next = String(value || "").trim();
  return next || null;
}

function normalizeEmail(value: unknown): string | null {
  const next = String(value || "").trim().toLowerCase();
  return next || null;
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

async function loadWorkspaceDocuments(context: TenancyContext) {
  const property = await loadDocument("properties", context.propertyId);

  let application = await loadDocument("applications", context.applicationId);
  if (!application && context.tenantId) {
    application = await queryFirst("applications", "tenantId", context.tenantId);
  }
  if (!application && context.invitedEmail) {
    const match = await queryFirst("applications", "applicantEmail", context.invitedEmail);
    if (match && String(match.data?.propertyId || "") === String(context.propertyId || "")) {
      application = match;
    }
  }
  if (!application && context.invitedEmail) {
    const match = await queryFirst("applications", "email", context.invitedEmail);
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

  let tenant = await loadDocument("tenants", context.tenantId);
  if (!tenant && context.invitedEmail) {
    tenant = await queryFirst("tenants", "email", context.invitedEmail);
  }

  return { property, application, lease, tenant };
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
