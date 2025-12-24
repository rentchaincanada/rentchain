import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../config/firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";
import admin from "firebase-admin";

const router = Router();

router.post("/create", requireAuth, requireRole(["landlord", "admin"]), async (req: any, res) => {
  const { email, password, landlordId, status } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const hash = await bcrypt.hash(String(password), 10);
  const ownerLandlordId = landlordId || req.user?.landlordId || req.user?.id;

  try {
    const docRef = await db.collection("tenants").add({
      id: null,
      email: normalizedEmail,
      landlordId: ownerLandlordId ?? null,
      role: "tenant",
      status: status || "active",
      passwordHash: hash,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // also store id for convenience
    await docRef.set({ id: docRef.id }, { merge: true });

    return res.json({
      ok: true,
      tenantId: docRef.id,
      email: normalizedEmail,
      landlordId: ownerLandlordId ?? null,
      status: status || "active",
    });
  } catch (err: any) {
    console.error("[admin tenant create] error", err);
    return res.status(500).json({ error: "Failed to create tenant" });
  }
});

router.get("/list", requireAuth, requireRole(["landlord", "admin"]), async (_req, res) => {
  try {
    const snap = await db.collection("tenants").orderBy("createdAt", "desc").limit(20).get();
    const tenants = snap.docs.map((doc) => {
      const t = doc.data() as any;
      return {
        id: doc.id,
        email: t.email ?? null,
        status: t.status ?? null,
        landlordId: t.landlordId ?? null,
        createdAt: t.createdAt ?? null,
      };
    });
    return res.json({ ok: true, count: tenants.length, tenants });
  } catch (err: any) {
    console.error("[admin tenant list] error", err);
    return res.status(500).json({ error: "Failed to list tenants" });
  }
});

export default router;
