import { apiFetch } from "./apiFetch";

export type RegistrySourceView = {
  id: string;
  sourceKey: "halifax_r400";
  jurisdictionCountry: "CA";
  jurisdictionProvince: string;
  jurisdictionMunicipality: string;
  sourceType: "rental_registry";
  sourceLabel: string;
  sourceUrl: string | null;
  active: boolean;
  ingestionMode: "csv_upload";
  schemaVersion: number;
  refreshFrequency: "manual" | "weekly";
  latestImportId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RegistryImportView = {
  id: string;
  sourceKey: "halifax_r400";
  sourceFileName: string | null;
  sourceFileStoragePath: string | null;
  importBatchId: string;
  rowCount: number;
  parsedRowCount: number;
  normalizedRowCount: number;
  matchedRowCount: number;
  unmatchedRowCount: number;
  mismatchRowCount: number;
  ignoredRowCount: number;
  skippedRowCount: number;
  status: "uploaded" | "processing" | "completed" | "failed";
  errorSummary: string | null;
  diagnostics: {
    missingPidCount: number;
    missingAddressCount: number;
    unsupportedStatusCount: number;
    invalidNumericFieldCount: number;
    duplicateRowHashCount: number;
  };
  startedAt: string;
  completedAt: string | null;
  createdBy: string | null;
  createdAt: string;
};

export type RegistryReviewItem = {
  match: {
    id: string;
    sourceKey: "halifax_r400";
    registryRecordId: string;
    normalizedRecordId: string;
    propertyId: string | null;
    landlordId: string | null;
    matchMethod: "pid_exact" | "address_exact" | "address_fuzzy" | "manual" | null;
    matchScore: number;
    matchStatus: "matched" | "possible_match" | "mismatch" | "unmatched" | "ignored";
    mismatchReasons: string[];
    reviewedBy: string | null;
    reviewedAt: string | null;
    overrideReason: string | null;
    createdAt: string;
    updatedAt: string;
  };
  normalizedRecord: {
    id: string;
    registryRecordId: string;
    registrationNumber: string | null;
    pid: string | null;
    addressRaw: string | null;
    addressNormalized: string | null;
    registrationStatusNormalized: "registered" | "pending_review" | "not_registered" | "unknown";
    registeredUnits: number | null;
    buildingTypeRaw: string | null;
  } | null;
  property: {
    id: string;
    name?: string | null;
    addressLine1?: string | null;
    city?: string | null;
    province?: string | null;
    postalCode?: string | null;
    pid?: string | null;
  } | null;
  topCandidate?: {
    propertyId: string;
    propertyName: string | null;
    addressLine1: string | null;
    city: string | null;
    province: string | null;
    postalCode: string | null;
    pid: string | null;
    unitCount?: number | null;
    score: number;
  } | null;
  reasonSummary?: string[];
};

export type RegistryRecordDetail = {
  normalizedRecord: any;
  rawRecord: any;
  match: RegistryReviewItem["match"] | null;
  candidates: Array<{
    propertyId: string;
    landlordId: string | null;
    propertyName: string | null;
    addressLine1: string | null;
    city: string | null;
    province: string | null;
    postalCode: string | null;
    pid: string | null;
    unitCount: number | null;
    buildingType: string | null;
    addressNormalized: string | null;
    score: number;
    comparison?: RegistryPropertyComparison | null;
  }>;
  operatorReview?: {
    reasonSummary: string[];
    pidState: RegistryPropertyComparison | null;
    registryPid: string | null;
    registryAddressCandidates: string[];
  };
  currentLinkedProperty?: RegistryAttachPropertySearchResult | null;
  propertyConflict?: RegistryReviewItem["match"] | null;
  auditTrail: Array<{
    id: string;
    actorType: string;
    actorId: string | null;
    eventType: string;
    eventData: Record<string, unknown>;
    createdAt: string;
  }>;
};

export type RegistryAttachPropertySearchResult = {
  id: string;
  name: string | null;
  addressLine1: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  landlordId: string | null;
  ownerUserId?: string | null;
  pid: string | null;
  unitCount: number | null;
};

export type RegistryPropertyComparison = {
  propertyId: string;
  propertyName: string | null;
  propertyAddress: string;
  propertyPid: string | null;
  registryRecordId: string | null;
  registryRegistrationNumber: string | null;
  registryAddress: string | null;
  registryPid: string | null;
  propertyPostalCode: string | null;
  registryPostalCode: string | null;
  propertyUnitCount: number | null;
  registryUnitCount: number | null;
  propertyBuildingType: string | null;
  registryBuildingType: string | null;
  pidStatus: "exact_match" | "missing_internal_pid" | "mismatch" | "missing_registry_pid" | "unavailable";
  exactAddressMatch: boolean;
  operatorPrompts: string[];
  reasonSummary: string[];
};

export type RegistryPidUpdateResult = {
  propertyId: string;
  previousPid: string | null;
  newPid: string | null;
  changed: boolean;
  reEvaluation: {
    matches: RegistryReviewItem["match"][];
    projection: any;
  };
};

export type AdminPropertyRegistryReview = {
  property: any;
  projection: any;
  matches: RegistryReviewItem["match"][];
  propertyPid: string | null;
  matchDetails: Array<RegistryReviewItem["match"] & {
    normalizedRecord: any;
    comparison: RegistryPropertyComparison;
    reasonSummary: string[];
  }>;
  selectedRecord?: any | null;
  selectedMatch?: RegistryReviewItem["match"] | null;
  selectedComparison?: RegistryPropertyComparison | null;
  conflictingMatch?: RegistryReviewItem["match"] | null;
};

export async function fetchAdminRegistrySources() {
  const response = await apiFetch<{ ok: true; items: RegistrySourceView[] }>("/admin/registry/sources");
  return response.items;
}

export async function fetchAdminRegistryImports(sourceKey?: string | null) {
  const suffix = sourceKey ? `?sourceKey=${encodeURIComponent(sourceKey)}` : "";
  const response = await apiFetch<{ ok: true; items: RegistryImportView[] }>(`/admin/registry/imports${suffix}`);
  return response.items;
}

export async function startAdminRegistryImport(input: {
  sourceKey: "halifax_r400";
  csvText: string;
  sourceFileName?: string | null;
  sourceFileStoragePath?: string | null;
}) {
  return apiFetch("/admin/registry/imports", {
    method: "POST",
    body: input,
  });
}

export async function fetchAdminRegistryReview(matchStatus: string = "all", searchQuery?: string) {
  const query = new URLSearchParams();
  if (matchStatus && matchStatus !== "all") query.set("matchStatus", matchStatus);
  if (searchQuery?.trim()) query.set("q", searchQuery.trim());
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const response = await apiFetch<{ ok: true; items: RegistryReviewItem[] }>(`/admin/registry/review${suffix}`);
  return response.items;
}

export async function searchAdminRegistryAttachProperties(query: string) {
  const suffix = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
  const response = await apiFetch<{ ok: true; items: RegistryAttachPropertySearchResult[] }>(
    `/admin/registry/properties/search${suffix}`
  );
  return response.items;
}

export async function fetchAdminRegistryRecordDetail(normalizedRecordId: string) {
  return apiFetch<RegistryRecordDetail>(`/admin/registry/records/${encodeURIComponent(normalizedRecordId)}`);
}

export async function overrideAdminRegistryRecord(input: {
  normalizedRecordId: string;
  action: "attach" | "ignore" | "return_to_review" | "detach";
  propertyId?: string | null;
  reason: string;
  replaceExistingMatch?: boolean;
}) {
  return apiFetch(`/admin/registry/records/${encodeURIComponent(input.normalizedRecordId)}/override`, {
    method: "POST",
    body: {
      action: input.action,
      propertyId: input.propertyId || null,
      reason: input.reason,
      replaceExistingMatch: Boolean(input.replaceExistingMatch),
    },
  });
}

export async function fetchAdminPropertyRegistryReview(propertyId: string, input?: { normalizedRecordId?: string | null }) {
  const query = new URLSearchParams();
  if (input?.normalizedRecordId) query.set("normalizedRecordId", input.normalizedRecordId);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiFetch<AdminPropertyRegistryReview>(`/admin/registry/properties/${encodeURIComponent(propertyId)}${suffix}`);
}

export async function reEvaluateAdminPropertyRegistry(propertyId: string) {
  return apiFetch(`/admin/registry/properties/${encodeURIComponent(propertyId)}/re-evaluate`, {
    method: "POST",
  });
}

export async function applyRegistryPidToProperty(input: {
  normalizedRecordId: string;
  propertyId: string;
  reason: string;
  confirmOverwrite?: boolean;
}) {
  return apiFetch<RegistryPidUpdateResult>(
    `/admin/registry/records/${encodeURIComponent(input.normalizedRecordId)}/apply-property-pid`,
    {
      method: "POST",
      body: {
        propertyId: input.propertyId,
        reason: input.reason,
        confirmOverwrite: Boolean(input.confirmOverwrite),
      },
    }
  );
}
