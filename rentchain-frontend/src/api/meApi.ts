import { apiFetch } from "./http";
import { normalizePlan } from "@/lib/plan";

export async function fetchMe() {
  const res = await apiFetch("/me", { method: "GET" });
  const payload = res as { landlordId?: string; email?: string; role?: string; plan?: string; user?: any };
  if (payload?.user && typeof payload.user === "object") {
    payload.user = {
      ...payload.user,
      ...(payload.user.plan != null ? { plan: normalizePlan(payload.user.plan) } : {}),
    };
  }
  if (payload?.plan != null) {
    payload.plan = normalizePlan(payload.plan);
  }
  return payload;
}
