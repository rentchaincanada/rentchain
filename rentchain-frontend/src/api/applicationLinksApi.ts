import { apiFetch } from "./apiFetch";

export type ApplicationLinkResponse = {
  ok: boolean;
  data?: {
    id: string;
    url: string;
    expiresAt: number;
  };
  emailed?: boolean;
  emailError?: string;
};

export async function createApplicationLink(params: {
  propertyId: string;
  unitId?: string | null;
  expiresInDays?: number;
  applicantEmail?: string | null;
}): Promise<ApplicationLinkResponse> {
  return apiFetch("/application-links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
}
