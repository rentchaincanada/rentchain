import { apiFetch } from "./apiFetch";

export type WatchlistEntryV1 = {
  version: "v1";
  id: string;
  target: {
    type: "portfolio" | "application" | "maintenance" | "lease";
    id: string;
    portfolioId?: string | null;
  };
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  notes?: string | null;
  tags?: string[];
  isActive: boolean;
};

export async function fetchWatchlist(params?: {
  targetType?: string | null;
  portfolioId?: string | null;
  activeOnly?: boolean | null;
  limit?: number | null;
  cursor?: string | null;
}): Promise<{ watchlist: WatchlistEntryV1[]; nextCursor?: string }> {
  const search = new URLSearchParams();
  if (params?.targetType) search.set("targetType", params.targetType);
  if (params?.portfolioId) search.set("portfolioId", params.portfolioId);
  if (typeof params?.activeOnly === "boolean") search.set("activeOnly", String(params.activeOnly));
  if (typeof params?.limit === "number") search.set("limit", String(params.limit));
  if (params?.cursor) search.set("cursor", params.cursor);
  const query = search.toString();
  return await apiFetch(`/admin/watchlist${query ? `?${query}` : ""}`);
}

export async function createWatchlistEntry(payload: {
  targetType: "portfolio" | "application" | "maintenance" | "lease";
  targetId: string;
  portfolioId?: string | null;
  notes?: string | null;
  tags?: string[];
}) {
  return await apiFetch(`/admin/watchlist`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateWatchlistEntry(
  watchId: string,
  payload: {
    isActive?: boolean;
    notes?: string | null;
    tags?: string[];
  }
) {
  return await apiFetch(`/admin/watchlist/${encodeURIComponent(watchId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
