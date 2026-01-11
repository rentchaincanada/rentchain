import { Router } from "express";
import { authenticateJwt } from "../middleware/authMiddleware";
import { db } from "../config/firebase";

const router = Router();
router.use(authenticateJwt);

function requireTenant(req: any, res: any, next: any) {
  if (!req.user || req.user.role !== "tenant") {
    return res.status(403).json({ ok: false, error: "TENANT_ONLY" });
  }
  return next();
}

router.get("/me", requireTenant, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId || null;
    if (!tenantId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const snap = await db.collection("tenants").doc(tenantId).get();
    if (!snap.exists) {
      return res.status(404).json({ ok: false, error: "TENANT_NOT_FOUND" });
    }
    const data = snap.data() as any;
    return res.json({
      ok: true,
      tenant: {
        id: snap.id,
        fullName: data?.fullName || data?.name || null,
        email: data?.email ?? req.user?.email ?? null,
        phone: data?.phone ?? null,
        status: data?.status ?? null,
        landlordId: data?.landlordId ?? null,
        propertyId: data?.propertyId ?? req.user?.propertyId ?? null,
        unitId: data?.unitId ?? data?.unit ?? req.user?.unitId ?? null,
        leaseId: data?.leaseId ?? req.user?.leaseId ?? null,
        createdAt: data?.createdAt ?? null,
      },
    });
  } catch (err) {
    console.error("[tenantPortalRoutes] /tenant/me error", err);
    return res.status(500).json({ ok: false, error: "Failed to load tenant profile" });
  }
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
