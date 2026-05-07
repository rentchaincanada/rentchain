import { apiFetch } from "./apiFetch";

export type ProductionIntegrationType =
  | "registry"
  | "accounting_export"
  | "screening_provider"
  | "lender_handoff"
  | "webhook_ingestion"
  | "operational_partner";
export type ProductionIntegrationStatus = "disabled" | "sandbox_ready" | "production_review_required" | "partially_ready" | "blocked";
export type ProductionIntegrationReferenceType = "activation" | "observability" | "rollback" | "governance" | "review" | "evidence" | "audit";
export type ProductionIntegrationReferenceStatus = "verified" | "partially_verified" | "blocked" | "unavailable";

export type ProductionIntegrationReference = {
  referenceId: string;
  referenceType: ProductionIntegrationReferenceType;
  status: ProductionIntegrationReferenceStatus;
  label: string;
  description: string;
  reviewRequired: true;
  lineageReferences: string[];
  destination: string | null;
  redacted: boolean;
  redactionReason: string | null;
  blockedReason: string | null;
};

export type ProductionIntegrationRestriction = {
  restrictionId: string;
  restrictionType:
    | ProductionIntegrationReferenceType
    | "operational_risk"
    | "regulatory"
    | "payment_execution"
    | "settlement_execution"
    | "unrestricted_webhook_execution"
    | "autonomous_provider_orchestration"
    | "external_mutation";
  status: "visible" | "blocked" | "review_required";
  label: string;
  description: string;
  blockedReason: string | null;
};

export type ProductionIntegrationProfile = {
  productionIntegrationId: string;
  integrationType: ProductionIntegrationType;
  status: ProductionIntegrationStatus;
  manualApprovalRequired: true;
  autonomousExecutionEnabled: false;
  paymentExecutionEnabled: false;
  unrestrictedWebhookExecutionEnabled: false;
  generatedAt: string;
  summary: {
    totalReferences: number;
    verifiedReferences: number;
    partiallyVerifiedReferences: number;
    blockedReferences: number;
    unavailableReferences: number;
    restrictions: number;
  };
  activationReferences: ProductionIntegrationReference[];
  observabilityReferences: ProductionIntegrationReference[];
  rollbackReferences: ProductionIntegrationReference[];
  reviewReferences: ProductionIntegrationReference[];
  evidenceReferences: ProductionIntegrationReference[];
  governanceReferences: ProductionIntegrationReference[];
  auditReferences: ProductionIntegrationReference[];
  integrationRestrictions: ProductionIntegrationRestriction[];
  redactions: string[];
  blockedReasons: string[];
  canonicalEvents: Array<{ eventType: string; action: string; status: ProductionIntegrationStatus; resourceId: string; summary: string }>;
};

export async function fetchProductionIntegrationProfiles(params?: {
  integrationType?: ProductionIntegrationType | "";
  status?: ProductionIntegrationStatus | "";
}): Promise<ProductionIntegrationProfile[]> {
  const search = new URLSearchParams();
  if (params?.integrationType) search.set("integrationType", params.integrationType);
  if (params?.status) search.set("status", params.status);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  const response = await apiFetch<{ ok: true; profiles: ProductionIntegrationProfile[] }>(`/admin/production-integrations${suffix}`);
  return response.profiles;
}

export async function fetchProductionIntegrationProfile(productionIntegrationId: string): Promise<ProductionIntegrationProfile> {
  const response = await apiFetch<{ ok: true; profile: ProductionIntegrationProfile }>(
    `/admin/production-integrations/${encodeURIComponent(productionIntegrationId)}`
  );
  return response.profile;
}
