import { hashSeedKey } from "./cutoverConfig";

export type CutoverRoute = "adapter" | "legacy" | "none";

export type CutoverTelemetryEvent = {
  eventType: "bureau_cutover";
  name: "quote" | "checkout" | "run" | "legacy_checkout";
  seedHash: string;
  selectedRoute: CutoverRoute;
  responseSource: "adapter" | "legacy" | "blocked";
  fallbackUsed: boolean;
  adapter: {
    ok: boolean;
    status?: number;
    durationMs?: number;
    errorCode?: string;
  };
  legacy: {
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
    env: string;
    ts: string;
    revision?: string;
    skippedReason?: string;
  };
};

function classifyError(err: unknown): string {
  const message = String((err as any)?.message || "").toLowerCase();
  if (message.includes("timeout")) return "timeout";
  if (message.includes("forbidden") || message.includes("403")) return "forbidden";
  if (message.includes("unauthorized") || message.includes("401")) return "unauthorized";
  if (message.includes("not found") || message.includes("404")) return "not_found";
  return "unknown";
}

export function buildCutoverErrorSnapshot(err: unknown) {
  return {
    ok: false,
    errorCode: classifyError(err),
  };
}

export function buildBaseCutoverTelemetry(params: {
  name: CutoverTelemetryEvent["name"];
  seedKey: string;
  selectedRoute: CutoverRoute;
  responseSource: CutoverTelemetryEvent["responseSource"];
  fallbackUsed?: boolean;
}): CutoverTelemetryEvent {
  return {
    eventType: "bureau_cutover",
    name: params.name,
    seedHash: hashSeedKey(params.seedKey || ""),
    selectedRoute: params.selectedRoute,
    responseSource: params.responseSource,
    fallbackUsed: Boolean(params.fallbackUsed),
    adapter: { ok: false },
    legacy: { ok: false },
    diff: { isMatch: true, fields: [] },
    meta: {
      env: process.env.NODE_ENV || "development",
      ts: new Date().toISOString(),
      revision: process.env.K_REVISION || process.env.GIT_SHA || undefined,
    },
  };
}

export function logCutoverEvent(event: CutoverTelemetryEvent): void {
  try {
    console.info("[bureau_cutover]", JSON.stringify(event));
  } catch {
    console.info("[bureau_cutover] failed_to_serialize");
  }
}
