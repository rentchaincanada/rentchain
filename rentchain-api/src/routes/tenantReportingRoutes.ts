import { Router } from "express";
import { requireRole } from "../middleware/requireRole";
import { db } from "../config/firebase";
import { createLedgerEvent } from "../services/ledgerEventsService";

const router = Router();

router.use(requireRole("tenant"));

router.get("/consent", async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  const landlordId = req.user?.landlordId || req.user?.id;
  if (!tenantId || !landlordId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const snap = await db
      .collection("reportingConsents")
      .where("tenantId", "==", tenantId)
      .where("landlordId", "==", landlordId)
      .limit(1)
      .get();

    if (snap.empty) return res.json({ status: "pending" });
    return res.json({ status: snap.docs[0].data().status, consentId: snap.docs[0].id });
  } catch (err) {
    console.error("[tenantReportingRoutes] get consent error", err);
    return res.status(500).json({ error: "Failed to load consent" });
  }
});

router.post("/consent/grant", async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  const landlordId = req.body?.landlordId || req.user?.landlordId || req.user?.id;
  if (!tenantId || !landlordId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const now = new Date().toISOString();
    const consent = {
      tenantId,
      landlordId,
      scope: "credit_reporting",
      status: "granted",
      grantedAt: now,
      revokedAt: null,
      method: req.body?.method || "portal_checkbox",
      ipHash: req.body?.ipHash ?? null,
      userAgent: req.headers["user-agent"] || null,
      createdAt: now,
    };
    await db.collection("reportingConsents").add(consent);
    createLedgerEvent({
      tenantId,
      landlordId,
      type: "reporting_consent_granted",
      amountDelta: 0,
      occurredAt: now,
      notes: "Tenant granted credit reporting consent",
    });
    return res.json({ status: "granted" });
  } catch (err) {
    console.error("[tenantReportingRoutes] grant error", err);
    return res.status(500).json({ error: "Failed to grant consent" });
  }
});

router.post("/consent/revoke", async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  const landlordId = req.body?.landlordId || req.user?.landlordId || req.user?.id;
  if (!tenantId || !landlordId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const now = new Date().toISOString();
    const snap = await db
      .collection("reportingConsents")
      .where("tenantId", "==", tenantId)
      .where("landlordId", "==", landlordId)
      .limit(1)
      .get();
    if (snap.empty) {
      return res.status(404).json({ error: "Consent not found" });
    }
    await snap.docs[0].ref.update({ status: "revoked", revokedAt: now });
    createLedgerEvent({
      tenantId,
      landlordId,
      type: "reporting_consent_revoked",
      amountDelta: 0,
      occurredAt: now,
      notes: "Tenant revoked credit reporting consent",
    });
    return res.json({ status: "revoked" });
  } catch (err) {
    console.error("[tenantReportingRoutes] revoke error", err);
    return res.status(500).json({ error: "Failed to revoke consent" });
  }
});

export default router;
