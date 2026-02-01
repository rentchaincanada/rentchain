import express from "express";
import { listBillingRecords } from "../billing/billingService";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requireAuthz";
import { getStripeClient } from "../services/stripeService";
import { stripeNotConfiguredResponse, isStripeNotConfiguredError } from "../lib/stripeNotConfigured";
import { FRONTEND_URL } from "../config/screeningConfig";

const router = express.Router();

router.get("/health", (_req, res) => {
  res.json({ ok: true, service: "billing", ts: Date.now() });
});

type BillingTier = "starter" | "pro" | "business";
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
  if (raw === "yearly" || raw === "annual" || raw === "annually") return "yearly";
  return "monthly";
}

function resolvePriceId(
  tier: BillingTier,
  interval: BillingInterval
): { priceId: string | null; envKey: string; hadValue: boolean } {
  const preferredKey =
    tier === "starter"
      ? interval === "yearly"
        ? "STRIPE_PRICE_STARTER_YEARLY"
        : "STRIPE_PRICE_STARTER_MONTHLY"
      : tier === "pro"
      ? interval === "yearly"
        ? "STRIPE_PRICE_PRO_YEARLY"
        : "STRIPE_PRICE_PRO_MONTHLY"
      : interval === "yearly"
      ? "STRIPE_PRICE_BUSINESS_YEARLY"
      : "STRIPE_PRICE_BUSINESS_MONTHLY";
  const legacyKey =
    tier === "starter"
      ? "STRIPE_PRICE_STARTER"
      : tier === "pro"
      ? "STRIPE_PRICE_PRO"
      : "STRIPE_PRICE_BUSINESS";
  const keys = interval === "monthly" ? [preferredKey, legacyKey] : [preferredKey];

  for (const key of keys) {
    const raw = process.env[key];
    if (raw === undefined || raw === null || String(raw).trim() === "") continue;
    const trimmed = String(raw).trim();
    if (trimmed.startsWith("price_")) {
      return { priceId: trimmed, envKey: key, hadValue: true };
    }
    return { priceId: null, envKey: key, hadValue: true };
  }

  return { priceId: null, envKey: preferredKey, hadValue: false };
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
  requirePermission("reports.view"),
  async (req: any, res) => {
    const landlordId = req.user?.landlordId || req.user?.id;
    if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
    const records = await listBillingRecords(landlordId);
    res.json({ ok: true, records });
  }
);

router.get(
  "/receipts/:id",
  requireAuth,
  requirePermission("reports.view"),
  async (req: any, res) => {
    // NOTE: ensure the receipt belongs to this landlordId before exposing content
    res.type("html").send(`
      <h2>RentChain Receipt</h2>
      <p>Receipt ID: ${req.params.id}</p>
      <p>Status: Paid</p>
    `);
  }
);

router.post("/checkout", requireAuth, async (req: any, res) => {
  const landlordId = req.user?.landlordId || req.user?.id;
  const userId = req.user?.id || null;
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const { tier, interval, plan, requiredPlan, featureKey, source, redirectTo } =
    req.body || {};
  const resolvedTier = normalizeTier(tier || plan || requiredPlan);
  if (!resolvedTier) {
    return res.status(400).json({ ok: false, error: "missing_tier" });
  }
  if (resolvedTier === "free") {
    return res.status(400).json({ ok: false, error: "invalid_tier" });
  }
  const resolvedInterval = normalizeInterval(interval);

  const { priceId, envKey } = resolvePriceId(resolvedTier, resolvedInterval);
  if (!priceId) {
    console.error("[billing/checkout] price not configured or invalid", { envKey });
    return res.status(400).json({
      ok: false,
      error: "price_not_configured",
      detail: `${envKey} must be Stripe price id price_...`,
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
      line_items: [{ price: priceId, quantity: 1 }],
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
});

export default router;
