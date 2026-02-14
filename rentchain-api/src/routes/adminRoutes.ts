import { Router } from "express";
import admin from "firebase-admin";
import { db } from "../config/firebase";
import { requireAdmin } from "../middleware/requireAdmin";
import { getCountersSummary } from "../services/telemetryService";
import { getStripeClient, isStripeConfigured } from "../services/stripeService";

const router = Router();
const FUNNEL_EVENT_NAMES = [
  "pricing_demo_clicked",
  "demo_request_access_clicked",
  "upgrade_modal_opened",
  "upgrade_modal_upgrade_clicked",
];

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

export default router;
