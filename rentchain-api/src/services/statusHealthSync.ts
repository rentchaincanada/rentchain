import { db } from "../config/firebase";
import { getEnvFlags } from "../config/requiredEnv";
import { getProviderStatus } from "./screening/providerStatusService";

type ComponentStatus = "operational" | "degraded" | "partial_outage" | "major_outage";
type HealthComponentKey = "website" | "api" | "screening" | "payments" | "email";

type HealthDecision = {
  key: HealthComponentKey;
  status: ComponentStatus;
  message: string;
};

type SyncSummaryItem = {
  key: HealthComponentKey;
  status?: ComponentStatus;
  reason?: string;
};

const ACTIVE_INCIDENT_STATUSES = ["investigating", "identified", "monitoring"] as const;
const WEBSITE_HEALTH_URL = "https://www.rentchain.ai";

function nowMs() {
  return Date.now();
}

function normalizeKey(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function withTimeout(ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    done: () => clearTimeout(timer),
  };
}

async function ping(url: string): Promise<{ ok: boolean; status?: number; error?: string }> {
  const timeout = withTimeout(4000);
  try {
    const response = await fetch(url, {
      method: "GET",
      signal: timeout.signal,
      headers: { "user-agent": "rentchain-status-sync/1.0" },
    });
    return { ok: response.ok, status: response.status };
  } catch (err: any) {
    return { ok: false, error: String(err?.message || "request_failed") };
  } finally {
    timeout.done();
  }
}

function getApiHealthUrls(): string[] {
  const explicit = String(process.env.STATUS_API_HEALTH_URL || "").trim();
  if (explicit) return [explicit];

  const base =
    String(
      process.env.INTERNAL_API_BASE_URL ||
        process.env.API_BASE_URL ||
        process.env.APP_BASE_URL ||
        process.env.PUBLIC_APP_URL ||
        ""
    ).trim() || `http://127.0.0.1:${process.env.PORT || "8080"}`;
  const clean = base.replace(/\/$/, "");
  return [`${clean}/api/health`, `${clean}/health`];
}

async function evaluateWebsite(): Promise<HealthDecision> {
  const result = await ping(WEBSITE_HEALTH_URL);
  if (result.ok) {
    return { key: "website", status: "operational", message: "" };
  }
  const reason = result.status ? `HTTP ${result.status}` : result.error || "unreachable";
  return { key: "website", status: "degraded", message: `website health check failed (${reason})` };
}

async function evaluateApi(): Promise<HealthDecision> {
  const urls = getApiHealthUrls();
  let lastFailure = "unknown";

  for (const url of urls) {
    const result = await ping(url);
    if (result.ok) {
      return { key: "api", status: "operational", message: "" };
    }
    lastFailure = result.status ? `${url} -> HTTP ${result.status}` : `${url} -> ${result.error || "failed"}`;
  }

  return { key: "api", status: "major_outage", message: `api health check failed (${lastFailure})` };
}

async function evaluateScreening(): Promise<HealthDecision> {
  const provider = getProviderStatus();
  const providerName = normalizeKey(provider.activeProvider || "unknown");
  const intentionallyDisabled =
    providerName === "mock" || providerName === "stub" || providerName === "disabled";
  if (intentionallyDisabled) {
    return {
      key: "screening",
      status: "operational",
      message: "screening available by configuration",
    };
  }

  if (!provider.configured) {
    const missing = (provider.requiredEnvMissing || []).join(", ");
    return {
      key: "screening",
      status: "degraded",
      message: missing ? `screening config missing: ${missing}` : "screening provider not configured",
    };
  }

  const recentWindowStart = nowMs() - 15 * 60 * 1000;
  const failedJobsSnap = await db.collection("screeningJobs").where("status", "==", "failed").limit(60).get();
  const recentFailures = failedJobsSnap.docs.filter((doc) => {
    const data = doc.data() as any;
    const failedAt = Number(data?.failedAt || 0);
    return Number.isFinite(failedAt) && failedAt >= recentWindowStart;
  }).length;

  if (recentFailures >= 5) {
    return {
      key: "screening",
      status: "degraded",
      message: `screening runner failures detected (${recentFailures} in last 15m)`,
    };
  }

  return { key: "screening", status: "operational", message: "" };
}

async function evaluatePayments(): Promise<HealthDecision> {
  const envFlags = getEnvFlags();
  if (!envFlags.stripeConfigured) {
    return {
      key: "payments",
      status: "degraded",
      message: "payments configuration incomplete",
    };
  }

  const recentWindowStart = nowMs() - 6 * 60 * 60 * 1000;
  const eventsSnap = await db.collection("stripeEvents").orderBy("createdAt", "desc").limit(40).get();
  let recentResolved = 0;
  let recentUnresolved = 0;

  for (const doc of eventsSnap.docs) {
    const data = doc.data() as any;
    const createdAt = Number(data?.createdAt || 0);
    if (!Number.isFinite(createdAt) || createdAt < recentWindowStart) continue;
    const resolved = data?.resolved === true;
    if (resolved) recentResolved += 1;
    else recentUnresolved += 1;
  }

  if (recentUnresolved >= 5 && recentUnresolved >= recentResolved * 2) {
    return {
      key: "payments",
      status: "degraded",
      message: "webhook failures elevated",
    };
  }

  return { key: "payments", status: "operational", message: "" };
}

async function evaluateEmail(): Promise<HealthDecision> {
  const envFlags = getEnvFlags();
  if (!envFlags.emailConfigured) {
    return {
      key: "email",
      status: "degraded",
      message: "email provider not configured",
    };
  }
  return { key: "email", status: "operational", message: "" };
}

function incidentAffectsComponent(incident: any, key: HealthComponentKey): boolean {
  const lists = [
    incident?.affectedComponents,
    incident?.componentKeys,
    incident?.components,
  ].filter(Array.isArray) as unknown[][];

  for (const list of lists) {
    const normalized = list.map((item) => normalizeKey(item)).filter(Boolean);
    if (normalized.includes(key)) return true;
  }

  const singles = [incident?.component, incident?.componentKey, incident?.key]
    .map((value) => normalizeKey(value))
    .filter(Boolean);
  return singles.includes(key);
}

async function getIncidentGuard() {
  const activeIncidentSnap = await db
    .collection("statusIncidents")
    .where("status", "in", [...ACTIVE_INCIDENT_STATUSES])
    .get();

  if (activeIncidentSnap.empty) {
    return { hasGlobalBlock: false, blocked: new Set<HealthComponentKey>() };
  }

  const blocked = new Set<HealthComponentKey>();
  let hasGlobalBlock = false;
  for (const doc of activeIncidentSnap.docs) {
    const incident = doc.data() as any;
    const explicitMatchKeys: HealthComponentKey[] = ["website", "api", "screening", "payments", "email"].filter(
      (key) => incidentAffectsComponent(incident, key as HealthComponentKey)
    ) as HealthComponentKey[];

    if (explicitMatchKeys.length === 0) {
      hasGlobalBlock = true;
      continue;
    }
    for (const key of explicitMatchKeys) blocked.add(key);
  }

  return { hasGlobalBlock, blocked };
}

export async function runStatusHealthSync(): Promise<{
  ok: true;
  updated: SyncSummaryItem[];
  skipped: SyncSummaryItem[];
}> {
  const now = nowMs();

  const [website, api, screening, payments, email] = await Promise.all([
    evaluateWebsite(),
    evaluateApi(),
    evaluateScreening(),
    evaluatePayments(),
    evaluateEmail(),
  ]);
  const decisions = [website, api, screening, payments, email];

  const incidentGuard = await getIncidentGuard();
  const updated: SyncSummaryItem[] = [];
  const skipped: SyncSummaryItem[] = [];

  for (const decision of decisions) {
    if (incidentGuard.hasGlobalBlock || incidentGuard.blocked.has(decision.key)) {
      skipped.push({
        key: decision.key,
        reason: "skipped due to active incident",
      });
      continue;
    }

    await db
      .collection("statusComponents")
      .doc(decision.key)
      .set(
        {
          status: decision.status,
          message: decision.message,
          updatedAtMs: now,
        },
        { merge: true }
      );

    updated.push({ key: decision.key, status: decision.status });
  }

  return { ok: true, updated, skipped };
}
