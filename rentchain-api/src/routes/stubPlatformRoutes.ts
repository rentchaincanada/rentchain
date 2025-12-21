import { Router } from "express";
import { PLANS, resolvePlan } from "../entitlements/plans";
import { upgradeRequired } from "../http/errors";

const router = Router();

router.post("/properties/:propertyId/units/import", (_req, res) => {
  res.setHeader("x-route-source", "stubPlatformRoutes");
  return res.json({ status: "ok", received: true });
});

router.get("/action-requests/snapshot", (_req, res) => {
  return res.json({
    ok: true,
    items: [],
    summary: { actionRequired: 0, overdue: 0 },
    generatedAt: new Date().toISOString(),
  });
});

router.get("/action-requests/portfolio", (_req, res) => {
  return res.json({ actionRequests: [] });
});

router.get("/payments", (_req, res) => {
  return res.json({ items: [] });
});

router.get("/payments/tenant/:tenantId/monthly", (req, res) => {
  const year = Number(req.query?.year ?? new Date().getFullYear());
  const month = Number(req.query?.month ?? new Date().getMonth() + 1);
  return res.json({
    year,
    month,
    items: [],
    totals: { paid: 0, due: 0 },
  });
});

router.get("/ledger/events", (_req, res) => {
  return res.json({ items: [] });
});

router.get("/ledger", (_req, res) => {
  return res.json({ items: [] });
});

router.get("/ledger/summary", (_req, res) => {
  return res.json({
    status: "ok",
    units: 0,
    properties: 0,
    screeningsThisMonth: 0,
  });
});

router.get("/dashboard/ai-summary", (_req, res) => {
  return res.json({ status: "unavailable", reason: "not_configured" });
});

router.post("/dashboard/ai-summary", (_req, res) => {
  return res.json({ status: "unavailable", reason: "not_configured" });
});

router.get("/blockchain/verify", (_req, res) => {
  return res.json({ status: "unavailable", reason: "not_configured" });
});

router.get("/tenants/:tenantId/reputation/timeline", (_req, res) => {
  return res.json({ items: [] });
});

router.get("/applications", (req, res) => {
  const planKey = resolvePlan((req as any)?.user?.plan);
  const capabilities = PLANS[planKey]?.capabilities || {};

  if (!capabilities["screening"]) {
    return res.status(402).json(
      upgradeRequired({
        plan: planKey,
        required: "screening",
        message: "Upgrade to Core to use applications.",
      })
    );
  }

  return res.json({ items: [] });
});

export default router;
