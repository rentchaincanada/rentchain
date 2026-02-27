import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/useAuth";
import { getMockAutomationEvents } from "./mockAutomationEvents";
import type { AutomationEvent } from "./automationTimeline.types";
import { getTimelineEventsForLandlord } from "./getTimelineEventsForLandlord";

type TimelineMode = "live" | "mock";

export function useAutomationTimeline() {
  const { user } = useAuth();
  const [events, setEvents] = useState<AutomationEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<TimelineMode>("mock");
  const [sources, setSources] = useState<{ tried: string[]; ok: string[] }>({
    tried: [],
    ok: [],
  });

  const landlordId = useMemo(() => {
    const actorLandlordId = String(user?.actorLandlordId || "").trim();
    if (actorLandlordId) return actorLandlordId;
    const directLandlordId = String(user?.landlordId || "").trim();
    if (directLandlordId) return directLandlordId;
    const role = String(user?.actorRole || user?.role || "").toLowerCase();
    if (role === "landlord" && user?.id) return String(user.id);
    return "";
  }, [user?.actorLandlordId, user?.actorRole, user?.id, user?.landlordId, user?.role]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const live = await getTimelineEventsForLandlord(landlordId);
      setSources(live.sources);
      if (live.events.length > 0) {
        setEvents(live.events);
        setMode("live");
      } else {
        setEvents(getMockAutomationEvents());
        setMode("mock");
        setError("No live events yet. Showing mock fallback.");
      }
    } catch (err: any) {
      setEvents(getMockAutomationEvents());
      setMode("mock");
      setSources({ tried: [], ok: [] });
      setError(String(err?.message || "Timeline fallback active."));
    } finally {
      setLoading(false);
    }
  }, [landlordId]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      await refresh();
    };
    run().catch(() => {
      if (active) {
        setEvents(getMockAutomationEvents());
        setMode("mock");
        setError("No live events yet. Showing mock fallback.");
      }
    });
    return () => {
      active = false;
    };
  }, [refresh]);

  return { events, loading, error, mode, sources, refresh };
}
