import type { TenantApplicationCompletionSummary } from "../../api/tenantApplicationCompletion";
import type { TenantApplicationReuseView } from "./tenantApplicationReuse";

export type TenantApplicationFlowEntry = "direct" | "invite" | "application";
export type TenantApplicationFlowState =
  | "readiness"
  | "needs_attention"
  | "ready_to_review"
  | "ready_to_proceed";

type TenantApplicationFlowStepStatus = "complete" | "current" | "upcoming";

export type TenantApplicationFlowStep = {
  key: "readiness" | "fix" | "review" | "continue";
  label: string;
  status: TenantApplicationFlowStepStatus;
};

export type TenantApplicationFlowView = {
  entry: TenantApplicationFlowEntry;
  state: TenantApplicationFlowState;
  title: string;
  detail: string;
  nextStepLabel: string;
  nextStepPath: string;
  nextStepDetail: string;
  missingCount: number;
  readyCount: number;
  steps: TenantApplicationFlowStep[];
};

function normalizeEntry(value: string | null | undefined): TenantApplicationFlowEntry {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "invite") return "invite";
  if (normalized === "application" || normalized === "apply") return "application";
  return "direct";
}

function firstActionPath(reuse: TenantApplicationReuseView): string {
  return (
    reuse.missingItems.find((item) => item.actionPath)?.actionPath ||
    reuse.documentItems.find((item) => item.status === "needs_attention")?.actionPath ||
    reuse.reusableProfileItems.find((item) => item.status === "needs_attention")?.actionPath ||
    "/tenant/profile"
  );
}

function firstActionLabel(reuse: TenantApplicationReuseView): string {
  return (
    reuse.missingItems.find((item) => item.actionLabel)?.actionLabel ||
    reuse.documentItems.find((item) => item.status === "needs_attention")?.actionLabel ||
    reuse.reusableProfileItems.find((item) => item.status === "needs_attention")?.actionLabel ||
    "Add missing details"
  );
}

function entryDescription(entry: TenantApplicationFlowEntry): string {
  if (entry === "invite") {
    return "You came in from a tenant invite. Review what is already ready before you continue.";
  }
  if (entry === "application") {
    return "You came in from an application link. Use your saved profile so this does not feel like a blank restart.";
  }
  return "You opened the application flow directly from your tenant workspace.";
}

function buildSteps(state: TenantApplicationFlowState): TenantApplicationFlowStep[] {
  const currentIndex = state === "needs_attention" ? 1 : state === "ready_to_review" ? 2 : state === "ready_to_proceed" ? 3 : 0;
  return [
    { key: "readiness", label: "Readiness", status: currentIndex > 0 ? "complete" : "current" },
    { key: "fix", label: "Fix details", status: currentIndex > 1 ? "complete" : currentIndex === 1 ? "current" : "upcoming" },
    { key: "review", label: "Review", status: currentIndex > 2 ? "complete" : currentIndex === 2 ? "current" : "upcoming" },
    { key: "continue", label: "Continue", status: currentIndex === 3 ? "current" : "upcoming" },
  ];
}

export function buildTenantApplicationEntryPath(input?: {
  entry?: TenantApplicationFlowEntry | null;
  token?: string | null;
}): string {
  const entry = normalizeEntry(input?.entry);
  const params = new URLSearchParams();
  if (entry !== "direct") {
    params.set("entry", entry);
  }
  const token = String(input?.token || "").trim();
  if (token) {
    params.set(entry === "invite" ? "inviteToken" : "applicationToken", token);
  }
  const query = params.toString();
  return query ? `/tenant/application?${query}` : "/tenant/application";
}

export function buildTenantApplicationFlow(input: {
  search?: string;
  completion: TenantApplicationCompletionSummary | null;
  reuse: TenantApplicationReuseView;
}): TenantApplicationFlowView {
  const entry = normalizeEntry(new URLSearchParams(input.search || "").get("entry"));
  const missingCount = input.reuse.missingItems.filter((item) => item.status !== "info").length;
  const readyCount =
    input.reuse.reusableProfileItems.filter((item) => item.status === "ready").length +
    input.reuse.documentItems.filter((item) => item.status === "ready").length;
  const pendingSignals =
    input.reuse.missingItems.filter((item) => item.status === "info").length +
    (input.completion?.sections || []).flatMap((section) => section.items).filter((item) => item.status === "pending" || item.status === "in_progress").length;
  const progressPercent = input.completion?.progressPercent ?? 0;
  const completionStatus = String(input.completion?.status || "").trim().toLowerCase();

  let state: TenantApplicationFlowState = "readiness";
  if (missingCount > 0) {
    state = "needs_attention";
  } else if (progressPercent >= 100 || completionStatus === "completed" || completionStatus === "verified") {
    state = entry === "direct" ? "ready_to_proceed" : "ready_to_review";
  } else if (readyCount > 0 || pendingSignals > 0 || progressPercent >= 50) {
    state = "ready_to_review";
  }

  if (state === "needs_attention") {
    return {
      entry,
      state,
      title: "Needs attention before review",
      detail: `${entryDescription(entry)} Add the missing details below so the application can move forward with clarity.`,
      nextStepLabel: firstActionLabel(input.reuse),
      nextStepPath: firstActionPath(input.reuse),
      nextStepDetail: `${missingCount} item${missingCount === 1 ? "" : "s"} still need your attention.`,
      missingCount,
      readyCount,
      steps: buildSteps(state),
    };
  }

  if (state === "ready_to_proceed") {
    return {
      entry,
      state,
      title: "Ready to proceed",
      detail: `${entryDescription(entry)} Your saved profile and document signals are in a good place for the supported next step.`,
      nextStepLabel: "Review access before continuing",
      nextStepPath: "/tenant/access",
      nextStepDetail: "Confirm what is shared with your permission before you continue.",
      missingCount,
      readyCount,
      steps: buildSteps(state),
    };
  }

  if (state === "ready_to_review") {
    return {
      entry,
      state,
      title: "Ready to review",
      detail: `${entryDescription(entry)} Review what is ready so this flow stays organized and tenant-controlled.`,
      nextStepLabel: "Review your application readiness",
      nextStepPath: "/tenant/application",
      nextStepDetail: "Check the sections below and confirm what is already reusable.",
      missingCount,
      readyCount,
      steps: buildSteps(state),
    };
  }

  return {
    entry,
    state,
    title: "Start with readiness",
    detail: `${entryDescription(entry)} Start by filling in your profile and documents so the rest of the flow has something to reuse.`,
    nextStepLabel: "Review your profile",
    nextStepPath: "/tenant/profile",
    nextStepDetail: "Profile details are the foundation for the rest of this application flow.",
    missingCount,
    readyCount,
    steps: buildSteps(state),
  };
}
