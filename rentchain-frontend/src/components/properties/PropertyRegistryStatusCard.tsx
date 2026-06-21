import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Pill } from "../ui/Ui";
import { fetchBillingPricing, type BillingPricingResponse } from "../../api/billingApi";
import { track } from "../../lib/analytics";
import {
  attachFilingReferenceAndNotes,
  createReadyFromDraft,
  createRegistryFilingRequest,
  extractRegistryUpgradeRequired,
  fetchPropertyRegistryStatus,
  fetchPropertyRegistrySubmission,
  readRegistryAcquisitionAttribution,
  retryRegistryFilingAttempt,
  updateRegistryFilingStatus,
  type Property,
  type PropertyRegistryReadiness,
  type PropertyRegistryStatus,
  type RegistrySubmissionDraft,
  type RegistrySubmissionFilingSummaryV3,
  type RegistrySubmissionLifecycleStatus,
  type RegistrySubmissionNormalizedSectionV3,
} from "../../api/propertiesApi";
import { useAuth } from "../../context/useAuth";
import { useEntitlements } from "../../hooks/useEntitlements";

type RegistryStatusPayload = Awaited<ReturnType<typeof fetchPropertyRegistryStatus>>;
type RegistrySubmissionPayload = Awaited<ReturnType<typeof fetchPropertyRegistrySubmission>>;

type RegistryUpgradeState = {
  capability: string;
  message: string;
  requiredPlan: string;
  location: string;
  paidUnlocks: string[];
  freeIncludes: string[];
};

type RegistryUpgradeVariantKey = "A" | "B" | "C";

type RegistryUpgradeVariant = {
  key: RegistryUpgradeVariantKey;
  headline: string;
  body: string;
  ctaLabel: string;
};

const REGISTRY_UPGRADE_VARIANTS: RegistryUpgradeVariant[] = [
  {
    key: "A",
    headline: "Upgrade to file and track submissions",
    body: "Unlock the filing workflow, retry safety, and audit tracking when you are ready to move beyond draft prep.",
    ctaLabel: "Upgrade to file",
  },
  {
    key: "B",
    headline: "Your filing is ready — unlock submission and tracking",
    body: "Turn a ready draft into a trackable filing workflow with lifecycle updates, attempts history, and status visibility.",
    ctaLabel: "Unlock submission workflow",
  },
  {
    key: "C",
    headline: "Avoid errors. File with retry and audit tracking",
    body: "Keep retry safety, attempt history, and a cleaner audit trail when a filing needs follow-up or correction.",
    ctaLabel: "Upgrade with retry safety",
  },
];

function hashVariantSeed(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function selectRegistryUpgradeVariant(seed: string): RegistryUpgradeVariant {
  const index = hashVariantSeed(seed) % REGISTRY_UPGRADE_VARIANTS.length;
  return REGISTRY_UPGRADE_VARIANTS[index];
}

function formatDate(value: string | null | undefined) {
  if (!value) return "--";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "--";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function statusLabel(status: PropertyRegistryStatus["registryStatus"]) {
  switch (status) {
    case "verified":
      return "Verified";
    case "pending_review":
      return "Pending municipal review";
    case "possible_mismatch":
      return "Possible mismatch detected";
    case "manual_review":
      return "Manual review in progress";
    case "not_found":
    default:
      return "No public match found";
  }
}

function readinessLabel(status: PropertyRegistryReadiness["readinessStatus"]) {
  switch (status) {
    case "verified":
      return "Verified";
    case "registry_ready":
      return "Registry-ready";
    case "manual_review_in_progress":
      return "Manual review";
    case "possible_mismatch":
      return "Possible mismatch";
    case "no_public_match":
      return "No public match";
    case "unsupported_jurisdiction":
      return "Unsupported";
    case "incomplete":
    default:
      return "Incomplete";
  }
}

function readinessTone(status: PropertyRegistryReadiness["readinessStatus"]) {
  if (
    status === "verified" ||
    status === "registry_ready" ||
    status === "possible_mismatch" ||
    status === "manual_review_in_progress"
  ) {
    return "accent";
  }
  return "muted";
}

function nextActionLabel(readiness: PropertyRegistryReadiness) {
  switch (readiness.nextRecommendedAction) {
    case "view_verified_details":
      return "View verified details";
    case "export_ready_draft":
      return readiness.mode === "registry_ready_fallback" ? "Export registry-ready draft" : "Export ready draft";
    case "complete_missing_fields":
      return readiness.mode === "registry_ready_fallback" ? "Complete registry-ready profile" : "Complete missing data";
    case "review_possible_match":
      return "Review discrepancy";
    case "resolve_mismatch":
      return "Review match";
    case "add_pid":
      return "Add PID";
    case "prepare_registry_submission":
      return readiness.assistant.ctaLabel;
    case "no_action_needed":
    default:
      return "No action needed";
  }
}

function readinessSummary(readiness: PropertyRegistryReadiness) {
  switch (readiness.readinessStatus) {
    case "verified":
      return "Verified against public registry data.";
    case "registry_ready":
      return "Registry-ready draft prepared and ready for export.";
    case "manual_review_in_progress":
      return "Manual review is in progress before the registry state can be confirmed.";
    case "possible_mismatch":
      return "A possible mismatch was detected and should be reviewed before relying on registry status.";
    case "no_public_match":
      return "No public match was found yet. You can still prepare this property for registry or compliance readiness.";
    case "unsupported_jurisdiction":
      return "This jurisdiction is not yet connected to a public registry workflow.";
    case "incomplete":
    default:
      return "Required data is still missing before this property is registry-ready.";
  }
}

function compactSupportingLine(readiness: PropertyRegistryReadiness) {
  switch (readiness.readinessStatus) {
    case "verified":
      return "Verified against public registry data.";
    case "registry_ready":
      return "Registry-ready draft is prepared.";
    case "manual_review_in_progress":
      return "Manual review is in progress.";
    case "possible_mismatch":
      return "Possible match requires manual review.";
    case "no_public_match":
      return "No public match found in available registry data.";
    case "unsupported_jurisdiction":
      return "No connected public registry workflow for this jurisdiction.";
    case "incomplete":
    default:
      return "Missing required data for a registry-ready draft.";
  }
}

// This card renders the registry readiness summary plus the latest filing workflow state.
function shouldShowCompactAssistantCta(readiness: PropertyRegistryReadiness) {
  return (
    readiness.nextRecommendedAction === "prepare_registry_submission" ||
    readiness.nextRecommendedAction === "complete_missing_fields" ||
    readiness.nextRecommendedAction === "export_ready_draft"
  );
}

function filingStatusLabel(status: RegistrySubmissionLifecycleStatus | "draft" | null) {
  switch (status) {
    case "draft":
      return "Draft";
    case "in_review":
      return "In review";
    case "ready_to_file":
      return "Ready to file";
    case "filed_pending_confirmation":
      return "Filed pending confirmation";
    case "filed_confirmed":
      return "Filed confirmed";
    case "rejected":
      return "Rejected";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return null;
  }
}

function filingStatusTone(status: RegistrySubmissionLifecycleStatus | "draft" | null): "accent" | "muted" {
  if (status === "ready_to_file" || status === "filed_pending_confirmation" || status === "filed_confirmed") {
    return "accent";
  }
  return "muted";
}

function resolvedWorkflowStatus(
  filing: RegistrySubmissionFilingSummaryV3 | null | undefined
): RegistrySubmissionLifecycleStatus | "draft" {
  return filing?.currentStatus || filing?.ready?.status || "draft";
}

type TimelineStep = {
  key: "draft" | RegistrySubmissionLifecycleStatus;
  label: string;
  active: boolean;
  complete: boolean;
  timestamp: string | null;
  actor: string | null;
};

function buildTimeline(
  draft: RegistrySubmissionDraft | null,
  filing: RegistrySubmissionFilingSummaryV3 | null | undefined
): TimelineStep[] {
  const current = resolvedWorkflowStatus(filing);
  const order: Array<TimelineStep["key"]> = [
    "draft",
    "ready_to_file",
    "filed_pending_confirmation",
    "filed_confirmed",
    "rejected",
    "failed",
    "cancelled",
  ];
  const completeKeys =
    current === "filed_confirmed"
      ? new Set<TimelineStep["key"]>(["draft", "ready_to_file", "filed_pending_confirmation"])
      : current === "rejected" || current === "failed" || current === "cancelled"
        ? new Set<TimelineStep["key"]>(["draft", "ready_to_file", "filed_pending_confirmation"])
        : current === "filed_pending_confirmation"
          ? new Set<TimelineStep["key"]>(["draft", "ready_to_file"])
          : current === "ready_to_file"
            ? new Set<TimelineStep["key"]>(["draft"])
            : current === "draft"
              ? new Set<TimelineStep["key"]>([])
              : new Set<TimelineStep["key"]>([]);

  return order.map((key) => {
    let timestamp: string | null = null;
    let actor: string | null = null;

    if (key === "draft") {
      timestamp = draft?.timestamps.updatedAt || null;
      actor = draft?.actor.updatedBy || null;
    } else if (key === "ready_to_file") {
      timestamp = filing?.ready?.createdAt || null;
      actor = filing?.ready?.actor.updatedBy || null;
    } else if (key === "filed_pending_confirmation") {
      timestamp = filing?.result?.submittedAt || null;
      actor = filing?.result?.actor.updatedBy || filing?.request?.actor.updatedBy || null;
    } else if (key === "filed_confirmed") {
      timestamp = filing?.result?.confirmedAt || null;
      actor = filing?.result?.actor.updatedBy || null;
    } else if (key === "rejected") {
      timestamp = filing?.result?.rejectedAt || null;
      actor = filing?.result?.actor.updatedBy || null;
    } else if (key === "failed") {
      timestamp = filing?.result?.failedAt || null;
      actor = filing?.result?.actor.updatedBy || null;
    } else if (key === "cancelled") {
      timestamp = filing?.result?.cancelledAt || null;
      actor = filing?.result?.actor.updatedBy || null;
    }

    return {
      key,
      label: filingStatusLabel(key)!,
      active: current === key,
      complete: current === key ? Boolean(timestamp) : completeKeys.has(key) || (key === "draft" && Boolean(timestamp)),
      timestamp,
      actor,
    };
  });
}

function renderFieldValue(value: RegistrySubmissionNormalizedSectionV3["fields"][number]["value"]) {
  if (value == null || value === "") return "--";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function collectHistoryItems(filing: RegistrySubmissionFilingSummaryV3 | null | undefined) {
  return (filing?.attempts || []).map((attempt, index) => ({
    key: attempt.attemptId,
    label: index === 0 ? `Latest filing attempt (#${attempt.attemptNumber})` : `Attempt #${attempt.attemptNumber}`,
    status: filingStatusLabel(attempt.status),
    timestamp: attempt.updatedAt || attempt.createdAt || null,
    referenceNumber: attempt.referenceNumbers?.[0]?.value || null,
    operatorNotes: attempt.operatorNotes || null,
    isLatest: index === 0,
  }));
}

function copyChecklistToClipboard(checklist: { steps: string[]; notes: string[]; portalUrl: string | null }) {
  const lines = [
    checklist.portalUrl ? `Portal: ${checklist.portalUrl}` : null,
    "Checklist:",
    ...checklist.steps.map((step, index) => `${index + 1}. ${step}`),
    checklist.notes.length ? "" : null,
    checklist.notes.length ? "Notes:" : null,
    ...checklist.notes,
  ].filter(Boolean);
  return writeToClipboard(lines.join("\n"));
}

function writeToClipboard(value: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    return Promise.reject(new Error("clipboard_unavailable"));
  }
  return navigator.clipboard.writeText(value);
}

function canSafelyUpdateBrowserState() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function scheduleCopyStateReset(setCopyState: React.Dispatch<React.SetStateAction<"idle" | "copied" | "failed">>) {
  if (typeof window === "undefined") return null;
  return window.setTimeout(() => setCopyState("idle"), 1800);
}

type Props = {
  property: Property | null;
  onOpenSubmissionAssistant?: () => void;
};

export const PropertyRegistryStatusCard: React.FC<Props> = ({ property, onOpenSubmissionAssistant }) => {
  const { user } = useAuth();
  const entitlements = useEntitlements();
  const [data, setData] = useState<RegistryStatusPayload | null>(null);
  const [submissionData, setSubmissionData] = useState<RegistrySubmissionPayload | null>(null);
  const [pricing, setPricing] = useState<BillingPricingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [upgradeState, setUpgradeState] = useState<RegistryUpgradeState | null>(null);
  const [workflowForm, setWorkflowForm] = useState({
    referenceNumber: "",
    notes: "",
    evidenceReference: "",
  });
  const viewedPromptKeysRef = React.useRef<Set<string>>(new Set());
  const lastPlanRef = React.useRef<string | null>(null);
  const conversionTrackedRef = React.useRef(false);
  const isMountedRef = React.useRef(true);
  const copyResetTimeoutRef = React.useRef<number | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (typeof window !== "undefined" && copyResetTimeoutRef.current != null) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
    };
  }, []);

  const propertyId = property?.id || null;

  const loadData = useCallback(async () => {
    if (!propertyId) {
      if (isMountedRef.current) {
        setData(null);
        setSubmissionData(null);
      }
      return;
    }
    try {
      if (isMountedRef.current) {
        setLoading(true);
        setError(null);
      }
      const [statusResult, submissionResult] = await Promise.all([
        fetchPropertyRegistryStatus(propertyId),
        fetchPropertyRegistrySubmission(propertyId),
      ]);
      if (isMountedRef.current) {
        setData(statusResult);
        setSubmissionData(submissionResult);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setError(err?.message || "Failed to load registry status");
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [propertyId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    let active = true;
    if (entitlements.hasCapability("registry_filing_access") && entitlements.hasCapability("registry_attempts_history")) {
      return () => {
        active = false;
      };
    }
    if (!canSafelyUpdateBrowserState()) {
      return () => {
        active = false;
      };
    }
    void fetchBillingPricing()
      .then((next) => {
        if (active && canSafelyUpdateBrowserState()) setPricing(next);
      })
      .catch(() => {
        if (active && canSafelyUpdateBrowserState()) setPricing(null);
      });
    return () => {
      active = false;
    };
  }, [entitlements]);

  const handleCopyPid = async () => {
    const pid = data?.pidPrompt.registryPid;
    if (!pid) return;
    try {
      await writeToClipboard(pid);
      setCopyState("copied");
      copyResetTimeoutRef.current = scheduleCopyStateReset(setCopyState);
    } catch {
      setCopyState("failed");
    }
  };

  const handleCopyChecklist = async () => {
    const checklist = data?.filing?.request?.checklist;
    if (!checklist) return;
    try {
      await copyChecklistToClipboard(checklist);
      setCopyState("copied");
      copyResetTimeoutRef.current = scheduleCopyStateReset(setCopyState);
    } catch {
      setCopyState("failed");
    }
  };

  const filing = data?.filing || null;
  const submission = submissionData?.submission || null;
  const userId = String(user?.id || "");
  const plan = String(entitlements.plan || user?.plan || "free");
  const hasRegistryFilingAccess = entitlements.isAdmin || entitlements.hasCapability("registry_filing_access");
  const hasRegistryAttemptsHistory =
    entitlements.isAdmin || entitlements.hasCapability("registry_attempts_history");
  const registryPricing = pricing?.registry?.filingWorkflow || null;
  const registryUpgradeLabel = registryPricing?.includedPlanKeys?.length
    ? `Included on ${registryPricing.includedPlanKeys
        .filter((plan) => plan !== "free")
        .map((plan) => plan[0].toUpperCase() + plan.slice(1))
        .join(" and ")}.`
    : "Included on Pro and Elite.";
  const workflowStatus = resolvedWorkflowStatus(filing);
  const latestAttempt = filing?.latestAttempt || null;
  const timeline = useMemo(() => buildTimeline(submission, filing), [submission, filing]);
  const canOpenAdminReview =
    typeof window !== "undefined" && window.location.pathname.startsWith("/admin") && Boolean(property?.id);
  const draftChangedSinceReady = Boolean(
    submission &&
      filing?.ready &&
      submission.timestamps.updatedAt &&
      filing.ready.audit.sourceDraftUpdatedAt &&
      new Date(submission.timestamps.updatedAt).getTime() > new Date(filing.ready.audit.sourceDraftUpdatedAt).getTime()
  );
  const checklistAvailable = Boolean(filing?.request?.checklist?.steps?.length);
  const filingHistory = collectHistoryItems(filing);
  const latestReference =
    latestAttempt?.referenceNumbers?.[0]?.value ||
    filing?.result?.referenceNumbers?.[0]?.value ||
    filing?.request?.referenceNumbers?.[0]?.value ||
    null;
  const registryUpgradeVariant = useMemo(
    () => selectRegistryUpgradeVariant(`${userId || "anonymous"}:${propertyId || "registry"}`),
    [propertyId, userId]
  );
  const acquisitionAttribution = useMemo(() => readRegistryAcquisitionAttribution(), []);

  const trackRegistryEvent = useCallback(
    (eventName: string, location: string, extra: Record<string, unknown> = {}) => {
      if (typeof window !== "undefined" && import.meta.env?.MODE !== "production") {
        console.info("[registry-pricing-event]", eventName, {
          propertyId,
          userId: userId || undefined,
          plan,
          location,
          variant: registryUpgradeVariant.key,
          source: acquisitionAttribution?.source || undefined,
          medium: acquisitionAttribution?.medium || undefined,
          campaign: acquisitionAttribution?.campaign || undefined,
          acquisitionVariant: acquisitionAttribution?.variant || undefined,
          ...extra,
        });
      }
      track(eventName, {
        propertyId,
        userId: userId || undefined,
        plan,
        location,
        variant: registryUpgradeVariant.key,
        source: acquisitionAttribution?.source || undefined,
        medium: acquisitionAttribution?.medium || undefined,
        campaign: acquisitionAttribution?.campaign || undefined,
        acquisitionVariant: acquisitionAttribution?.variant || undefined,
        landingPath: acquisitionAttribution?.landingPath || undefined,
        timestamp: new Date().toISOString(),
        ...extra,
      });
    },
    [acquisitionAttribution?.campaign, acquisitionAttribution?.landingPath, acquisitionAttribution?.medium, acquisitionAttribution?.source, acquisitionAttribution?.variant, plan, propertyId, registryUpgradeVariant.key, userId]
  );

  const runWorkflowAction = useCallback(
    async (runner: () => Promise<unknown>, meta?: { successEvent?: string; location?: string }) => {
      try {
        setActionLoading(true);
        setActionError(null);
        setUpgradeState(null);
        await runner();
        if (meta?.successEvent && meta.location) {
          trackRegistryEvent(meta.successEvent, meta.location);
        }
        setWorkflowForm({ referenceNumber: "", notes: "", evidenceReference: "" });
        await loadData();
      } catch (err: any) {
        const upgradeRequired = extractRegistryUpgradeRequired(err);
        if (upgradeRequired) {
          const paidUnlocks = upgradeRequired.monetization?.paidUnlocks || [];
          const freeIncludes = upgradeRequired.monetization?.freeIncludes || [];
          setUpgradeState({
            capability: upgradeRequired.requiredCapability || upgradeRequired.capability,
            message: upgradeRequired.message || "Upgrade to unlock filing workflow.",
            requiredPlan: upgradeRequired.requiredPlan || "pro",
            location: meta?.location || "action_panel",
            paidUnlocks,
            freeIncludes,
          });
          trackRegistryEvent(
            upgradeRequired.requiredCapability === "registry_attempts_history"
              ? "registry_attempts_history_gate_hit"
              : meta?.location === "retry_button"
                ? "registry_retry_gate_hit"
                : "registry_filing_gate_hit",
            meta?.location || "action_panel",
            {
              capability: upgradeRequired.requiredCapability || upgradeRequired.capability,
              requiredPlan: upgradeRequired.requiredPlan || "pro",
            }
          );
          setActionError(upgradeRequired.message || "Upgrade to unlock filing workflow.");
        } else {
          setActionError(err?.message || "Unable to update the filing workflow right now.");
        }
      } finally {
        setActionLoading(false);
      }
    },
    [loadData, trackRegistryEvent]
  );

  const openRegistryUpgrade = useCallback((override?: Partial<RegistryUpgradeState>) => {
    const payload = override || upgradeState;
    if (payload?.capability && payload?.location) {
      trackRegistryEvent("registry_upgrade_clicked", payload.location, {
        capability: payload.capability,
        requiredPlan: payload.requiredPlan || "pro",
      });
    }
    if (typeof window !== "undefined") {
      window.location.assign("/pricing?feature=registry_filing_access");
    }
  }, [trackRegistryEvent, upgradeState]);

  const showFilingWorkflowUpgrade =
    !hasRegistryFilingAccess &&
    (workflowStatus === "ready_to_file" ||
      workflowStatus === "filed_pending_confirmation" ||
      workflowStatus === "rejected" ||
      workflowStatus === "failed" ||
      workflowStatus === "cancelled");
  const showAttemptsHistoryUpgrade = !hasRegistryAttemptsHistory;

  useEffect(() => {
    if (showFilingWorkflowUpgrade) {
      const key = `filing:${propertyId}:${registryUpgradeVariant.key}:${workflowStatus}`;
      if (!viewedPromptKeysRef.current.has(key)) {
        viewedPromptKeysRef.current.add(key);
        trackRegistryEvent("registry_upgrade_prompt_viewed", "action_panel", {
          capability: upgradeState?.capability || "registry_filing_access",
          promptType: "filing_workflow",
          workflowStatus,
        });
      }
    }
  }, [propertyId, registryUpgradeVariant.key, showFilingWorkflowUpgrade, trackRegistryEvent, upgradeState?.capability, workflowStatus]);

  useEffect(() => {
    if (detailsOpen && showAttemptsHistoryUpgrade) {
      const key = `history:${propertyId}:${registryUpgradeVariant.key}`;
      if (!viewedPromptKeysRef.current.has(key)) {
        viewedPromptKeysRef.current.add(key);
        trackRegistryEvent("registry_attempts_history_gate_hit", "history_panel", {
          capability: "registry_attempts_history",
        });
        trackRegistryEvent("registry_upgrade_prompt_viewed", "history_panel", {
          capability: "registry_attempts_history",
          promptType: "attempts_history",
        });
      }
    }
  }, [detailsOpen, propertyId, registryUpgradeVariant.key, showAttemptsHistoryUpgrade, trackRegistryEvent]);

  useEffect(() => {
    const previousPlan = lastPlanRef.current;
    if (
      previousPlan &&
      previousPlan !== plan &&
      hasRegistryFilingAccess &&
      viewedPromptKeysRef.current.size > 0 &&
      !conversionTrackedRef.current
    ) {
      conversionTrackedRef.current = true;
      trackRegistryEvent("registry_upgrade_converted", "status_card", {
        previousPlan,
      });
    }
    lastPlanRef.current = plan;
  }, [hasRegistryFilingAccess, plan, trackRegistryEvent]);

  const dismissUpgradePrompt = useCallback(
    (location: string) => {
      if (showFilingWorkflowUpgrade || showAttemptsHistoryUpgrade || upgradeState) {
        trackRegistryEvent("registry_upgrade_dismissed", location, {
          capability:
            upgradeState?.capability ||
            (showAttemptsHistoryUpgrade ? "registry_attempts_history" : "registry_filing_access"),
        });
      }
    },
    [showFilingWorkflowUpgrade, showAttemptsHistoryUpgrade, trackRegistryEvent, upgradeState]
  );

  return (
    <Card style={{ display: "grid", gap: 10, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 12, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6 }}>
            Compliance / Registry
          </div>
          <div style={{ fontSize: 15, fontWeight: 800 }}>Registry readiness</div>
          {!loading && data?.readiness ? (
            <div style={{ color: "#64748b", fontSize: 12 }}>
              {data.readiness.schemaLabel}
              {data.readiness.readinessStatus !== "verified" ? ` · ${data.readiness.completionPercent}% complete` : ""}
            </div>
          ) : null}
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {data?.readiness ? <Pill tone={readinessTone(data.readiness.readinessStatus)}>{readinessLabel(data.readiness.readinessStatus)}</Pill> : null}
          {!loading && data ? (
            <Button type="button" variant="secondary" onClick={() => setDetailsOpen(true)} style={{ padding: "6px 10px", fontSize: 12 }}>
              View details
            </Button>
          ) : null}
        </div>
      </div>

      {loading ? <div style={{ color: "#475569" }}>Checking registry and readiness…</div> : null}
      {!loading && error ? <div style={{ color: "#b91c1c" }}>{error}</div> : null}

      {!loading && data?.readiness ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {filingStatusLabel(workflowStatus) ? (
            <Pill tone={filingStatusTone(workflowStatus)}>{filingStatusLabel(workflowStatus)}</Pill>
          ) : null}
          {onOpenSubmissionAssistant && shouldShowCompactAssistantCta(data.readiness) ? (
            <Button type="button" onClick={onOpenSubmissionAssistant} style={{ padding: "6px 10px", fontSize: 12 }}>
              {data.readiness.assistant.ctaLabel}
            </Button>
          ) : null}
        </div>
      ) : null}

      {detailsOpen && data && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Compliance and registry details"
          onMouseDown={() => {
            dismissUpgradePrompt("status_card");
            setDetailsOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.46)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 1300,
          }}
        >
          <div
            onMouseDown={(event) => event.stopPropagation()}
            style={{
              width: "min(920px, 100%)",
              maxHeight: "88vh",
              overflow: "auto",
              background: "#fff",
              borderRadius: 18,
              padding: 18,
              display: "grid",
              gap: 16,
              boxShadow: "0 22px 70px rgba(15,23,42,0.22)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6 }}>
                  Compliance / Registry
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>Readiness and filing workflow</div>
                <div style={{ color: "#475569", lineHeight: 1.5 }}>{readinessSummary(data.readiness)}</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <Pill tone={readinessTone(data.readiness.readinessStatus)}>{readinessLabel(data.readiness.readinessStatus)}</Pill>
                {filingStatusLabel(workflowStatus) ? (
                  <Pill tone={filingStatusTone(workflowStatus)}>{filingStatusLabel(workflowStatus)}</Pill>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    dismissUpgradePrompt("status_card");
                    setDetailsOpen(false);
                  }}
                >
                  Close
                </Button>
              </div>
            </div>

            {draftChangedSinceReady ? (
              <div
                style={{
                  display: "grid",
                  gap: 8,
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(245,158,11,0.28)",
                  background: "rgba(254,243,199,0.4)",
                }}
              >
                <div style={{ fontWeight: 700, color: "#92400e" }}>Draft has changed since this filing package was prepared</div>
                <div style={{ color: "#78350f", fontSize: 14 }}>
                  Review the updated draft and regenerate the filing package before taking the next filing step.
                </div>
                {(workflowStatus === "draft" || workflowStatus === "in_review" || workflowStatus === "ready_to_file") && (
                  <div>
                    <Button
                      type="button"
                      onClick={() =>
                        void runWorkflowAction(() => createReadyFromDraft(String(propertyId)), {
                          successEvent: "registry_ready_created",
                          location: "status_card",
                        })
                      }
                    >
                      Regenerate filing package
                    </Button>
                  </div>
                )}
              </div>
            ) : null}

            <div
              style={{
                display: "grid",
                gap: 10,
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid rgba(15,23,42,0.08)",
                background: "rgba(15,23,42,0.03)",
              }}
            >
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <Pill tone="muted">{data.readiness.schemaLabel}</Pill>
                <Pill tone="muted">{data.readiness.completionPercent}% complete</Pill>
                <Pill tone="muted">Score {data.readiness.readinessScore}</Pill>
              </div>
              <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
                <div>
                  <strong>Jurisdiction:</strong>{" "}
                  {[data.readiness.jurisdiction.municipality, data.readiness.jurisdiction.province, data.readiness.jurisdiction.country]
                    .filter(Boolean)
                    .join(", ")}
                </div>
                <div>
                  <strong>Registry state:</strong> {data.readiness.currentRegistryState.summary}
                </div>
                <div>
                  <strong>Next action:</strong> {nextActionLabel(data.readiness)}
                </div>
                {filingStatusLabel(data.filing?.currentStatus) ? (
                  <div>
                    <strong>Filing status:</strong> {filingStatusLabel(data.filing.currentStatus)}
                  </div>
                ) : null}
              </div>
              {data.readiness.topMissingItems.length ? (
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontWeight: 700, color: "#0f172a" }}>Top missing items</div>
                  {data.readiness.topMissingItems.slice(0, 5).map((item) => (
                    <div key={`${item.category}-${item.headline}`} style={{ color: "#475569", fontSize: 14 }}>
                      • {item.headline}
                      {item.count > 1 ? ` (${item.count})` : ""}
                    </div>
                  ))}
                </div>
              ) : null}
              {data.readiness.warnings.length ? (
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontWeight: 700, color: "#0f172a" }}>Warnings</div>
                  {data.readiness.warnings.map((warning, index) => (
                    <div key={`${warning}-${index}`} style={{ color: "#475569", fontSize: 14 }}>
                      • {warning}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div
              style={{
                display: "grid",
                gap: 12,
                padding: "14px 16px",
                borderRadius: 14,
                border: "1px solid rgba(15,23,42,0.08)",
                background: "#fff",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ fontWeight: 700, color: "#0f172a" }}>Filing timeline</div>
                {filingStatusLabel(workflowStatus) ? (
                  <Pill tone={filingStatusTone(workflowStatus)}>{filingStatusLabel(workflowStatus)}</Pill>
                ) : null}
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                {timeline.map((step) => (
                  <div
                    key={step.key}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "24px 1fr",
                      gap: 12,
                      alignItems: "start",
                    }}
                  >
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 999,
                        marginTop: 4,
                        background: step.active ? "#2563eb" : step.complete ? "#22c55e" : "#e2e8f0",
                        boxShadow: step.active ? "0 0 0 4px rgba(37,99,235,0.14)" : "none",
                      }}
                    />
                    <div style={{ display: "grid", gap: 4 }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <div style={{ fontWeight: step.active ? 800 : 700, color: "#0f172a" }}>{step.label}</div>
                        {step.active ? <Pill tone="accent">Current</Pill> : null}
                      </div>
                      <div style={{ color: "#64748b", fontSize: 13 }}>
                        {step.timestamp !== null ? `${formatDateTime(step.timestamp)}${step.actor ? ` • ${step.actor}` : ""}` : "Not reached yet"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              }}
            >
              <Card style={{ display: "grid", gap: 12 }}>
                <div style={{ fontWeight: 700, color: "#0f172a" }}>Filing actions</div>
                <div style={{ color: "#475569", fontSize: 14 }}>
                  Only the next valid workflow actions are shown for the current filing state.
                </div>
                <label style={{ display: "grid", gap: 6 }}>
                  <span>Reference number</span>
                  <Input
                    value={workflowForm.referenceNumber}
                    onChange={(event) => setWorkflowForm((current) => ({ ...current, referenceNumber: event.target.value }))}
                    placeholder="e.g. SUB-12345"
                  />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span>Notes</span>
                  <Input
                    value={workflowForm.notes}
                    onChange={(event) => setWorkflowForm((current) => ({ ...current, notes: event.target.value }))}
                    placeholder="Operator notes or outcome details"
                  />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span>Evidence reference</span>
                  <Input
                    value={workflowForm.evidenceReference}
                    onChange={(event) => setWorkflowForm((current) => ({ ...current, evidenceReference: event.target.value }))}
                    placeholder="Email subject, screenshot note, or internal reference"
                  />
                </label>
                {showFilingWorkflowUpgrade || upgradeState ? (
                  <div
                    style={{
                      display: "grid",
                      gap: 8,
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: "1px solid rgba(37,99,235,0.16)",
                      background: "rgba(37,99,235,0.06)",
                    }}
                  >
                    <div style={{ fontWeight: 700, color: "#0f172a" }}>Unlock filing workflow</div>
                    <div style={{ color: "#475569", fontSize: 14, lineHeight: 1.5 }}>
                      {registryUpgradeVariant.headline}
                    </div>
                    <div style={{ color: "#475569", fontSize: 13 }}>
                      {upgradeState?.message || registryUpgradeVariant.body} Free includes{" "}
                      {(upgradeState?.freeIncludes || registryPricing?.freeIncludes || ["draft", "readiness", "export"]).join(", ")}.
                      Paid filing adds{" "}
                      {(upgradeState?.paidUnlocks || registryPricing?.paidUnlocks || [
                        "filing workflow",
                        "retry safety",
                        "attempt history",
                        "audit tracking",
                      ]).join(", ")}
                      . {registryUpgradeLabel}
                    </div>
                    <div>
                      <Button type="button" onClick={openRegistryUpgrade}>
                        {registryUpgradeVariant.ctaLabel}
                      </Button>
                    </div>
                  </div>
                ) : null}
                {actionError ? <div style={{ color: "#b91c1c", fontSize: 14 }}>{actionError}</div> : null}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {(workflowStatus === "draft" || workflowStatus === "in_review") && (
                    <Button
                      type="button"
                      disabled={actionLoading}
                      onClick={() =>
                        void runWorkflowAction(() => createReadyFromDraft(String(propertyId)), {
                          successEvent: "registry_ready_created",
                          location: "action_panel",
                        })
                      }
                    >
                      Prepare filing package
                    </Button>
                  )}
                  {workflowStatus === "ready_to_file" && !filing?.request && (
                    hasRegistryFilingAccess ? (
                      <Button
                        type="button"
                        disabled={actionLoading || draftChangedSinceReady}
                        onClick={() =>
                          void runWorkflowAction(() => createRegistryFilingRequest(String(propertyId)), {
                            location: "action_panel",
                          })
                        }
                      >
                        Open filing checklist
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          trackRegistryEvent("registry_filing_gate_hit", "action_panel", {
                            capability: "registry_filing_access",
                          });
                          setUpgradeState({
                            capability: "registry_filing_access",
                            message: "Upgrade to unlock the filing workflow once your draft is ready.",
                            requiredPlan: "pro",
                            location: "action_panel",
                            paidUnlocks: registryPricing?.paidUnlocks || [],
                            freeIncludes: registryPricing?.freeIncludes || [],
                          });
                          openRegistryUpgrade({
                            capability: "registry_filing_access",
                            requiredPlan: "pro",
                            location: "action_panel",
                          });
                        }}
                      >
                        Unlock filing workflow
                      </Button>
                    )
                  )}
                  {workflowStatus === "ready_to_file" && filing?.request && (
                    hasRegistryFilingAccess ? (
                      <Button
                        type="button"
                        disabled={actionLoading || draftChangedSinceReady}
                        onClick={() =>
                          void runWorkflowAction(() =>
                            updateRegistryFilingStatus(String(propertyId), {
                              attemptId: latestAttempt?.attemptId || null,
                              status: "filed_pending_confirmation",
                              note: workflowForm.notes || "Marked as filed through the Halifax manual portal workflow.",
                              referenceNumbers: workflowForm.referenceNumber
                                ? [
                                    {
                                      type: "external_reference",
                                      value: workflowForm.referenceNumber,
                                      label: "Reference number",
                                    },
                                  ]
                                : [],
                              evidence: workflowForm.evidenceReference
                                ? [
                                    {
                                      id: `evidence-${Date.now()}`,
                                      type: "other",
                                      label: "Evidence reference",
                                      note: workflowForm.evidenceReference,
                                    },
                                  ]
                                : [],
                            }),
                            { location: "action_panel" }
                          )
                        }
                      >
                        Mark as Filed
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          trackRegistryEvent("registry_filing_gate_hit", "action_panel", {
                            capability: "registry_filing_access",
                          });
                          setUpgradeState({
                            capability: "registry_filing_access",
                            message: "Upgrade to mark filings, track outcomes, and keep an audit trail.",
                            requiredPlan: "pro",
                            location: "action_panel",
                            paidUnlocks: registryPricing?.paidUnlocks || [],
                            freeIncludes: registryPricing?.freeIncludes || [],
                          });
                          openRegistryUpgrade({
                            capability: "registry_filing_access",
                            requiredPlan: "pro",
                            location: "action_panel",
                          });
                        }}
                      >
                        Upgrade to file
                      </Button>
                    )
                  )}
                  {workflowStatus === "filed_pending_confirmation" && (
                    hasRegistryFilingAccess ? (
                    <>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={actionLoading}
                        onClick={() =>
                          void runWorkflowAction(() =>
                            attachFilingReferenceAndNotes(String(propertyId), {
                              status: "filed_pending_confirmation",
                              attemptId: latestAttempt?.attemptId || null,
                              note: workflowForm.notes,
                              referenceNumber: workflowForm.referenceNumber,
                              evidenceReference: workflowForm.evidenceReference,
                            }),
                            { location: "action_panel" }
                          )
                        }
                      >
                        Add Reference Number
                      </Button>
                      <Button
                        type="button"
                        disabled={actionLoading}
                        onClick={() =>
                          void runWorkflowAction(() =>
                            updateRegistryFilingStatus(String(propertyId), {
                              attemptId: latestAttempt?.attemptId || null,
                              status: "filed_confirmed",
                              note: workflowForm.notes || "Filing confirmed.",
                              referenceNumbers: workflowForm.referenceNumber
                                ? [
                                    {
                                      type: "external_reference",
                                      value: workflowForm.referenceNumber,
                                      label: "Reference number",
                                    },
                                  ]
                                : [],
                              evidence: workflowForm.evidenceReference
                                ? [
                                    {
                                      id: `evidence-${Date.now()}`,
                                      type: "other",
                                      label: "Evidence reference",
                                      note: workflowForm.evidenceReference,
                                    },
                                  ]
                                : [],
                            }),
                            { location: "action_panel" }
                          )
                        }
                      >
                        Mark as Confirmed
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={actionLoading}
                        onClick={() =>
                          void runWorkflowAction(() =>
                            updateRegistryFilingStatus(String(propertyId), {
                              attemptId: latestAttempt?.attemptId || null,
                              status: "rejected",
                              note: workflowForm.notes || "Filing rejected.",
                              referenceNumbers: workflowForm.referenceNumber
                                ? [
                                    {
                                      type: "external_reference",
                                      value: workflowForm.referenceNumber,
                                      label: "Reference number",
                                    },
                                  ]
                                : [],
                              evidence: workflowForm.evidenceReference
                                ? [
                                    {
                                      id: `evidence-${Date.now()}`,
                                      type: "other",
                                      label: "Evidence reference",
                                      note: workflowForm.evidenceReference,
                                    },
                                  ]
                                : [],
                            }),
                            { location: "action_panel" }
                          )
                        }
                      >
                        Mark as Rejected
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={actionLoading}
                        onClick={() =>
                          void runWorkflowAction(() =>
                            updateRegistryFilingStatus(String(propertyId), {
                              attemptId: latestAttempt?.attemptId || null,
                              status: "failed",
                              note: workflowForm.notes || "Filing failed before confirmation.",
                              referenceNumbers: workflowForm.referenceNumber
                                ? [
                                    {
                                      type: "external_reference",
                                      value: workflowForm.referenceNumber,
                                      label: "Reference number",
                                    },
                                  ]
                                : [],
                              evidence: workflowForm.evidenceReference
                                ? [
                                    {
                                      id: `evidence-${Date.now()}`,
                                      type: "other",
                                      label: "Evidence reference",
                                      note: workflowForm.evidenceReference,
                                    },
                                  ]
                                : [],
                            }),
                            { location: "action_panel" }
                          )
                        }
                      >
                        Mark as Failed
                      </Button>
                    </>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          trackRegistryEvent("registry_filing_gate_hit", "action_panel", {
                            capability: "registry_filing_access",
                          });
                          setUpgradeState({
                            capability: "registry_filing_access",
                            message: "Upgrade to update filing status and keep the workflow moving.",
                            requiredPlan: "pro",
                            location: "action_panel",
                            paidUnlocks: registryPricing?.paidUnlocks || [],
                            freeIncludes: registryPricing?.freeIncludes || [],
                          });
                          openRegistryUpgrade({
                            capability: "registry_filing_access",
                            requiredPlan: "pro",
                            location: "action_panel",
                          });
                        }}
                      >
                        Upgrade to file
                      </Button>
                    )
                  )}
                  {(workflowStatus === "rejected" || workflowStatus === "failed" || workflowStatus === "cancelled") &&
                  latestAttempt ? (
                    hasRegistryFilingAccess ? (
                      <Button
                        type="button"
                        disabled={actionLoading || draftChangedSinceReady}
                        onClick={() =>
                          void runWorkflowAction(() =>
                            retryRegistryFilingAttempt(String(propertyId), {
                              attemptId: latestAttempt.attemptId,
                            }),
                            { location: "retry_button" }
                          )
                        }
                      >
                        Retry filing attempt
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          trackRegistryEvent("registry_retry_gate_hit", "retry_button", {
                            capability: "registry_filing_access",
                          });
                          setUpgradeState({
                            capability: "registry_filing_access",
                            message: "Upgrade to retry filings safely and preserve prior attempts as audit history.",
                            requiredPlan: "pro",
                            location: "retry_button",
                            paidUnlocks: registryPricing?.paidUnlocks || [],
                            freeIncludes: registryPricing?.freeIncludes || [],
                          });
                          openRegistryUpgrade({
                            capability: "registry_filing_access",
                            requiredPlan: "pro",
                            location: "retry_button",
                          });
                        }}
                      >
                        Unlock retry workflow
                      </Button>
                    )
                  ) : null}
                </div>
                {(workflowStatus === "rejected" || workflowStatus === "failed" || workflowStatus === "cancelled") && (
                  <div style={{ color: "#475569", fontSize: 13 }}>
                    {draftChangedSinceReady
                      ? "This draft changed after the latest ready package was created. Regenerate the filing package before retrying."
                      : "Retry creates a new filing attempt and preserves the prior attempts as audit history."}
                  </div>
                )}
              </Card>

              <Card style={{ display: "grid", gap: 12 }}>
                <div style={{ fontWeight: 700, color: "#0f172a" }}>Filing details</div>
                <div style={{ display: "grid", gap: 8, fontSize: 14 }}>
                  <div>
                    <strong>Filing mode:</strong> {filing?.request?.filingChannel || filing?.ready?.filingChannel || "--"}
                  </div>
                  <div>
                    <strong>Adapter:</strong> {filing?.request?.adapterKey || filing?.result?.adapterKey || "--"}
                  </div>
                  <div>
                    <strong>Consent captured:</strong> {formatDateTime(filing?.ready?.consentLock.preparationAuthorizedAt)}
                  </div>
                  <div>
                    <strong>Declarations confirmed:</strong> {formatDateTime(filing?.ready?.consentLock.declarationsConfirmedAt)}
                  </div>
                  <div>
                    <strong>Final review confirmed:</strong> {formatDateTime(filing?.ready?.consentLock.finalReviewConfirmedAt)}
                  </div>
                  <div>
                    <strong>Latest reference:</strong> {latestReference || "--"}
                  </div>
                  {latestAttempt ? (
                    <div>
                      <strong>Latest attempt:</strong> #{latestAttempt.attemptNumber} · {filingStatusLabel(latestAttempt.status)}
                    </div>
                  ) : null}
                </div>
                {filing?.ready?.normalizedSubmission.sections.length ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ fontWeight: 700, color: "#0f172a" }}>Normalized submission summary</div>
                    {filing.ready.normalizedSubmission.sections.slice(0, 3).map((section) => (
                      <div
                        key={section.id}
                        style={{
                          display: "grid",
                          gap: 6,
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: "1px solid rgba(15,23,42,0.08)",
                        }}
                      >
                        <div style={{ fontWeight: 700, color: "#0f172a" }}>{section.label}</div>
                        {section.fields.slice(0, 4).map((field) => (
                          <div key={field.id} style={{ color: "#475569", fontSize: 13 }}>
                            <strong>{field.label}:</strong> {renderFieldValue(field.value)}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : null}
                {filing?.ready?.declarationsLock.items.length ? (
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontWeight: 700, color: "#0f172a" }}>Declaration snapshot</div>
                    {filing.ready.declarationsLock.items.map((item) => (
                      <div key={item.id} style={{ color: "#475569", fontSize: 13 }}>
                        {item.checked ? "✓" : "○"} {item.label}
                      </div>
                    ))}
                  </div>
                ) : null}
              </Card>
            </div>

            <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              }}
            >
              <Card style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ fontWeight: 700, color: "#0f172a" }}>Operator checklist</div>
                  {checklistAvailable ? (
                    <Button type="button" variant="secondary" onClick={() => void handleCopyChecklist()}>
                      {copyState === "copied" ? "Checklist copied" : "Copy instructions"}
                    </Button>
                  ) : null}
                </div>
                {filing?.request?.checklist ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    {filing.request.checklist.portalUrl ? (
                      <a
                        href={filing.request.checklist.portalUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#2563eb", fontWeight: 700, textDecoration: "none" }}
                      >
                        Open Halifax filing portal
                      </a>
                    ) : null}
                    {filing.request.checklist.steps.map((step, index) => (
                      <div key={`${step}-${index}`} style={{ color: "#475569", fontSize: 14 }}>
                        {index + 1}. {step}
                      </div>
                    ))}
                    {filing.request.checklist.notes.length ? (
                      <div style={{ display: "grid", gap: 4, paddingTop: 4 }}>
                        <div style={{ fontWeight: 700, color: "#0f172a" }}>Notes</div>
                        {filing.request.checklist.notes.map((note, index) => (
                          <div key={`${note}-${index}`} style={{ color: "#475569", fontSize: 13 }}>
                            • {note}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div style={{ color: "#475569", fontSize: 14 }}>
                    Create a filing checklist once the ready package is prepared to see the manual Halifax portal steps here.
                  </div>
                )}
              </Card>

              <Card style={{ display: "grid", gap: 12 }}>
                <div style={{ fontWeight: 700, color: "#0f172a" }}>Filing history</div>
                {!hasRegistryAttemptsHistory ? (
                  <div
                    style={{
                      display: "grid",
                      gap: 8,
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(37,99,235,0.14)",
                      background: "rgba(37,99,235,0.05)",
                    }}
                  >
                    <div style={{ fontWeight: 700, color: "#0f172a" }}>Unlock attempts history</div>
                    <div style={{ color: "#475569", fontSize: 14, lineHeight: 1.5 }}>
                      Filing history, retry safety, and audit tracking are part of the paid filing workflow.
                    </div>
                    <div style={{ color: "#475569", fontSize: 13 }}>{registryUpgradeLabel}</div>
                    <div>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          trackRegistryEvent("registry_attempts_history_gate_hit", "history_panel", {
                            capability: "registry_attempts_history",
                          });
                          setUpgradeState({
                            capability: "registry_attempts_history",
                            message: "Upgrade to keep a history of filing attempts, notes, and references.",
                            requiredPlan: "pro",
                            location: "history_panel",
                            paidUnlocks: registryPricing?.paidUnlocks || [],
                            freeIncludes: registryPricing?.freeIncludes || [],
                          });
                          openRegistryUpgrade({
                            capability: "registry_attempts_history",
                            requiredPlan: "pro",
                            location: "history_panel",
                          });
                        }}
                      >
                        Unlock filing history
                      </Button>
                    </div>
                  </div>
                ) : filingHistory.length ? (
                  filingHistory.map((entry) => (
                    <div
                      key={entry.key}
                      style={{
                        display: "grid",
                        gap: 4,
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "1px solid rgba(15,23,42,0.08)",
                      }}
                    >
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <div style={{ fontWeight: 700, color: "#0f172a" }}>{entry.label}</div>
                        {entry.isLatest ? <Pill tone="accent">Latest</Pill> : null}
                      </div>
                      <div style={{ color: "#475569", fontSize: 14 }}>
                        <strong>Status:</strong> {entry.status || "--"}
                      </div>
                      <div style={{ color: "#475569", fontSize: 14 }}>
                        <strong>Updated:</strong> {formatDateTime(entry.timestamp)}
                      </div>
                      <div style={{ color: "#475569", fontSize: 14 }}>
                        <strong>Reference number:</strong> {entry.referenceNumber || "--"}
                      </div>
                      {entry.operatorNotes ? (
                        <div style={{ color: "#475569", fontSize: 14 }}>
                          <strong>Notes:</strong> {entry.operatorNotes}
                        </div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div style={{ color: "#475569", fontSize: 14 }}>
                    No filing attempts have been recorded yet.
                  </div>
                )}
              </Card>
            </div>

            {data.pidPrompt.pidPromptEligible ? (
              <div
                style={{
                  display: "grid",
                  gap: 8,
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(37,99,235,0.18)",
                  background: "rgba(37,99,235,0.06)",
                }}
              >
                <div style={{ fontWeight: 700, color: "#0f172a" }}>Property PID missing</div>
                <div style={{ color: "#475569", fontSize: 14, lineHeight: 1.5 }}>{data.pidPrompt.pidPromptMessage}</div>
                <div style={{ color: "#334155", fontSize: 13 }}>
                  Registry PID available from {data.pidPrompt.sourceLabel}: <strong>{data.pidPrompt.registryPid}</strong>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Button type="button" variant="secondary" onClick={() => void handleCopyPid()}>
                    {copyState === "copied" ? "PID copied" : "Copy PID"}
                  </Button>
                  {canOpenAdminReview ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        if (typeof window !== "undefined") {
                          window.location.assign(`/admin/registry/properties/${encodeURIComponent(String(property?.id || ""))}`);
                        }
                      }}
                    >
                      Open registry review
                    </Button>
                  ) : null}
                </div>
                {copyState === "failed" ? (
                  <div style={{ color: "#b91c1c", fontSize: 13 }}>
                    Could not copy automatically. You can still copy the PID manually.
                  </div>
                ) : null}
              </div>
            ) : null}

            {data.status ? (
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ fontWeight: 700, color: "#0f172a" }}>Registry details</div>
                <div style={{ color: "#475569" }}>{data.status.summary}</div>
                <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
                  <div>
                    <strong>Public status:</strong> {statusLabel(data.status.registryStatus)}
                  </div>
                  <div>
                    <strong>Property PID:</strong> {data.pidPrompt.propertyPid || "--"}
                  </div>
                  <div>
                    <strong>Registry PID:</strong> {data.status.pid || "--"}
                  </div>
                  <div>
                    <strong>Source:</strong> {data.source.sourceLabel}
                  </div>
                  <div>
                    <strong>Last checked:</strong> {formatDate(data.status.lastEvaluatedAt)}
                  </div>
                  <div>
                    <strong>Registration number:</strong> {data.status.registrationNumber || "--"}
                  </div>
                  <div>
                    <strong>Recommended action:</strong> {data.status.recommendedAction}
                  </div>
                </div>
              </div>
            ) : null}

            {onOpenSubmissionAssistant ? (
              <div
                style={{
                  borderRadius: 12,
                  border: "1px solid rgba(15,23,42,0.08)",
                  background: "rgba(15,23,42,0.03)",
                  padding: "12px 14px",
                  display: "grid",
                  gap: 8,
                }}
              >
                <div style={{ fontWeight: 700, color: "#0f172a" }}>{data.readiness.assistant.title}</div>
                <div style={{ color: "#475569", fontSize: 14, lineHeight: 1.5 }}>{data.readiness.assistant.description}</div>
                <div>
                  <Button
                    type="button"
                    onClick={() => {
                      setDetailsOpen(false);
                      onOpenSubmissionAssistant();
                    }}
                  >
                    {data.readiness.assistant.ctaLabel}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </Card>
  );
};
