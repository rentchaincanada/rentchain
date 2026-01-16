import { apiFetch } from "./apiFetch";

export type ApplicationLinkResponse = {
  ok: boolean;
  data?: {
    id: string;
    url: string;
    expiresAt: number;
  };
};

export async function createApplicationLink(params: {
  propertyId: string;
  unitId?: string | null;
  expiresInDays?: number;
}): Promise<ApplicationLinkResponse> {
  return apiFetch("/application-links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
}
