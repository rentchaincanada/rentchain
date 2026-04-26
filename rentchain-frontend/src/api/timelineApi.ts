import { apiFetch } from "./apiFetch";

export type TimelineItem = {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  domain: string;
  status?: string;
  actor?: string;
  details?: string[];
};

export type TimelineResponse = {
  events: TimelineItem[];
  nextCursor?: string;
};

export async function fetchTimeline(params?: {
  resourceId?: string | null;
  domain?: string | null;
  limit?: number | null;
  cursor?: string | null;
}): Promise<TimelineResponse> {
  const search = new URLSearchParams();
  if (params?.resourceId) search.set("resourceId", params.resourceId);
  if (params?.domain) search.set("domain", params.domain);
  if (typeof params?.limit === "number") search.set("limit", String(params.limit));
  if (params?.cursor) search.set("cursor", params.cursor);
  const query = search.toString();
  return await apiFetch<TimelineResponse>(`/timeline${query ? `?${query}` : ""}`);
}
