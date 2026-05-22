import crypto from "crypto";

export const IMPERSONATION_GOVERNANCE_VERSION = "impersonation_governance_v1";

export type ImpersonationLifecycleState =
  | "requested"
  | "started"
  | "active"
  | "ended"
  | "expired"
  | "revoked"
  | "denied";

export type ImpersonationReasonCategory =
  | "customer_support"
  | "incident_review"
  | "evidence_review"
  | "export_review"
  | "screening_review"
  | "billing_support"
  | "technical_diagnostics"
  | "security_investigation"
  | "compliance_review";

export type ImpersonationTargetRole = "tenant" | "landlord";

export type ImpersonationPolicyDecision = "allowed" | "denied" | "expired" | "revoked";

export type ImpersonationActorChain = {
  realActorId: string;
  realActorRole: "admin" | "support";
  effectiveActorId: string;
  effectiveActorRole: ImpersonationTargetRole;
  impersonationSessionId: string;
  actingAsRole: ImpersonationTargetRole;
  supportAttribution: true;
};

export type ImpersonationAuditEvent = {
  impersonationGovernanceVersion: typeof IMPERSONATION_GOVERNANCE_VERSION;
  eventType:
    | "impersonation.started"
    | "impersonation.ended"
    | "impersonation.expired"
    | "impersonation.revoked"
    | "impersonation.denied";
  sessionId: string;
  lifecycleState: ImpersonationLifecycleState;
  reasonCategory: ImpersonationReasonCategory;
  actorChain: ImpersonationActorChain;
  targetAccountType: ImpersonationTargetRole;
  targetAccountId: string;
  targetLandlordId: string | null;
  occurredAt: string;
  startedAt: string | null;
  endedAt: string | null;
  sourceActionFamily: "admin_support_impersonation";
  policyDecision: ImpersonationPolicyDecision;
  visibilityClass: "admin_support_internal";
  metadataOnly: true;
  tenantVisible: false;
  supportProjectionSafe: true;
  payloadSafety: {
    sensitiveData: "excluded";
    credentialData: "excluded";
    providerData: "excluded";
    debugData: "excluded";
  };
};

const VALID_STATES = new Set<ImpersonationLifecycleState>([
  "requested",
  "started",
  "active",
  "ended",
  "expired",
  "revoked",
  "denied",
]);

const VALID_REASONS = new Set<ImpersonationReasonCategory>([
  "customer_support",
  "incident_review",
  "evidence_review",
  "export_review",
  "screening_review",
  "billing_support",
  "technical_diagnostics",
  "security_investigation",
  "compliance_review",
]);

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function normalizeKey(value: unknown): string {
  return asString(value, 120).toLowerCase().replace(/[\s.-]+/g, "_");
}

function toIso(value: unknown, fallback = new Date(0)): string {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  const raw = asString(value, 120);
  const parsed = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback.toISOString();
}

function stablePart(value: unknown): string {
  return asString(value, 240)
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function normalizeImpersonationLifecycleState(value: unknown): ImpersonationLifecycleState {
  const normalized = normalizeKey(value);
  return VALID_STATES.has(normalized as ImpersonationLifecycleState)
    ? (normalized as ImpersonationLifecycleState)
    : "denied";
}

export function normalizeImpersonationReasonCategory(value: unknown): ImpersonationReasonCategory | null {
  const normalized = normalizeKey(value);
  return VALID_REASONS.has(normalized as ImpersonationReasonCategory)
    ? (normalized as ImpersonationReasonCategory)
    : null;
}

export function buildImpersonationSessionId(input: {
  realActorId: string;
  effectiveActorId: string;
  occurredAt: unknown;
  nonce?: string | null;
}): string {
  const basis = [
    "impersonation",
    stablePart(input.realActorId),
    stablePart(input.effectiveActorId),
    toIso(input.occurredAt),
    stablePart(input.nonce || crypto.randomUUID()),
  ].join(":");
  return basis || "impersonation:unknown";
}

export function buildImpersonationActorChain(input: {
  realActorId: string;
  realActorRole: unknown;
  effectiveActorId: string;
  effectiveActorRole: ImpersonationTargetRole;
  impersonationSessionId: string;
}): ImpersonationActorChain | null {
  const realActorId = asString(input.realActorId, 240);
  const effectiveActorId = asString(input.effectiveActorId, 240);
  const sessionId = asString(input.impersonationSessionId, 300);
  const role = normalizeKey(input.realActorRole);
  if (!realActorId || !effectiveActorId || !sessionId) return null;
  if (role !== "admin" && role !== "support") return null;
  return {
    realActorId,
    realActorRole: role,
    effectiveActorId,
    effectiveActorRole: input.effectiveActorRole,
    impersonationSessionId: sessionId,
    actingAsRole: input.effectiveActorRole,
    supportAttribution: true,
  };
}

export function buildImpersonationAuditEvent(input: {
  eventType: ImpersonationAuditEvent["eventType"];
  sessionId: string;
  lifecycleState: unknown;
  reasonCategory: unknown;
  realActorId: string;
  realActorRole: unknown;
  effectiveActorId: string;
  effectiveActorRole: ImpersonationTargetRole;
  targetAccountId: string;
  targetAccountType: ImpersonationTargetRole;
  targetLandlordId?: string | null;
  occurredAt?: unknown;
  startedAt?: unknown;
  endedAt?: unknown;
  policyDecision: ImpersonationPolicyDecision;
}): ImpersonationAuditEvent {
  const occurredAt = toIso(input.occurredAt, new Date());
  const reasonCategory = normalizeImpersonationReasonCategory(input.reasonCategory);
  if (!reasonCategory) throw new Error("impersonation_reason_required");
  const actorChain = buildImpersonationActorChain({
    realActorId: input.realActorId,
    realActorRole: input.realActorRole,
    effectiveActorId: input.effectiveActorId,
    effectiveActorRole: input.effectiveActorRole,
    impersonationSessionId: input.sessionId,
  });
  if (!actorChain) throw new Error("impersonation_actor_chain_invalid");

  return {
    impersonationGovernanceVersion: IMPERSONATION_GOVERNANCE_VERSION,
    eventType: input.eventType,
    sessionId: asString(input.sessionId, 300),
    lifecycleState: normalizeImpersonationLifecycleState(input.lifecycleState),
    reasonCategory,
    actorChain,
    targetAccountType: input.targetAccountType,
    targetAccountId: asString(input.targetAccountId, 240),
    targetLandlordId: asString(input.targetLandlordId, 240) || null,
    occurredAt,
    startedAt: input.startedAt == null ? null : toIso(input.startedAt),
    endedAt: input.endedAt == null ? null : toIso(input.endedAt),
    sourceActionFamily: "admin_support_impersonation",
    policyDecision: input.policyDecision,
    visibilityClass: "admin_support_internal",
    metadataOnly: true,
    tenantVisible: false,
    supportProjectionSafe: true,
    payloadSafety: {
      sensitiveData: "excluded",
      credentialData: "excluded",
      providerData: "excluded",
      debugData: "excluded",
    },
  };
}

export function buildImpersonationTelemetryMeta(event: ImpersonationAuditEvent) {
  return {
    sessionId: event.sessionId,
    lifecycleState: event.lifecycleState,
    reasonCategory: event.reasonCategory,
    realActorId: event.actorChain.realActorId,
    realActorRole: event.actorChain.realActorRole,
    effectiveActorId: event.actorChain.effectiveActorId,
    effectiveActorRole: event.actorChain.effectiveActorRole,
    targetAccountType: event.targetAccountType,
    targetAccountId: event.targetAccountId,
    targetLandlordId: event.targetLandlordId,
    sourceActionFamily: event.sourceActionFamily,
    policyDecision: event.policyDecision,
    visibilityClass: event.visibilityClass,
    metadataOnly: event.metadataOnly,
    tenantVisible: event.tenantVisible,
    supportProjectionSafe: event.supportProjectionSafe,
  };
}
