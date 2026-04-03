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
  status: "uploaded" | "processing" | "completed" | "failed";
  errorSummary: string | null;
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
  } | null;
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
  }>;
  auditTrail: Array<{
    id: string;
    actorType: string;
    actorId: string | null;
    eventType: string;
    eventData: Record<string, unknown>;
    createdAt: string;
  }>;
};

export type AdminPropertyRegistryReview = {
  property: any;
  projection: any;
  matches: RegistryReviewItem["match"][];
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

export async function fetchAdminRegistryReview(matchStatus: string = "all") {
  const query = new URLSearchParams();
  if (matchStatus && matchStatus !== "all") query.set("matchStatus", matchStatus);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const response = await apiFetch<{ ok: true; items: RegistryReviewItem[] }>(`/admin/registry/review${suffix}`);
  return response.items;
}

export async function fetchAdminRegistryRecordDetail(normalizedRecordId: string) {
  return apiFetch<RegistryRecordDetail>(`/admin/registry/records/${encodeURIComponent(normalizedRecordId)}`);
}

export async function overrideAdminRegistryRecord(input: {
  normalizedRecordId: string;
  action: "attach" | "ignore";
  propertyId?: string | null;
  reason: string;
}) {
  return apiFetch(`/admin/registry/records/${encodeURIComponent(input.normalizedRecordId)}/override`, {
    method: "POST",
    body: {
      action: input.action,
      propertyId: input.propertyId || null,
      reason: input.reason,
    },
  });
}

export async function fetchAdminPropertyRegistryReview(propertyId: string) {
  return apiFetch<AdminPropertyRegistryReview>(`/admin/registry/properties/${encodeURIComponent(propertyId)}`);
}

export async function reEvaluateAdminPropertyRegistry(propertyId: string) {
  return apiFetch(`/admin/registry/properties/${encodeURIComponent(propertyId)}/re-evaluate`, {
    method: "POST",
  });
}
