import { apiJson } from "@/lib/apiClient";

export type ProviderStatus = {
  activeProvider: string;
  configured: boolean;
  requiredEnvMissing?: string[];
  lastErrorAt?: string;
};

export async function getProviderStatus(): Promise<ProviderStatus> {
  return apiJson<ProviderStatus>("/providers/status");
}

export async function setFeatureFlag(flag: string, value: boolean) {
  return apiJson("/admin/feature-flags", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ flag, value }),
  });
}
