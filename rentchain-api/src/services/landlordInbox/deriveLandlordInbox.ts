import { db } from "../../firebase";
import type { LandlordAgentDecision } from "../../lib/analytics/analyticsTypes";
import { buildReviewSummary } from "../../lib/reviewSummary";
import { deriveLandlordTrustContext } from "../../lib/trust/deriveLandlordTrustContext";
import { deriveLeaseExecution } from "../leaseExecution/deriveLeaseExecution";
import { deriveNetworkReuseSummary, type NetworkReuseSummary } from "../networkReuse/deriveNetworkReuseSummary";
import {
  deriveTenantCredibilitySignals,
  type LandlordSafeTenantCredibilitySummary,
} from "../tenantCredibility/deriveTenantCredibilitySignals";
import {
  deriveLandlordSafeApplicationReusableFromApplication,
  loadLandlordSafeTenantIdentitySummary,
  type TenantIdentitySummary,
  type TenantIdentityRecord,
} from "../tenantPortal/tenantProfileService";

type InboxPriority = "low" | "medium" | "high";
type InboxStatus = "action_required" | "pending" | "completed";
type InboxType = "application" | "lease" | "screening";
type InboxNextAction =
  | "review_application"
  | "request_info"
  | "review_documents"
  | "review_screening"
  | "prepare_lease"
  | "no_action";

export type LandlordInboxItem = {
  id: string;
  type: InboxType;
  subjectId: string;
  applicationId: string | null;
  leaseId: string | null;
  title: string;
  description: string;
  priority: InboxPriority;
  status: InboxStatus;
  nextAction: InboxNextAction;
  nextActionHref: string | null;
  trustSummary: {
    readiness: "limited" | "emerging" | "ready" | "strong";
    verificationLevel: "none" | "partial" | "strong";
  } | null;
  credibilitySummary: {
    completenessLevel: "low" | "medium" | "high";
  } | null;
  networkReuseSummary: NetworkReuseSummary | null;
  source: "review_summary" | "analytics_overlay" | "lease_execution";
};

export type LandlordInboxResult = {
  items: LandlordInboxItem[];
  summary: {
    actionRequired: number;
    pending: number;
    completed: number;
  };
};

type DeriveLandlordInboxParams = {
  landlordId: string;
  propertyId?: string | null;
  analyticsDecisions: LandlordAgentDecision[];
};

type ScopedApplicationRecord = Record<string, unknown> & {
  id: string;
  landlordId?: string | null;
  ownerId?: string | null;
  userId?: string | null;
  propertyId?: string | null;
  status?: string | null;
};

type ScopedLeaseRecord = Record<string, unknown> & {
  id: string;
  landlordId?: string | null;
  ownerId?: string | null;
  userId?: string | null;
  propertyId?: string | null;
  applicationId?: string | null;
  documentUrl?: string | null;
  status?: string | null;
};

function asString(value: unknown, max = 240): string | null {
  const next = String(value || "").trim().slice(0, max);
  return next || null;
}

function normalizeStatus(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function hasLandlordScope(doc: { landlordId?: string | null; ownerId?: string | null; userId?: string | null }, landlordId: string) {
  return [doc.landlordId, doc.ownerId, doc.userId].some((value) => asString(value, 240) === landlordId);
}

function matchesPropertyScope(propertyId: string | null, requestedPropertyId: string | null) {
  if (!requestedPropertyId) return true;
  return propertyId === requestedPropertyId;
}

async function loadCollection(name: string) {
  return await db.collection(name).get().catch(() => ({ docs: [] } as any));
}

function maxPriority(left: InboxPriority, right: InboxPriority): InboxPriority {
  const ranking: Record<InboxPriority, number> = { low: 1, medium: 2, high: 3 };
  return ranking[right] > ranking[left] ? right : left;
}

function actionFromTrustNextAction(
  nextAction:
    | "review_application"
    | "request_missing_info"
    | "review_screening_status"
    | "review_documents"
    | "prepare_lease"
    | "no_action"
): InboxNextAction {
  switch (nextAction) {
    case "request_missing_info":
      return "request_info";
    case "review_screening_status":
      return "review_screening";
    case "review_documents":
      return "review_documents";
    case "prepare_lease":
      return "prepare_lease";
    case "no_action":
      return "no_action";
    case "review_application":
    default:
      return "review_application";
  }
}

function titleFromNextAction(action: InboxNextAction): string {
  switch (action) {
    case "request_info":
      return "Application needs more information";
    case "review_screening":
      return "Screening needs review";
    case "review_documents":
      return "Supporting records need review";
    case "prepare_lease":
      return "Application is ready for lease preparation";
    case "no_action":
      return "Application review is settled";
    case "review_application":
    default:
      return "Application ready for review";
  }
}

function statusFromNextAction(action: InboxNextAction): InboxStatus {
  if (action === "no_action") return "completed";
  return "action_required";
}

function priorityFromApplicationContext(params: {
  nextAction: InboxNextAction;
  screeningStatus: string | null;
  completenessFlags: string[];
}): InboxPriority {
  const { nextAction, screeningStatus, completenessFlags } = params;
  if (nextAction === "request_info" || nextAction === "review_screening") return "high";
  if (nextAction === "prepare_lease") return "medium";
  if (nextAction === "review_documents") return "medium";
  if (nextAction === "review_application") {
    if ((screeningStatus || "") === "needs_attention") return "high";
    if (completenessFlags.length > 0) return "medium";
    return "medium";
  }
  return "low";
}

function buildLandlordSafeIdentityRecord(params: {
  tenantIdentitySummary: TenantIdentitySummary | null;
  applicationReusable: boolean;
  screeningStatus: string | null | undefined;
}): TenantIdentityRecord | null {
  const { tenantIdentitySummary, applicationReusable, screeningStatus } = params;
  if (!tenantIdentitySummary) return null;
  return {
    identityStatus: tenantIdentitySummary.identityStatus,
    verification: tenantIdentitySummary.verification,
    readinessLabel: tenantIdentitySummary.readinessLabel,
    readinessDescription: tenantIdentitySummary.readinessDescription,
    profile: {
      completionStatus:
        tenantIdentitySummary.identityStatus === "ready" || tenantIdentitySummary.identityStatus === "verified"
          ? "complete"
          : tenantIdentitySummary.identityStatus === "incomplete"
          ? "in_progress"
          : "missing",
    },
    application: {
      reusable: applicationReusable,
      lastSubmittedAt: null,
    },
    documents: {
      completionStatus:
        tenantIdentitySummary.verification.level === "strong"
          ? "complete"
          : tenantIdentitySummary.verification.level === "partial"
          ? "in_progress"
          : "missing",
      missingCategories: [],
    },
    screening: {
      status:
        screeningStatus === "completed" ||
        screeningStatus === "in_progress" ||
        screeningStatus === "needs_attention" ||
        screeningStatus === "blocked"
          ? (screeningStatus as TenantIdentityRecord["screening"]["status"])
          : tenantIdentitySummary.verification.level === "strong"
          ? "completed"
          : tenantIdentitySummary.verification.level === "partial"
          ? "in_progress"
          : "not_started",
      lastCompletedAt: null,
    },
    leases: {
      activeCount: 0,
      historicalCount: 0,
      lastSignedAt: null,
    },
  };
}

function parseScreeningDecisionApplicationId(decisionId: string): string | null {
  const match = decisionId.match(/^start_screening_checkout:(.+)$/);
  return match ? asString(match[1], 240) : null;
}

function buildFallbackItemFromDecision(decision: LandlordAgentDecision): LandlordInboxItem | null {
  if (decision.decisionType !== "start_screening_checkout" && decision.decisionType !== "improve_application_conversion") {
    return null;
  }

  const applicationId =
    decision.decisionType === "start_screening_checkout" ? parseScreeningDecisionApplicationId(decision.id) : null;
  const type: InboxType = decision.decisionType === "start_screening_checkout" ? "screening" : "application";
  const nextAction: InboxNextAction = decision.decisionType === "start_screening_checkout" ? "review_screening" : "review_application";

  return {
    id: `decision:${decision.id}`,
    type,
    subjectId: decision.id,
    applicationId,
    leaseId: null,
    title: decision.actionLabel || titleFromNextAction(nextAction),
    description: decision.explanation || "A current analytics decision is available for landlord follow-through.",
    priority: decision.priority,
    status: decision.state === "executed" || decision.state === "dismissed" ? "completed" : "action_required",
    nextAction,
    nextActionHref: asString(decision.destination, 400),
    trustSummary: decision.trustContext
      ? {
          readiness: decision.trustContext.trustReadiness,
          verificationLevel:
            decision.trustContext.decisionSupportLevel === "high"
              ? "strong"
              : decision.trustContext.decisionSupportLevel === "medium"
              ? "partial"
              : "none",
        }
      : null,
    credibilitySummary: null,
    networkReuseSummary: null,
    source: "analytics_overlay",
  };
}

function sortItems(items: LandlordInboxItem[]) {
  const statusRank: Record<InboxStatus, number> = {
    action_required: 1,
    pending: 2,
    completed: 3,
  };
  const priorityRank: Record<InboxPriority, number> = {
    high: 1,
    medium: 2,
    low: 3,
  };

  return [...items].sort((left, right) => {
    const statusDiff = statusRank[left.status] - statusRank[right.status];
    if (statusDiff !== 0) return statusDiff;
    const priorityDiff = priorityRank[left.priority] - priorityRank[right.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return left.title.localeCompare(right.title);
  });
}

export async function deriveLandlordInbox(
  params: DeriveLandlordInboxParams
): Promise<LandlordInboxResult> {
  const landlordId = asString(params.landlordId, 240);
  if (!landlordId) {
    return {
      items: [],
      summary: { actionRequired: 0, pending: 0, completed: 0 },
    };
  }

  const propertyId = asString(params.propertyId, 240);
  const [applicationsSnap, leasesSnap] = await Promise.all([
    loadCollection("rentalApplications"),
    loadCollection("leases"),
  ]);

  const applications = ((applicationsSnap.docs || []) as Array<{ id: string; data: () => unknown }>)
    .map((doc) => ({ id: doc.id, ...((doc.data() as Record<string, unknown>) || {}) }))
    .filter((entry): entry is ScopedApplicationRecord => Boolean(asString(entry.id, 240)))
    .filter((entry) => hasLandlordScope(entry, landlordId))
    .filter((entry) => matchesPropertyScope(asString(entry.propertyId, 240), propertyId));

  const leases = ((leasesSnap.docs || []) as Array<{ id: string; data: () => unknown }>)
    .map((doc) => ({ id: doc.id, ...((doc.data() as Record<string, unknown>) || {}) }))
    .filter((entry): entry is ScopedLeaseRecord => Boolean(asString(entry.id, 240)))
    .filter((entry) => hasLandlordScope(entry, landlordId))
    .filter((entry) => matchesPropertyScope(asString(entry.propertyId, 240), propertyId));

  const items: LandlordInboxItem[] = [];
  const applicationItems = new Map<string, LandlordInboxItem>();

  for (const application of applications) {
    const applicationId = asString(application.id, 240);
    if (!applicationId) continue;

    const summary = buildReviewSummary(applicationId, application);
    const completenessFlags = Array.isArray(summary?.derived?.flags)
      ? summary.derived.flags.map((entry) => asString(entry, 240)).filter(Boolean) as string[]
      : [];
    const screeningStatus = asString(summary?.screening?.status, 80);
    const applicationReusable = deriveLandlordSafeApplicationReusableFromApplication(application);
    const tenantIdentitySummary = await loadLandlordSafeTenantIdentitySummary({
      applicationId,
      application,
    });
    const trustContext = deriveLandlordTrustContext({
      tenantIdentitySummary,
      completenessScore: summary?.derived?.completeness?.score ?? null,
      completenessFlags,
      screeningStatus,
      applicationReusable,
    });
    const landlordSafeRecord = buildLandlordSafeIdentityRecord({
      tenantIdentitySummary,
      applicationReusable,
      screeningStatus,
    });
    const { landlordSafeSummary: tenantCredibilitySummary } = deriveTenantCredibilitySignals({
      tenantIdentityRecord: landlordSafeRecord,
      leaseExecution: null,
    });

    const nextAction = actionFromTrustNextAction(trustContext.recommendedNextAction);
    if (nextAction === "no_action") continue;

    const item: LandlordInboxItem = {
      id: `application:${applicationId}`,
      type: nextAction === "review_screening" ? "screening" : "application",
      subjectId: applicationId,
      applicationId,
      leaseId: null,
      title: titleFromNextAction(nextAction),
      description: trustContext.trustDescription,
      priority: priorityFromApplicationContext({
        nextAction,
        screeningStatus,
        completenessFlags,
      }),
      status: statusFromNextAction(nextAction),
      nextAction,
      nextActionHref: `/applications/${encodeURIComponent(applicationId)}/review-summary`,
      trustSummary: tenantIdentitySummary
        ? {
            readiness: trustContext.trustReadiness,
            verificationLevel: tenantIdentitySummary.verification.level,
          }
        : null,
      credibilitySummary: {
        completenessLevel: tenantCredibilitySummary.completenessLevel,
      },
      networkReuseSummary: deriveNetworkReuseSummary({
        applicationSource:
          application.applicationSource === "apply_with_rentchain" ? "apply_with_rentchain" : null,
        identityReference: (application.identityReference as any) || null,
        approvedScopeKeys: Array.isArray((application as any).approvedScopeKeys)
          ? ((application as any).approvedScopeKeys as any[])
          : null,
      }),
      source: "review_summary",
    };

    items.push(item);
    applicationItems.set(applicationId, item);
  }

  for (const decision of params.analyticsDecisions || []) {
    const fallback = buildFallbackItemFromDecision(decision);
    if (!fallback) continue;

    const overlayApplicationId = fallback.applicationId;
    if (overlayApplicationId && applicationItems.has(overlayApplicationId)) {
      const current = applicationItems.get(overlayApplicationId)!;
      current.priority = maxPriority(current.priority, fallback.priority);
      continue;
    }

    items.push(fallback);
  }

  for (const lease of leases) {
    const leaseId = asString(lease.id, 240);
    if (!leaseId) continue;
    const leaseExecution = deriveLeaseExecution({
      leaseId,
      documentUrl: asString(lease.documentUrl, 400),
      status: asString(lease.status, 80),
      raw: lease,
    });

    if (!["ready_for_landlord_signature", "tenant_signed", "landlord_signed"].includes(leaseExecution.executionStatus)) {
      continue;
    }

    const linkedApplicationId = asString(lease.applicationId, 240);
    if (linkedApplicationId && applicationItems.has(linkedApplicationId)) {
      continue;
    }

    const completed = leaseExecution.executionStatus === "landlord_signed";
    items.push({
      id: `lease:${leaseId}`,
      type: "lease",
      subjectId: leaseId,
      applicationId: linkedApplicationId,
      leaseId,
      title: leaseExecution.executionLabel,
      description: leaseExecution.executionDescription,
      priority:
        leaseExecution.executionStatus === "ready_for_landlord_signature"
          ? "high"
          : leaseExecution.executionStatus === "tenant_signed"
          ? "medium"
          : "low",
      status: completed ? "completed" : "action_required",
      nextAction: completed ? "no_action" : "prepare_lease",
      nextActionHref: `/leases/${encodeURIComponent(leaseId)}/ledger`,
      trustSummary: null,
      credibilitySummary: null,
      networkReuseSummary: null,
      source: "lease_execution",
    });
  }

  const orderedItems = sortItems(items);
  return {
    items: orderedItems,
    summary: {
      actionRequired: orderedItems.filter((item) => item.status === "action_required").length,
      pending: orderedItems.filter((item) => item.status === "pending").length,
      completed: orderedItems.filter((item) => item.status === "completed").length,
    },
  };
}
