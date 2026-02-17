import express from "express";
import { listRecordsForLandlord } from "../services/billingService";
import { db } from "../config/firebase";
import { requireAuth } from "../middleware/requireAuth";
import { getStripeClient } from "../services/stripeService";
import { stripeNotConfiguredResponse, isStripeNotConfiguredError } from "../lib/stripeNotConfigured";
import { FRONTEND_URL } from "../config/screeningConfig";
import {
  getPlanMatrix,
  getStripeEnv,
  resolvePlanPriceId,
  type BillingPlanKey,
} from "../config/planMatrix";
import { getScreeningPricing } from "../billing/screeningPricing";

const router = express.Router();

router.get("/health", (_req, res) => {
  res.json({ ok: true, service: "billing", ts: Date.now() });
});

type SubscriptionStatusTier = "free" | "starter" | "pro" | "elite";
type SubscriptionStatusInterval = "month" | "year" | null;

function normalizeSubscriptionStatusTier(input: any): SubscriptionStatusTier {
  const raw = String(input || "").trim().toLowerCase();
  if (raw === "pro" || raw === "professional") return "pro";
  if (raw === "elite" || raw === "business" || raw === "enterprise") return "elite";
  if (raw === "starter" || raw === "core") return "starter";
  return "free";
}

function sendSubscriptionStatus(req: any, res: any) {
  const tier = normalizeSubscriptionStatusTier(req.user?.plan);
  const interval: SubscriptionStatusInterval = null;
  const renewalDate: string | null = null;
  const isActive = tier !== "free";

  return res.status(200).json({
    ok: true,
    tier,
    interval,
    renewalDate,
    isActive,
  });
}

router.get("/subscription-status", requireAuth, sendSubscriptionStatus);
// Compatibility alias in case any client still calls /api/billing/billing/subscription-status.
router.get("/billing/subscription-status", requireAuth, sendSubscriptionStatus);

router.get("/pricing", (_req, res) => {
  res.setHeader("x-route-source", "billingRoutes.ts");
  const plans = getPlanMatrix().map((plan) => ({
    key: plan.key,
    label: plan.label,
    currency: "cad",
    monthlyAmountCents: plan.monthlyAmountCents,
    yearlyAmountCents: plan.yearlyAmountCents,
  }));

  const screening = {
    basicCents: getScreeningPricing({ screeningTier: "basic" }).baseAmountCents,
    verifyCents: getScreeningPricing({ screeningTier: "verify" }).baseAmountCents,
    verifyAiCents: getScreeningPricing({ screeningTier: "verify_ai" }).baseAmountCents,
    creditScoreCents: getScreeningPricing({
      screeningTier: "basic",
      addons: ["credit_score"],
    }).scoreAddOnCents,
    expeditedCents: getScreeningPricing({
      screeningTier: "basic",
      addons: ["expedited"],
    }).expeditedAddOnCents,
    currency: "cad",
  };

  res.json({ ok: true, plans, screening, env: getStripeEnv() });
});

type BillingTier = BillingPlanKey;
type BillingInterval = "monthly" | "yearly";

function normalizeTier(input: any): BillingTier | "free" | null {
  const raw = String(input || "").trim().toLowerCase();
  if (!raw) return null;
  if (raw === "free" || raw === "screening") return "free";
  if (raw === "starter" || raw === "core") return "starter";
  if (raw === "pro") return "pro";
  if (raw === "business" || raw === "elite" || raw === "enterprise") return "business";
  return null;
}

function normalizeInterval(input: any): BillingInterval {
  const raw = String(input || "").trim().toLowerCase();
  if (raw === "year" || raw === "yearly" || raw === "annual" || raw === "annually") return "yearly";
  if (raw === "month" || raw === "monthly") return "monthly";
  return "monthly";
}

function resolvePriceId(tier: BillingTier, interval: BillingInterval) {
  return resolvePlanPriceId({ plan: tier, interval });
}

function sanitizeRedirectTo(raw: any): string {
  const fallback = "/dashboard";
  if (!raw) return fallback;
  const value = String(raw || "").trim();
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  if (value.includes("://")) return fallback;
  return value;
}

function resolveFrontendBase(): string {
  const fallback =
    process.env.NODE_ENV === "production"
      ? "https://www.rentchain.ai"
      : "http://localhost:5173";
  const base = String(process.env.FRONTEND_URL || FRONTEND_URL || fallback).trim();
  return base.replace(/\/$/, "");
}

function appendBillingCanceled(path: string): string {
  if (!path) return "/dashboard?billing=canceled=1";
  if (path.includes("?")) return `${path}&billing=canceled=1`;
  return `${path}?billing=canceled=1`;
}
router.use((req, res, next) => {
  res.setHeader("x-billing-routes", "present");
  next();
});

router.get(
  "/",
  requireAuth,
  async (req: any, res) => {
    const landlordId = req.user?.landlordId || req.user?.id;
    if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
    const records = listRecordsForLandlord(landlordId).map((record) => ({
      ...record,
      type: record.kind,
    }));
    res.json({ ok: true, records, ts: Date.now() });
  }
);

router.get(
  "/receipts/:id",
  requireAuth,
  async (req: any, res) => {
    // NOTE: ensure the receipt belongs to this landlordId before exposing content
    res.type("html").send(`
      <h2>RentChain Receipt</h2>
      <p>Receipt ID: ${req.params.id}</p>
      <p>Status: Paid</p>
    `);
  }
);

async function handleCheckout(req: any, res: any) {
  const landlordId = req.user?.landlordId || req.user?.id;
  const userId = req.user?.id || null;
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const { tier, interval, plan, requiredPlan, planKey, featureKey, source, redirectTo } =
    req.body || {};
  const resolvedTier = normalizeTier(tier || plan || requiredPlan || planKey);
  if (!resolvedTier) {
    return res.status(400).json({ ok: false, error: "missing_tier" });
  }
  if (resolvedTier === "free") {
    return res.status(400).json({ ok: false, error: "invalid_tier" });
  }
  const resolvedInterval = normalizeInterval(interval);

  const resolved = resolvePriceId(resolvedTier, resolvedInterval);
  if (!resolved.priceId) {
    console.error("[billing/checkout] price not configured or invalid", { envKey: resolved.envKey });
    const statusCode = process.env.NODE_ENV === "production" ? 503 : 400;
    return res.status(statusCode).json({
      ok: false,
      error: "price_not_configured",
      detail: `${resolved.envKey} must be Stripe price id price_...`,
    });
  }

  let stripe: any;
  try {
    stripe = getStripeClient();
  } catch (err) {
    if (isStripeNotConfiguredError(err)) {
      return res.status(400).json(stripeNotConfiguredResponse());
    }
    throw err;
  }

  const featureKeyValue = String(featureKey || "unknown").trim().slice(0, 80);
  const sourceValue = String(source || "unknown").trim().slice(0, 80);
  const redirectToValue = sanitizeRedirectTo(redirectTo);
  const frontendUrl = resolveFrontendBase();

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: resolved.priceId, quantity: 1 }],
      metadata: {
        landlordId: String(landlordId),
        userId: String(userId || ""),
        tier: resolvedTier,
        interval: resolvedInterval,
        featureKey: featureKeyValue,
        source: sourceValue,
      },
      subscription_data: {
        metadata: {
          landlordId: String(landlordId),
          userId: String(userId || ""),
          tier: resolvedTier,
          interval: resolvedInterval,
          featureKey: featureKeyValue,
          source: sourceValue,
        },
      },
      success_url: `${frontendUrl}/billing/checkout-success?session_id={CHECKOUT_SESSION_ID}&redirectTo=${encodeURIComponent(
        redirectToValue
      )}`,
      cancel_url: `${frontendUrl}${appendBillingCanceled(redirectToValue)}`,
    });

    return res.status(200).json({ ok: true, url: session.url });
  } catch (err: any) {
    console.error("[billing/checkout] Failed to create Checkout Session", {
      message: err?.message,
    });
    return res.status(500).json({ ok: false, error: "checkout_failed" });
  }
}

router.post("/checkout", requireAuth, handleCheckout);
router.post("/subscribe", requireAuth, handleCheckout);
router.post("/upgrade", requireAuth, handleCheckout);

router.post("/portal", requireAuth, async (req: any, res) => {
  const landlordId = req.user?.landlordId || req.user?.id;
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

  let stripe: any;
  try {
    stripe = getStripeClient();
  } catch (err) {
    if (isStripeNotConfiguredError(err)) {
      return res.status(400).json(stripeNotConfiguredResponse());
    }
    throw err;
  }

  const landlordRef = db.collection("landlords").doc(String(landlordId));
  const landlordSnap = await landlordRef.get();
  if (!landlordSnap.exists) {
    return res.status(404).json({ ok: false, error: "landlord_not_found" });
  }
  const landlord = landlordSnap.data() as any;

  let stripeCustomerId = String(landlord?.stripeCustomerId || "").trim();
  if (!stripeCustomerId) {
    const email = String(landlord?.email || req.user?.email || "").trim() || undefined;
    const name = String(landlord?.name || landlord?.companyName || "").trim() || undefined;
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: { landlordId: String(landlordId) },
    });
    stripeCustomerId = customer.id;
    await landlordRef.set({ stripeCustomerId }, { merge: true });
  }

  const frontendUrl = resolveFrontendBase();
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${frontendUrl}/billing`,
  });

  return res.status(200).json({ ok: true, url: session.url });
});

export default router;
