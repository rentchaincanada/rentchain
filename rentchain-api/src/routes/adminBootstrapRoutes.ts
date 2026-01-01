import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../config/firebase";

const router = Router();

function requireBootstrapKey(req: any, res: any, next: any) {
  const key = String(req.headers["x-admin-key"] || "");
  if (!process.env.ADMIN_BOOTSTRAP_KEY || key !== process.env.ADMIN_BOOTSTRAP_KEY) {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }
  next();
}

// POST /api/admin/bootstrap/set-password
// body: { email, password, role?, plan? }
// Creates user if missing; resets password hash if exists.
router.post("/bootstrap/set-password", requireBootstrapKey, async (req: any, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const role = String(req.body?.role || "landlord");
  const plan = String(req.body?.plan || "starter");

  if (!email || !password || password.length < 8) {
    return res.status(400).json({ ok: false, error: "email+password required (min 8 chars)" });
  }

  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // Update the collection name to match your auth system.
  // Common options: "users", "authUsers", "landlords"
  const usersCol = db.collection("users");

  // Find by email (if you store users by docId=emailKey, simplify accordingly)
  const snap = await usersCol.where("email", "==", email).limit(1).get();

  if (!snap.empty) {
    const doc = snap.docs[0];
    await doc.ref.set(
      {
        email,
        passwordHash,
        role,
        plan,
        updatedAt: Date.now(),
      },
      { merge: true }
    );
    return res.json({ ok: true, action: "updated", id: doc.id, email });
  }

  // Create new user
  const ref = usersCol.doc();
  await ref.set({
    email,
    passwordHash,
    role,
    plan,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  return res.json({ ok: true, action: "created", id: ref.id, email });
});

router.get("/health", (_req, res) => {
  res.setHeader("x-route-source", "adminBootstrapRoutes");
  res.json({ ok: true });
});

export default router;
