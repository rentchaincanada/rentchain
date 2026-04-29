import { apiFetch } from "./apiFetch";
import { API_BASE_URL } from "./config";
import { getAuthToken } from "../lib/authToken";
import { getFirebaseIdToken } from "../lib/firebaseAuthToken";
import { parseContentDispositionFilename } from "./exportDownload";

export type AdminPropertyView = {
  id: string;
  name: string | null;
  address1: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  ownerUserId: string | null;
  landlordId: string | null;
  managerUserIds: string[];
  unitCount: number;
  occupiedUnitCount: number;
  vacantUnitCount: number;
  createdAt: string | number | null;
  updatedAt: string | number | null;
  integrity: {
    hasIssues: boolean;
    orphaned: boolean;
    missingOwner: boolean;
  };
};

export type FetchAdminPropertiesParams = {
  q?: string;
  province?: string;
  landlordId?: string;
  ownerUserId?: string;
  integrity?: "all" | "issues" | "orphaned" | "missingOwner";
  sortBy?: "createdAt" | "updatedAt" | "name";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export type AdminTenantView = {
  id: string;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  landlordId: string | null;
  propertyId: string | null;
  propertyName: string | null;
  unitId: string | null;
  unitNumber: string | null;
  leaseId: string | null;
  leaseStatus: string | null;
  screeningStatus: string | null;
  moveInStatus: string | null;
  currentLeaseStartDate: string | null;
  currentLeaseEndDate: string | null;
  createdAt: string | number | null;
  updatedAt: string | number | null;
  flags: {
    missingLeaseLink: boolean;
    missingPropertyLink: boolean;
    hasScreening: boolean;
  };
};

export type FetchAdminTenantsParams = {
  q?: string;
  landlordId?: string;
  propertyId?: string;
  leaseStatus?: string;
  screeningStatus?: string;
  moveInStatus?: string;
  sortBy?: "createdAt" | "updatedAt" | "fullName";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export type AdminLeaseView = {
  id: string;
  propertyId: string | null;
  propertyName: string | null;
  unitId: string | null;
  unitNumber: string | null;
  landlordId: string | null;
  tenantIds: string[];
  tenantNames: string[];
  status: string | null;
  monthlyRent: number | null;
  startDate: string | null;
  endDate: string | null;
  riskGrade: string | null;
  createdAt: string | number | null;
  updatedAt: string | number | null;
  integrity: {
    hasIssues: boolean;
    duplicateAgreement: boolean;
    occupancyMismatch: boolean;
  };
};

export type FetchAdminLeasesParams = {
  q?: string;
  landlordId?: string;
  propertyId?: string;
  status?: string;
  riskGrade?: string;
  integrity?: "all" | "issues" | "duplicateAgreement" | "occupancyMismatch";
  startAfter?: string;
  startBefore?: string;
  endAfter?: string;
  endBefore?: string;
  sortBy?: "createdAt" | "updatedAt" | "startDate" | "monthlyRent";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export type AdminOverview = {
  summary: {
    totalProperties: number;
    totalUnits: number;
    totalTenants: number;
    totalLeases: number;
    activeLeases: number;
    integrityWarnings: number;
    orphanRecords: number;
  };
  activity: {
    recentAdminAccessCount: number;
    recentHighImpactEvents: Array<{
      key: string;
      label: string;
      ts: string | number | null;
    }>;
  };
  integrity: {
    orphanProperties: number;
    missingOwnerLinks: number;
    duplicateActiveLeases: number;
    staleLeasePointers: number;
    propertyUnitMismatches: number;
  };
};

export type AdminIntegrity = {
  sections: Array<{
    key:
      | "orphan_properties"
      | "missing_owner_linkage"
      | "duplicate_active_leases"
      | "stale_lease_pointers"
      | "property_unit_mismatches";
    label: string;
    severity: "high" | "medium" | "low";
    count: number;
    description: string;
    samples: Array<{
      id: string;
      type: string;
      label: string;
      propertyId?: string | null;
      leaseId?: string | null;
      tenantId?: string | null;
      relatedAdminPath?: string | null;
    }>;
  }>;
  totals: {
    issueTypes: number;
    totalIssues: number;
    highSeverity: number;
    mediumSeverity: number;
    lowSeverity: number;
  };
};

export type AdminAudit = {
  summary: {
    recentAdminActions: number;
    recentExports: number;
    recentIntegrityEvents: number;
    recentSavedFilterActions: number;
  };
  sections: {
    adminActions: Array<{
      id: string;
      type: string;
      label: string;
      pageKey?: string | null;
      route?: string | null;
      occurredAt: string | number | null;
      relatedAdminPath?: string | null;
    }>;
    exports: Array<{
      id: string;
      exportType: string;
      label: string;
      rowCount?: number | null;
      capped?: boolean | null;
      occurredAt: string | number | null;
      relatedAdminPath?: string | null;
    }>;
    integrityEvents: Array<{
      id: string;
      severity?: string | null;
      label: string;
      eventType?: string | null;
      occurredAt: string | number | null;
      relatedAdminPath?: string | null;
    }>;
    savedFilterActions: Array<{
      id: string;
      action: string;
      pageKey?: string | null;
      label: string;
      occurredAt: string | number | null;
      relatedAdminPath?: string | null;
    }>;
  };
};

export type AdminSavedFilterPageKey = "properties" | "tenants" | "leases" | "integrity";

export type AdminSavedFilterPreset = {
  id: string;
  userId: string;
  pageKey: AdminSavedFilterPageKey;
  name: string;
  filters: Record<string, string | number | boolean | null>;
  createdAt: string | number;
  updatedAt: string | number;
};

export async function fetchAdminProperties(params?: FetchAdminPropertiesParams) {
  const query = new URLSearchParams();
  if (params?.q) query.set("q", params.q);
  if (params?.province) query.set("province", params.province);
  if (params?.landlordId) query.set("landlordId", params.landlordId);
  if (params?.ownerUserId) query.set("ownerUserId", params.ownerUserId);
  if (params?.integrity) query.set("integrity", params.integrity);
  if (params?.sortBy) query.set("sortBy", params.sortBy);
  if (params?.sortDir) query.set("sortDir", params.sortDir);
  if (params?.page) query.set("page", String(params.page));
  if (params?.pageSize) query.set("pageSize", String(params.pageSize));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiFetch<{
    ok: true;
    items: AdminPropertyView[];
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  }>(`/admin/properties${suffix}`);
}

export async function fetchAdminTenants(params?: FetchAdminTenantsParams) {
  const query = new URLSearchParams();
  if (params?.q) query.set("q", params.q);
  if (params?.landlordId) query.set("landlordId", params.landlordId);
  if (params?.propertyId) query.set("propertyId", params.propertyId);
  if (params?.leaseStatus) query.set("leaseStatus", params.leaseStatus);
  if (params?.screeningStatus) query.set("screeningStatus", params.screeningStatus);
  if (params?.moveInStatus) query.set("moveInStatus", params.moveInStatus);
  if (params?.sortBy) query.set("sortBy", params.sortBy);
  if (params?.sortDir) query.set("sortDir", params.sortDir);
  if (params?.page) query.set("page", String(params.page));
  if (params?.pageSize) query.set("pageSize", String(params.pageSize));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiFetch<{
    ok: true;
    items: AdminTenantView[];
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  }>(`/admin/tenants${suffix}`);
}

export async function fetchAdminLeases(params?: FetchAdminLeasesParams) {
  const query = new URLSearchParams();
  if (params?.q) query.set("q", params.q);
  if (params?.landlordId) query.set("landlordId", params.landlordId);
  if (params?.propertyId) query.set("propertyId", params.propertyId);
  if (params?.status) query.set("status", params.status);
  if (params?.riskGrade) query.set("riskGrade", params.riskGrade);
  if (params?.integrity) query.set("integrity", params.integrity);
  if (params?.startAfter) query.set("startAfter", params.startAfter);
  if (params?.startBefore) query.set("startBefore", params.startBefore);
  if (params?.endAfter) query.set("endAfter", params.endAfter);
  if (params?.endBefore) query.set("endBefore", params.endBefore);
  if (params?.sortBy) query.set("sortBy", params.sortBy);
  if (params?.sortDir) query.set("sortDir", params.sortDir);
  if (params?.page) query.set("page", String(params.page));
  if (params?.pageSize) query.set("pageSize", String(params.pageSize));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiFetch<{
    ok: true;
    items: AdminLeaseView[];
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  }>(`/admin/leases${suffix}`);
}

export async function fetchAdminOverview() {
  return apiFetch<{
    ok: true;
    summary: AdminOverview["summary"];
    activity: AdminOverview["activity"];
    integrity: AdminOverview["integrity"];
  }>("/admin/overview");
}

export async function fetchAdminIntegrity() {
  return apiFetch<{
    ok: true;
    sections: AdminIntegrity["sections"];
    totals: AdminIntegrity["totals"];
  }>("/admin/integrity");
}

export async function fetchAdminAudit() {
  return apiFetch<{
    ok: true;
    summary: AdminAudit["summary"];
    sections: AdminAudit["sections"];
  }>("/admin/audit");
}

export async function fetchAdminSavedFilters(pageKey: AdminSavedFilterPageKey) {
  return apiFetch<{
    ok: true;
    items: AdminSavedFilterPreset[];
  }>(`/admin/saved-filters?pageKey=${encodeURIComponent(pageKey)}`);
}

export async function createAdminSavedFilter(payload: {
  pageKey: AdminSavedFilterPageKey;
  name: string;
  filters: Record<string, string | number | boolean | null>;
}) {
  return apiFetch<{
    ok: true;
    item: AdminSavedFilterPreset;
  }>("/admin/saved-filters", {
    method: "POST",
    body: payload,
  });
}

export async function deleteAdminSavedFilter(id: string) {
  return apiFetch<{ ok: true }>(`/admin/saved-filters/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

function adminApiUrl(path: string, query?: URLSearchParams) {
  const base = API_BASE_URL.replace(/\/$/, "").replace(/\/api$/i, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const suffix = query?.toString() ? `?${query.toString()}` : "";
  return `${base}/api${normalized}${suffix}`;
}

async function downloadAdminCsv(path: string, params?: Record<string, string | number | null | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value == null || value === "") return;
    query.set(key, String(value));
  });

  const firebaseToken = await getFirebaseIdToken();
  const authToken = getAuthToken();
  const token = authToken || firebaseToken;
  const response = await fetch(adminApiUrl(path, query), {
    headers: {
      "x-api-client": "web",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Export failed (${response.status})`);
  }

  const blob = await response.blob();
  const filename = parseContentDispositionFilename(response.headers.get("content-disposition"), "admin-export.csv");
  return { blob, filename };
}

export async function exportAdminPropertiesCsv(params?: FetchAdminPropertiesParams) {
  return downloadAdminCsv("/admin/properties/export.csv", {
    q: params?.q,
    province: params?.province,
    landlordId: params?.landlordId,
    ownerUserId: params?.ownerUserId,
    integrity: params?.integrity,
    sortBy: params?.sortBy,
    sortDir: params?.sortDir,
  });
}

export async function exportAdminTenantsCsv(params?: FetchAdminTenantsParams) {
  return downloadAdminCsv("/admin/tenants/export.csv", {
    q: params?.q,
    landlordId: params?.landlordId,
    propertyId: params?.propertyId,
    leaseStatus: params?.leaseStatus,
    screeningStatus: params?.screeningStatus,
    moveInStatus: params?.moveInStatus,
    sortBy: params?.sortBy,
    sortDir: params?.sortDir,
  });
}

export async function exportAdminLeasesCsv(params?: FetchAdminLeasesParams) {
  return downloadAdminCsv("/admin/leases/export.csv", {
    q: params?.q,
    landlordId: params?.landlordId,
    propertyId: params?.propertyId,
    status: params?.status,
    riskGrade: params?.riskGrade,
    integrity: params?.integrity,
    startAfter: params?.startAfter,
    startBefore: params?.startBefore,
    endAfter: params?.endAfter,
    endBefore: params?.endBefore,
    sortBy: params?.sortBy,
    sortDir: params?.sortDir,
  });
}

export async function exportAdminIntegrityCsv() {
  return downloadAdminCsv("/admin/integrity/export.csv");
}
