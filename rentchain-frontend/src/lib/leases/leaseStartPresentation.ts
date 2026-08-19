export type LeaseStartOutcome = "created_without_occupancy" | "occupancy_effective" | "already_coherent";

export function leaseStartOutcomePresentation(outcome: LeaseStartOutcome | null | undefined, startDate?: string | null) {
  if (outcome === "occupancy_effective" || outcome === "already_coherent") {
    return {
      title: "Lease activated",
      description: "Canonical occupancy is effective. Refreshed lease, unit, and tenant records show the current occupant.",
      occupancyLabel: "Current occupancy",
    };
  }
  const formattedStart = String(startDate || "").trim();
  return {
    title: "Lease created",
    description: formattedStart
      ? `This lease is not current occupancy. Its recorded start date is ${formattedStart}; future-start automation is not enabled.`
      : "This lease is not current occupancy. Review its start and execution state before move-in.",
    occupancyLabel: "Pending occupancy",
  };
}

function errorCode(error: unknown): string {
  const body = (error as { body?: Record<string, unknown> } | null)?.body;
  return String(body?.error || body?.code || "").trim().toLowerCase();
}

export function leaseStartMutationErrorMessage(error: unknown, fallback: string): string {
  switch (errorCode(error)) {
    case "idempotency_key_required":
      return "This operation could not be safely identified. Review the form and try again.";
    case "lease_start_idempotency_key_reused":
      return "This request changed after an earlier attempt. Review the latest state, then submit it as a new operation.";
    case "lease_start_state_stale":
    case "occupancy_state_stale":
      return "Lease or occupancy records changed. Refresh the workflow, review the latest state, and try again.";
    case "end_lease_workflow_required":
    case "occupancy_reconciliation_required":
      return "This edit cannot change current occupancy. Use the existing End Lease workflow or review the latest occupancy state.";
    case "restore_active_workflow_required":
      return "A past lease cannot be made current through a general edit. Use the explicit restore workflow when available, or review the record.";
    case "anonymous_occupied_unit":
      return "Review needed: this occupied unit does not have enough tenant identity evidence to create a lease.";
    case "occupied_tenant_identity_incoherent":
    case "lease_start_context_ambiguous":
      return "Review needed: lease, tenant, and unit records do not identify one safe current occupancy.";
    default: {
      const message = error instanceof Error ? String(error.message || "").trim() : "";
      return message && !/firestore|google|payload.?hash|stack/i.test(message) ? message : fallback;
    }
  }
}
