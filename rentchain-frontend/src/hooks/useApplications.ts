// rentchain-frontend/src/hooks/useApplications.ts
import { useEffect, useState } from "react";
import { type Application, fetchApplications } from "@/api/applicationsApi";

export function useApplications() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchApplications();
        if (!cancelled) {
          setApplications(data);
        }
      } catch (err: any) {
        console.error("[useApplications] error:", err);
        if (!cancelled) {
          setError(err?.message ?? "Failed to load applications");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return { applications, loading, error };
}
