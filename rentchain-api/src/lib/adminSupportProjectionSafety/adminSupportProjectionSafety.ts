export type AdminSupportProjectionAudience =
  | "tenant"
  | "landlord"
  | "admin_support"
  | "export_public"
  | "export_user_safe"
  | "internal_debug";

export const ADMIN_SUPPORT_PROJECTION_SAFETY_VERSION = "admin_support_projection_safety_v1";

const USER_SAFE_AUDIENCES = new Set<AdminSupportProjectionAudience>([
  "tenant",
  "landlord",
  "export_public",
  "export_user_safe",
]);

const INTERNAL_KEYS = new Set([
  "realActorId",
  "realActorRole",
  "effectiveActorId",
  "effectiveActorRole",
  "impersonationSessionId",
  "impersonationReason",
  "impersonationStartedAt",
  "impersonationActive",
  "actorChain",
  "supportProjectionSafe",
  "visibilityClass",
  "sourceActionFamily",
  "policyDecision",
  "internalOnly",
  "tenantVisible",
  "debug",
  "debugPayload",
  "internalDebug",
  "routeSource",
]);

const ALWAYS_RESTRICTED_KEY_PATTERNS = [
  /token/i,
  /secret/i,
  /password/i,
  /credential/i,
  /raw.*payload/i,
  /provider.*payload/i,
  /raw.*report/i,
  /stack/i,
  /authorization/i,
  /cookie/i,
];

function normalizeAudience(value: unknown): AdminSupportProjectionAudience {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/[\s.-]+/g, "_");
  if (
    normalized === "tenant" ||
    normalized === "landlord" ||
    normalized === "admin_support" ||
    normalized === "export_public" ||
    normalized === "export_user_safe" ||
    normalized === "internal_debug"
  ) {
    return normalized;
  }
  return "export_user_safe";
}

function keyIsAlwaysRestricted(key: string) {
  return ALWAYS_RESTRICTED_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function keyIsInternal(key: string) {
  return INTERNAL_KEYS.has(key);
}

function safeString(value: unknown, max = 160): string | null {
  const next = String(value ?? "").trim().slice(0, max);
  return next || null;
}

function maybeImpersonationSummary(input: Record<string, unknown>) {
  const sessionId = safeString(input.impersonationSessionId || input.sessionId, 240);
  const lifecycleState = safeString(input.lifecycleState || input.state, 80);
  const reasonCategory = safeString(input.reasonCategory || input.impersonationReason, 120);
  const occurredAt = safeString(input.occurredAt, 120);
  const startedAt = safeString(input.startedAt || input.impersonationStartedAt, 120);
  const endedAt = safeString(input.endedAt, 120);
  const targetAccountType = safeString(input.targetAccountType, 80);
  const targetLandlordId = safeString(input.targetLandlordId, 240);
  const actorChain = input.actorChain && typeof input.actorChain === "object" ? (input.actorChain as Record<string, unknown>) : null;
  const realActorRole = safeString(input.realActorRole || actorChain?.realActorRole, 80);
  const effectiveActorRole = safeString(input.effectiveActorRole || actorChain?.effectiveActorRole, 80);

  if (
    !sessionId &&
    !lifecycleState &&
    !reasonCategory &&
    !realActorRole &&
    !effectiveActorRole &&
    !targetAccountType &&
    !targetLandlordId
  ) {
    return null;
  }

  return {
    schemaVersion: ADMIN_SUPPORT_PROJECTION_SAFETY_VERSION,
    sessionId,
    lifecycleState,
    reasonCategory,
    occurredAt,
    startedAt,
    endedAt,
    actorSummary: {
      realActorRole,
      effectiveActorRole,
      supportAttribution: true,
      rawActorIdsIncluded: false,
    },
    targetSummary: {
      accountType: targetAccountType,
      landlordScoped: Boolean(targetLandlordId),
      rawTargetIdsIncluded: false,
    },
    policyOutcomeSummary: safeString(input.policyDecision, 80),
    metadataOnly: true,
    tenantVisible: false,
    supportSafe: true,
  };
}

function cloneForAudience(value: unknown, audience: AdminSupportProjectionAudience): unknown {
  if (value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => cloneForAudience(item, audience));

  const source = value as Record<string, unknown>;
  if (audience === "admin_support" || audience === "internal_debug") {
    const summary = maybeImpersonationSummary(source);
    if (summary) return summary;
  }

  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(source)) {
    if (keyIsAlwaysRestricted(key)) continue;
    if (USER_SAFE_AUDIENCES.has(audience) && keyIsInternal(key)) continue;
    if (USER_SAFE_AUDIENCES.has(audience) && source.visibilityClass === "admin_support_internal") continue;
    output[key] = cloneForAudience(nested, audience);
  }
  return output;
}

export function projectAdminSupportMetadataForAudience<T = unknown>(payload: T, audience: unknown): T {
  return cloneForAudience(payload, normalizeAudience(audience)) as T;
}

export function stripAdminSupportInternalsForUser<T = unknown>(payload: T): T {
  return projectAdminSupportMetadataForAudience(payload, "export_user_safe");
}
