import { apiFetch } from "./apiFetch";

export type RegulatoryProfileStatus = "ready_for_review" | "partially_ready" | "blocked" | "unknown";
export type RegulatoryReferenceStatus = "verified" | "partially_verified" | "blocked" | "unavailable";
export type RegulatoryReferenceType = "registry" | "screening" | "privacy" | "settlement" | "export" | "sharing" | "audit" | "review";

export type RegulatoryJurisdiction = { country: "CA"; province: string; municipality: string };

export type RegulatoryReference = {
  referenceId: string;
  referenceType: RegulatoryReferenceType;
  status: RegulatoryReferenceStatus;
  label: string;
  description: string;
  jurisdictionScope: RegulatoryJurisdiction;
  restrictionSummary: { restricted: boolean; reasons: string[] };
  reviewLineage: string[];
  evidenceLineage: string[];
  redacted: boolean;
  redactionReason: string | null;
  blockedReason: string | null;
  destination: string | null;
};

export type RegulatoryProfile = {
  regulatoryProfileId: string;
  jurisdiction: RegulatoryJurisdiction;
  status: RegulatoryProfileStatus;
  manualReviewRequired: true;
  legalCertificationEnabled: false;
  externalRegulatorSubmissionEnabled: false;
  generatedAt: string;
  summary: {
    totalReferences: number;
    verifiedReferences: number;
    partiallyReadyReferences: number;
    blockedReferences: number;
    unavailableReferences: number;
    restrictions: number;
  };
  registryReferences: RegulatoryReference[];
  screeningReadiness: RegulatoryReference[];
  privacyReadiness: RegulatoryReference[];
  sharingRestrictions: RegulatoryReference[];
  settlementRestrictions: RegulatoryReference[];
  reviewReferences: RegulatoryReference[];
  evidenceReferences: RegulatoryReference[];
  redactions: string[];
  blockedReasons: string[];
  canonicalEvents: Array<{ eventType: string; action: string; status: RegulatoryProfileStatus; resourceId: string; summary: string }>;
};

export async function fetchRegulatoryProfiles(params?: {
  country?: string;
  province?: string;
  municipality?: string;
  status?: RegulatoryProfileStatus | "";
}): Promise<RegulatoryProfile[]> {
  const search = new URLSearchParams();
  if (params?.country) search.set("country", params.country);
  if (params?.province) search.set("province", params.province);
  if (params?.municipality) search.set("municipality", params.municipality);
  if (params?.status) search.set("status", params.status);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  const response = await apiFetch<{ ok: true; profiles: RegulatoryProfile[] }>(`/landlord/regulatory-profiles${suffix}`);
  return response.profiles;
}

export async function fetchRegulatoryProfile(regulatoryProfileId: string): Promise<RegulatoryProfile> {
  const response = await apiFetch<{ ok: true; profile: RegulatoryProfile }>(
    `/landlord/regulatory-profiles/${encodeURIComponent(regulatoryProfileId)}`
  );
  return response.profile;
}
