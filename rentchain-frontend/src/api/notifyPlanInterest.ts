import { apiFetch } from "./apiFetch";

export type PlanInterestPayload = {
  email: string;
  plan: "core" | "pro";
  note?: string;
};

export async function notifyPlanInterest(payload: PlanInterestPayload) {
  const cleanEmail = String(payload.email || "").trim().toLowerCase();
  const plan = payload.plan === "pro" ? "pro" : "core";
  const body: any = { email: cleanEmail, plan };
  if (payload.note) body.note = payload.note;

  return apiFetch("/notify-plan-interest", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
