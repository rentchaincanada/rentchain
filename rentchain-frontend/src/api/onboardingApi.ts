import { apiFetch } from "./apiFetch";

export async function fetchOnboarding() {
  return apiFetch("/onboarding", {
    method: "GET",
    allow404: true,
  });
}

export async function updateOnboarding(payload: {
  dismissed?: boolean;
  steps?: Record<string, boolean>;
}) {
  return apiFetch("/onboarding", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function setOnboardingStep(step: string, done: boolean) {
  return apiFetch("/onboarding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ step, done }),
  });
}
