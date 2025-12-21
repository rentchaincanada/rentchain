import { apiFetch } from "./http";

export type AccountLimits = {
  status: string;
  plan: string;
  limits: {
    maxProperties: number;
    maxUnits: number;
    screeningCreditsMonthly: number;
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

export async function fetchAccountLimits(token?: string): Promise<AccountLimits> {
  return apiFetch<AccountLimits>("/account/limits", token ? { token } : undefined);
}
