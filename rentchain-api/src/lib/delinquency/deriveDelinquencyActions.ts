import type { DecisionInboxItem } from "../decisions/decisionInboxTypes";
import type { DelinquencyActionDescriptor } from "./delinquencyActionTypes";

function action(input: {
  actionKey: DelinquencyActionDescriptor["actionKey"];
  label: string;
  description: string;
  requiresConfirmation: boolean;
  destination?: string | null;
  status: DelinquencyActionDescriptor["status"];
  blockedReason?: string | null;
}): DelinquencyActionDescriptor {
  return {
    actionKey: input.actionKey,
    label: input.label,
    description: input.description,
    manualOnly: true,
    requiresConfirmation: input.requiresConfirmation,
    policyGuarded: true,
    destination: input.destination || null,
    status: input.status,
    blockedReason: input.blockedReason || null,
  };
}

function hasLedgerDestination(item: Pick<DecisionInboxItem, "destination">): boolean {
  return Boolean(item.destination && /\/leases\/[^/]+\/ledger(?:$|[?#])/.test(item.destination));
}

export function deriveDelinquencyActions(item: DecisionInboxItem): DelinquencyActionDescriptor[] {
  if (item.workflow.queue !== "delinquency_review") return [];

  const ledgerAvailable = hasLedgerDestination(item);
  const contextDestination = item.destination || null;
  const contextReason = contextDestination ? null : "Lease or ledger context is unavailable for this decision.";
  const ledgerReason = ledgerAvailable ? null : "A lease ledger destination is unavailable for this decision.";

  return [
    action({
      actionKey: "review_context",
      label: "Review context",
      description: "Review lease and payment context before taking any manual follow-up.",
      requiresConfirmation: false,
      destination: contextDestination,
      status: contextDestination ? "available" : "blocked",
      blockedReason: contextReason,
    }),
    action({
      actionKey: "view_ledger",
      label: "View ledger",
      description: "Open the existing lease ledger to compare expected rent, payments, and reconciliation evidence.",
      requiresConfirmation: false,
      destination: ledgerAvailable ? item.destination : null,
      status: ledgerAvailable ? "available" : "blocked",
      blockedReason: ledgerReason,
    }),
    action({
      actionKey: "prepare_reminder",
      label: "Prepare reminder",
      description: "Scaffold a manual reminder review. No tenant message is generated or sent from this inbox.",
      requiresConfirmation: true,
      destination: contextDestination,
      status: "blocked",
      blockedReason: "Reminder draft preview is not enabled in this scaffold; no tenant communication will be sent.",
    }),
    action({
      actionKey: "prepare_notice",
      label: "Prepare notice",
      description: "Scaffold a manual notice review. Draft only. Review local legal requirements before use.",
      requiresConfirmation: true,
      destination: contextDestination,
      status: "blocked",
      blockedReason: "Notice draft preview is not enabled in this scaffold; no legal notice will be generated or sent.",
    }),
  ];
}
