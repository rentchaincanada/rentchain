import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import {
  DEFAULT_CAPABILITIES,
  getCachedCapabilities,
  setCachedCapabilities,
  type CapabilitiesResponse,
} from "@/lib/entitlements";

type Capabilities = CapabilitiesResponse & { ok: boolean };

export function useCapabilities() {
  const [caps, setCaps] = useState<Capabilities | null>(() => {
    const cached = getCachedCapabilities();
    const initial = cached || DEFAULT_CAPABILITIES;
    return { ok: Boolean(initial.ok), ...initial };
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await apiFetch("/capabilities");
        if (!alive) return;
        const next = res as Capabilities;
        setCaps(next);
        if (next && typeof next === "object") {
          setCachedCapabilities({
            ok: next.ok,
            plan: next.plan,
            features: next.features || {},
            ts: next.ts,
          });
        }
      } catch {
        if (!alive) return;
        setCaps({ ok: Boolean(DEFAULT_CAPABILITIES.ok), ...DEFAULT_CAPABILITIES });
        setCachedCapabilities(DEFAULT_CAPABILITIES);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    const onUpdated = (evt: Event) => {
      if (!alive) return;
      const detail = (evt as CustomEvent<CapabilitiesResponse>).detail;
      if (detail && typeof detail === "object") {
        setCaps({ ok: Boolean(detail.ok), ...detail });
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("capabilities:updated", onUpdated as EventListener);
    }
    return () => {
      alive = false;
      if (typeof window !== "undefined") {
        window.removeEventListener("capabilities:updated", onUpdated as EventListener);
      }
    };
  }, []);

  return { caps, loading, features: caps?.features || {} };
}
