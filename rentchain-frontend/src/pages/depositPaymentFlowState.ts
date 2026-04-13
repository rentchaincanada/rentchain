import type { TenantWorkspaceLease } from "../api/tenantPortal";
import type { LeaseSigningWorkspaceView } from "./leaseSigningWorkspaceState";

export type DepositPaymentState =
  | "not_requested"
  | "requested"
  | "pending"
  | "paid"
  | "needs_attention";

export type DepositPaymentActor = "tenant" | "landlord" | "shared" | null;

export type DepositPaymentFlowView = {
  paymentState: DepositPaymentState;
  label: string;
  summary: string;
  paymentLabel: string;
  explanation: string;
  currentActor: DepositPaymentActor;
  currentActorLabel: string;
  amountLabel: string | null;
  paymentMethodLabel: string | null;
  blockers: string[];
  nextActions: string[];
  timelineEvent: {
    title: string;
    description: string;
    actionRequired: boolean;
  } | null;
};

function normalizeStatus(value: string | null | undefined): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function stateLabel(state: DepositPaymentState): string {
  if (state === "requested") return "Payment requested";
  if (state === "pending") return "Payment in progress";
  if (state === "paid") return "Payment completed";
  if (state === "needs_attention") return "Needs attention";
  return "Not requested";
}

function actorLabel(actor: DepositPaymentActor): string {
  if (actor === "tenant") return "Tenant";
  if (actor === "landlord") return "Landlord";
  if (actor === "shared") return "Shared follow-through";
  return "Not surfaced yet";
}

function paymentLabels(lease: TenantWorkspaceLease | null | undefined) {
  const depositCents =
    typeof lease?.depositCents === "number" && Number.isFinite(lease.depositCents) && lease.depositCents > 0
      ? Math.round(lease.depositCents)
      : null;
  const depositRequired = lease?.depositRequired === true || depositCents != null;
  const monthlyRentCents =
    typeof lease?.monthlyRent === "number" && Number.isFinite(lease.monthlyRent) && lease.monthlyRent > 0
      ? Math.round(lease.monthlyRent * 100)
      : null;
  const paymentLabel = depositRequired ? "Deposit request" : "First payment";
  const amountLabel =
    depositRequired && depositCents != null
      ? `${formatMoney(depositCents)} deposit`
      : !depositRequired && monthlyRentCents != null
      ? `${formatMoney(monthlyRentCents)} first payment`
      : null;
  const paymentMethodLabel = String(lease?.paymentMethod || "").trim() || null;

  return {
    depositRequired,
    hasConfiguredPayment: depositRequired || monthlyRentCents != null,
    paymentLabel,
    amountLabel,
    paymentMethodLabel,
  };
}

export function buildDepositPaymentFlowState(input: {
  audience: "landlord" | "tenant";
  signingWorkspace: LeaseSigningWorkspaceView;
  lease?: TenantWorkspaceLease | null;
}): DepositPaymentFlowView {
  const lease = input.lease || null;
  const normalizedPaymentStatus = normalizeStatus(lease?.paymentStatus);
  const paymentRequestedAt = String(lease?.paymentRequestedAt || "").trim() || null;
  const paymentCompletedAt = String(lease?.paymentCompletedAt || "").trim() || null;
  const depositReceivedAt = String(lease?.depositReceivedAt || "").trim() || null;
  const depositReceived = lease?.depositReceived === true;
  const labels = paymentLabels(lease);
  const signed = input.signingWorkspace.signingState === "signed_or_completed";

  const explicitlyRequested = ["requested", "awaiting_payment", "unpaid", "open", "sent"].includes(normalizedPaymentStatus);
  const explicitlyPending = ["pending", "processing", "in_progress", "external_pending", "started"].includes(
    normalizedPaymentStatus
  );
  const explicitlyPaid = ["paid", "completed", "succeeded"].includes(normalizedPaymentStatus);
  const explicitlyNeedsAttention = [
    "failed",
    "attention_required",
    "requires_action",
    "requires_payment_method",
    "canceled",
    "cancelled",
  ].includes(normalizedPaymentStatus);

  if (explicitlyPaid || paymentCompletedAt || depositReceivedAt || depositReceived) {
    return {
      paymentState: "paid",
      label: stateLabel("paid"),
      summary: "Deposit / first payment",
      paymentLabel: labels.paymentLabel,
      explanation:
        "The current authorized lease state already shows this payment as complete, so no further payment action is surfaced from this workspace right now.",
      currentActor: null,
      currentActorLabel: actorLabel(null),
      amountLabel: labels.amountLabel,
      paymentMethodLabel: labels.paymentMethodLabel,
      blockers: [],
      nextActions:
        input.audience === "landlord"
          ? [
              "Keep this payment workspace as the structured record of the first completed payment step.",
              "Use the existing lease and move-in workflow for any remaining operational follow-through.",
            ]
          : [
              "Keep a copy of the current lease and payment details for your records.",
              "Watch your tenant workspace for any remaining move-in instructions.",
            ],
      timelineEvent: {
        title: "Payment completed",
        description:
          "The currently visible lease payment details indicate the first payment step is complete.",
        actionRequired: false,
      },
    };
  }

  if (explicitlyNeedsAttention) {
    return {
      paymentState: "needs_attention",
      label: stateLabel("needs_attention"),
      summary: "Deposit / first payment",
      paymentLabel: labels.paymentLabel,
      explanation:
        "A payment-related status is visible, but it still needs attention before this first payment step can settle cleanly.",
      currentActor: "tenant",
      currentActorLabel: actorLabel("tenant"),
      amountLabel: labels.amountLabel,
      paymentMethodLabel: labels.paymentMethodLabel,
      blockers: [
        `${labels.paymentLabel} still needs attention in the currently visible payment status.`,
      ],
      nextActions:
        input.audience === "landlord"
          ? [
              "Confirm the current processor-led payment step before treating this first payment as complete.",
              "Keep this workspace read-first unless a supported payment status update becomes visible.",
            ]
          : [
              "Review the current payment instruction and resolve the outstanding issue before trying again.",
              "Use the existing lease or payments pages if you need to confirm the current request details.",
            ],
      timelineEvent: {
        title: "Payment needs attention",
        description:
          "The current payment state still needs attention before the first payment step can be treated as complete.",
        actionRequired: true,
      },
    };
  }

  if (explicitlyPending) {
    return {
      paymentState: "pending",
      label: stateLabel("pending"),
      summary: "Deposit / first payment",
      paymentLabel: labels.paymentLabel,
      explanation:
        "The first payment step has started and is still in progress in the currently visible workflow.",
      currentActor: "shared",
      currentActorLabel: actorLabel("shared"),
      amountLabel: labels.amountLabel,
      paymentMethodLabel: labels.paymentMethodLabel,
      blockers: [],
      nextActions:
        input.audience === "landlord"
          ? [
              "Wait for the current processor-led payment step to settle before marking the file complete.",
              "Use this workspace as the status layer rather than a funds-holding or reconciliation console.",
            ]
          : [
              "Watch for payment confirmation before assuming the first payment step is finished.",
              "Use the payments or lease pages if you need to revisit the visible payment details.",
            ],
      timelineEvent: {
        title: "Payment started",
        description:
          "The current lease payment status indicates the first payment step is in progress.",
        actionRequired: false,
      },
    };
  }

  if (explicitlyRequested || (signed && labels.hasConfiguredPayment)) {
    return {
      paymentState: "requested",
      label: stateLabel("requested"),
      summary: "Deposit / first payment",
      paymentLabel: labels.paymentLabel,
      explanation:
        labels.depositRequired
          ? "The lease appears to require a deposit, and that first payment step is still outstanding in the current workflow."
          : "The file appears ready for the first payment step, and that request is still outstanding in the current workflow.",
      currentActor: "tenant",
      currentActorLabel: actorLabel("tenant"),
      amountLabel: labels.amountLabel,
      paymentMethodLabel: labels.paymentMethodLabel,
      blockers: [],
      nextActions:
        input.audience === "landlord"
          ? [
              "Use an existing processor-led payment path if one is already configured for this tenancy.",
              "Keep this workspace as the structured status layer rather than treating RentChain as the funds holder.",
            ]
          : [
              "Review the current payment details and follow the next processor-led payment instruction when it is available to you.",
              "Use the lease and payments pages to confirm the current request details before you proceed.",
            ],
      timelineEvent:
        explicitlyRequested || paymentRequestedAt
          ? {
              title: "Deposit requested",
              description:
                "A first payment request is now visible in the current authorized lease workflow.",
              actionRequired: input.audience === "tenant",
            }
          : null,
    };
  }

  return {
    paymentState: "not_requested",
    label: stateLabel("not_requested"),
    summary: "Deposit / first payment",
    paymentLabel: labels.paymentLabel,
    explanation:
      "The first payment step has not been surfaced yet because the current signing stage still needs to settle before a payment request can be treated as live.",
    currentActor: signed ? "landlord" : null,
    currentActorLabel: actorLabel(signed ? "landlord" : null),
    amountLabel: labels.amountLabel,
    paymentMethodLabel: labels.paymentMethodLabel,
    blockers: signed
      ? ["A processor-led payment request is not yet visible in the current authorized workspace."]
      : input.signingWorkspace.blockers,
    nextActions:
      input.audience === "landlord"
        ? [
            "Finish the current signing step before treating any deposit or first payment request as live.",
            "Use a processor-led path only when that payment step is clearly available in the existing workflow.",
          ]
        : [
            "Watch for the next payment request after the current signing step settles.",
            "Keep your lease and application details current while the first payment step is still not visible.",
          ],
    timelineEvent: null,
  };
}
