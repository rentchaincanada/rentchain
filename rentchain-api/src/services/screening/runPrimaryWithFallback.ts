import { getPrimaryTimeoutMs, isFallbackEnabled, isPrimaryModeEnabled, shouldUseAdapterPrimary } from "./cutoverConfig";
import {
  buildBaseCutoverTelemetry,
  buildCutoverErrorSnapshot,
  logCutoverEvent,
  type CutoverTelemetryEvent,
} from "./cutoverTelemetry";

type DiffResult = { isMatch: boolean; fields?: string[] };

type RunPrimaryWithFallbackArgs<T> = {
  name: CutoverTelemetryEvent["name"];
  seedKey: string;
  runAdapter: () => Promise<T>;
  runLegacy: () => Promise<T>;
  compare?: (legacy: T, adapter: T) => DiffResult;
  timeoutMs?: number;
  conservativeReturnLegacy?: boolean;
};

function extractStatus(value: unknown): number | undefined {
  const status = Number((value as any)?.status);
  if (!Number.isFinite(status)) return undefined;
  return status;
}

function withTimeout<T>(task: () => Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("adapter_timeout")), timeoutMs);
    task()
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export async function runPrimaryWithFallback<T>(args: RunPrimaryWithFallbackArgs<T>): Promise<T> {
  const timeoutMs = args.timeoutMs ?? getPrimaryTimeoutMs();
  const adapterPrimary = isPrimaryModeEnabled() && shouldUseAdapterPrimary(args.seedKey);
  const selectedRoute = adapterPrimary ? "adapter" : "legacy";
  const event = buildBaseCutoverTelemetry({
    name: args.name,
    seedKey: args.seedKey,
    selectedRoute,
  });

  if (!adapterPrimary) {
    const legacyStart = Date.now();
    try {
      const legacy = await args.runLegacy();
      event.legacy = {
        ok: true,
        durationMs: Date.now() - legacyStart,
        status: extractStatus(legacy),
      };
      logCutoverEvent(event);
      return legacy;
    } catch (err) {
      event.legacy = { ...buildCutoverErrorSnapshot(err), durationMs: Date.now() - legacyStart };
      logCutoverEvent(event);
      throw err;
    }
  }

  const adapterStart = Date.now();
  let adapterResult: T | null = null;
  try {
    adapterResult = await withTimeout(args.runAdapter, timeoutMs);
    event.adapter = {
      ok: true,
      durationMs: Date.now() - adapterStart,
      status: extractStatus(adapterResult),
    };
  } catch (err) {
    event.adapter = { ...buildCutoverErrorSnapshot(err), durationMs: Date.now() - adapterStart };
    if (!isFallbackEnabled()) {
      logCutoverEvent(event);
      throw err;
    }
    event.fallbackUsed = true;
    const legacyStart = Date.now();
    try {
      const legacy = await args.runLegacy();
      event.legacy = {
        ok: true,
        durationMs: Date.now() - legacyStart,
        status: extractStatus(legacy),
      };
      logCutoverEvent(event);
      return legacy;
    } catch (legacyErr) {
      event.legacy = { ...buildCutoverErrorSnapshot(legacyErr), durationMs: Date.now() - legacyStart };
      logCutoverEvent(event);
      throw legacyErr;
    }
  }

  if (!args.conservativeReturnLegacy) {
    if (adapterResult !== null) {
      logCutoverEvent(event);
      return adapterResult;
    }
  }

  const legacyStart = Date.now();
  try {
    const legacy = await args.runLegacy();
    event.legacy = {
      ok: true,
      durationMs: Date.now() - legacyStart,
      status: extractStatus(legacy),
    };
    if (adapterResult !== null && args.compare) {
      event.diff = args.compare(legacy, adapterResult);
    }
    logCutoverEvent(event);
    return legacy;
  } catch (legacyErr) {
    event.legacy = { ...buildCutoverErrorSnapshot(legacyErr), durationMs: Date.now() - legacyStart };
    logCutoverEvent(event);
    throw legacyErr;
  }
}
