import { Router } from "express";
import { db } from "../config/firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";

const router = Router();

router.get("/consents", requireAuth, requireRole(["landlord", "admin"]), async (req, res) => {
  const tenantId = req.query.tenantId as string | undefined;
  const landlordId = req.query.landlordId as string | undefined;

  try {
    let query: FirebaseFirestore.Query = db.collection("reportingConsents");
    if (tenantId) query = query.where("tenantId", "==", tenantId);
    if (landlordId) query = query.where("landlordId", "==", landlordId);
    query = query.orderBy("createdAt", "desc").limit(10);

    const snap = await query.get();
    const results = snap.docs.map((doc) => {
      const d = doc.data() as any;
      return {
        id: doc.id,
        tenantId: d.tenantId ?? null,
        landlordId: d.landlordId ?? null,
        status: d.status ?? null,
        createdAt: d.createdAt ?? null,
        grantedAt: d.grantedAt ?? null,
        revokedAt: d.revokedAt ?? null,
      };
    });
    return res.json({ ok: true, count: results.length, results });
  } catch (err: any) {
    console.error("[admin consent diag] error", err);
    return res.status(500).json({ error: "Failed to fetch consents" });
  }
});

export default router;
