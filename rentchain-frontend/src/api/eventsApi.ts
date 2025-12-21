import api from "./client";

export type EventItem = {
  id?: string;
  type?: string;
  message?: string;
  createdAt?: string;
  tenantId?: string;
  propertyId?: string;
};

export async function fetchRecentEvents(limit = 10): Promise<EventItem[]> {
  const res = await api.get("/events", { params: { limit } });
  const data = res.data;
  if (Array.isArray(data)) return data as EventItem[];
  if (Array.isArray(data?.items)) return data.items as EventItem[];
  return [];
}

export async function fetchTenantEvents(
  tenantId: string,
  limit = 25
): Promise<EventItem[]> {
  const res = await api.get("/events", { params: { tenantId, limit } });
  const data = res.data;
  if (Array.isArray(data)) return data as EventItem[];
  if (Array.isArray(data?.items)) return data.items as EventItem[];
  return [];
}

export async function fetchPropertyEvents(
  propertyId: string,
  limit = 25
): Promise<EventItem[]> {
  const res = await api.get("/events", { params: { propertyId, limit } });
  const data = res.data;
  if (Array.isArray(data)) return data as EventItem[];
  if (Array.isArray(data?.items)) return data.items as EventItem[];
  return [];
}

export async function fetchApplicationEvents(
  applicationId: string,
  limit = 25
): Promise<EventItem[]> {
  const res = await api.get("/events", { params: { applicationId, limit } });
  const data = res.data;
  if (Array.isArray(data)) return data as EventItem[];
  if (Array.isArray(data?.items)) return data.items as EventItem[];
  return [];
}

