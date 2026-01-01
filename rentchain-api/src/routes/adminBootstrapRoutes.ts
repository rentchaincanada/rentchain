import { Router } from "express";
import admin from "firebase-admin";
import { db } from "../config/firebase";

const router = Router();

function requireBootstrapKey(req: any, res: any, next: any) {
  const key = String(req.headers["x-admin-key"] || "");
  if (!process.env.ADMIN_BOOTSTRAP_KEY || key !== process.env.ADMIN_BOOTSTRAP_KEY) {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }
  next();
}

/**
 * POST /api/admin/bootstrap/set-password
 * body: { email, password, role?, plan? }
 *
 * Creates/updates Firebase Auth (email/password), then upserts landlord profile in Firestore.
 * This aligns with /auth/login using signInWithPassword().
 */
router.post("/bootstrap/set-password", requireBootstrapKey, async (req: any, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const role = String(req.body?.role || "landlord");
  const plan = String(req.body?.plan || "starter");

  if (!email || !password || password.length < 8) {
    return res.status(400).json({ ok: false, error: "email+password required (min 8 chars)" });
  }

  try {
    // 1) Ensure Firebase Auth user exists & has this password
    let userRecord: admin.auth.UserRecord | null = null;

    try {
      userRecord = await admin.auth().getUserByEmail(email);
      await admin.auth().updateUser(userRecord.uid, { password, disabled: false });
    } catch (e: any) {
      const code = String(e?.code || "");
      if (code.includes("auth/user-not-found")) {
        userRecord = await admin.auth().createUser({
          email,
          password,
          emailVerified: true,
          disabled: false,
        });
      } else {
        throw e;
      }
    }

    if (!userRecord) {
      return res.status(500).json({ ok: false, error: "Failed to create/update Firebase Auth user" });
    }

    const uid = userRecord.uid;

    // 2) Upsert landlord profile so getOrCreateLandlordProfile resolves cleanly
    const landlordsCol = db.collection("landlords");
    const ref = landlordsCol.doc(uid);

    await ref.set(
      {
        id: uid,
        landlordId: uid,
        email,
        role,
        plan,
        updatedAt: Date.now(),
        createdAt: admin.firestore.FieldValue.serverTimestamp?.() ?? Date.now(),
      },
      { merge: true }
    );

    return res.json({
      ok: true,
      uid,
      email,
      role,
      plan,
      action: "firebase-auth-password-set + landlord-profile-upserted",
    });
  } catch (err: any) {
    console.error("[admin/bootstrap/set-password] error", err);
    return res
      .status(500)
      .json({ ok: false, error: "Internal", detail: String(err?.message || err) });
  }
});

router.get("/health", (_req, res) => {
  res.setHeader("x-route-source", "adminBootstrapRoutes");
  res.json({ ok: true });
});

export default router;
