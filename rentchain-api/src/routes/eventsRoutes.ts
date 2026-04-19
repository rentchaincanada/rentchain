import express from "express";
import crypto from "crypto";
import { db } from "../config/firebase";
import { incrementCounter } from "../services/telemetryService";

const router = express.Router();

const ALLOWED_EVENT_PATTERNS = [
  /^billing_/,
  /^pricing_/,
  /^pricing_cta_/,
  /^demo_/,
  /^gating_/,
  /^upgrade_cta_/,
  /^upgrade_prompt_/,
  /^upgrade_modal_/,
  /^registry_/,
  /^activation_/,
  /^empty_state_/,
  /^onboarding_/,
];

const SESSION_COOKIE = "rc_sid";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 365;

const isAllowedEventName = (name: string) => {
  return ALLOWED_EVENT_PATTERNS.some((pattern) => pattern.test(name));
};

const parseTimestamp = (value: unknown) => {
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
};

const REGISTRY_FUNNEL_EVENT_LABELS = {
  registry_landing_cta_clicked: "landingEntries",
  registry_ready_created: "readinessCreated",
  registry_filing_gate_hit: "filingGateHits",
  registry_upgrade_prompt_viewed: "upgradePromptViews",
  registry_upgrade_clicked: "upgradeClicks",
  registry_upgrade_converted: "upgradeConversions",
} as const;

type RegistryFunnelCountKey = (typeof REGISTRY_FUNNEL_EVENT_LABELS)[keyof typeof REGISTRY_FUNNEL_EVENT_LABELS];

function emptyRegistryCounts(): Record<RegistryFunnelCountKey, number> {
  return {
    landingEntries: 0,
    readinessCreated: 0,
    filingGateHits: 0,
    upgradePromptViews: 0,
    upgradeClicks: 0,
    upgradeConversions: 0,
  };
}

function incrementRegistryCount(bucket: Record<RegistryFunnelCountKey, number>, eventName: string) {
  const key = REGISTRY_FUNNEL_EVENT_LABELS[eventName as keyof typeof REGISTRY_FUNNEL_EVENT_LABELS];
  if (key) {
    bucket[key] += 1;
  }
}

function normalizeDateKey(ts: number) {
  return new Date(ts).toISOString().slice(0, 10);
}

function parseRangeBoundary(value: unknown, fallback: number) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

const getSessionId = (req: express.Request, res: express.Response) => {
  const existing = typeof req.cookies?.[SESSION_COOKIE] === "string" ? req.cookies[SESSION_COOKIE].trim() : "";
  if (existing) return existing;

  const sessionId = crypto.randomBytes(16).toString("hex");
  res.cookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS * 1000,
    path: "/",
  });
  return sessionId;
};

function isAdmin(req: any) {
  return String(req.user?.role || "").trim().toLowerCase() === "admin";
}

router.get("/", async (req: any, res) => {
  res.setHeader("x-route-source", "eventsRoutes.ts");
  const landlordId = req.user?.landlordId || req.user?.id;
  const { tenantId, propertyId, limit = "25" } = req.query as any;

  res.json({
    items: [],
    landlordId,
    tenantId: tenantId || null,
    propertyId: propertyId || null,
    limit: Number(limit),
  });
});

router.get("/registry-funnel-report", async (req: any, res) => {
  res.setHeader("x-route-source", "eventsRoutes.ts");
  if (!req.user?.id) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  if (!isAdmin(req)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  const now = Date.now();
  const defaultFrom = now - 30 * 24 * 60 * 60 * 1000;
  const from = parseRangeBoundary(req.query?.from, defaultFrom);
  const to = parseRangeBoundary(req.query?.to, now);

  try {
    const snap = await db.collection("events").get();
    const rows = (snap.docs || [])
      .map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter((row: any) => REGISTRY_FUNNEL_EVENT_LABELS[row.name as keyof typeof REGISTRY_FUNNEL_EVENT_LABELS])
      .filter((row: any) => {
        const ts = toNumber(row.ts) ?? Date.now();
        return ts >= from && ts <= to;
      });

    const totals = emptyRegistryCounts();
    const byDate = new Map<string, ReturnType<typeof emptyRegistryCounts>>();
    const bySource = new Map<
      string,
      {
        source: string;
        medium: string | null;
        campaign: string | null;
        counts: ReturnType<typeof emptyRegistryCounts>;
      }
    >();
    const byVariant = new Map<
      string,
      { variant: string; promptViews: number; clicks: number; conversions: number }
    >();

    for (const row of rows) {
      const ts = toNumber(row.ts) ?? Date.now();
      const dateKey = normalizeDateKey(ts);
      const props = row.props && typeof row.props === "object" ? row.props : {};
      const source = typeof (props as any).source === "string" && (props as any).source.trim() ? (props as any).source.trim() : "unknown";
      const medium =
        typeof (props as any).medium === "string" && (props as any).medium.trim() ? (props as any).medium.trim() : null;
      const campaign =
        typeof (props as any).campaign === "string" && (props as any).campaign.trim()
          ? (props as any).campaign.trim()
          : null;
      const variant =
        typeof (props as any).variant === "string" && (props as any).variant.trim() ? (props as any).variant.trim() : "unknown";
      const sourceKey = `${source}::${medium || ""}::${campaign || ""}`;

      incrementRegistryCount(totals, row.name);

      const dayBucket = byDate.get(dateKey) || emptyRegistryCounts();
      incrementRegistryCount(dayBucket, row.name);
      byDate.set(dateKey, dayBucket);

      const sourceBucket = bySource.get(sourceKey) || {
        source,
        medium,
        campaign,
        counts: emptyRegistryCounts(),
      };
      incrementRegistryCount(sourceBucket.counts, row.name);
      bySource.set(sourceKey, sourceBucket);

      if (row.name === "registry_upgrade_prompt_viewed" || row.name === "registry_upgrade_clicked" || row.name === "registry_upgrade_converted") {
        const variantBucket = byVariant.get(variant) || { variant, promptViews: 0, clicks: 0, conversions: 0 };
        if (row.name === "registry_upgrade_prompt_viewed") variantBucket.promptViews += 1;
        if (row.name === "registry_upgrade_clicked") variantBucket.clicks += 1;
        if (row.name === "registry_upgrade_converted") variantBucket.conversions += 1;
        byVariant.set(variant, variantBucket);
      }
    }

    return res.json({
      range: {
        from: new Date(from).toISOString(),
        to: new Date(to).toISOString(),
      },
      totals,
      stepConversion: {
        readinessFromLanding: totals.landingEntries ? totals.readinessCreated / totals.landingEntries : null,
        filingGateFromReadiness: totals.readinessCreated ? totals.filingGateHits / totals.readinessCreated : null,
        clickFromPromptView: totals.upgradePromptViews ? totals.upgradeClicks / totals.upgradePromptViews : null,
        conversionFromClick: totals.upgradeClicks ? totals.upgradeConversions / totals.upgradeClicks : null,
      },
      byDate: Array.from(byDate.entries())
        .map(([date, counts]) => ({ date, counts }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      bySource: Array.from(bySource.values()).sort((a, b) => {
        if (b.counts.landingEntries !== a.counts.landingEntries) {
          return b.counts.landingEntries - a.counts.landingEntries;
        }
        return a.source.localeCompare(b.source);
      }),
      byVariant: Array.from(byVariant.values())
        .map((item) => ({
          ...item,
          clickThroughRate: item.promptViews ? item.clicks / item.promptViews : 0,
          conversionRateFromClick: item.clicks ? item.conversions / item.clicks : null,
        }))
        .sort((a, b) => a.variant.localeCompare(b.variant)),
    });
  } catch (error: any) {
    console.error("[events/registry-funnel-report] failed", error?.message || error);
    return res.status(500).json({ ok: false, error: "registry_funnel_report_failed" });
  }
});

router.post("/track", async (req: any, res) => {
  res.setHeader("x-route-source", "eventsRoutes.ts");
  const name = String(req.body?.name || "").trim();
  const props = req.body?.props;

  if (!name || !isAllowedEventName(name)) {
    return res.status(400).json({ ok: false, error: "invalid_event_name" });
  }

  if (props != null && (typeof props !== "object" || Array.isArray(props))) {
    return res.status(400).json({ ok: false, error: "invalid_props" });
  }

  const ts = parseTimestamp(req.body?.ts);
  const userId = typeof req.user?.id === "string" ? req.user.id : null;
  const sessionId = userId ? null : getSessionId(req, res);

  try {
    await db.collection("events").add({
      name,
      ts,
      userId,
      sessionId,
      props: props || null,
      createdAt: Date.now(),
    });

    await incrementCounter({ name });

    return res.json({ ok: true });
  } catch (error: any) {
    console.error("[events/track] failed", error?.message || error);
    return res.status(500).json({ ok: false, error: "track_failed" });
  }
});

export default router;
