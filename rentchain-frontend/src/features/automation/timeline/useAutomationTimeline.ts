import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/useAuth";
import { track } from "@/lib/analytics";
import { getMockAutomationEvents } from "./mockAutomationEvents";
import type { AutomationEvent } from "./automationTimeline.types";
import {
  getTimelineEventsForLandlord,
  type TimelineSourceReportItem,
} from "./getTimelineEventsForLandlord";
import { computeIntegrity, type IntegrityMode } from "./timelineIntegrity";

type TimelineMode = "live" | "mock";
type TimelineSources = { tried: string[]; ok: string[]; report: TimelineSourceReportItem[] };

export function useAutomationTimeline(options?: { enabled?: boolean }) {
  const { user } = useAuth();
  const [events, setEvents] = useState<AutomationEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<TimelineMode>("mock");
  const [integrityMode, setIntegrityMode] = useState<IntegrityMode>("unverified");
  const [headChainHash, setHeadChainHash] = useState<string | null>(null);
  const [sources, setSources] = useState<TimelineSources>({
    tried: [],
    ok: [],
    report: [],
  });
  const enabled = options?.enabled !== false;

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
    if (!enabled) {
      setEvents([]);
      setSources({ tried: [], ok: [], report: [] });
      setMode("mock");
      setIntegrityMode("unverified");
      setHeadChainHash(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const live = await getTimelineEventsForLandlord(landlordId);
      setSources(live.sources);
      if (!import.meta.env.DEV) {
        try {
          const msTotal = live.sources.report.reduce((total, item) => total + item.ms, 0);
          void track("timeline_sources_health", {
            okCount: live.sources.ok.length,
            triedCount: live.sources.tried.length,
            msTotal,
            sources: live.sources.report.map((item) => ({
              source: item.source,
              ok: item.ok,
              ms: item.ms,
              count: item.count,
              errorCode: item.errorCode || null,
            })),
          });
        } catch {
          // telemetry must not block timeline rendering
        }
      }
      if (live.events.length > 0) {
        const integrity = await computeIntegrity(live.events);
        setEvents(integrity.events);
        setIntegrityMode(integrity.mode);
        setHeadChainHash(integrity.headChainHash);
        setMode("live");
      } else {
        const fallback = await computeIntegrity(getMockAutomationEvents());
        setEvents(fallback.events);
        setIntegrityMode(fallback.mode);
        setHeadChainHash(fallback.headChainHash);
        setMode("mock");
        setError("No live events yet. Showing mock fallback.");
      }
    } catch (err: any) {
      const fallback = await computeIntegrity(getMockAutomationEvents());
      setEvents(fallback.events);
      setIntegrityMode(fallback.mode);
      setHeadChainHash(fallback.headChainHash);
      setMode("mock");
      setSources({ tried: [], ok: [], report: [] });
      setError(String(err?.message || "Timeline fallback active."));
    } finally {
      setLoading(false);
    }
  }, [enabled, landlordId]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      await refresh();
    };
    run().catch(() => {
      if (active) {
        setEvents(getMockAutomationEvents());
        setMode("mock");
        setIntegrityMode("unverified");
        setHeadChainHash(null);
        setSources({ tried: [], ok: [], report: [] });
        setError("No live events yet. Showing mock fallback.");
      }
    });
    return () => {
      active = false;
    };
  }, [refresh]);

  const sourceHealth = useMemo(() => {
    const triedCount = sources.tried.length;
    const okCount = sources.ok.length;
    const failedCount = sources.report.filter((item) => !item.ok).length;
    return {
      triedCount,
      okCount,
      failedCount,
      degraded: failedCount > 0,
    };
  }, [sources.ok.length, sources.report, sources.tried.length]);

  return {
    events,
    loading,
    error,
    mode,
    integrityMode,
    headChainHash,
    sources,
    sourcesReport: sources.report,
    sourceHealth,
    refresh,
  };
}
