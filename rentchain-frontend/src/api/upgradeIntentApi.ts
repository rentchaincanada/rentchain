import { apiFetch } from "./apiFetch";

export async function trackUpgradeIntent(args: {
  desiredPlan: "core" | "pro" | "elite";
  context: string;
  email?: string;
}) {
  return apiFetch<{ ok: boolean }>("/billing/upgrade-intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
}
