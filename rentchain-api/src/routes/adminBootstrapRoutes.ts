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

function requireBootstrapEnabled(_req: any, res: any, next: any) {
  const enabled =
    String(process.env.ADMIN_BOOTSTRAP_ENABLED || "")
      .trim()
      .toLowerCase() === "true";
  const isProd = String(process.env.NODE_ENV || "").toLowerCase() === "production";

  if (isProd && !enabled) {
    return res.status(404).json({ ok: false });
  }
  next();
}

const allowedIps = String(process.env.ADMIN_BOOTSTRAP_IP_ALLOWLIST || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function getClientIp(req: any) {
  const xff = String(req.headers["x-forwarded-for"] || "");
  const first = xff.split(",")[0].trim();
  return first || req.ip || "";
}

function requireBootstrapIp(req: any, res: any, next: any) {
  if (!allowedIps.length) return next();
  const ip = getClientIp(req);
  if (!allowedIps.includes(ip)) {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }
  next();
}

// POST /api/admin/bootstrap/set-password
// body: { email, password, role?, plan? }
router.post(
  "/bootstrap/set-password",
  requireBootstrapEnabled,
  requireBootstrapIp,
  requireBootstrapKey,
  async (req: any, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const role = String(req.body?.role || "landlord");
  const plan = String(req.body?.plan || "starter");

  if (!email || !password || password.length < 8) {
    return res.status(400).json({ ok: false, error: "email+password required (min 8 chars)" });
  }

  try {
    // 1) Create/update Firebase Auth user (THIS is what /login uses)
    let user: admin.auth.UserRecord;
    try {
      user = await admin.auth().getUserByEmail(email);
      user = await admin.auth().updateUser(user.uid, { password, disabled: false });
    } catch (e: any) {
      if (String(e?.code || "").includes("auth/user-not-found")) {
        user = await admin.auth().createUser({
          email,
          password,
          disabled: false,
          emailVerified: true, // optional
        });
      } else {
        throw e;
      }
    }

    // 2) Upsert landlord profile doc to match your downstream flow
    await db.collection("landlords").doc(user.uid).set(
      {
        id: user.uid,
        landlordId: user.uid,
        email,
        role,
        plan,
        updatedAt: Date.now(),
        createdAt: Date.now(),
      },
      { merge: true }
    );

    return res.json({
      ok: true,
      uid: user.uid,
      email,
      role,
      plan,
      action: "firebase-auth-password-set",
    });
  } catch (err: any) {
    console.error("[admin/bootstrap] set-password error", err);
    return res
      .status(500)
      .json({ ok: false, error: "Internal", detail: String(err?.message || err) });
  }
  }
);

router.get("/health", (_req, res) => {
  res.setHeader("x-route-source", "adminBootstrapRoutes");
  res.json({ ok: true });
});

export default router;
