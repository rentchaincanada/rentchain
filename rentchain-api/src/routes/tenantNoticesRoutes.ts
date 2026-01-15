import { Router } from "express";
import { db } from "../config/firebase";
import { authenticateJwt } from "../middleware/authMiddleware";

const router = Router();

const ALLOWED_TYPES = ["GENERAL", "LATE_RENT", "ENTRY_NOTICE", "LEASE_UPDATE", "WARNING"];

router.post("/tenant-notices", authenticateJwt, async (req: any, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const landlordId = req.user?.landlordId || req.user?.id || null;
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const { tenantId, type, title, body, effectiveAt } = req.body || {};
    const trimmedTitle = typeof title === "string" ? title.trim() : "";
    const trimmedBody = typeof body === "string" ? body.trim() : "";
    const normalizedType = typeof type === "string" ? type.trim().toUpperCase() : "";
    const effAt =
      effectiveAt === null || effectiveAt === undefined
        ? null
        : Number.isFinite(Number(effectiveAt))
        ? Number(effectiveAt)
        : null;

    if (!tenantId || !trimmedTitle || !trimmedBody || !normalizedType) {
      return res.status(400).json({ ok: false, error: "INVALID_REQUEST" });
    }
    if (!ALLOWED_TYPES.includes(normalizedType)) {
      return res.status(400).json({ ok: false, error: "INVALID_REQUEST" });
    }
    if (trimmedBody.length > 10_000) {
      return res.status(400).json({ ok: false, error: "INVALID_REQUEST" });
    }

    // Ownership check
    try {
      const tenantSnap = await db.collection("tenants").doc(String(tenantId)).get();
      if (tenantSnap.exists) {
        const t = tenantSnap.data() as any;
        const tenantLandlordId = t?.landlordId || t?.ownerId || t?.owner;
        if (tenantLandlordId && tenantLandlordId !== landlordId) {
          return res.status(403).json({ ok: false, error: "FORBIDDEN" });
        }
      }
    } catch {
      // ignore lookup errors; rely on auth fallback
    }

    const now = Date.now();
    const doc = {
      landlordId,
      tenantId: String(tenantId),
      type: normalizedType,
      title: trimmedTitle,
      body: trimmedBody,
      effectiveAt: effAt,
      createdAt: now,
      createdBy: req.user?.email || req.user?.id || null,
      status: "ACTIVE",
    };

    const ref = await db.collection("tenantNotices").add(doc);
    return res.json({ ok: true, data: { id: ref.id, ...doc } });
  } catch (err) {
    console.error("[tenant-notices] create failed", err);
    return res.status(500).json({ ok: false, error: "TENANT_NOTICE_CREATE_FAILED" });
  }
});

export default router;
