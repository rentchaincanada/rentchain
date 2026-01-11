import { apiFetch } from "./apiFetch";

export type PublicApplicationLink = {
  token: string;
  propertyId?: string;
  unitId?: string;
};

export type PublicApplicationContext = {
  landlordDisplayName?: string | null;
  propertyName?: string | null;
  unitLabel?: string | null;
};

export async function fetchPublicApplicationLink(token: string): Promise<{
  link: PublicApplicationLink;
  context: PublicApplicationContext;
}> {
  const res: any = await apiFetch(`/public/application-links/${encodeURIComponent(token)}`);
  const link = (res?.link || {}) as PublicApplicationLink;
  const context = (res?.context || {}) as PublicApplicationContext;
  if (!res?.ok && res?.error) {
    throw new Error(res.error);
  }
  if (!link?.token) {
    throw new Error("Application link not found");
  }
  return { link, context };
}

export async function submitPublicApplication(params: {
  token: string;
  applicant: { fullName: string; email: string; phone: string; message?: string };
}): Promise<{ applicationId?: string }> {
  const res: any = await apiFetch("/public/applications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res?.ok && res?.error) {
    throw new Error(res?.error || "Failed to submit application");
  }
  return { applicationId: res?.applicationId };
}
