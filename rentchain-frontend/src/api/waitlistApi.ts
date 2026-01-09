import { apiFetch } from "./apiFetch";

export async function joinWaitlist(email: string, meta?: Record<string, any>) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanEmail) throw new Error("EMAIL_REQUIRED");

  return apiFetch("/api/waitlist", {
    method: "POST",
    body: JSON.stringify({
      email: cleanEmail,
      source: "pricing_notify",
      meta: meta || {},
    }),
  });
}
