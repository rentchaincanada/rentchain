import { Router } from "express";
import { db } from "../firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";

const router = Router();

router.get("/tenants/:tenantId/report", requireAuth, requireLandlord, async (req: any, res) => {
  res.setHeader("x-route-source", "tenantReportRoutes");
  const landlordId = req.user?.landlordId || req.user?.id;
  const tenantId = String(req.params.tenantId || "");
  if (!landlordId) return res.status(401).json({ error: "Unauthorized" });
  if (!tenantId) return res.status(400).json({ error: "Missing tenantId" });

  const tenantSnap = await db.collection("tenants").doc(tenantId).get();
  if (!tenantSnap.exists) return res.status(404).json({ error: "Tenant not found" });
  const tenant = tenantSnap.data() as any;
  if (tenant?.landlordId && tenant.landlordId !== landlordId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  return res.json({
    ok: true,
    tenant: {
      id: tenantId,
      name: tenant?.name || tenant?.fullName || "-",
      email: tenant?.email || "-",
      phone: tenant?.phone || "-",
      status: tenant?.status || "active",
      createdAt: tenant?.createdAt || null,
      propertyId: tenant?.propertyId || null,
      unitId: tenant?.unitId || null,
    },
    summary: {
      leasesActive: tenant?.leasesActive ?? null,
      lastPaymentAt: tenant?.lastPaymentAt ?? null,
      reputationScore: tenant?.reputationScore ?? null,
    },
  });
});

export default router;
