import { apiFetch } from "@/lib/apiClient";

export type CapabilitiesResponse = {
  ok?: boolean;
  plan?: string;
  features: Record<string, boolean>;
  ts?: number;
};

let cachedCapabilities: CapabilitiesResponse | null = null;

export function getCachedCapabilities(): CapabilitiesResponse | null {
  return cachedCapabilities;
}

export function setCachedCapabilities(next: CapabilitiesResponse) {
  cachedCapabilities = next;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("capabilities:updated", { detail: next }));
  }
}

export async function refreshEntitlements(
  updateUser?: (patch: Record<string, any>) => void
): Promise<void> {
  try {
    const me = await apiFetch<{ ok?: boolean; user?: any }>("/auth/me");
    if (me?.user && updateUser) {
      updateUser(me.user);
    }
  } catch {
    // ignore auth refresh failures
  }

  try {
    const caps = await apiFetch<CapabilitiesResponse>("/capabilities");
    if (caps && typeof caps === "object") {
      setCachedCapabilities({
        ok: caps.ok,
        plan: caps.plan,
        features: caps.features || {},
        ts: caps.ts,
      });
    }
  } catch {
    // ignore capability refresh failures
  }
}
