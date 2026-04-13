import type { TenantWorkspaceContext, TenantWorkspaceLease } from "../../api/tenantPortal";

export type ActiveTenancyState =
  | "not_active"
  | "transitioning_to_active"
  | "active_tenancy"
  | "active_but_needs_attention";

export type ActiveTenancyWorkspaceView = {
  tenancyState: ActiveTenancyState;
  title: string;
  label: string;
  explanation: string;
  summaryItems: string[];
  needsAttention: string[];
  nextActions: string[];
};

function normalize(value: string | null | undefined): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function hasLeaseReference(lease: TenantWorkspaceLease | null | undefined): boolean {
  return Boolean(String(lease?.leaseId || "").trim() || String(lease?.status || "").trim());
}

function hasLeaseDocument(lease: TenantWorkspaceLease | null | undefined): boolean {
  return Boolean(String(lease?.documentUrl || "").trim());
}

function paymentSettled(lease: TenantWorkspaceLease | null | undefined): boolean {
  const paymentStatus = normalize(lease?.paymentStatus);
  return (
    ["paid", "completed", "succeeded"].includes(paymentStatus) ||
    Boolean(String(lease?.paymentCompletedAt || "").trim()) ||
    lease?.depositReceived === true ||
    Boolean(String(lease?.depositReceivedAt || "").trim())
  );
}

function paymentNeedsAttention(lease: TenantWorkspaceLease | null | undefined): boolean {
  const paymentStatus = normalize(lease?.paymentStatus);
  return ["failed", "attention_required", "requires_action", "requires_payment_method", "cancelled", "canceled"].includes(
    paymentStatus
  );
}

function stateLabel(state: ActiveTenancyState): string {
  if (state === "active_tenancy") return "Active tenancy";
  if (state === "active_but_needs_attention") return "Active but needs attention";
  if (state === "transitioning_to_active") return "Transitioning to active tenancy";
  return "Not active yet";
}

export function buildActiveTenancyWorkspaceState(input: {
  context: TenantWorkspaceContext | null | undefined;
  lease?: TenantWorkspaceLease | null;
}): ActiveTenancyWorkspaceView {
  const context = input.context || null;
  const lease = input.lease || null;
  const authority = normalize(context?.authority);
  const leaseStatus = normalize(lease?.status);
  const leaseReferenceVisible = hasLeaseReference(lease);
  const leaseDocumentVisible = hasLeaseDocument(lease);
  const settledFirstPayment = paymentSettled(lease);
  const paymentAttention = paymentNeedsAttention(lease);
  const activeAuthority = authority === "active_tenant";
  const activeLease = ["active", "current"].includes(leaseStatus);
  const signedLease = ["signed"].includes(leaseStatus);
  const summaryItems: string[] = [];

  if (activeAuthority) summaryItems.push("Your tenant workspace access is active.");
  if (leaseReferenceVisible) summaryItems.push("A lease reference is visible in your tenant workspace.");
  if (leaseDocumentVisible) summaryItems.push("A lease document is available in your tenant workspace.");
  if (settledFirstPayment) summaryItems.push("The first payment step appears complete in the visible lease record.");

  if (paymentAttention && (activeAuthority || activeLease || signedLease)) {
    return {
      tenancyState: "active_but_needs_attention",
      title: "Your tenancy is active, but one item still needs attention",
      label: stateLabel("active_but_needs_attention"),
      explanation:
        "Your workspace has moved into the active-tenant stage, but the visible lease or payment state still shows one remaining item that needs follow-through.",
      summaryItems: summaryItems.length ? summaryItems : ["Your tenant workspace is no longer in the applicant-only stage."],
      needsAttention: ["A payment-related step still needs attention in the current visible lease record."],
      nextActions: [
        "Review your lease and payment details before treating the tenancy as fully settled.",
        "Use your tenant workspace to keep documents and lease details organized while this last item is resolved.",
      ],
    };
  }

  if (activeAuthority && (activeLease || settledFirstPayment || leaseDocumentVisible)) {
    return {
      tenancyState: "active_tenancy",
      title: "Your tenancy is active",
      label: stateLabel("active_tenancy"),
      explanation:
        "You have moved out of the applicant and pre-lease flow. This workspace is now the structured home for your current tenancy details and next-step visibility.",
      summaryItems: summaryItems.length
        ? summaryItems
        : ["Your tenant workspace is active and ready for ongoing tenancy details."],
      needsAttention: [],
      nextActions: [
        "Use your dashboard as the main place to review lease, documents, and tenancy updates.",
        "Keep your profile and document details current so future tenancy requests stay easy to handle.",
      ],
    };
  }

  if (activeAuthority || leaseReferenceVisible || signedLease || leaseDocumentVisible) {
    return {
      tenancyState: "transitioning_to_active",
      title: "Your workspace is transitioning into active tenancy",
      label: stateLabel("transitioning_to_active"),
      explanation:
        "Your file has moved beyond the core application stage, but the visible lease and move-in signals do not yet show a fully active tenancy state.",
      summaryItems: summaryItems.length
        ? summaryItems
        : ["A lease-related record is visible, but the active tenancy stage is not fully surfaced yet."],
      needsAttention: leaseReferenceVisible ? [] : ["A current lease reference is not visible in your tenant workspace yet."],
      nextActions: [
        "Watch for your lease and tenancy details to finish appearing in the workspace.",
        "Review your lease, payment, and move-in information before treating the tenancy as fully active.",
      ],
    };
  }

  return {
    tenancyState: "not_active",
    title: "Your active tenancy has not started yet",
    label: stateLabel("not_active"),
    explanation:
      "This workspace is still in a pre-tenancy stage. You can keep using the application and readiness flows until the active tenancy state is visible.",
    summaryItems: ["You are still in an invite, application, or pre-lease stage."],
    needsAttention: [],
    nextActions: [
      "Continue with your current application or lease steps until your tenancy becomes active.",
      "Use your application, documents, and access pages to keep your file ready for the next stage.",
    ],
  };
}
