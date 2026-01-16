import { Router } from "express";
import { db } from "../config/firebase";
import { authenticateJwt } from "../middleware/authMiddleware";

const router = Router();

const ALLOWED_STATUS = [
  "NEW",
  "IN_PROGRESS",
  "WAITING_ON_TENANT",
  "SCHEDULED",
  "RESOLVED",
  "CLOSED",
];

router.use(authenticateJwt);

router.get("/maintenance-requests", async (req: any, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const landlordId = req.user?.landlordId || req.user?.id || null;
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const { tenantId, status } = req.query || {};
    let query: FirebaseFirestore.Query = db
      .collection("maintenanceRequests")
      .where("landlordId", "==", landlordId)
      .limit(100);

    if (tenantId) {
      query = query.where("tenantId", "==", String(tenantId));
    }
    if (status && typeof status === "string") {
      query = query.where("status", "==", status.toUpperCase());
    }

    const snap = await query.get();
    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    items.sort((a, b) => (Number(b.updatedAt || 0) || 0) - (Number(a.updatedAt || 0) || 0));
    return res.json({ ok: true, data: items });
  } catch (err) {
    console.error("[maintenance-requests] list failed", { err });
    return res.status(500).json({ ok: false, error: "MAINT_REQUEST_LIST_FAILED" });
  }
});

router.patch("/maintenance-requests/:id", async (req: any, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const landlordId = req.user?.landlordId || req.user?.id || null;
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    const id = String(req.params?.id || "").trim();
    if (!id) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const docRef = db.collection("maintenanceRequests").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }
    const data = snap.data() as any;
    if (data?.landlordId && data.landlordId !== landlordId) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const updates: any = {};
    if (req.body?.status) {
      const st = String(req.body.status || "").toUpperCase();
      if (ALLOWED_STATUS.includes(st)) {
        updates.status = st;
      }
    }
    if (req.body?.landlordNote !== undefined) {
      const note = req.body.landlordNote;
      updates.landlordNote = note === null ? null : String(note || "").trim().slice(0, 5000);
    }
    updates.updatedAt = Date.now();
    updates.lastUpdatedBy = "LANDLORD";

    await docRef.update(updates);
    const refreshed = await docRef.get();
    return res.json({ ok: true, data: { id: refreshed.id, ...(refreshed.data() as any) } });
  } catch (err) {
    console.error("[maintenance-requests] update failed", { id: req.params?.id, err });
    return res.status(500).json({ ok: false, error: "MAINT_REQUEST_UPDATE_FAILED" });
  }
});

export default router;
