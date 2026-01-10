import { apiFetch } from "./apiFetch";

export type ApplicationLinkResponse = {
  ok: boolean;
  id?: string;
  token?: string;
  applicationUrl?: string;
};

export async function createApplicationLink(propertyId: string, unitId: string): Promise<ApplicationLinkResponse> {
  return apiFetch("/api/landlord/application-links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ propertyId, unitId }),
  });
}
