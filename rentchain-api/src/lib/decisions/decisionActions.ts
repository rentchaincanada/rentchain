import crypto from "crypto";
import type { Decision, DecisionStatus } from "./decisionEngine";

export const DECISION_ACTIONS_COLLECTION = "decisionActions";

export type DecisionActionType = "reviewed" | "snoozed" | "assigned" | "dismissed" | "resolved";

export type DecisionAction = {
  actionId: string;
  decisionId: string;
  leaseId: string;
  propertyId: string | null;
  unitId: string | null;
  landlordId: string | null;
  actorId: string | null;
  actorEmail?: string | null;
  actionType: DecisionActionType;
  previousStatus: DecisionStatus;
  nextStatus: DecisionStatus;
  note?: string | null;
  assignedTo?: string | null;
  snoozedUntil?: string | null;
  createdAt: string;
};

export type DecisionActionPatch = {
  actionType: DecisionActionType;
  note?: string | null;
  assignedTo?: string | null;
  snoozedUntil?: string | null;
};

export type DecisionWithActions = Decision & {
  latestAction: DecisionAction | null;
};

const VALID_ACTIONS = new Set<DecisionActionType>(["reviewed", "snoozed", "assigned", "dismissed", "resolved"]);

function asString(value: unknown, max = 1000): string {
  return String(value ?? "").trim().slice(0, max);
}

function toIsoDate(value: unknown): string | null {
  const raw = asString(value, 120);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function cleanIdPart(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function nextStatusForAction(actionType: DecisionActionType): DecisionStatus {
  if (actionType === "reviewed") return "reviewed";
  if (actionType === "snoozed") return "snoozed";
  if (actionType === "assigned") return "assigned";
  if (actionType === "dismissed") return "dismissed";
  return "resolved";
}

export function normalizeDecisionAction(raw: unknown): DecisionAction | null {
  const data = (raw || {}) as Record<string, unknown>;
  const actionId = asString(data.actionId || data.id, 240);
  const decisionId = asString(data.decisionId, 500);
  const leaseId = asString(data.leaseId, 240);
  const actionType = asString(data.actionType, 40) as DecisionActionType;
  const previousStatus = asString(data.previousStatus, 40) as DecisionStatus;
  const nextStatus = asString(data.nextStatus, 40) as DecisionStatus;
  const createdAt = toIsoDate(data.createdAt);
  if (!actionId || !decisionId || !leaseId || !createdAt || !VALID_ACTIONS.has(actionType)) return null;
  if (!nextStatus) return null;
  return {
    actionId,
    decisionId,
    leaseId,
    propertyId: asString(data.propertyId, 240) || null,
    unitId: asString(data.unitId, 240) || null,
    landlordId: asString(data.landlordId, 240) || null,
    actorId: asString(data.actorId, 240) || null,
    actorEmail: asString(data.actorEmail, 320) || null,
    actionType,
    previousStatus: previousStatus || "detected",
    nextStatus,
    note: asString(data.note, 1000) || null,
    assignedTo: asString(data.assignedTo, 240) || null,
    snoozedUntil: toIsoDate(data.snoozedUntil),
    createdAt,
  };
}

export function parseDecisionActionPatch(body: unknown): DecisionActionPatch | null {
  const data = (body || {}) as Record<string, unknown>;
  const actionType = asString(data.actionType, 40) as DecisionActionType;
  if (!VALID_ACTIONS.has(actionType)) return null;
  const patch: DecisionActionPatch = {
    actionType,
    note: asString(data.note, 1000) || null,
  };
  if (actionType === "assigned") {
    patch.assignedTo = asString(data.assignedTo, 240) || null;
    if (!patch.assignedTo) return null;
  }
  if (actionType === "snoozed") {
    patch.snoozedUntil = toIsoDate(data.snoozedUntil);
    if (!patch.snoozedUntil) return null;
  }
  return patch;
}

export function buildDecisionAction(input: {
  decision: Decision;
  patch: DecisionActionPatch;
  existingActions?: DecisionAction[] | null;
  landlordId?: string | null;
  actorId?: string | null;
  actorEmail?: string | null;
  now?: string;
}): DecisionAction {
  const createdAt = toIsoDate(input.now) || new Date().toISOString();
  const current = applyDecisionActions([input.decision], input.existingActions || [])[0];
  const nextStatus = nextStatusForAction(input.patch.actionType);
  const seed = [
    input.decision.decisionId,
    input.patch.actionType,
    createdAt,
    crypto.randomUUID(),
  ].join(":");
  return {
    actionId: crypto.createHash("sha256").update(seed).digest("hex"),
    decisionId: input.decision.decisionId,
    leaseId: input.decision.leaseId,
    propertyId: input.decision.propertyId || null,
    unitId: input.decision.unitId || null,
    landlordId: asString(input.landlordId, 240) || null,
    actorId: asString(input.actorId, 240) || null,
    actorEmail: asString(input.actorEmail, 320) || null,
    actionType: input.patch.actionType,
    previousStatus: current.status || "detected",
    nextStatus,
    note: asString(input.patch.note, 1000) || null,
    assignedTo: input.patch.actionType === "assigned" ? asString(input.patch.assignedTo, 240) || null : null,
    snoozedUntil: input.patch.actionType === "snoozed" ? toIsoDate(input.patch.snoozedUntil) : null,
    createdAt,
  };
}

export function applyDecisionActions(decisions: Decision[], rawActions: unknown[]): DecisionWithActions[] {
  const latestByDecisionId = new Map<string, DecisionAction>();
  for (const raw of Array.isArray(rawActions) ? rawActions : []) {
    const action = normalizeDecisionAction(raw);
    if (!action) continue;
    const current = latestByDecisionId.get(action.decisionId);
    if (!current || action.createdAt.localeCompare(current.createdAt) >= 0) {
      latestByDecisionId.set(action.decisionId, action);
    }
  }

  return (decisions || []).map((decision) => {
    const latestAction = latestByDecisionId.get(decision.decisionId) || null;
    if (!latestAction) {
      return { ...decision, status: decision.status || "detected", latestAction: null };
    }
    return {
      ...decision,
      status: latestAction.nextStatus,
      updatedAt: latestAction.createdAt,
      latestAction,
    };
  });
}

export function decisionActionRecordId(action: DecisionAction): string {
  return cleanIdPart(["decision_action", action.decisionId, action.actionId].join(":")) || action.actionId;
}
