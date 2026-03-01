import { track } from "@/lib/analytics";
import { isShadowModeEnabled, redactSeed } from "./shadowMode";

export type BureauShadowLogEvent = {
  eventType: "bureau_shadow";
  name: string;
  seedKey: string;
  primary: {
    provider?: string;
    ok: boolean;
    status?: number;
    durationMs?: number;
    errorCode?: string;
  };
  shadow: {
    provider?: string;
    ok: boolean;
    status?: number;
    durationMs?: number;
    errorCode?: string;
  };
  diff: {
    isMatch: boolean;
    fields?: string[];
  };
  meta: {
    appId?: string;
    landlordId?: string;
    envMode: string;
    buildSha?: string;
    ts: string;
  };
};

type BureauShadowSafeEvent = Omit<BureauShadowLogEvent, "seedKey" | "meta"> & {
  seedKey: string;
  meta: {
    appKey?: string;
    landlordKey?: string;
    envMode: string;
    buildSha?: string;
    ts: string;
  };
};

const shadowEventsBuffer: BureauShadowSafeEvent[] = [];
const MAX_BUFFER = 200;
const MAX_SENT_PER_SESSION = 50;
let sentCount = 0;

export function getShadowEventsBuffer(): BureauShadowSafeEvent[] {
  return [...shadowEventsBuffer];
}

export function clearShadowEventsBuffer(): void {
  shadowEventsBuffer.length = 0;
}

export function __resetShadowLoggerSessionForTests(): void {
  sentCount = 0;
  shadowEventsBuffer.length = 0;
}

export function logShadowEvent(event: BureauShadowLogEvent): void {
  const isProdRuntime = import.meta.env.PROD || import.meta.env.MODE === "production";
  const safeEvent: BureauShadowSafeEvent = {
    ...event,
    seedKey: redactSeed(event.seedKey),
    meta: {
      appKey: event.meta.appId ? redactSeed(`app:${event.meta.appId}`) : undefined,
      landlordKey: event.meta.landlordId
        ? redactSeed(`landlord:${event.meta.landlordId}`)
        : undefined,
      envMode: event.meta.envMode,
      buildSha: event.meta.buildSha,
      ts: event.meta.ts,
    },
  };

  if (shadowEventsBuffer.length >= MAX_BUFFER) {
    shadowEventsBuffer.shift();
  }
  shadowEventsBuffer.push(safeEvent);

  try {
    if (!isProdRuntime) {
      console.info("[bureau_shadow]", safeEvent);
    }
  } catch {
    // no-op
  }

  if (!isProdRuntime) return;
  if (!isShadowModeEnabled()) return;
  if (sentCount >= MAX_SENT_PER_SESSION) return;

  try {
    sentCount += 1;
    track("bureau_shadow", {
      name: safeEvent.name,
      seedKey: safeEvent.seedKey,
      primary: safeEvent.primary,
      shadow: safeEvent.shadow,
      diff: safeEvent.diff,
      meta: safeEvent.meta,
    });
  } catch {
    // telemetry must never throw
  }
}
