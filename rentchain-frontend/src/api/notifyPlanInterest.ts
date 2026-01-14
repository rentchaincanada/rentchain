import { apiFetch } from "./apiFetch";

export type PlanInterestPayload = {
  email: string;
  plan: "core" | "pro";
};

export async function notifyPlanInterest(payload: PlanInterestPayload) {
  const cleanEmail = String(payload.email || "").trim().toLowerCase();
  const plan = payload.plan === "pro" ? "pro" : "core";
  const body = { email: cleanEmail, plan };

  return apiFetch("/notify-plan-interest", {
    method: "POST",
    body,
  });
}
