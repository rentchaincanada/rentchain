import { apiGetJson } from "./http";

export type AccountLimits = {
  status: string;
  plan: string;
  limits: {
    maxProperties: number;
    maxUnits: number;
  };
  capabilities: Record<string, boolean>;
  usage?: {
    properties: number;
    units: number;
    screeningsThisMonth?: number;
  };
  integrity?: {
    ok: boolean;
    before?: {
      properties: number;
      units: number;
      screeningsThisMonth?: number;
    };
    after?: {
      properties: number;
      units: number;
      screeningsThisMonth?: number;
    };
  };
};

export async function fetchAccountLimits(token?: string): Promise<AccountLimits | null> {
  const res = await apiGetJson<AccountLimits>("/account/limits", {
    allowStatuses: [404, 501],
  });
  if (res.ok) return res.data;
  if (res.status === 404 || res.status === 501) {
    return {
      status: "unavailable",
      plan: "starter",
      limits: { maxProperties: 0, maxUnits: 0 },
      capabilities: {},
      usage: { properties: 0, units: 0 },
    };
  }
  return null;
}
