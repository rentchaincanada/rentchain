import { Router } from "express";
import { db } from "../config/firebase";
import { authenticateJwt } from "../middleware/authMiddleware";

const router = Router();

function requireTenant(req: any, res: any, next: any) {
  if (!req.user || req.user.role !== "tenant") {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }
  next();
}

function requireLandlord(req: any, res: any, next: any) {
  const role = String(req.user?.role || "");
  if (role !== "landlord" && role !== "admin") {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }
  next();
}

router.get("/tenant/events", authenticateJwt, requireTenant, async (req: any, res) => {
  res.setHeader("x-route-source", "tenantEventsRoutes");
  console.log("[tenant/events] start");
  try {
    const tenantId = req.user?.tenantId || req.user?.id;
    if (!tenantId) return res.status(403).json({ ok: false, error: "Forbidden" });

    if (process.env.DEBUG_TENANT_EVENTS === "1") {
      return res.json({ ok: true, items: [] });
    }

    const limitRaw = Number(req.query?.limit ?? 50);
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.max(limitRaw, 1), 200) : 50;

    const snap = await db
      .collection("tenantEvents")
      .where("tenantId", "==", tenantId)
      .limit(limit)
      .get();

    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    console.log("[tenant/events] done items=", items.length);
    return res.json({ ok: true, items });
  } catch (err) {
    console.error("[tenant/events] error", err);
    return res.status(500).json({ ok: false, error: "Failed to load tenant events" });
  }
});

router.get(
  "/tenants/:tenantId/events",
  authenticateJwt,
  requireLandlord,
  async (req: any, res: any) => {
    res.setHeader("x-route-source", "tenantEventsRoutes");
    const landlordId = req.user?.landlordId || req.user?.id;
    const tenantId = String(req.params.tenantId || "");
    if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
    if (!tenantId) return res.status(400).json({ ok: false, error: "Missing tenantId" });

    const limitRaw = Number(req.query?.limit ?? 50);
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.max(limitRaw, 1), 200) : 50;

    const snap = await db
      .collection("tenantEvents")
      .where("tenantId", "==", tenantId)
      .where("landlordId", "==", landlordId)
      .orderBy("occurredAt", "desc")
      .limit(limit)
      .get();

    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    return res.json({ ok: true, items });
  }
);

export default router;
