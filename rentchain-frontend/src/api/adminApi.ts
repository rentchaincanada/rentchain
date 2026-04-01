import { apiFetch } from "./apiFetch";

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
