import { Router } from "express";
import { db } from "../config/firebase";
import { authenticateJwt } from "../middleware/authMiddleware";

const router = Router();

router.post("/ledger/:ledgerItemId/attachments", authenticateJwt, async (req: any, res) => {
  try {
    const role = String(req.user?.role || "");
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const landlordId = req.user?.landlordId || req.user?.id;
    const ledgerItemId = String(req.params?.ledgerItemId || "").trim();
    const { tenantId, url, title, fileName, purpose, purposeLabel } = req.body || {};

    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    if (!tenantId || !url || !ledgerItemId) return res.status(400).json({ ok: false, error: "INVALID_REQUEST" });
    if (typeof url !== "string" || !url.startsWith("https://")) {
      return res.status(400).json({ ok: false, error: "INVALID_URL" });
    }

    // Ownership check: ensure tenant belongs to landlord if landlordId stored
    try {
      const tenantSnap = await db.collection("tenants").doc(String(tenantId)).get();
      if (tenantSnap.exists) {
        const data = tenantSnap.data() as any;
        const tenantLandlordId = data?.landlordId || data?.ownerId || data?.owner;
        if (tenantLandlordId && tenantLandlordId !== landlordId) {
          return res.status(403).json({ ok: false, error: "FORBIDDEN" });
        }
      }
    } catch {
      // ignore lookup errors
    }

    const normalizePurpose = (val: any): string | null => {
      const raw = String(val || "").trim();
      if (!raw) return null;
      const normalized = raw.replace(/\s+/g, "_").replace(/__+/g, "_").toUpperCase();
      const allowed = ["RENT", "PARKING", "SECURITY_DEPOSIT", "DAMAGE", "LATE_FEE", "UTILITIES", "OTHER"];
      return allowed.includes(normalized) ? normalized : "OTHER";
    };
    const normalizedPurpose = normalizePurpose(purpose);
    const normalizedPurposeLabel =
      typeof purposeLabel === "string" && purposeLabel.trim()
        ? purposeLabel.trim().slice(0, 80)
        : null;

    const now = Date.now();
    const doc = {
      landlordId,
      tenantId: String(tenantId),
      ledgerItemId,
      url: String(url).trim(),
      title: title ? String(title).trim() : null,
      fileName: fileName ? String(fileName).trim() : null,
      purpose: normalizedPurpose,
      purposeLabel: normalizedPurposeLabel,
      createdAt: now,
      createdBy: req.user?.email || req.user?.id || null,
    };

    const ref = await db.collection("ledgerAttachments").add(doc);
    return res.json({ ok: true, data: { id: ref.id, ...doc } });
  } catch (err) {
    console.error("[ledgerAttachmentsRoutes] create error", err);
    return res.status(500).json({ ok: false, error: "LEDGER_ATTACHMENT_CREATE_FAILED" });
  }
});

export default router;
