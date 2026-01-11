import { apiFetch } from "./apiFetch";

export type ConvertApplicationResponse = {
  ok: boolean;
  applicationId: string;
  tenantId: string;
  alreadyConverted: boolean;
  screening: any | null;
  inviteUrl?: string | null;
  inviteEmailed?: boolean;
};

export async function convertApplicationToTenant(
  applicationId: string,
  opts?: { runScreening?: boolean }
) {
  return apiFetch<ConvertApplicationResponse>(
    `/applications/${applicationId}/convert-to-tenant`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runScreening: !!opts?.runScreening }),
    }
  );
}
