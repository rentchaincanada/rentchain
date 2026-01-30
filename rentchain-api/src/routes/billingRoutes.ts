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
router.get("/_probe", (_req, res) => res.json({ ok: true, billingRoutes: true }));

function normalizePlan(input: string): "starter" | "pro" | "elite" | null {
  const raw = String(input || "").trim().toLowerCase();
  if (!raw || raw === "free" || raw === "screening") return null;
  if (raw === "starter" || raw === "core") return "starter";
  if (raw === "pro") return "pro";
  if (raw === "business" || raw === "elite" || raw === "enterprise") return "elite";
  return null;
}

function resolvePriceId(plan: "starter" | "pro" | "elite"): string | null {
  if (plan === "starter") return process.env.STRIPE_PRICE_STARTER || null;
  if (plan === "pro") return process.env.STRIPE_PRICE_PRO || null;
  return process.env.STRIPE_PRICE_BUSINESS || null;
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

  const { plan, featureKey, source, redirectTo } = req.body || {};
  if (!plan) {
    return res.status(400).json({ ok: false, error: "missing_plan" });
  }
  const normalizedPlan = normalizePlan(String(plan || ""));
  if (!normalizedPlan) {
    return res.status(400).json({ ok: false, error: "invalid_plan" });
  }

  const priceId = resolvePriceId(normalizedPlan);
  if (!priceId) {
    return res.status(400).json({ ok: false, error: "price_not_configured" });
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
  const frontendUrl = (process.env.FRONTEND_URL || FRONTEND_URL || "").replace(/\/$/, "");
  if (!frontendUrl) {
    return res.status(400).json({ ok: false, error: "frontend_not_configured" });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        landlordId: String(landlordId),
        userId: String(userId || ""),
        plan: normalizedPlan,
        featureKey: featureKeyValue,
        source: sourceValue,
      },
      success_url: `${frontendUrl}/billing/checkout-success?session_id={CHECKOUT_SESSION_ID}&redirectTo=${encodeURIComponent(
        redirectToValue
      )}`,
      cancel_url: `${frontendUrl}/billing?checkout=cancel&redirectTo=${encodeURIComponent(
        redirectToValue
      )}`,
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
