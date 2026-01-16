import { Router } from "express";
import { createHash, randomBytes } from "crypto";
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

router.post("/", authenticateJwt, async (req: any, res) => {
  res.setHeader("x-route-source", "landlordApplicationLinksRoutes");
  try {
    const role = String(req.user?.role || "");
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }

    const landlordId = req.user?.landlordId || req.user?.id;
    const propertyId = String(req.body?.propertyId || "").trim();
    const unitIdRaw = req.body?.unitId;
    const unitId = unitIdRaw === null || unitIdRaw === undefined ? "" : String(unitIdRaw).trim();
    const expiresInDaysRaw = Number(req.body?.expiresInDays ?? 14);

    if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
    if (!propertyId) {
      return res.status(400).json({ ok: false, error: "propertyId is required" });
    }

    const ownership = await ensurePropertyOwned(propertyId, landlordId);
    if (!ownership.ok) {
      if (ownership.code === "NOT_FOUND") return res.status(404).json({ ok: false, error: "Property not found" });
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }

    if (unitId) {
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
    }

    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const now = Date.now();
    const expiresInDays = Number.isFinite(expiresInDaysRaw)
      ? Math.min(Math.max(expiresInDaysRaw, 1), 60)
      : 14;
    const expiresAt = now + expiresInDays * 24 * 60 * 60 * 1000;

    const ref = await db.collection("applicationLinks").add({
      landlordId,
      propertyId,
      unitId: unitId || null,
      createdAt: now,
      expiresAt,
      status: "ACTIVE",
      tokenHash,
    });

    const baseUrl = (process.env.PUBLIC_APP_URL || "https://www.rentchain.ai").replace(/\/$/, "");
    const applicationUrl = `${baseUrl}/apply/${encodeURIComponent(token)}`;

    return res.json({
      ok: true,
      data: {
        id: ref.id,
        url: applicationUrl,
        expiresAt,
      },
    });
  } catch (err: any) {
    console.error("[application-links] create failed", err?.message || err, err);
    return res.status(500).json({ ok: false, error: "Failed to create application link" });
  }
});

export default router;
