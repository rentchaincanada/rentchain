import { db } from "../../config/firebase";
import { getReportingConfig } from "../../config/reporting";

type RuntimeConfig = {
  enabled: boolean;
  reportingPaused: boolean;
  dryRun: boolean;
  maxAttempts: number;
  source: "env" | "firestore" | "env+firestore";
  updatedAt?: string;
};

export function getStuckThresholdMinutes(): number {
  return Number(process.env.REPORTING_STUCK_THRESHOLD_MINUTES || 10) || 10;
}

export function getSweepLimit(): number {
  return Number(process.env.REPORTING_SWEEP_LIMIT || 50) || 50;
}

export function getPilotLandlordAllowlist(): string[] {
  const raw = process.env.REPORTING_PILOT_LANDLORD_IDS || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const CACHE_TTL_MS = 10000;
let cachedConfig: { value: RuntimeConfig; fetchedAt: number } | null = null;

async function fetchDoc(): Promise<{ reportingPaused?: boolean; updatedAt?: string } | null> {
  try {
    const doc = await db.collection("config").doc("reporting").get();
    if (!doc.exists) return null;
    const data = doc.data() as any;
    return { reportingPaused: data?.reportingPaused, updatedAt: data?.updatedAt };
  } catch (_err) {
    return null;
  }
}

export async function getReportingRuntimeConfig(options?: { bypassCache?: boolean }): Promise<RuntimeConfig> {
  const now = Date.now();
  if (!options?.bypassCache && cachedConfig && now - cachedConfig.fetchedAt < CACHE_TTL_MS) {
    return cachedConfig.value;
  }

  const envCfg = getReportingConfig();
  const doc = await fetchDoc();

  // Env is the hard ceiling
  const envEnabled = envCfg.enabled === true;
  const docPaused = doc?.reportingPaused === true;

  const enabled = envEnabled ? !docPaused : false;
  const source = doc ? "env+firestore" : "env";

  const value: RuntimeConfig = {
    enabled,
    reportingPaused: !!docPaused || !envEnabled,
    dryRun: envCfg.dryRun,
    maxAttempts: envCfg.maxAttempts,
    source,
    updatedAt: doc?.updatedAt,
  };

  cachedConfig = { value, fetchedAt: now };
  return value;
}

export async function setReportingPaused(paused: boolean): Promise<RuntimeConfig> {
  const nowIso = new Date().toISOString();
  await db.collection("config").doc("reporting").set(
    {
      reportingPaused: paused,
      updatedAt: nowIso,
    },
    { merge: true }
  );
  // Invalidate cache
  cachedConfig = null;
  return getReportingRuntimeConfig({ bypassCache: true });
}
