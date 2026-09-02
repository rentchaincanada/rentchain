import { tenantApiFetch } from "./tenantApiFetch";
import type { TenantSafeProjectionMetadata } from "./tenantPortal";
import {
  optionalTenantAttachmentNumber,
  optionalTenantAttachmentString,
  projectTenantAttachmentMetadata,
  tenantAttachmentInternalPath,
} from "./tenantAttachmentProjection";

export { projectTenantAttachmentMetadata } from "./tenantAttachmentProjection";

export type TenantAttachment = {
  id: string;
  documentReference?: string | null;
  tenantReference?: string | null;
  leaseReference?: string | null;
  draftReference?: string | null;
  ledgerReference?: string | null;
  title?: string | null;
  purpose?: string | null;
  purposeLabel?: string | null;
  fileName?: string | null;
  sha256?: string | null;
  createdAt?: number | null;
  label?: string | null;
  category?: string | null;
  status?: "missing" | "uploaded" | "pending_review" | "verified" | "needs_attention" | "reupload_requested";
  uploadedAt?: number | null;
  nextAction?: string | null;
  actionAvailable?: boolean;
  actionLabel?: string | null;
  actionPath?: string | null;
  helpLabel?: string | null;
  helpPath?: string | null;
};

export type TenantAttachmentSummary = {
  total: number;
  missing: number;
  uploaded: number;
  pendingReview: number;
  verified: number;
  needsAttention: number;
};

export type TenantAttachmentGuidance = {
  headline: string;
  nextSteps: string[];
  uploadEntryAvailable: boolean;
  uploadEntryLabel: string | null;
  uploadEntryPath: string | null;
  supportPath: string | null;
  supportLabel: string | null;
};

export type TenantAttachmentsResponse = {
  ok: boolean;
} & TenantSafeProjectionMetadata & {
  data: TenantAttachment[];
  summary?: TenantAttachmentSummary;
  guidance?: TenantAttachmentGuidance;
  updatedAt?: number | null;
};

function tenantAttachmentStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : undefined;
}

function projectTenantSafeProjectionMetadata(value: Record<string, unknown>): TenantSafeProjectionMetadata {
  const metadata: TenantSafeProjectionMetadata = {};
  const projectionVersion = optionalTenantAttachmentString(value.projectionVersion);
  if (projectionVersion) metadata.projectionVersion = projectionVersion;
  if (value.sensitivityClass === "sensitive") metadata.sensitivityClass = "sensitive";
  if (value.authorityBasis === "authenticated_tenant_scope") {
    metadata.authorityBasis = "authenticated_tenant_scope";
  }

  const sourceCollections = tenantAttachmentStringArray(value.sourceCollections);
  if (sourceCollections) metadata.sourceCollections = sourceCollections;

  if (Array.isArray(value.sourceRefs)) {
    metadata.sourceRefs = value.sourceRefs.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const raw = item as Record<string, unknown>;
      const sourceCollection = optionalTenantAttachmentString(raw.sourceCollection);
      const sourceId = optionalTenantAttachmentString(raw.sourceId);
      return sourceCollection && sourceId ? [{ sourceCollection, sourceId }] : [];
    });
  }

  if (value.redactionSummary && typeof value.redactionSummary === "object") {
    const raw = value.redactionSummary as Record<string, unknown>;
    const redactionPolicy = optionalTenantAttachmentString(raw.redactionPolicy);
    const redactedFieldGroups = tenantAttachmentStringArray(raw.redactedFieldGroups);
    const redactionCount = optionalTenantAttachmentNumber(raw.redactionCount);
    if (redactionPolicy && redactedFieldGroups && typeof redactionCount === "number") {
      metadata.redactionSummary = { redactionPolicy, redactedFieldGroups, redactionCount };
    }
  }

  if (value.projectionProfile && typeof value.projectionProfile === "object") {
    const raw = value.projectionProfile as Record<string, unknown>;
    const projectionName = optionalTenantAttachmentString(raw.projectionName);
    const profileProjectionVersion = optionalTenantAttachmentString(raw.projectionVersion);
    const scopeType = optionalTenantAttachmentString(raw.scopeType);
    const allowedSourceCollections = tenantAttachmentStringArray(raw.allowedSourceCollections);
    const allowedFieldGroups = tenantAttachmentStringArray(raw.allowedFieldGroups);
    const excludedFieldGroups = tenantAttachmentStringArray(raw.excludedFieldGroups);
    const relationshipBasis = optionalTenantAttachmentString(raw.relationshipBasis);
    const internalReferencePolicy = optionalTenantAttachmentString(raw.internalReferencePolicy);
    const redactionPolicy = optionalTenantAttachmentString(raw.redactionPolicy);
    if (
      projectionName &&
      profileProjectionVersion &&
      raw.audience === "tenant_workspace" &&
      scopeType &&
      allowedSourceCollections &&
      allowedFieldGroups &&
      excludedFieldGroups &&
      raw.sensitivityClass === "sensitive" &&
      raw.authorityBasis === "authenticated_tenant_scope" &&
      relationshipBasis &&
      internalReferencePolicy &&
      redactionPolicy
    ) {
      metadata.projectionProfile = {
        projectionName,
        projectionVersion: profileProjectionVersion,
        audience: "tenant_workspace",
        scopeType,
        allowedSourceCollections,
        allowedFieldGroups,
        excludedFieldGroups,
        sensitivityClass: "sensitive",
        authorityBasis: "authenticated_tenant_scope",
        relationshipBasis,
        internalReferencePolicy,
        redactionPolicy,
      };
    }
  }

  return metadata;
}

function projectSummary(value: unknown): TenantAttachmentSummary | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const number = (field: string) =>
    typeof raw[field] === "number" && Number.isFinite(raw[field]) ? Number(raw[field]) : 0;
  return {
    total: number("total"),
    missing: number("missing"),
    uploaded: number("uploaded"),
    pendingReview: number("pendingReview"),
    verified: number("verified"),
    needsAttention: number("needsAttention"),
  };
}

function projectGuidance(value: unknown): TenantAttachmentGuidance | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  return {
    headline: optionalTenantAttachmentString(raw.headline) || "",
    nextSteps: Array.isArray(raw.nextSteps)
      ? raw.nextSteps.filter((item): item is string => typeof item === "string")
      : [],
    uploadEntryAvailable: raw.uploadEntryAvailable === true,
    uploadEntryLabel: optionalTenantAttachmentString(raw.uploadEntryLabel) ?? null,
    uploadEntryPath: tenantAttachmentInternalPath(raw.uploadEntryPath) ?? null,
    supportPath: tenantAttachmentInternalPath(raw.supportPath) ?? null,
    supportLabel: optionalTenantAttachmentString(raw.supportLabel) ?? null,
  };
}

export function projectTenantAttachmentsResponse(value: unknown): TenantAttachmentsResponse {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    ...projectTenantSafeProjectionMetadata(raw),
    ok: raw.ok === true,
    data: Array.isArray(raw.data)
      ? raw.data.map(projectTenantAttachmentMetadata).filter((item): item is TenantAttachment => item !== null)
      : [],
    summary: projectSummary(raw.summary),
    guidance: projectGuidance(raw.guidance),
    updatedAt: optionalTenantAttachmentNumber(raw.updatedAt),
  };
}

export async function getTenantAttachments(): Promise<TenantAttachmentsResponse> {
  return projectTenantAttachmentsResponse(await tenantApiFetch<unknown>("/tenant/attachments"));
}
