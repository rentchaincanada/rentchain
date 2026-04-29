type LeaseLifecycleStatus =
  | "active"
  | "expiring_soon"
  | "renewal_pending"
  | "no_response"
  | "renewed"
  | "ending"
  | "expired"
  | "blocked";

type LeaseLifecycleRequiredNextAction =
  | "review_expiring_lease"
  | "prepare_renewal_notice"
  | "follow_up_response"
  | "review_renewal_outcome"
  | "review_move_out"
  | "none";

type LeaseLifecycleRenewalOutcome =
  | "not_started"
  | "pending_response"
  | "renewed"
  | "tenant_quitting"
  | "no_response"
  | "not_applicable";

type LeaseLifecycleHistoryItemType =
  | "lease_started"
  | "notice_prepared"
  | "notice_sent"
  | "tenant_response_pending"
  | "renewed"
  | "tenant_quitting"
  | "expired";

export type LeaseLifecycleHistoryItem = {
  type: LeaseLifecycleHistoryItemType;
  label: string;
  occurredAt?: string;
};

export type LeaseLifecycleSummary = {
  lifecycleStatus: LeaseLifecycleStatus;
  lifecycleLabel: string;
  lifecycleDescription: string;
  requiredNextAction: LeaseLifecycleRequiredNextAction;
  renewalOutcome: LeaseLifecycleRenewalOutcome;
  daysUntilExpiry?: number;
  history: LeaseLifecycleHistoryItem[];
};

type LeaseLifecycleInput = {
  lease: {
    status?: string | null;
    leaseStartDate?: string | null;
    startDate?: string | null;
    leaseEndDate?: string | null;
    endDate?: string | null;
    nextNoticeDueAt?: number | string | null;
  } | null;
  latestNotice?: {
    tenantResponse?: string | null;
    responseDeadlineAt?: number | string | null;
    createdAt?: number | string | null;
    updatedAt?: number | string | null;
    sentAt?: number | string | null;
  } | null;
  noResponse?: boolean;
  now?: number;
  expiringWindowMs?: number;
};

const DEFAULT_EXPIRING_WINDOW_MS = 120 * 24 * 60 * 60 * 1000;
const CURRENT_LIFECYCLE_STATUSES = new Set([
  "active",
  "notice_pending",
  "renewal_pending",
  "renewal_accepted",
  "move_out_pending",
]);

function toMillis(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) {
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : null;
  }
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIso(value: unknown): string | undefined {
  const ts = toMillis(value);
  return ts ? new Date(ts).toISOString() : undefined;
}

function normalizeStatus(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function normalizeResponse(value: unknown): string {
  return String(value || "pending").trim().toLowerCase();
}

function buildBaseHistory(input: LeaseLifecycleInput, lifecycleStatus: LeaseLifecycleStatus): LeaseLifecycleHistoryItem[] {
  const history: LeaseLifecycleHistoryItem[] = [];
  const leaseStartedAt = toIso(input.lease?.leaseStartDate || input.lease?.startDate);
  if (leaseStartedAt) {
    history.push({
      type: "lease_started",
      label: "Lease started",
      occurredAt: leaseStartedAt,
    });
  }

  const latestNotice = input.latestNotice || null;
  if (latestNotice) {
    const noticePreparedAt = toIso(latestNotice.updatedAt || latestNotice.createdAt);
    if (noticePreparedAt) {
      history.push({
        type: "notice_prepared",
        label: "Renewal notice prepared",
        occurredAt: noticePreparedAt,
      });
    }
    const noticeSentAt = toIso(latestNotice.sentAt);
    if (noticeSentAt) {
      history.push({
        type: "notice_sent",
        label: "Renewal notice sent",
        occurredAt: noticeSentAt,
      });
    }
  }

  if (lifecycleStatus === "renewal_pending") {
    history.push({
      type: "tenant_response_pending",
      label: "Tenant response pending",
      occurredAt: toIso(latestNotice?.updatedAt || latestNotice?.createdAt),
    });
  }
  if (lifecycleStatus === "renewed") {
    history.push({
      type: "renewed",
      label: "Renewed",
      occurredAt: toIso(latestNotice?.updatedAt || latestNotice?.createdAt),
    });
  }
  if (lifecycleStatus === "ending") {
    history.push({
      type: "tenant_quitting",
      label: "Tenant ending lease",
      occurredAt: toIso(latestNotice?.updatedAt || latestNotice?.createdAt),
    });
  }
  if (lifecycleStatus === "expired") {
    history.push({
      type: "expired",
      label: "Lease expired",
      occurredAt: toIso(input.lease?.leaseEndDate || input.lease?.endDate),
    });
  }

  return history;
}

function buildSummary(
  lifecycleStatus: LeaseLifecycleStatus,
  requiredNextAction: LeaseLifecycleRequiredNextAction,
  renewalOutcome: LeaseLifecycleRenewalOutcome,
  daysUntilExpiry: number | undefined,
  input: LeaseLifecycleInput
): LeaseLifecycleSummary {
  const labels: Record<LeaseLifecycleStatus, { label: string; description: string }> = {
    active: {
      label: "Active",
      description: "This lease is currently active with no renewal follow-up needed right now.",
    },
    expiring_soon: {
      label: "Expiring soon",
      description: "This lease is approaching its notice timing and should be reviewed for renewal follow-through.",
    },
    renewal_pending: {
      label: "Renewal response pending",
      description: "A renewal notice is in progress and the tenant response is still pending.",
    },
    no_response: {
      label: "No response yet",
      description: "The tenant response deadline has passed without a recorded renewal response.",
    },
    renewed: {
      label: "Renewed",
      description: "The latest renewal outcome indicates the lease is continuing.",
    },
    ending: {
      label: "Tenant ending lease",
      description: "The latest renewal outcome indicates this lease is ending rather than renewing.",
    },
    expired: {
      label: "Expired",
      description: "The lease end date has passed and no active renewal outcome is visible.",
    },
    blocked: {
      label: "Needs review",
      description: "Lease lifecycle status could not be determined safely from the current lease record.",
    },
  };

  return {
    lifecycleStatus,
    lifecycleLabel: labels[lifecycleStatus].label,
    lifecycleDescription: labels[lifecycleStatus].description,
    requiredNextAction,
    renewalOutcome,
    ...(typeof daysUntilExpiry === "number" ? { daysUntilExpiry } : {}),
    history: buildBaseHistory(input, lifecycleStatus),
  };
}

export function deriveLeaseLifecycleSummary(input: LeaseLifecycleInput): LeaseLifecycleSummary {
  const lease = input.lease || null;
  const now = typeof input.now === "number" ? input.now : Date.now();
  const expiringWindowMs =
    typeof input.expiringWindowMs === "number" ? input.expiringWindowMs : DEFAULT_EXPIRING_WINDOW_MS;
  const status = normalizeStatus(lease?.status);
  const latestResponse = normalizeResponse(input.latestNotice?.tenantResponse);
  const noResponse = input.noResponse === true;
  const leaseEndAt = toMillis(lease?.leaseEndDate || lease?.endDate);
  const nextNoticeDueAt = toMillis(lease?.nextNoticeDueAt);
  const daysUntilExpiry =
    leaseEndAt && leaseEndAt >= now ? Math.ceil((leaseEndAt - now) / (24 * 60 * 60 * 1000)) : undefined;

  if (!lease || (!status && !leaseEndAt && !nextNoticeDueAt)) {
    return buildSummary("blocked", "none", "not_applicable", undefined, input);
  }

  if (latestResponse === "renew" || status === "renewal_accepted") {
    return buildSummary("renewed", "review_renewal_outcome", "renewed", daysUntilExpiry, input);
  }

  if (latestResponse === "quit" || status === "move_out_pending") {
    return buildSummary("ending", "review_move_out", "tenant_quitting", daysUntilExpiry, input);
  }

  if (noResponse || latestResponse === "no_response") {
    return buildSummary("no_response", "review_renewal_outcome", "no_response", daysUntilExpiry, input);
  }

  if (input.latestNotice && latestResponse === "pending") {
    return buildSummary("renewal_pending", "follow_up_response", "pending_response", daysUntilExpiry, input);
  }

  if (leaseEndAt && leaseEndAt < now) {
    return buildSummary("expired", "review_expiring_lease", "not_applicable", undefined, input);
  }

  if (nextNoticeDueAt && nextNoticeDueAt >= now && nextNoticeDueAt <= now + expiringWindowMs) {
    return buildSummary("expiring_soon", "prepare_renewal_notice", "not_started", daysUntilExpiry, input);
  }

  if (status && (CURRENT_LIFECYCLE_STATUSES.has(status) || status === "ended")) {
    return buildSummary("active", "none", "not_applicable", daysUntilExpiry, input);
  }

  return buildSummary("blocked", "none", "not_applicable", daysUntilExpiry, input);
}
