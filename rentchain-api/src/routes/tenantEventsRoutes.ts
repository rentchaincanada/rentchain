import { Router } from "express";
import { db, FieldValue } from "../config/firebase";
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

router.post("/tenant-events", authenticateJwt, requireLandlord, async (req: any, res: any) => {
  res.setHeader("x-route-source", "tenantEventsRoutes");
  try {
    const landlordId = req.user?.landlordId || req.user?.id;
    if (!landlordId) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const { tenantId, propertyId, type, title, description, amount, occurredAt } = req.body || {};

    if (!tenantId || !String(type || "").trim() || !String(title || "").trim()) {
      return res.status(400).json({
        ok: false,
        error: "tenantId, type, and title are required",
      });
    }

    const occurredDate = new Date(occurredAt || Date.now());
    const validOccurredAt = Number.isNaN(occurredDate.getTime()) ? new Date() : occurredDate;

    const payload: any = {
      tenantId: String(tenantId),
      propertyId: propertyId || null,
      landlordId,
      type: String(type),
      title: String(title),
      description: description ? String(description) : "",
      amount: typeof amount === "number" && Number.isFinite(amount) ? amount : null,
      occurredAt: validOccurredAt,
      createdAt: new Date(),
      createdAtServer: FieldValue.serverTimestamp(),
      createdBy: landlordId,
      source: "landlord_manual",
    };

    const ref = await db.collection("tenantEvents").add(payload);
    return res.json({ ok: true, eventId: ref.id });
  } catch (err) {
    console.error("[tenant-events POST] error", err);
    return res.status(500).json({ ok: false, error: "Failed to record tenant event" });
  }
});

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
