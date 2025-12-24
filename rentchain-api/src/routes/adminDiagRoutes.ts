import { Router } from "express";
import { db } from "../config/firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";

const router = Router();

router.get("/tenant-by-email", requireAuth, requireRole(["landlord", "admin"]), async (req, res) => {
  const email = req.query.email as string | undefined;
  if (!email) return res.status(400).json({ error: "email required" });

  try {
    const snap = await db
      .collection("tenants")
      .where("email", "==", String(email))
      .limit(5)
      .get();

    const results = snap.docs.map((doc) => {
      const tenant = doc.data() as any;
      return {
        id: doc.id,
        email: tenant.email ?? null,
        status: tenant.status ?? null,
        landlordId: tenant.landlordId ?? null,
        hasPasswordHash: !!tenant.passwordHash,
        passwordHashPrefix: tenant.passwordHash ? String(tenant.passwordHash).slice(0, 7) : null,
      };
    });

    return res.json({ ok: true, count: results.length, results });
  } catch (err: any) {
    console.error("[admin diag] tenant lookup error", err);
    return res.status(500).json({ error: "lookup_failed" });
  }
});

export default router;
