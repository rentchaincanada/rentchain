import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";

type Capabilities = {
  ok: boolean;
  plan?: string;
  features: Record<string, boolean>;
  ts?: number;
};

export function useCapabilities() {
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await apiFetch("/capabilities");
        if (!alive) return;
        setCaps(res as Capabilities);
      } catch {
        if (!alive) return;
        setCaps({ ok: false, features: {} });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { caps, loading, features: caps?.features || {} };
}
