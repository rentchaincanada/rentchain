import { Router } from "express";
import admin from "firebase-admin";
import { db } from "../config/firebase";
import { requireAdmin } from "../middleware/requireAdmin";
import { getCountersSummary } from "../services/telemetryService";
import { getStripeClient, isStripeConfigured } from "../services/stripeService";
import { getPlanConfig, resolvePlanFromPriceId, type BillingPlanKey } from "../config/planMatrix";
import { getTuReferralMetricsForMonth } from "../services/metrics/tuReferralReport";
import { getPublicStatusPayload } from "../services/statusService";
import {
  createStatusIncident,
  resolveStatusIncident,
  updateStatusComponent,
  updateStatusMeta,
} from "../services/statusService";

const router = Router();
const FUNNEL_EVENT_NAMES = [
  "pricing_demo_clicked",
  "demo_request_access_clicked",
  "upgrade_modal_opened",
  "upgrade_modal_upgrade_clicked",
];

function safeMessage(err: any): string | null {
  const raw = String(err?.message || "").trim();
  if (!raw) return null;
  const compact = raw.replace(/\s+/g, " ").slice(0, 240);
  return compact
    .replace(/(api[_-]?key|token|secret)\s*[:=]\s*\S+/gi, "$1=[redacted]")
    .replace(/bearer\s+[a-z0-9\-_\.]+/gi, "bearer [redacted]");
}

function monthDaysFromKey(month: string): string[] {
  const match = /^(\d{4})-(\d{2})$/.exec(String(month || "").trim());
  if (!match) return [];
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return [];
  }
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const days: string[] = [];
  for (let day = 1; day <= lastDay; day += 1) {
    days.push(`${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }
  return days;
}

router.get("/ping", requireAdmin, (_req, res) => res.json({ ok: true }));

router.post("/users/create-landlord", requireAdmin, async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "").trim();
    const planRaw = String(req.body?.plan || "free").trim().toLowerCase();
    const plan = planRaw === "starter" || planRaw === "pro" || planRaw === "free" ? planRaw : "free";

    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "missing_email_or_password" });
    }

    const user = await admin.auth().createUser({
      email,
      password,
      emailVerified: false,
      disabled: false,
    });

    const uid = user.uid;
    const createdAt = admin.firestore.FieldValue.serverTimestamp();

    await db.collection("users").doc(uid).set({
      id: uid,
      email,
      role: "landlord",
      landlordId: uid,
      status: "active",
      createdAt,
    });

    await db.collection("accounts").doc(uid).set({
      id: uid,
      email,
      role: "landlord",
      landlordId: uid,
      status: "active",
      plan,
      createdAt,
    });

    await db.collection("landlords").doc(uid).set({
      id: uid,
      plan,
      createdAt,
    });

    await db
      .collection("landlords")
      .doc(uid)
      .collection("settings")
      .doc("onboarding")
      .set({
        dismissed: false,
        steps: {
          propertyAdded: false,
          unitAdded: false,
          tenantInvited: false,
          applicationCreated: false,
          exportPreviewed: false,
        },
        lastSeenAt: null,
        createdAt,
      });

    return res.json({ ok: true, uid, email, landlordId: uid });
  } catch (err: any) {
    console.error("[admin/create-landlord] error", err?.message || err);
    return res.status(500).json({ ok: false, error: "create_landlord_failed" });
  }
});

router.post("/users/reset-onboarding", requireAdmin, async (req, res) => {
  try {
    const landlordId = String(req.body?.landlordId || "").trim();
    if (!landlordId) {
      return res.status(400).json({ ok: false, error: "missing_landlordId" });
    }

    await db
      .collection("landlords")
      .doc(landlordId)
      .collection("settings")
      .doc("onboarding")
      .set(
        {
          dismissed: false,
          steps: {
            propertyAdded: false,
            unitAdded: false,
            tenantInvited: false,
            applicationCreated: false,
            exportPreviewed: false,
          },
          lastSeenAt: null,
        },
        { merge: true }
      );

    return res.json({ ok: true, landlordId });
  } catch (err: any) {
    console.error("[admin/reset-onboarding] error", err?.message || err);
    return res.status(500).json({ ok: false, error: "reset_onboarding_failed" });
  }
});

function toDayString(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function startOfDayUtc(ts: number) {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function dateRangeForLast30d() {
  const now = Date.now();
  const end = Math.floor(now / 1000);
  const start = Math.floor((now - 30 * 24 * 60 * 60 * 1000) / 1000);
  return { start, end };
}

function dateRangeForMtd() {
  const now = new Date();
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000;
  const end = Math.floor(Date.now() / 1000);
  return { start, end };
}

function dateRangeForYtd() {
  const now = new Date();
  const start = Date.UTC(now.getUTCFullYear(), 0, 1) / 1000;
  const end = Math.floor(Date.now() / 1000);
  return { start, end };
}

function toMillis(input: unknown): number | null {
  if (input == null) return null;
  if (typeof input === "number" && Number.isFinite(input)) {
    if (input > 1e12) return Math.round(input);
    if (input > 1e9) return Math.round(input * 1000);
  }
  if (typeof input === "string") {
    const parsed = Date.parse(input);
    if (Number.isFinite(parsed)) return parsed;
    const asNum = Number(input);
    if (Number.isFinite(asNum)) return toMillis(asNum);
  }
  if (input instanceof Date) {
    const ms = input.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof input === "object") {
    const maybeTs = input as { toMillis?: () => number; seconds?: number };
    if (typeof maybeTs.toMillis === "function") {
      try {
        const ms = maybeTs.toMillis();
        return Number.isFinite(ms) ? ms : null;
      } catch {
        return null;
      }
    }
    if (typeof maybeTs.seconds === "number") {
      return Math.round(maybeTs.seconds * 1000);
    }
  }
  return null;
}

function startOfMonthMs(now = new Date()) {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
}

function startOfYearMs(now = new Date()) {
  return Date.UTC(now.getUTCFullYear(), 0, 1);
}

function startOfTodayUtcMs(now = new Date()) {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

function toFiniteNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toUpperStatus(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function safeRatio(numerator: number, denominator: number, decimals = 4) {
  if (!(denominator > 0)) return 0;
  return Number((numerator / denominator).toFixed(decimals));
}

function applicationSubmittedAtMs(data: any): number {
  return (
    toMillis(data?.submittedAtMs) ||
    toMillis(data?.submittedAt) ||
    toMillis(data?.createdAtMs) ||
    toMillis(data?.createdAt) ||
    0
  );
}

function applicationApprovedAtMs(data: any): number {
  return (
    toMillis(data?.approvedAtMs) ||
    toMillis(data?.approvedAt) ||
    toMillis(data?.statusUpdatedAtMs) ||
    toMillis(data?.updatedAtMs) ||
    toMillis(data?.updatedAt) ||
    0
  );
}

function screeningOrderCreatedAtMs(data: any): number {
  return (
    toMillis(data?.createdAtMs) ||
    toMillis(data?.createdAt) ||
    toMillis(data?.queuedAt) ||
    toMillis(data?.updatedAtMs) ||
    toMillis(data?.updatedAt) ||
    0
  );
}

function screeningOrderCompletedAtMs(data: any): number {
  return (
    toMillis(data?.completedAtMs) ||
    toMillis(data?.completedAt) ||
    toMillis(data?.reportGeneratedAtMs) ||
    toMillis(data?.reportGeneratedAt) ||
    toMillis(data?.paidAtMs) ||
    toMillis(data?.paidAt) ||
    0
  );
}

function leaseCreatedAtMs(data: any): number {
  return (
    toMillis(data?.createdAtMs) ||
    toMillis(data?.createdAt) ||
    toMillis(data?.activatedAtMs) ||
    toMillis(data?.activatedAt) ||
    0
  );
}

function isApplicationApprovedStatus(status: string): boolean {
  return status === "APPROVED" || status === "CONDITIONAL_COSIGNER" || status === "CONDITIONAL_DEPOSIT";
}

function isScreeningCompletedStatus(rawStatus: unknown, rawPaymentStatus: unknown): boolean {
  const status = String(rawStatus || "").trim().toLowerCase();
  const paymentStatus = String(rawPaymentStatus || "").trim().toLowerCase();
  if (
    status === "complete" ||
    status === "completed" ||
    status === "report_ready" ||
    status === "external_completed"
  ) {
    return true;
  }
  return paymentStatus === "paid" && status !== "failed";
}

function isActivePropertyStatus(status: string): boolean {
  return status !== "DRAFT" && status !== "INACTIVE" && status !== "ARCHIVED" && status !== "DELETED";
}

function isActiveUnitStatus(status: string): boolean {
  return status !== "OFFLINE" && status !== "INACTIVE" && status !== "ARCHIVED" && status !== "DELETED";
}

async function getControlTowerPayload() {
  const now = new Date();
  const nowMs = now.getTime();
  const todayStartMs = startOfTodayUtcMs(now);
  const monthStartMs = startOfMonthMs(now);

  const [applicationsSnap, screeningOrdersSnap, leasesSnap, propertiesSnap, unitsSnap, tuMetrics, statusPayload] =
    await Promise.all([
      db.collection("rentalApplications").get(),
      db.collection("screeningOrders").get(),
      db.collection("leases").get(),
      db.collection("properties").get(),
      db.collection("units").get(),
      getTuReferralMetricsForMonth(),
      getPublicStatusPayload(),
    ]);

  const applications = applicationsSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));
  const screeningOrders = screeningOrdersSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));
  const leases = leasesSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));
  const properties = propertiesSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));
  const units = unitsSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));

  let applicationsToday = 0;
  let applicationsMtd = 0;
  let applicationsApprovedMtd = 0;
  const activeLandlordIds = new Set<string>();

  for (const app of applications) {
    const submittedAtMs = applicationSubmittedAtMs(app);
    const approvedAtMs = applicationApprovedAtMs(app);
    const status = toUpperStatus(app?.status);
    const landlordId = String(app?.landlordId || "").trim();

    if (landlordId) activeLandlordIds.add(landlordId);

    if (submittedAtMs >= todayStartMs) applicationsToday += 1;
    if (submittedAtMs >= monthStartMs) applicationsMtd += 1;
    if (isApplicationApprovedStatus(status) && approvedAtMs >= monthStartMs) {
      applicationsApprovedMtd += 1;
    }
  }

  let screeningsToday = 0;
  let creditReportsRunMtd = 0;

  for (const order of screeningOrders) {
    const createdAtMs = screeningOrderCreatedAtMs(order);
    const completedAtMs = screeningOrderCompletedAtMs(order);
    const landlordId = String(order?.landlordId || "").trim();
    if (landlordId) activeLandlordIds.add(landlordId);

    if (createdAtMs >= todayStartMs) screeningsToday += 1;
    if (
      completedAtMs >= monthStartMs &&
      isScreeningCompletedStatus(order?.status, order?.paymentStatus)
    ) {
      creditReportsRunMtd += 1;
    }
  }

  let leasesToday = 0;
  let leasesMtd = 0;
  let depositCountToday = 0;
  let depositsCollectedToday = 0;
  let depositsCollectedMonth = 0;
  let depositsCountMonth = 0;

  for (const lease of leases) {
    const createdAtMs = leaseCreatedAtMs(lease);
    const landlordId = String(lease?.landlordId || "").trim();
    if (landlordId) activeLandlordIds.add(landlordId);

    if (createdAtMs >= todayStartMs) leasesToday += 1;
    if (createdAtMs >= monthStartMs) leasesMtd += 1;

    const depositCents = toFiniteNumber(lease?.depositCents);
    if (!(depositCents > 0)) continue;
    const depositDollars = Number((depositCents / 100).toFixed(2));
    if (createdAtMs >= todayStartMs) {
      depositCountToday += 1;
      depositsCollectedToday += depositDollars;
    }
    if (createdAtMs >= monthStartMs) {
      depositsCountMonth += 1;
      depositsCollectedMonth += depositDollars;
    }
  }

  const activeProperties = properties.filter((property) =>
    isActivePropertyStatus(toUpperStatus(property?.status))
  ).length;
  const activeUnits = units.filter((unit) => isActiveUnitStatus(toUpperStatus(unit?.status))).length;
  const applicationsPerUnit =
    activeUnits > 0 ? Number((applicationsMtd / activeUnits).toFixed(2)) : 0;

  const screeningRate = safeRatio(creditReportsRunMtd, applicationsMtd, 4);
  const approvalRate = safeRatio(applicationsApprovedMtd, creditReportsRunMtd, 4);
  const leaseConversionRate = safeRatio(leasesMtd, applicationsMtd, 4);
  const averageDepositAmount =
    depositsCountMonth > 0 ? Number((depositsCollectedMonth / depositsCountMonth).toFixed(2)) : 0;

  const byComponent = new Map<string, any>();
  for (const component of statusPayload.components || []) {
    const key = String(component?.key || "").trim().toLowerCase();
    if (key) byComponent.set(key, component);
  }

  const normalizeStatus = (key: string) => String(byComponent.get(key)?.status || "operational");

  return {
    ok: true as const,
    today: {
      applicationsSubmitted: applicationsToday,
      screeningsInitiated: screeningsToday,
      leasesGenerated: leasesToday,
      depositsRecorded: depositCountToday,
    },
    funnelMonthToDate: {
      applicationsReceived: applicationsMtd,
      creditReportsRun: creditReportsRunMtd,
      applicationsApproved: applicationsApprovedMtd,
      leasesGenerated: leasesMtd,
      screeningRate,
      approvalRate,
      leaseConversionRate,
    },
    utilization: {
      activeLandlords: activeLandlordIds.size,
      activeProperties,
      activeUnits,
      applicationsPerUnit,
    },
    screening: {
      referralClicks: toFiniteNumber(tuMetrics.metrics?.referralClicks),
      completedScreenings: toFiniteNumber(tuMetrics.metrics?.completedScreenings),
      screeningsPerLandlord: toFiniteNumber(tuMetrics.metrics?.screeningsPerLandlord),
      conversionRate: toFiniteNumber(tuMetrics.metrics?.conversionRate),
    },
    financial: {
      depositsCollectedToday: Number(depositsCollectedToday.toFixed(2)),
      depositsCollectedMonth: Number(depositsCollectedMonth.toFixed(2)),
      averageDepositAmount,
    },
    statusSummary: {
      website: normalizeStatus("website"),
      api: normalizeStatus("api"),
      screening: normalizeStatus("screening"),
      payments: normalizeStatus("payments"),
    },
    updatedAtMs: nowMs,
  };
}

function normalizeTier(input?: string | null): BillingPlanKey | null {
  const raw = String(input || "").trim().toLowerCase();
  if (raw === "starter" || raw === "core") return "starter";
  if (raw === "pro" || raw === "professional") return "pro";
  if (raw === "business" || raw === "enterprise") return "business";
  return null;
}

type SubscriptionMetrics = {
  activeSubscribers: number;
  mrrCents: number;
  arrCents: number;
  subscriptionsByTier: { starter: number; pro: number; business: number; elite: number };
};

async function getSubscriptionMetrics(): Promise<SubscriptionMetrics> {
  const byTier = { starter: 0, pro: 0, business: 0, elite: 0 };
  let mrrCents = 0;
  let activeSubscribers = 0;

  if (isStripeConfigured()) {
    try {
      const stripe = getStripeClient();
      for await (const sub of stripe.subscriptions.list({ status: "all", limit: 100 })) {
        if (!(sub.status === "active" || sub.status === "trialing")) continue;
        const price = sub.items?.data?.[0]?.price;
        const plan = resolvePlanFromPriceId(price?.id || null);
        if (!plan) continue;
        activeSubscribers += 1;
        byTier[plan] += 1;
        const amount = typeof price?.unit_amount === "number" ? price.unit_amount : getPlanConfig(plan).monthlyAmountCents;
        const interval = price?.recurring?.interval;
        const monthly = interval === "year" ? Math.round(amount / 12) : amount;
        mrrCents += monthly;
      }
      return {
        activeSubscribers,
        mrrCents,
        arrCents: mrrCents * 12,
        subscriptionsByTier: byTier,
      };
    } catch (err: any) {
      console.warn("[admin] stripe subscription metrics fallback", err?.message || err);
    }
  }

  const landlordSnap = await db.collection("landlords").get();
  landlordSnap.forEach((doc) => {
    const data = doc.data() as any;
    const tier = normalizeTier(data?.plan);
    if (!tier) return;
    const subStatus = String(data?.subscriptionStatus || "").toLowerCase();
    const active = subStatus
      ? subStatus === "active" || subStatus === "trialing"
      : true;
    if (!active) return;
    activeSubscribers += 1;
    byTier[tier] += 1;
    mrrCents += getPlanConfig(tier).monthlyAmountCents;
  });

  return {
    activeSubscribers,
    mrrCents,
    arrCents: mrrCents * 12,
    subscriptionsByTier: byTier,
  };
}

type ScreeningMetrics = {
  screeningsPaidThisMonth: number;
  screeningsPaidYtd: number;
  screeningRevenueCentsThisMonth: number;
  screeningRevenueCentsYtd: number;
};

function isPaidScreeningOrder(data: any): boolean {
  const status = String(data?.status || "").toLowerCase();
  if (
    status.includes("paid") ||
    status.includes("complete") ||
    status.includes("completed") ||
    status.includes("report_ready")
  ) {
    return true;
  }
  return Boolean(data?.paidAt);
}

function screeningOrderAmountCents(data: any): number {
  const amount =
    Number(data?.totalAmountCents ?? data?.amountTotalCents ?? data?.amountCents ?? 0);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount) : 0;
}

async function getScreeningMetrics(): Promise<ScreeningMetrics> {
  const monthStart = startOfMonthMs();
  const yearStart = startOfYearMs();
  let screeningsPaidThisMonth = 0;
  let screeningsPaidYtd = 0;
  let screeningRevenueCentsThisMonth = 0;
  let screeningRevenueCentsYtd = 0;

  const snap = await db.collection("screeningOrders").get();
  snap.forEach((doc) => {
    const data = doc.data() as any;
    if (!isPaidScreeningOrder(data)) return;
    const at = toMillis(data?.paidAt) || toMillis(data?.createdAt) || 0;
    if (!at) return;
    const amountCents = screeningOrderAmountCents(data);
    if (at >= yearStart) {
      screeningsPaidYtd += 1;
      screeningRevenueCentsYtd += amountCents;
    }
    if (at >= monthStart) {
      screeningsPaidThisMonth += 1;
      screeningRevenueCentsThisMonth += amountCents;
    }
  });

  return {
    screeningsPaidThisMonth,
    screeningsPaidYtd,
    screeningRevenueCentsThisMonth,
    screeningRevenueCentsYtd,
  };
}

router.get("/metrics", requireAdmin, async (_req, res) => {
  try {
    const [subscription, screening, counters] = await Promise.all([
      getSubscriptionMetrics(),
      getScreeningMetrics(),
      getCountersSummary(31),
    ]);

    const upgradesStartedThisMonth = Number(counters?.byName?.upgrade_modal_opened || 0);
    const upgradesCompletedThisMonth = Number(counters?.byName?.upgrade_modal_upgrade_clicked || 0);

    return res.json({
      ok: true,
      metrics: {
        activeSubscribers: subscription.activeSubscribers,
        mrrCents: subscription.mrrCents,
        arrCents: subscription.arrCents,
        subscriptionsByTier: subscription.subscriptionsByTier,
        screeningsPaidThisMonth: screening.screeningsPaidThisMonth,
        screeningsPaidYtd: screening.screeningsPaidYtd,
        screeningRevenueCentsThisMonth: screening.screeningRevenueCentsThisMonth,
        screeningRevenueCentsYtd: screening.screeningRevenueCentsYtd,
        upgradesStartedThisMonth,
        upgradesCompletedThisMonth,
      },
    });
  } catch (err: any) {
    console.error("[admin] metrics failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "METRICS_FAILED" });
  }
});

router.get("/metrics/tu-referrals", requireAdmin, async (req, res) => {
  try {
    const payload = await getTuReferralMetricsForMonth(String(req.query?.month || "").trim() || undefined);
    return res.json(payload);
  } catch (err: any) {
    console.error("[admin] tu referral metrics failed", err?.message || err);
    const role = String((req as any)?.user?.role || "").toLowerCase();
    const detail = safeMessage(err);
    return res.status(500).json({
      ok: false,
      error: "METRICS_FAILED",
      ...(role === "admin" && detail ? { detail } : {}),
    });
  }
});

router.get("/metrics/tu-referrals/chart", requireAdmin, async (req, res) => {
  try {
    const payload = await getTuReferralMetricsForMonth(String(req.query?.month || "").trim() || undefined);
    const initiatedMap = new Map(payload.dailyInitiated.map((p) => [p.day, p.count]));
    const completedMap = new Map(payload.dailyCompleted.map((p) => [p.day, p.count]));
    const monthDays = monthDaysFromKey(payload.month);
    const observedDays = Array.from(new Set([...initiatedMap.keys(), ...completedMap.keys()])).sort();
    const days = monthDays.length > 0 ? monthDays : observedDays;
    const series = days.map((day) => ({
      day,
      initiated: initiatedMap.get(day) || 0,
      completed: completedMap.get(day) || 0,
    }));

    return res.json({
      ok: true,
      month: payload.month,
      series,
      totals: payload.metrics,
    });
  } catch (err: any) {
    console.error("[admin] tu referral chart failed", err?.message || err);
    const role = String((req as any)?.user?.role || "").toLowerCase();
    const detail = safeMessage(err);
    return res.status(500).json({
      ok: false,
      error: "METRICS_FAILED",
      ...(role === "admin" && detail ? { detail } : {}),
    });
  }
});

async function sumStripePaymentIntents(start: number, end: number) {
  if (!isStripeConfigured()) {
    return { grossCents: 0, netCents: 0 };
  }
  const stripe = getStripeClient();
  let grossCents = 0;
  for await (const pi of stripe.paymentIntents.list({ limit: 100, created: { gte: start, lte: end } })) {
    if (pi.status !== "succeeded") continue;
    const amt = typeof pi.amount_received === "number" ? pi.amount_received : 0;
    grossCents += amt;
  }
  return { grossCents, netCents: grossCents };
}

async function sumExpenses(from?: string, to?: string) {
  let query = db.collection("admin_expenses") as FirebaseFirestore.Query;
  if (from) query = query.where("date", ">=", from);
  if (to) query = query.where("date", "<=", to);
  const snap = await query.get();
  let total = 0;
  for (const doc of snap.docs) {
    total += Number(doc.data()?.amountCents || 0);
  }
  return total;
}

router.get("/summary", requireAdmin, async (_req, res) => {
  try {
    const last30 = dateRangeForLast30d();
    const mtd = dateRangeForMtd();
    const ytd = dateRangeForYtd();

    const [last30Revenue, mtdRevenue, ytdRevenue] = await Promise.all([
      sumStripePaymentIntents(last30.start, last30.end),
      sumStripePaymentIntents(mtd.start, mtd.end),
      sumStripePaymentIntents(ytd.start, ytd.end),
    ]);

    const { byName } = await getCountersSummary(30);
    const last30dVisitors = Number(byName?.visitors || 0);
    const last30dGetStartedClicks = Number(byName?.get_started_clicks || 0);
    const last30dSeePricingClicks = Number(byName?.see_pricing_clicks || 0);
    const last30dTemplateDownloads = Number(byName?.template_downloads || 0);
    const last30dHelpSearches = Number(byName?.help_searches || 0);
    const ctaRatePricingToGetStarted =
      last30dSeePricingClicks > 0 ? last30dGetStartedClicks / last30dSeePricingClicks : 0;

    const now = Date.now();
    const todayKey = toDayString(new Date(now));
    const mtdStartKey = toDayString(new Date(Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), 1)));
    const ytdStartKey = toDayString(new Date(Date.UTC(new Date(now).getUTCFullYear(), 0, 1)));

    const [mtdExpenses, ytdExpenses] = await Promise.all([
      sumExpenses(mtdStartKey, todayKey),
      sumExpenses(ytdStartKey, todayKey),
    ]);

    return res.json({
      ok: true,
      revenue: {
        mtdGrossCents: mtdRevenue.grossCents,
        mtdNetCents: mtdRevenue.netCents,
        ytdGrossCents: ytdRevenue.grossCents,
        ytdNetCents: ytdRevenue.netCents,
        last30dGrossCents: last30Revenue.grossCents,
        last30dNetCents: last30Revenue.netCents,
      },
      marketing: {
        last30dVisitors,
        last30dGetStartedClicks,
        last30dSeePricingClicks,
        last30dTemplateDownloads,
        last30dHelpSearches,
        ctaRatePricingToGetStarted,
      },
      expenses: {
        mtdCents: mtdExpenses,
        ytdCents: ytdExpenses,
      },
    });
  } catch (err: any) {
    console.error("[admin] summary failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "SUMMARY_FAILED" });
  }
});

router.get("/control-tower", requireAdmin, async (_req, res) => {
  try {
    const payload = await getControlTowerPayload();
    return res.json(payload);
  } catch (err: any) {
    console.error("[admin] control tower failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "CONTROL_TOWER_FAILED" });
  }
});

router.get("/events/summary", requireAdmin, async (req, res) => {
  try {
    const range = String(req.query?.range || "month").toLowerCase();
    const days = range === "week" ? 7 : range === "day" ? 1 : 30;
    const now = Date.now();
    const start = now - days * 24 * 60 * 60 * 1000;

    const snapshot = await db
      .collection("events")
      .where("ts", ">=", start)
      .where("ts", "<=", now)
      .get();

    const counts = FUNNEL_EVENT_NAMES.reduce<Record<string, number>>((acc, name) => {
      acc[name] = 0;
      return acc;
    }, {});

    for (const doc of snapshot.docs) {
      const name = String(doc.data()?.name || "");
      if (!Object.prototype.hasOwnProperty.call(counts, name)) continue;
      counts[name] += 1;
    }

    return res.json({
      ok: true,
      range,
      counts,
    });
  } catch (err: any) {
    console.error("[admin] events summary failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "EVENTS_SUMMARY_FAILED" });
  }
});

router.get("/expenses", requireAdmin, async (req, res) => {
  try {
    const from = String(req.query?.from || "").trim();
    const to = String(req.query?.to || "").trim();
    let query = db.collection("admin_expenses") as FirebaseFirestore.Query;
    if (from) query = query.where("date", ">=", from);
    if (to) query = query.where("date", "<=", to);
    const snap = await query.orderBy("date", "desc").get();
    const items = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));
    return res.json({ ok: true, items });
  } catch (err: any) {
    console.error("[admin] expenses list failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "EXPENSES_LIST_FAILED" });
  }
});

router.post("/expenses", requireAdmin, async (req, res) => {
  try {
    const date = String(req.body?.date || "").trim();
    const vendor = String(req.body?.vendor || "").trim();
    const category = String(req.body?.category || "").trim();
    const amountCents = Number(req.body?.amountCents || 0);
    const notes = String(req.body?.notes || "").trim();

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ ok: false, error: "INVALID_DATE" });
    }
    if (!vendor || !category || !Number.isFinite(amountCents)) {
      return res.status(400).json({ ok: false, error: "INVALID_REQUEST" });
    }

    const createdAt = startOfDayUtc(Date.now());
    const ref = await db.collection("admin_expenses").add({
      date,
      vendor,
      category,
      amountCents: Math.round(amountCents),
      notes: notes || null,
      createdAt,
    });

    const doc = await ref.get();
    return res.json({ ok: true, item: { id: doc.id, ...(doc.data() as any) } });
  } catch (err: any) {
    console.error("[admin] expenses create failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "EXPENSES_CREATE_FAILED" });
  }
});

router.post("/status/meta", requireAdmin, async (req, res) => {
  try {
    const data = await updateStatusMeta(req.body || {});
    return res.json({ ok: true, data });
  } catch (err: any) {
    console.error("[admin] status meta update failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "STATUS_META_UPDATE_FAILED" });
  }
});

router.post("/status/component", requireAdmin, async (req, res) => {
  try {
    const data = await updateStatusComponent(req.body || {});
    return res.json({ ok: true, data });
  } catch (err: any) {
    const message = String(err?.message || "");
    if (message === "missing_component_key") {
      return res.status(400).json({ ok: false, error: "missing_component_key" });
    }
    console.error("[admin] status component update failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "STATUS_COMPONENT_UPDATE_FAILED" });
  }
});

router.post("/status/incident", requireAdmin, async (req, res) => {
  try {
    const data = await createStatusIncident(req.body || {});
    return res.json({ ok: true, data });
  } catch (err: any) {
    console.error("[admin] status incident create failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "STATUS_INCIDENT_CREATE_FAILED" });
  }
});

router.post("/status/incident/:id/resolve", requireAdmin, async (req, res) => {
  try {
    const data = await resolveStatusIncident(String(req.params?.id || ""), req.body?.message);
    return res.json({ ok: true, data });
  } catch (err: any) {
    const message = String(err?.message || "");
    if (message === "missing_incident_id") {
      return res.status(400).json({ ok: false, error: "missing_incident_id" });
    }
    console.error("[admin] status incident resolve failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "STATUS_INCIDENT_RESOLVE_FAILED" });
  }
});

export default router;
