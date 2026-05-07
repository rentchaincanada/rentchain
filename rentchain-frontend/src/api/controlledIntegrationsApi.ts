import { apiFetch } from "./apiFetch";

export type ControlledIntegrationType =
  | "registry"
  | "lender"
  | "insurer"
  | "regulator"
  | "accounting"
  | "payment_provider"
  | "operational_partner";
export type ControlledIntegrationStatus = "disabled" | "sandbox_ready" | "review_required" | "partially_ready" | "blocked";
export type ControlledIntegrationReferenceType =
  | "adapter"
  | "review"
  | "evidence"
  | "settlement"
  | "regulatory"
  | "observability"
  | "governance"
  | "audit";
export type ControlledIntegrationReferenceStatus = "verified" | "partially_verified" | "blocked" | "unavailable";

export type ControlledIntegrationReference = {
  referenceId: string;
  referenceType: ControlledIntegrationReferenceType;
  status: ControlledIntegrationReferenceStatus;
  label: string;
  description: string;
  reviewRequired: true;
  lineageReferences: string[];
  destination: string | null;
  redacted: boolean;
  redactionReason: string | null;
  blockedReason: string | null;
};

export type ControlledIntegrationRestriction = {
  restrictionId: string;
  restrictionType:
    | ControlledIntegrationReferenceType
    | "external_synchronization"
    | "webhook_execution"
    | "financial_execution"
    | "live_settlement"
    | "provider_execution";
  status: "visible" | "blocked" | "review_required";
  label: string;
  description: string;
  blockedReason: string | null;
};

export type ControlledIntegrationProfile = {
  controlledIntegrationId: string;
  integrationType: ControlledIntegrationType;
  status: ControlledIntegrationStatus;
  manualApprovalRequired: true;
  liveSynchronizationEnabled: false;
  autonomousExecutionEnabled: false;
  webhookExecutionEnabled: false;
  generatedAt: string;
  summary: {
    totalReferences: number;
    verifiedReferences: number;
    partiallyVerifiedReferences: number;
    blockedReferences: number;
    unavailableReferences: number;
    restrictions: number;
  };
  adapterReferences: ControlledIntegrationReference[];
  reviewReferences: ControlledIntegrationReference[];
  evidenceReferences: ControlledIntegrationReference[];
  settlementReferences: ControlledIntegrationReference[];
  regulatoryReferences: ControlledIntegrationReference[];
  observabilityReferences: ControlledIntegrationReference[];
  releaseGovernanceReferences: ControlledIntegrationReference[];
  auditReferences: ControlledIntegrationReference[];
  integrationRestrictions: ControlledIntegrationRestriction[];
  redactions: string[];
  blockedReasons: string[];
  canonicalEvents: Array<{ eventType: string; action: string; status: ControlledIntegrationStatus; resourceId: string; summary: string }>;
};

export async function fetchControlledIntegrationProfiles(params?: {
  integrationType?: ControlledIntegrationType | "";
  status?: ControlledIntegrationStatus | "";
}): Promise<ControlledIntegrationProfile[]> {
  const search = new URLSearchParams();
  if (params?.integrationType) search.set("integrationType", params.integrationType);
  if (params?.status) search.set("status", params.status);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  const response = await apiFetch<{ ok: true; profiles: ControlledIntegrationProfile[] }>(`/admin/controlled-integrations${suffix}`);
  return response.profiles;
}

export async function fetchControlledIntegrationProfile(controlledIntegrationId: string): Promise<ControlledIntegrationProfile> {
  const response = await apiFetch<{ ok: true; profile: ControlledIntegrationProfile }>(
    `/admin/controlled-integrations/${encodeURIComponent(controlledIntegrationId)}`
  );
  return response.profile;
}
