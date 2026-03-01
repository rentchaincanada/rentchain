import { track } from "@/lib/analytics";
import { redactSeed } from "./shadowMode";

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

const shadowEventsBuffer: BureauShadowLogEvent[] = [];
const MAX_BUFFER = 200;

export function getShadowEventsBuffer(): BureauShadowLogEvent[] {
  return [...shadowEventsBuffer];
}

export function clearShadowEventsBuffer(): void {
  shadowEventsBuffer.length = 0;
}

export function logShadowEvent(event: BureauShadowLogEvent): void {
  const safeEvent: BureauShadowLogEvent = {
    ...event,
    seedKey: redactSeed(event.seedKey),
  };

  if (shadowEventsBuffer.length >= MAX_BUFFER) {
    shadowEventsBuffer.shift();
  }
  shadowEventsBuffer.push(safeEvent);

  try {
    if (import.meta.env.DEV) {
      console.info("[bureau_shadow]", safeEvent);
    }
  } catch {
    // no-op
  }

  try {
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
