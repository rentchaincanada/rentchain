import type { TenantWorkspaceLease } from "../api/tenantPortal";
import type { LeaseExecutionWorkspaceView } from "./leaseExecutionWorkspace";

export type LeaseSigningWorkspaceState =
  | "not_ready_for_signing"
  | "ready_for_signing"
  | "signing_in_progress"
  | "awaiting_tenant_signature"
  | "awaiting_landlord_signature"
  | "signed_or_completed";

export type LeaseSigningWorkspaceActor = "tenant" | "landlord" | "shared" | null;

export type LeaseSigningWorkspaceView = {
  signingState: LeaseSigningWorkspaceState;
  label: string;
  summary: string;
  explanation: string;
  currentActor: LeaseSigningWorkspaceActor;
  currentActorLabel: string;
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

function hasLeaseProjection(lease: TenantWorkspaceLease | null | undefined): boolean {
  if (!lease) return false;
  return Boolean(String(lease.leaseId || "").trim() || String(lease.status || "").trim());
}

function hasLeaseDocument(lease: TenantWorkspaceLease | null | undefined): boolean {
  return Boolean(String(lease?.documentUrl || "").trim());
}

function stateLabel(state: LeaseSigningWorkspaceState): string {
  if (state === "ready_for_signing") return "Ready for signing";
  if (state === "signing_in_progress") return "Signing in progress";
  if (state === "awaiting_tenant_signature") return "Awaiting tenant signature";
  if (state === "awaiting_landlord_signature") return "Awaiting landlord signature";
  if (state === "signed_or_completed") return "Signed";
  return "Not ready for signing";
}

function actorLabel(actor: LeaseSigningWorkspaceActor): string {
  if (actor === "tenant") return "Tenant";
  if (actor === "landlord") return "Landlord";
  if (actor === "shared") return "Shared follow-through";
  return "Not surfaced yet";
}

export function buildLeaseSigningWorkspaceState(input: {
  audience: "landlord" | "tenant";
  executionWorkspace: LeaseExecutionWorkspaceView;
  lease?: TenantWorkspaceLease | null;
}): LeaseSigningWorkspaceView {
  const lease = input.lease || null;
  const leaseVisible = hasLeaseProjection(lease);
  const leaseDocumentVisible = hasLeaseDocument(lease);
  const normalizedLeaseStatus = normalizeStatus(lease?.status);

  if (["signed", "active", "current"].includes(normalizedLeaseStatus)) {
    return {
      signingState: "signed_or_completed",
      label: stateLabel("signed_or_completed"),
      summary: "Lease signing",
      explanation:
        "The visible lease record already shows a signed or active status, so the first signing step appears complete in the current authorized workspace.",
      currentActor: null,
      currentActorLabel: actorLabel(null),
      blockers: [],
      nextActions:
        input.audience === "landlord"
          ? [
              "Use the existing lease and move-in tools for any remaining operational follow-through.",
              "Keep this signing workspace as the high-level record of how the file moved past the first signing stage.",
            ]
          : [
              "Review your lease details and watch for any next tenant-visible move-in instructions.",
              "Use the lease page if you need to revisit the current signed document.",
            ],
      timelineEvent: {
        title: "Lease signing completed",
        description:
          "The visible lease status now indicates the first signing step is complete in the authorized workspace.",
        actionRequired: false,
      },
    };
  }

  if (
    ["tenant_signed", "signed_by_tenant", "awaiting_landlord_signature", "pending_landlord_signature"].includes(
      normalizedLeaseStatus
    )
  ) {
    return {
      signingState: "awaiting_landlord_signature",
      label: stateLabel("awaiting_landlord_signature"),
      summary: "Lease signing",
      explanation:
        "The visible lease record shows that tenant review appears complete and landlord signature is the next signing step now surfaced by the current workflow.",
      currentActor: "landlord",
      currentActorLabel: actorLabel("landlord"),
      blockers: [],
      nextActions:
        input.audience === "landlord"
          ? [
              "Review the current lease details and complete the landlord-side signing step in the existing lease workflow when appropriate.",
              "Keep this workspace as the neutral status view rather than treating it as a legal-signing tool.",
            ]
          : [
              "Your lease review appears complete for now.",
              "Watch for the landlord-side signing step to finish in the existing workflow.",
            ],
      timelineEvent: {
        title: "Awaiting landlord signature",
        description:
          "The visible lease status indicates tenant review appears complete and landlord signature is the next visible step.",
        actionRequired: input.audience === "landlord",
      },
    };
  }

  if (
    leaseDocumentVisible &&
    [
      "sent",
      "awaiting_tenant_signature",
      "pending_tenant_signature",
      "ready_for_signature",
      "signature_requested",
    ].includes(normalizedLeaseStatus)
  ) {
    return {
      signingState: "awaiting_tenant_signature",
      label: stateLabel("awaiting_tenant_signature"),
      summary: "Lease signing",
      explanation:
        "A visible lease document is available and the current lease status points to tenant review or signature as the next step.",
      currentActor: "tenant",
      currentActorLabel: actorLabel("tenant"),
      blockers: [],
      nextActions:
        input.audience === "landlord"
          ? [
              "Wait for the tenant-side signing step to complete in the current lease workflow.",
              "Use this workspace to explain who is expected to act next without implying provider-backed e-sign automation.",
            ]
          : [
              "Review the current lease details carefully before taking the next tenant-visible signing step.",
              "Use the existing lease page for the current document and any tenant-safe follow-through.",
            ],
      timelineEvent: {
        title: "Awaiting tenant signature",
        description:
          "A visible lease document and current status indicate the next signing step belongs to the tenant.",
        actionRequired: input.audience === "tenant",
      },
    };
  }

  if (leaseVisible && leaseDocumentVisible) {
    return {
      signingState: "signing_in_progress",
      label: stateLabel("signing_in_progress"),
      summary: "Lease signing",
      explanation:
        "A visible lease record and document show that signing has started, but the next signing actor is not clearly surfaced from the current authorized state.",
      currentActor: "shared",
      currentActorLabel: actorLabel("shared"),
      blockers: [],
      nextActions:
        input.audience === "landlord"
          ? [
              "Use the existing lease workflow to confirm who should act next.",
              "Keep this signing workspace as the high-level handoff view while the live lease process continues.",
            ]
          : [
              "Watch the lease page for the next tenant-visible signing instruction.",
              "Use this workspace as a status view only while the current lease process continues.",
            ],
      timelineEvent: {
        title: "Lease signing started",
        description:
          "A visible lease record and document indicate that signing has started in the current authorized workflow.",
        actionRequired: false,
      },
    };
  }

  if (input.executionWorkspace.executionState === "ready_for_execution") {
    return {
      signingState: "ready_for_signing",
      label: stateLabel("ready_for_signing"),
      summary: "Lease signing",
      explanation:
        "The file appears ready to move into lease signing once the live signing step and visible lease document are surfaced through the supported lease workflow.",
      currentActor: "landlord",
      currentActorLabel: actorLabel("landlord"),
      blockers: leaseDocumentVisible
        ? []
        : ["A tenant-visible lease document is not yet surfaced from the current authorized workflow."],
      nextActions:
        input.audience === "landlord"
          ? [
              "Use the current lease workflow to surface the lease document and begin the next supported signing step.",
              "Treat this workspace as the structured bridge into signing rather than a provider-backed e-sign console.",
            ]
          : [
              "Watch for the lease document and next signing instruction in your tenant workspace.",
              "Use the lease page once the signing step becomes visible there.",
            ],
      timelineEvent: {
        title: "Lease ready for signing",
        description:
          "The visible lease workflow now appears organized enough to move into the first supported signing step.",
        actionRequired: false,
      },
    };
  }

  return {
    signingState: "not_ready_for_signing",
    label: stateLabel("not_ready_for_signing"),
    summary: "Lease signing",
    explanation:
      "This file is not ready to move into lease signing yet because the current execution handoff still needs to settle first.",
    currentActor: null,
    currentActorLabel: actorLabel(null),
    blockers: input.executionWorkspace.blockers,
    nextActions: input.executionWorkspace.nextSteps,
    timelineEvent: null,
  };
}
