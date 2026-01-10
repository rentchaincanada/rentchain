import { Router } from "express";
import { randomBytes } from "crypto";
import { authenticateJwt } from "../middleware/authMiddleware";
import { db } from "../config/firebase";

const router = Router();

async function ensurePropertyOwned(propertyId: string, landlordId: string) {
  const snap = await db.collection("properties").doc(propertyId).get();
  if (!snap.exists) return { ok: false as const, code: "NOT_FOUND" as const };
  const data = snap.data() as any;
  if ((data?.landlordId || data?.ownerId || data?.owner) !== landlordId) {
    return { ok: false as const, code: "FORBIDDEN" as const };
  }
  return { ok: true as const, data };
}

router.post("/application-links", authenticateJwt, async (req: any, res) => {
  res.setHeader("x-route-source", "landlordApplicationLinksRoutes");
  try {
    const role = String(req.user?.role || "");
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }

    const landlordId = req.user?.landlordId || req.user?.id;
    const propertyId = String(req.body?.propertyId || "").trim();
    const unitId = String(req.body?.unitId || "").trim();

    if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
    if (!propertyId || !unitId) {
      return res.status(400).json({ ok: false, error: "propertyId and unitId are required" });
    }

    const ownership = await ensurePropertyOwned(propertyId, landlordId);
    if (!ownership.ok) {
      if (ownership.code === "NOT_FOUND") return res.status(404).json({ ok: false, error: "Property not found" });
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }

    const unitSnap = await db.collection("units").doc(unitId).get();
    if (!unitSnap.exists) {
      return res.status(404).json({ ok: false, error: "Unit not found" });
    }
    const unit = unitSnap.data() as any;
    if (unit?.landlordId !== landlordId) {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }
    if (unit?.propertyId && unit.propertyId !== propertyId) {
      return res.status(400).json({ ok: false, error: "Unit does not belong to property" });
    }

    const token = randomBytes(32).toString("hex");
    const now = new Date();
    const ref = await db.collection("application_links").add({
      landlordId,
      propertyId,
      unitId,
      token,
      createdAt: now,
      isActive: true,
    });

    const baseUrl = (process.env.PUBLIC_APP_URL || "https://www.rentchain.ai").replace(/\/$/, "");
    const applicationUrl = `${baseUrl}/apply/${encodeURIComponent(token)}`;

    return res.json({
      ok: true,
      id: ref.id,
      token,
      applicationUrl,
    });
  } catch (err: any) {
    console.error("[application-links] create failed", err?.message || err, err);
    return res.status(500).json({ ok: false, error: "Failed to create application link" });
  }
});

export default router;
