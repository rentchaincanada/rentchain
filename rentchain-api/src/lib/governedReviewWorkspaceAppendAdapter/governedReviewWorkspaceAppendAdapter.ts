import crypto from "crypto";
import {
  validateGovernedReviewWorkspacePersistenceCandidate,
  type GovernedReviewWorkspacePersistenceRecord,
} from "../governedReviewWorkspacePersistence/governedReviewWorkspacePersistence";

export const GOVERNED_REVIEW_WORKSPACE_APPEND_ADAPTER_VERSION =
  "governed_review_workspace_append_only_adapter_v1";

export type GovernedReviewWorkspaceAppendActorRole = "admin" | "support" | "unknown";

export type GovernedReviewWorkspaceAppendActorContext = {
  actorRole?: unknown;
  displayName?: unknown;
  permission?: unknown;
  supportAuthorized?: unknown;
};

export type GovernedReviewWorkspaceAppendEnvelope = {
  governedReviewWorkspaceAppendAdapterVersion: typeof GOVERNED_REVIEW_WORKSPACE_APPEND_ADAPTER_VERSION;
  appendEnvelopeId: string;
  appendOnly: true;
  appendOperation: "append_workspace_record";
  storageTarget: "governed_review_workspace_append_log";
  storageWriteDecision: "adapter_port_only_firestore_deferred";
  actorSummary: {
    role: GovernedReviewWorkspaceAppendActorRole;
    displayName: string | null;
    systemAdminAuthorized: boolean;
    supportAuthorized: boolean;
    rawActorIdsIncluded: false;
  };
  occurredAt: string;
  warnings: string[];
  record: GovernedReviewWorkspacePersistenceRecord;
  metadataOnly: true;
  visibilityClass: "admin_support_internal";
  tenantVisible: false;
  landlordVisible: false;
  supportPowersGranted: false;
  impersonationEnabled: false;
  autonomousRemediationEnabled: false;
  autonomousEscalationEnabled: false;
  financialMutationEnabled: false;
  routeVisibilityChanged: false;
  mutationControlsEnabled: false;
  rawPayloadAccessEnabled: false;
  createRouteEnabled: false;
  updateRouteEnabled: false;
  deleteRouteEnabled: false;
  statusMutationEnabled: false;
  redactionSummary: string;
};

export type GovernedReviewWorkspaceAppendStore = {
  append(envelope: GovernedReviewWorkspaceAppendEnvelope): Promise<void>;
};

export type GovernedReviewWorkspaceAppendResult =
  | {
      ok: true;
      envelope: GovernedReviewWorkspaceAppendEnvelope;
    }
  | {
      ok: false;
      error: "admin_support_authority_required";
      metadataOnly: true;
      tenantVisible: false;
      landlordVisible: false;
      supportPowersGranted: false;
      rawPayloadAccessEnabled: false;
    };

type AppendInput = {
  actor: GovernedReviewWorkspaceAppendActorContext;
  candidate: Parameters<typeof validateGovernedReviewWorkspacePersistenceCandidate>[0];
  occurredAt?: unknown;
};

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function normalizeKey(value: unknown): string {
  return asString(value, 120).toLowerCase().replace(/[\s.-]+/g, "_");
}

function stableHash(value: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex").slice(0, 16);
}

function toIso(value: unknown): string {
  if (value && typeof (value as any).toDate === "function") return (value as any).toDate().toISOString();
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value).toISOString();
  const raw = asString(value, 120);
  const parsed = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date(0).toISOString();
}

function safeLabel(value: unknown, max = 120): string | null {
  const label = asString(value, max).replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
  if (!label) return null;
  if (/gs:\/\//i.test(label) || /storage\.googleapis\.com/i.test(label)) return null;
  if (/token|secret|credential|authorization|cookie|password|bearer/i.test(label)) return null;
  if (/^[a-zA-Z0-9_-]{16,}$/.test(label)) return null;
  return label;
}

function normalizeActorRole(value: unknown): GovernedReviewWorkspaceAppendActorRole {
  const normalized = normalizeKey(value);
  if (normalized === "admin" || normalized === "system_admin") return "admin";
  if (normalized === "support" || normalized === "operator_support") return "support";
  return "unknown";
}

function actorSummary(actor: GovernedReviewWorkspaceAppendActorContext): GovernedReviewWorkspaceAppendEnvelope["actorSummary"] {
  const role = normalizeActorRole(actor.actorRole);
  const permission = normalizeKey(actor.permission);
  return {
    role,
    displayName: safeLabel(actor.displayName),
    systemAdminAuthorized: permission === "system_admin" || permission === "system.admin" || role === "admin",
    supportAuthorized: Boolean(actor.supportAuthorized) || role === "support",
    rawActorIdsIncluded: false,
  };
}

function actorCanAppend(summary: GovernedReviewWorkspaceAppendEnvelope["actorSummary"]): boolean {
  return summary.systemAdminAuthorized || summary.supportAuthorized;
}

function safeFlags() {
  return {
    metadataOnly: true as const,
    visibilityClass: "admin_support_internal" as const,
    tenantVisible: false as const,
    landlordVisible: false as const,
    supportPowersGranted: false as const,
    impersonationEnabled: false as const,
    autonomousRemediationEnabled: false as const,
    autonomousEscalationEnabled: false as const,
    financialMutationEnabled: false as const,
    routeVisibilityChanged: false as const,
    mutationControlsEnabled: false as const,
    rawPayloadAccessEnabled: false as const,
    createRouteEnabled: false as const,
    updateRouteEnabled: false as const,
    deleteRouteEnabled: false as const,
    statusMutationEnabled: false as const,
  };
}

export function buildGovernedReviewWorkspaceAppendEnvelope(input: AppendInput): GovernedReviewWorkspaceAppendResult {
  const validation = validateGovernedReviewWorkspacePersistenceCandidate(input.candidate);
  const actor = actorSummary(input.actor || {});
  if (!actorCanAppend(actor)) {
    return {
      ok: false,
      error: "admin_support_authority_required",
      metadataOnly: true,
      tenantVisible: false,
      landlordVisible: false,
      supportPowersGranted: false,
      rawPayloadAccessEnabled: false,
    };
  }
  const occurredAt = toIso(input.occurredAt);
  const record = validation.record;
  return {
    ok: true,
    envelope: {
      governedReviewWorkspaceAppendAdapterVersion: GOVERNED_REVIEW_WORKSPACE_APPEND_ADAPTER_VERSION,
      appendEnvelopeId: `governed_workspace_append:${stableHash([
        record.persistenceContractId,
        actor.role,
        actor.displayName,
        occurredAt,
      ])}`,
      appendOnly: true,
      appendOperation: "append_workspace_record",
      storageTarget: "governed_review_workspace_append_log",
      storageWriteDecision: "adapter_port_only_firestore_deferred",
      actorSummary: actor,
      occurredAt,
      warnings: validation.warnings,
      record,
      redactionSummary:
        "Append adapter envelopes are metadata-only and append-only. Raw notes, documents, provider payloads, screening reports, storage paths, tokens, secrets, request/response bodies, stack traces, debug payloads, raw IDs as labels, and policy internals are excluded.",
      ...safeFlags(),
    },
  };
}

export function createGovernedReviewWorkspaceAppendAdapter(store: GovernedReviewWorkspaceAppendStore) {
  return {
    async appendWorkspaceRecord(input: AppendInput): Promise<GovernedReviewWorkspaceAppendResult> {
      const result = buildGovernedReviewWorkspaceAppendEnvelope(input);
      if (!result.ok) return result;
      await store.append(result.envelope);
      return result;
    },
  };
}
