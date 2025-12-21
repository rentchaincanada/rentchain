import { apiFetch } from "./apiFetch";

export async function fetchOnboarding() {
  return apiFetch("/onboarding", {
    method: "GET",
  });
}

export async function setOnboardingStep(step: string, done: boolean) {
  return apiFetch("/onboarding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ step, done }),
  });
}
