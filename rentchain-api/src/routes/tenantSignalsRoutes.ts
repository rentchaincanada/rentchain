import { Router } from "express";
import { authenticateJwt } from "../middleware/authMiddleware";
import { listLedgerEventsV2 } from "../services/ledgerEventsFirestoreService";
import { computeTenantSignals } from "../services/tenantSignalsService";

const router = Router();
router.use(authenticateJwt);

router.get("/tenants/:tenantId/signals", async (req: any, res) => {
  res.setHeader("x-route-source", "tenantSignalsRoutes");
  const landlordId = req.user?.landlordId || req.user?.id;
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const tenantId = String(req.params?.tenantId || "").trim();
  if (!tenantId) return res.status(400).json({ ok: false, error: "tenantId required" });

  const result = await listLedgerEventsV2({
    landlordId,
    tenantId,
    limit: 200,
  });

  const signals = computeTenantSignals(result.items || [], tenantId, landlordId);
  return res.json({ ok: true, signals });
});

export default router;
