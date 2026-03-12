// rentchain-frontend/src/hooks/useApplications.ts
import { useEffect, useState } from "react";
import { useAuth } from "@/context/useAuth";
import { type Application, fetchApplications } from "@/api/applicationsApi";

export function useApplications() {
  const { user, ready, authStatus, isLoading: authLoading } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const role = String(user?.actorRole || user?.role || "").trim().toLowerCase();
    const canLoad = role === "landlord" || role === "admin";

    async function load() {
      if (!ready || authLoading || authStatus === "restoring") return;
      if (!canLoad) {
        if (!cancelled) {
          setApplications([]);
          setError(null);
          setLoading(false);
        }
        return;
      }
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
  }, [authLoading, authStatus, ready, user?.actorRole, user?.role]);

  return { applications, loading, error };
}
