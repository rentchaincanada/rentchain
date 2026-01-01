import { Router } from "express";
import admin from "firebase-admin";
import { db } from "../config/firebase";

const router = Router();

/** ===== Helpers ===== */

function jsonForbidden(res: any) {
  return res.status(403).json({ ok: false, error: "Forbidden" });
}

function getClientIp(req: any) {
  const xff = String(req.headers["x-forwarded-for"] || "");
  const first = xff.split(",")[0]?.trim();
  return first || req.ip || "";
}

/** ===== Security Gates ===== */

function requireBootstrapEnabled(req: any, res: any, next: any) {
  const enabled =
    String(process.env.ADMIN_BOOTSTRAP_ENABLED || "")
      .trim()
      .toLowerCase() === "true";

  const isProd = String(process.env.NODE_ENV || "")
    .trim()
    .toLowerCase() === "production";

  if (isProd && !enabled) {
    return res.status(404).json({ ok: false });
  }

  next();
}

function requireBootstrapKey(req: any, res: any, next: any) {
  const key = String(req.headers["x-admin-key"] || "");
  if (!process.env.ADMIN_BOOTSTRAP_KEY || key !== process.env.ADMIN_BOOTSTRAP_KEY) {
    return jsonForbidden(res);
  }
  next();
}

function requireBootstrapIp(req: any, res: any, next: any) {
  const allowlist = String(process.env.ADMIN_BOOTSTRAP_IP_ALLOWLIST || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!allowlist.length) return next();

  const ip = getClientIp(req);
  if (!ip || !allowlist.includes(ip)) {
    return jsonForbidden(res);
  }

  next();
}

// Simple in-memory rate limit (per instance).
const _hits = new Map<string, { n: number; t: number }>();
function rateLimitBootstrap(req: any, res: any, next: any) {
  const ip = getClientIp(req) || "unknown";
  const key = `${ip}:${req.path}`;
  const now = Date.now();
  const windowMs = 60_000;
  const limit = Number(process.env.ADMIN_BOOTSTRAP_RATELIMIT || 20);

  const v = _hits.get(key) || { n: 0, t: now };
  if (now - v.t > windowMs) {
    v.n = 0;
    v.t = now;
  }
  v.n += 1;
  _hits.set(key, v);

  if (v.n > limit) {
    return res.status(429).json({ ok: false, error: "Too Many Requests" });
  }
  next();
}

async function audit(req: any, action: string, extra?: Record<string, any>) {
  try {
    await db.collection("adminAudit").add({
      at: Date.now(),
      action,
      actorIp: getClientIp(req),
      userAgent: String(req.headers["user-agent"] || ""),
      ...extra,
    });
  } catch (e) {
    console.warn("[adminAudit] write failed (non-blocking)", (e as any)?.message || e);
  }
}

/** ===== Routes ===== */

// DEBUG: verify wiring quickly (protected)
router.get(
  "/debug/firebase",
  requireBootstrapEnabled,
  requireBootstrapIp,
  requireBootstrapKey,
  async (req: any, res: any) => {
    const app = admin.app();
    const opts: any = (app as any).options || {};
    await audit(req, "bootstrap/debug-firebase");
    res.setHeader("x-route-source", "adminBootstrapRoutes");
    return res.json({
      ok: true,
      adminProjectId:
        opts.projectId ||
        process.env.GCLOUD_PROJECT ||
        process.env.GOOGLE_CLOUD_PROJECT ||
        null,
      hasFirebaseApiKey: Boolean(process.env.FIREBASE_API_KEY),
      bootstrapEnabled:
        String(process.env.ADMIN_BOOTSTRAP_ENABLED || "").toLowerCase() === "true",
      nodeEnv: process.env.NODE_ENV || null,
    });
  }
);

// POST /api/admin/bootstrap/set-password
// body: { email, password, role?, plan? }
router.post(
  "/bootstrap/set-password",
  requireBootstrapEnabled,
  requireBootstrapIp,
  rateLimitBootstrap,
  requireBootstrapKey,
  async (req: any, res: any) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const role = String(req.body?.role || "landlord");
    const plan = String(req.body?.plan || "starter");

    if (!email || !password || password.length < 8) {
      return res
        .status(400)
        .json({ ok: false, error: "email+password required (min 8 chars)" });
    }

    try {
      let user: admin.auth.UserRecord;

      try {
        user = await admin.auth().getUserByEmail(email);
        user = await admin.auth().updateUser(user.uid, { password, disabled: false });
      } catch (e: any) {
        const code = String(e?.code || "");
        if (code.includes("auth/user-not-found")) {
          user = await admin.auth().createUser({
            email,
            password,
            disabled: false,
            emailVerified: true,
          });
        } else {
          throw e;
        }
      }

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

      await audit(req, "bootstrap/set-password", { targetEmail: email, uid: user.uid });

      return res.json({
        ok: true,
        uid: user.uid,
        email,
        role,
        plan,
        action: "firebase-auth-password-set + landlord-profile-upserted",
      });
    } catch (err: any) {
      console.error("[admin/bootstrap/set-password] error", err);
      await audit(req, "bootstrap/set-password-failed", {
        targetEmail: email,
        error: String(err?.message || err),
      });
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

/*
POST-DEPLOY CHECKLIST (manual Cloud Run)
1) Set:
   - NODE_ENV=production
   - ADMIN_BOOTSTRAP_ENABLED=false
   - ADMIN_BOOTSTRAP_KEY=<keep secret>
   - FIREBASE_API_KEY=<already set>
2) Deploy revision
3) Confirm:
   - /api/admin/health works (if you have it)
   - /api/admin/bootstrap/health still works only if you want it public; if not, you can also gate it.
4) When you need to bootstrap:
   - Set ADMIN_BOOTSTRAP_ENABLED=true
   - Deploy
   - Call /api/admin/bootstrap/set-password with x-admin-key
   - Set ADMIN_BOOTSTRAP_ENABLED=false
   - Deploy again
*/
