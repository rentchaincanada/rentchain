import { apiFetch } from "./http";

export async function fetchMe() {
  const res = await apiFetch("/me", { method: "GET" });
  return res as { landlordId?: string; email?: string; role?: string; plan?: string };
}
