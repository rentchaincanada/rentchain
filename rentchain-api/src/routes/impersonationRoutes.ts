import { Router } from "express";
import jwt from "jsonwebtoken";
import { db } from "../services/firestore";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";
import { JWT_SECRET } from "../config/authConfig";

const router = Router();

router.post(
  "/landlord/tenants/:tenantId/impersonate",
  requireAuth,
  requireLandlord,
  async (req: any, res) => {
    res.setHeader("x-route-source", "impersonationRoutes");
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

    const payload = {
      role: "tenant",
      tenantId,
      id: tenantId,
      landlordId,
      email: tenant?.email || undefined,
      propertyId: tenant?.propertyId || null,
      unitId: tenant?.unitId || null,
    };

    if (!JWT_SECRET) {
      return res.status(500).json({ error: "JWT_SECRET missing" });
    }
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
    return res.json({ ok: true, token, tenantId });
  }
);

export default router;
