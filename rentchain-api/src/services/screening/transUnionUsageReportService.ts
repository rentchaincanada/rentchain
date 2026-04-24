import { db } from "../../config/firebase";
import { CANONICAL_EVENTS_COLLECTION } from "../../lib/events/buildEvent";
import type { CanonicalEventV1 } from "../../lib/events/eventTypes";
import { TRANSUNION_USAGE_EVENT_TYPES } from "./transUnionUsageEvents";

export type TransUnionUsagePeriodLabel =
  | "last_30_days"
  | "last_60_days"
  | "last_90_days"
  | "custom";

type LoadTransUnionUsageReportInput = {
  period?: string | null;
  startDate?: string | null;
  endDate?: string | null;
};

type TransUnionUsageFunnel = {
  optionViewed: number;
  getAccessClicks: number;
  haveCredentialsClicks: number;
  credentialSubmissions: number;
  connectionSuccesses: number;
  connectionFailures: number;
  firstScreeningInitiated: number;
  repeatScreeningUsers: number;
};

type TransUnionUsageSummary = {
  activeConnectedLandlords: number;
  totalScreeningRequests: number;
  completedScreenings: number;
  inProgressScreenings: number;
  blockedScreenings: number;
  manualReviewScreenings: number;
  averageScreeningsPerConnectedLandlord: number;
  repeatUsageRate: number;
};

type TransUnionUsageCompliance = {
  tenantConsentCapturedRate: number;
  permissiblePurposeConfirmedRate: number;
  auditCoverageRate: number;
  requestsBlockedForMissingConsent: number;
  requestsBlockedForMissingProviderConnection: number;
};

type TransUnionUsageQuality = {
  completionRate: number;
  manualReviewRate: number;
  failedOrBlockedRate: number;
  credentialConnectionFailureRate: number;
  averageTimeFromApplicationToScreeningRequestMinutes: number | null;
};

export type TransUnionUsageReport = {
  ok: true;
  providerKey: "transunion";
  period: {
    label: TransUnionUsagePeriodLabel;
    startDate: string;
    endDate: string;
  };
  funnel: TransUnionUsageFunnel;
  usage: TransUnionUsageSummary;
  compliance: TransUnionUsageCompliance;
  quality: TransUnionUsageQuality;
  report: {
    executiveSummary: {
      headline: string;
      confidentialityNote: string;
      keyMetrics: Record<string, number>;
    };
    onboardingFunnel: TransUnionUsageFunnel;
    screeningVolume: TransUnionUsageSummary;
    complianceControls: TransUnionUsageCompliance;
    workflowDescription: {
      steps: string[];
    };
    landlordAdoptionInsights: {
      landlordCounts: {
        viewers: number;
        connected: number;
        repeatUsers: number;
      };
      mostCommonBlockedReason: string | null;
    };
    operationalQuality: TransUnionUsageQuality;
    partnershipReadiness: {
      notes: string[];
    };
    appendix: {
      eventDefinitions: string[];
      dataExclusions: string[];
    };
  };
};

const VALID_USAGE_EVENT_TYPES = new Set<string>(TRANSUNION_USAGE_EVENT_TYPES);

function toIsoDateBoundary(value: Date, mode: "start" | "end"): string {
  const copy = new Date(value.getTime());
  if (mode === "start") {
    copy.setUTCHours(0, 0, 0, 0);
  } else {
    copy.setUTCHours(23, 59, 59, 999);
  }
  return copy.toISOString();
}

function parsePeriod(input: LoadTransUnionUsageReportInput): TransUnionUsageReport["period"] {
  const now = new Date();
  const period = String(input.period || "").trim().toLowerCase();
  if (period === "last_60_days") {
    return {
      label: "last_60_days",
      startDate: toIsoDateBoundary(new Date(now.getTime() - 59 * 24 * 60 * 60 * 1000), "start"),
      endDate: toIsoDateBoundary(now, "end"),
    };
  }
  if (period === "last_90_days") {
    return {
      label: "last_90_days",
      startDate: toIsoDateBoundary(new Date(now.getTime() - 89 * 24 * 60 * 60 * 1000), "start"),
      endDate: toIsoDateBoundary(now, "end"),
    };
  }
  if (input.startDate || input.endDate) {
    const start = input.startDate ? new Date(input.startDate) : new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
    const end = input.endDate ? new Date(input.endDate) : now;
    return {
      label: "custom",
      startDate: toIsoDateBoundary(start, "start"),
      endDate: toIsoDateBoundary(end, "end"),
    };
  }
  return {
    label: "last_30_days",
    startDate: toIsoDateBoundary(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000), "start"),
    endDate: toIsoDateBoundary(now, "end"),
  };
}

function toFinite(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function roundMetric(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function ratio(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return roundMetric(numerator / denominator);
}

function requestKeyForEvent(event: CanonicalEventV1): string | null {
  const metadata = (event.metadata || {}) as Record<string, unknown>;
  const orderId = String(metadata.orderId || metadata.screeningRequestId || "").trim();
  if (orderId) return orderId;
  const resourceId = String(event.resource?.id || "").trim();
  if (event.resource?.type === "screening_order" && resourceId) return resourceId;
  const applicationId = String(metadata.applicationId || event.resource?.id || "").trim();
  return applicationId || null;
}

function landlordIdForEvent(event: CanonicalEventV1): string | null {
  const metadata = (event.metadata || {}) as Record<string, unknown>;
  return String(metadata.landlordId || event.actor?.id || event.resource?.parentId || "").trim() || null;
}

function buildUsageReport(events: CanonicalEventV1[], period: TransUnionUsageReport["period"]): TransUnionUsageReport {
  const filtered = events.filter((event) => {
    const type = String(event.type || "").trim();
    if (!VALID_USAGE_EVENT_TYPES.has(type)) return false;
    const providerKey = String((event.metadata || {})?.providerKey || "").trim().toLowerCase();
    return providerKey === "transunion" || type.startsWith("tu_");
  });

  const countByType = new Map<string, number>();
  const landlordRequestCounts = new Map<string, number>();
  const connectedLandlords = new Set<string>();
  const consentApplicationIds = new Set<string>();
  const permissibleLandlordIds = new Set<string>();
  const requestLifecycle = new Map<
    string,
    {
      landlordId: string | null;
      created: boolean;
      submitted: boolean;
      completed: boolean;
      blocked: boolean;
      manualReview: boolean;
      failed: boolean;
      applicationCreatedAtMs: number | null;
      requestCreatedAtMs: number | null;
      blockedReason: string | null;
    }
  >();

  for (const event of filtered) {
    const type = String(event.type || "").trim();
    countByType.set(type, (countByType.get(type) || 0) + 1);

    const landlordId = landlordIdForEvent(event);
    if (type === "tu_connected" && landlordId) {
      connectedLandlords.add(landlordId);
    }
    if (type === "screening_permissible_purpose_confirmed" && landlordId) {
      permissibleLandlordIds.add(landlordId);
    }
    if (type === "screening_consent_confirmed") {
      const applicationId = String((event.metadata || {})?.applicationId || event.resource?.id || "").trim();
      if (applicationId) consentApplicationIds.add(applicationId);
    }

    if (
      type !== "screening_request_created" &&
      type !== "screening_request_submitted" &&
      type !== "screening_completed" &&
      type !== "screening_blocked"
    ) {
      continue;
    }

    const requestKey = requestKeyForEvent(event);
    if (!requestKey) continue;
    const existing = requestLifecycle.get(requestKey) || {
      landlordId,
      created: false,
      submitted: false,
      completed: false,
      blocked: false,
      manualReview: false,
      failed: false,
      applicationCreatedAtMs: null,
      requestCreatedAtMs: null,
      blockedReason: null,
    };
    existing.landlordId = existing.landlordId || landlordId;
    const metadata = (event.metadata || {}) as Record<string, unknown>;
    if (type === "screening_request_created") {
      existing.created = true;
      const appCreatedAt = Date.parse(String(metadata.applicationCreatedAt || ""));
      existing.applicationCreatedAtMs = Number.isFinite(appCreatedAt)
        ? appCreatedAt
        : existing.applicationCreatedAtMs;
      const occurredAt = Date.parse(String(event.occurredAt || ""));
      existing.requestCreatedAtMs = Number.isFinite(occurredAt) ? occurredAt : existing.requestCreatedAtMs;
      if (landlordId) {
        landlordRequestCounts.set(landlordId, (landlordRequestCounts.get(landlordId) || 0) + 1);
        connectedLandlords.add(landlordId);
      }
    }
    if (type === "screening_request_submitted") {
      existing.submitted = true;
      if (landlordId) connectedLandlords.add(landlordId);
    }
    if (type === "screening_completed") {
      existing.completed = true;
      const status = String(event.status || "").trim().toLowerCase();
      existing.manualReview = existing.manualReview || status === "manual_review";
      existing.failed = existing.failed || status === "failed";
      if (landlordId) connectedLandlords.add(landlordId);
    }
    if (type === "screening_blocked") {
      existing.blocked = true;
      existing.blockedReason =
        String(metadata.blockReason || metadata.reason || existing.blockedReason || "").trim() || null;
    }
    requestLifecycle.set(requestKey, existing);
  }

  const requests = Array.from(requestLifecycle.values());
  const totalScreeningRequests = requests.length;
  const completedScreenings = requests.filter((item) => item.completed).length;
  const blockedScreenings = requests.filter((item) => item.blocked).length;
  const manualReviewScreenings = requests.filter((item) => item.manualReview).length;
  const inProgressScreenings = requests.filter((item) => !item.completed && !item.blocked).length;
  const repeatScreeningUsers = Array.from(landlordRequestCounts.values()).filter((count) => count > 1).length;
  const firstScreeningInitiated = Array.from(landlordRequestCounts.values()).filter((count) => count >= 1).length;
  const activeConnectedLandlords = connectedLandlords.size;
  const averageScreeningsPerConnectedLandlord = ratio(totalScreeningRequests, activeConnectedLandlords || 1);
  const repeatUsageRate = ratio(repeatScreeningUsers, activeConnectedLandlords || 1);
  const requestsBlockedForMissingConsent = requests.filter(
    (item) => item.blockedReason === "missing_consent"
  ).length;
  const requestsBlockedForMissingProviderConnection = requests.filter(
    (item) => item.blockedReason === "missing_provider_connection"
  ).length;
  const auditedRequests = requests.filter(
    (item) => item.created && (item.submitted || item.completed || item.blocked)
  ).length;
  const requestDurations = requests
    .map((item) =>
      item.applicationCreatedAtMs != null && item.requestCreatedAtMs != null
        ? (item.requestCreatedAtMs - item.applicationCreatedAtMs) / 60000
        : null
    )
    .filter((value): value is number => value != null && Number.isFinite(value) && value >= 0);
  const averageTimeFromApplicationToScreeningRequestMinutes = requestDurations.length
    ? roundMetric(requestDurations.reduce((sum, value) => sum + value, 0) / requestDurations.length)
    : null;
  const blockedReasons = requests.reduce<Record<string, number>>((acc, item) => {
    const key = String(item.blockedReason || "").trim();
    if (!key) return acc;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const mostCommonBlockedReason =
    Object.entries(blockedReasons).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  const funnel = {
    optionViewed: countByType.get("tu_option_viewed") || 0,
    getAccessClicks: countByType.get("tu_get_access_clicked") || 0,
    haveCredentialsClicks: countByType.get("tu_have_credentials_clicked") || 0,
    credentialSubmissions: countByType.get("tu_credentials_submitted") || 0,
    connectionSuccesses: countByType.get("tu_connected") || 0,
    connectionFailures: countByType.get("tu_connection_failed") || 0,
    firstScreeningInitiated,
    repeatScreeningUsers,
  };

  const usage = {
    activeConnectedLandlords,
    totalScreeningRequests,
    completedScreenings,
    inProgressScreenings,
    blockedScreenings,
    manualReviewScreenings,
    averageScreeningsPerConnectedLandlord,
    repeatUsageRate,
  };

  const compliance = {
    tenantConsentCapturedRate: ratio(consentApplicationIds.size, totalScreeningRequests || 1),
    permissiblePurposeConfirmedRate: ratio(permissibleLandlordIds.size, activeConnectedLandlords || 1),
    auditCoverageRate: ratio(auditedRequests, totalScreeningRequests || 1),
    requestsBlockedForMissingConsent,
    requestsBlockedForMissingProviderConnection,
  };

  const quality = {
    completionRate: ratio(completedScreenings, totalScreeningRequests || 1),
    manualReviewRate: ratio(manualReviewScreenings, totalScreeningRequests || 1),
    failedOrBlockedRate: ratio(
      requests.filter((item) => item.failed || item.blocked).length,
      totalScreeningRequests || 1
    ),
    credentialConnectionFailureRate: ratio(
      funnel.connectionFailures,
      funnel.credentialSubmissions || 1
    ),
    averageTimeFromApplicationToScreeningRequestMinutes,
  };

  return {
    ok: true,
    providerKey: "transunion",
    period,
    funnel,
    usage,
    compliance,
    quality,
    report: {
      executiveSummary: {
        headline:
          "RentChain tracks TransUnion onboarding, screening workflow usage, and compliance coverage as an internal admin report.",
        confidentialityNote:
          "Aggregated platform metrics only. No raw credit report contents, no tenant PII, and no credential secrets are included.",
        keyMetrics: {
          totalLandlordsExposedToOption: funnel.optionViewed,
          successfulConnections: funnel.connectionSuccesses,
          totalScreeningRequests: usage.totalScreeningRequests,
          completedScreenings: usage.completedScreenings,
          auditCoverageRate: compliance.auditCoverageRate,
        },
      },
      onboardingFunnel: funnel,
      screeningVolume: usage,
      complianceControls: compliance,
      workflowDescription: {
        steps: [
          "Application is created or reviewed in RentChain.",
          "Landlord opens the TransUnion connection flow or uses an existing connection.",
          "Tenant consent is confirmed before screening request creation.",
          "Permissible-use confirmation is captured during credential connection/update.",
          "RentChain records request creation, submission, status changes, and blocks in canonical events.",
        ],
      },
      landlordAdoptionInsights: {
        landlordCounts: {
          viewers: funnel.optionViewed,
          connected: usage.activeConnectedLandlords,
          repeatUsers: funnel.repeatScreeningUsers,
        },
        mostCommonBlockedReason,
      },
      operationalQuality: quality,
      partnershipReadiness: {
        notes: [
          "RentChain is positioned as the workflow, consent, and audit layer.",
          "The report is landlord-by-landlord and TransUnion-connection aware.",
          "No raw screening report data is returned in this endpoint.",
        ],
      },
      appendix: {
        eventDefinitions: [...TRANSUNION_USAGE_EVENT_TYPES],
        dataExclusions: [
          "No raw credit report contents",
          "No passcodes or member codes",
          "No tenant personal information",
          "No landlord customer list in the default response",
        ],
      },
    },
  };
}

export async function loadTransUnionUsageReport(
  input: LoadTransUnionUsageReportInput = {}
): Promise<TransUnionUsageReport> {
  const period = parsePeriod(input);
  const snapshot = await db
    .collection(CANONICAL_EVENTS_COLLECTION)
    .where("occurredAt", ">=", period.startDate)
    .where("occurredAt", "<=", period.endDate)
    .get();
  const events = snapshot.docs.map((doc: any) => doc.data()) as CanonicalEventV1[];
  return buildUsageReport(events, period);
}

export const __testing = {
  buildUsageReport,
  parsePeriod,
};
