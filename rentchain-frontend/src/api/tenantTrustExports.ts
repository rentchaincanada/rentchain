import { tenantApiFetch } from "./tenantApiFetch";

export type TenantTrustExportAudience =
  | "tenant_portability"
  | "insurer"
  | "lender"
  | "institutional_landlord"
  | "auditor";

export type TenantTrustExportPurpose =
  | "tenant_controlled_portability"
  | "insurance_review"
  | "lender_review"
  | "institutional_landlord_review"
  | "auditor_review";

export type TenantTrustExportLifecycle =
  | "preview"
  | "prepared"
  | "revoked"
  | "expired"
  | "blocked"
  | "consent_required";

export type TenantTrustExportPreview = {
  exportId: string | null;
  schemaVersion: "tenant_trust_export.v1";
  audience: TenantTrustExportAudience;
  purpose: TenantTrustExportPurpose;
  lifecycle: TenantTrustExportLifecycle;
  consent: {
    required: true;
    granted: boolean;
    consentId: string | null;
    consentVersion: "tenant_trust_export_consent.v1";
    grantedAt: string | null;
    expiresAt: string | null;
    revokedAt: string | null;
    audience: TenantTrustExportAudience;
    purpose: TenantTrustExportPurpose;
    claimCategories: string[];
    summary: string;
  };
  expiresAt: string | null;
  revokedAt: string | null;
  generatedAt: string;
  metadataOnly: true;
  publicAccessEnabled: false;
  externalSubmissionEnabled: false;
  policyGated: true;
  package: {
    exportId: string;
    status: "export_ready" | "blocked" | "unavailable";
    lifecycle: "policy_evaluated" | "blocked" | "empty";
    blockedReasons: string[];
    exportSummaries: Array<{
      attestationId: string;
      claimCategory: string;
      claimLabel: string;
      claimDescription: string;
      consentExpiresAt: string | null;
      metadataOnly: true;
      rawEvidenceIncluded: false;
      rawProviderPayloadIncluded: false;
      supportMetadataIncluded: false;
      publicAccessEnabled: false;
      externalSubmissionEnabled: false;
      nonAuthorityDisclaimers: string[];
    }>;
    auditMetadata: {
      exportId: string;
      consentScoped: true;
      policyGated: true;
      manualOnly: true;
      publicAccessEnabled: false;
      externalSubmissionEnabled: false;
      portableAttestationCount: number;
      exportableAttestationCount: number;
      blockedAttestationCount: number;
    };
  };
  includedClaims: Array<{
    attestationId: string;
    claimCategory: string;
    claimLabel: string;
    lifecycleState: string;
    consentExpiresAt: string | null;
  }>;
  excludedClaims: Array<{
    attestationId: string;
    claimCategory: string;
    claimLabel: string;
    reasons: string[];
  }>;
  redactions: string[];
  disclaimers: string[];
};

export type TenantTrustExportRecord = TenantTrustExportPreview & {
  exportId: string;
  lifecycle: "prepared" | "revoked" | "expired" | "blocked";
  createdAt: string;
  updatedAt: string;
};

export type TenantTrustExportRequest = {
  audience: TenantTrustExportAudience;
  purpose?: TenantTrustExportPurpose;
  expiresInDays?: number;
  consentAccepted?: boolean;
};

export async function listTenantTrustExports(): Promise<TenantTrustExportRecord[]> {
  const res = await tenantApiFetch<{ ok: boolean; data: { items: TenantTrustExportRecord[] } }>("/tenant/trust-exports");
  return Array.isArray(res?.data?.items) ? res.data.items : [];
}

export async function previewTenantTrustExport(
  request: TenantTrustExportRequest
): Promise<TenantTrustExportPreview> {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantTrustExportPreview }>("/tenant/trust-exports/preview", {
    method: "POST",
    body: JSON.stringify(request),
  });
  return res.data;
}

export async function prepareTenantTrustExport(
  request: TenantTrustExportRequest
): Promise<TenantTrustExportRecord> {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantTrustExportRecord }>("/tenant/trust-exports", {
    method: "POST",
    body: JSON.stringify(request),
  });
  return res.data;
}

export async function revokeTenantTrustExport(exportId: string): Promise<TenantTrustExportRecord> {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantTrustExportRecord }>(
    `/tenant/trust-exports/${encodeURIComponent(exportId)}/revoke`,
    {
      method: "POST",
    }
  );
  return res.data;
}
