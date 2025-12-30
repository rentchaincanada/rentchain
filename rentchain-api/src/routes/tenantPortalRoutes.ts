import { Router } from "express";
import { authenticateJwt } from "../middleware/authMiddleware";

const router = Router();
router.use(authenticateJwt);

function requireTenant(req: any, res: any, next: any) {
  if (!req.user || req.user.role !== "tenant") {
    return res.status(403).json({ ok: false, error: "TENANT_ONLY" });
  }
  return next();
}

router.get("/me", requireTenant, (req: any, res) => {
  return res.json({
    ok: true,
    tenant: {
      id: req.user?.tenantId,
      email: req.user?.email || null,
      propertyId: req.user?.propertyId || null,
      unitId: req.user?.unitId || null,
      leaseId: req.user?.leaseId || null,
    },
  });
});

router.get("/lease", requireTenant, (_req: any, res) => {
  return res.json({
    ok: true,
    lease: {
      property: null,
      unit: null,
      leaseId: null,
      status: "active",
    },
  });
});

router.get("/payments", requireTenant, (_req: any, res) => {
  return res.json({ ok: true, items: [] });
});

router.get("/ledger", requireTenant, (_req: any, res) => {
  return res.json({ ok: true, items: [] });
});

export default router;
