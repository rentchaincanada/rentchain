// src/routes/authRoutes.ts
import { Router, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { generateJwtForLandlord, signInWithPassword } from "../services/authService";
import { authenticateJwt } from "../middleware/authMiddleware";
import { DEMO_LANDLORD, DEMO_LANDLORD_EMAIL } from "../config/authConfig";
import {
  generateTotpSecret,
  generateTotpUri,
  verifyTotpCode,
  generateBackupCodes,
} from "../services/totpService";
import {
  ensureLandlordProfile,
  getLandlordProfile,
  getOrCreateLandlordProfile,
} from "../services/landlordProfileService";
import { setPlan } from "../services/accountService";
import { resolvePlan } from "../entitlements/plans";
import { z } from "zod";
import { maybeGrantMicroLiveFromLead } from "../services/microLiveGrant";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const TRUSTED_DEVICE_EXPIRY = "30d";
let didWarnDevAuth = false;

type Landlord2FAUser = {
  id: string;
  email: string;
  twoFactorEnabled?: boolean;
  twoFactorMethods?: string[];
  totpSecret?: string | null;
  backupCodes?: string[];
  screeningCredits?: number;
};

const landlordStoreByEmail: Record<string, Landlord2FAUser> = {};
const landlordStoreById: Record<string, Landlord2FAUser> = {};

type RateLimiterEntry = {
  timestamps: number[];
};

const rateLimiterStore: Record<string, RateLimiterEntry> = {};
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

function jsonError(res: any, status: number, error: string, code?: string, details?: any) {
  const payload: any = { error };
  if (code) payload.code = code;
  if (details !== undefined) payload.details = details;
  return res.status(status).json(payload);
}

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function rateLimit(key: string) {
  return (req: any, res: Response, next: NextFunction) => {
    const now = Date.now();
    const ip = req.ip || req.headers["x-forwarded-for"]?.toString() || "unknown";
    const storeKey = `${ip}:${key}`;
    const entry = rateLimiterStore[storeKey] ?? { timestamps: [] };
    entry.timestamps = entry.timestamps.filter(
      (ts) => now - ts < RATE_LIMIT_WINDOW_MS
    );
    if (entry.timestamps.length >= RATE_LIMIT_MAX) {
      res.status(429).json({ error: "Too many attempts. Try again soon." });
      return;
    }
    entry.timestamps.push(now);
    rateLimiterStore[storeKey] = entry;
    next();
  };
}

function ensureLandlordEntry(base: Landlord2FAUser): Landlord2FAUser {
  const existing = landlordStoreByEmail[base.email];
  if (existing) {
    const profile = ensureLandlordProfile(existing.id, existing.email);
    existing.screeningCredits = profile?.screeningCredits;
    landlordStoreById[existing.id] = existing;
    return existing;
  }

  const initialized: Landlord2FAUser = {
    ...base,
    twoFactorEnabled: base.twoFactorEnabled ?? false,
    twoFactorMethods: base.twoFactorMethods ?? [],
    totpSecret: base.totpSecret ?? null,
    backupCodes: base.backupCodes ?? [],
    screeningCredits: base.screeningCredits,
  };

  landlordStoreByEmail[initialized.email] = initialized;
  landlordStoreById[initialized.id] = initialized;
  const profile = ensureLandlordProfile(initialized.id, initialized.email);
  initialized.screeningCredits = profile?.screeningCredits;
  return initialized;
}

function loadLandlordByEmail(email?: string): Landlord2FAUser | null {
  if (!email) return null;
  const byEmail = landlordStoreByEmail[email];
  if (byEmail) return byEmail;
  if (email === DEMO_LANDLORD_EMAIL) {
    return ensureLandlordEntry({ ...DEMO_LANDLORD });
  }
  return null;
}

function loadLandlordById(id?: string): Landlord2FAUser | null {
  if (!id) return null;
  const byId = landlordStoreById[id];
  if (byId) return byId;
  if (id === DEMO_LANDLORD.id) {
    return ensureLandlordEntry({ ...DEMO_LANDLORD });
  }
  return null;
}

function saveLandlord(user: Landlord2FAUser): void {
  landlordStoreByEmail[user.email] = user;
  landlordStoreById[user.id] = user;
}

function validateCodeWithBackup(
  user: Landlord2FAUser,
  code: string
): { ok: boolean; backupUsed: boolean } {
  user.backupCodes = user.backupCodes ?? [];
  if (user.totpSecret && verifyTotpCode(user.totpSecret, code)) {
    return { ok: true, backupUsed: false };
  }

  const backupIndex = user.backupCodes.findIndex((backup) => backup === code);
  if (backupIndex !== -1) {
    user.backupCodes.splice(backupIndex, 1);
    return { ok: true, backupUsed: true };
  }

  return { ok: false, backupUsed: false };
}

// Seed demo landlord on startup
ensureLandlordEntry({ ...DEMO_LANDLORD });

router.post("/login", async (req, res) => {
  const loginEnabled =
    (process.env.AUTH_LOGIN_ENABLED || process.env.PASSWORD_LOGIN_ENABLED || "true")
      .toString()
      .toLowerCase() === "true";

  if (!loginEnabled) {
    return jsonError(res, 403, "Login disabled", "LOGIN_DISABLED");
  }

  const parsed = LoginSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return jsonError(res, 400, "Invalid request payload", "BAD_REQUEST", parsed.error.flatten());
  }

  const email = String(parsed.data.email || "").trim().toLowerCase();
  const password = String(parsed.data.password || "");
  const passwordLoginEnabled =
    (process.env.PASSWORD_LOGIN_ENABLED || "true").toString().trim().toLowerCase() === "true";

  try {
    console.log("[auth/login] hit", { email, passwordLoginEnabled });
    console.log("[auth/login] request", {
      email,
      passwordLoginEnabled,
      envPasswordEnabled: process.env.PASSWORD_LOGIN_ENABLED,
    });

    if (!passwordLoginEnabled) {
      return jsonError(res, 403, "Login disabled", "LOGIN_DISABLED");
    }

    const fb = await signInWithPassword(email, password);
    if (!fb) {
      return jsonError(res, 401, "Unauthorized", "INVALID_CREDENTIALS");
    }

    const profile = await getOrCreateLandlordProfile({
      uid: fb.uid,
      email: fb.email,
    });

    const plan = resolvePlan((profile as any)?.plan || "starter");
    const user = ensureLandlordEntry({
      id: (profile as any)?.id || fb.uid,
      email: (profile as any)?.email || fb.email,
      role: (profile as any)?.role || "landlord",
      landlordId: (profile as any)?.landlordId || fb.uid,
      plan,
      screeningCredits: (profile as any)?.screeningCredits,
    } as any);

    const token = generateJwtForLandlord({ ...user, plan } as any);

    try {
      const landlordId = user.id;
      await maybeGrantMicroLiveFromLead(user.email, landlordId);
    } catch (e) {
      console.warn("[micro-live] grant attempt failed (non-blocking)", (e as any)?.message || e);
    }

    return res.status(200).json({
      ok: true,
      token,
      user: {
        ...user,
        screeningCredits:
          (profile as any)?.screeningCredits ?? (user as any)?.screeningCredits ?? 0,
      },
    });
  } catch (err: any) {
    const msg = String(err?.message || "");
    const code = String(err?.code || "");
    const looksLikeAuthFailure =
      code.includes("auth/") ||
      code === "UNAUTHORIZED" ||
      code === "INVALID_CREDENTIALS" ||
      /invalid|expired|revoked|credential|password|token|unauthorized/i.test(msg);

    if (looksLikeAuthFailure) {
      return jsonError(res, 401, "Unauthorized", "UNAUTHORIZED");
    }

    console.error("[auth/login] error", err);
    return jsonError(res, 500, "Internal Server Error", "INTERNAL");
  }
});

router.post("/login/demo", async (_req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).end();
  }

  const demoPlan =
    process.env.DEMO_PLAN === "starter" || process.env.DEMO_PLAN === "elite"
      ? (process.env.DEMO_PLAN as any)
      : process.env.NODE_ENV === "production"
      ? "starter"
      : "elite";

  const user = ensureLandlordEntry({
    id: DEMO_LANDLORD.id,
    email: DEMO_LANDLORD_EMAIL,
    role: "landlord",
    landlordId: DEMO_LANDLORD.id,
    plan: demoPlan,
  } as any);

  // Persist demo plan in dev so entitlements/limits match across attachAccount usage
	  try {
    if (demoPlan === "elite") {
      await setPlan(DEMO_LANDLORD.id, "elite");
    }
	  } catch (err) {
	    console.warn("[login/demo] failed to persist demo plan", err);
	  }

  const token = generateJwtForLandlord({ ...user, plan: demoPlan } as any, "7d");
  const profile = ensureLandlordProfile(user.id, user.email);

  try {
    await maybeGrantMicroLiveFromLead(user.email, user.id);
  } catch (e: any) {
    console.warn("[micro-live] grant attempt failed (non-blocking)", e?.message || e);
  }

  return res.json({
    token,
    user: {
      ...user,
      screeningCredits: profile?.screeningCredits ?? 0,
    },
  });
});

router.post("/2fa/verify", rateLimit("2fa-verify"), async (req, res) => {
  const { pendingToken, method, code } = req.body as {
    pendingToken?: string;
    method?: string;
    code?: string;
  };

  if (!pendingToken || !method || !code) {
    res
      .status(400)
      .json({ error: "pendingToken, method, and code are required" });
    return;
  }

  let payload: any;
  try {
    payload = jwt.verify(pendingToken, JWT_SECRET) as any;
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired 2FA token" });
    return;
  }

  if (!payload?.userId || payload?.stage !== "2fa") {
    res.status(401).json({ error: "Invalid 2FA session" });
    return;
  }

  const methods: string[] = Array.isArray(payload.methods)
    ? payload.methods
    : [];
  if (!methods.includes(method)) {
    res.status(400).json({ error: "2FA method not allowed" });
    return;
  }

  const user = loadLandlordById(payload.userId);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  user.backupCodes = user.backupCodes ?? [];

  let verified = false;

  if (method === "totp") {
    if (user.totpSecret && verifyTotpCode(user.totpSecret, code)) {
      verified = true;
    } else {
      const backupIndex = user.backupCodes.findIndex(
        (backup: string) => backup === code
      );
      if (backupIndex !== -1) {
        verified = true;
        user.backupCodes.splice(backupIndex, 1);
        saveLandlord(user);
      }
    }
  }

  if (!verified) {
    res.status(400).json({ error: "Invalid 2FA code" });
    return;
  }

  const token = generateJwtForLandlord({ id: user.id, email: user.email });
  const profile = ensureLandlordProfile(user.id, user.email);

  res.status(200).json({
    token,
    user: {
      id: user.id,
      email: user.email,
      screeningCredits: profile?.screeningCredits ?? 0,
    },
  });
});

router.post(
  "/2fa/totp/setup",
  authenticateJwt,
  rateLimit("2fa-totp-setup"),
  async (req: any, res: Response) => {
    const authPayload: any = (req as any).user || {};
    const email: string | undefined =
      authPayload.email || (req as any).userEmail;

    if (!email) {
      res.status(401).json({ error: "No authenticated email" });
      return;
    }

    const user = loadLandlordByEmail(email);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const secret = generateTotpSecret();
    user.totpSecret = secret;

    saveLandlord(user);

    const otpauthUrl = generateTotpUri(user.email, secret);

    res.json({ secret, otpauthUrl });
  }
);

router.post(
  "/2fa/totp/confirm",
  authenticateJwt,
  rateLimit("2fa-totp-confirm"),
  async (req: any, res: Response) => {
    const authPayload: any = (req as any).user || {};
    const email: string | undefined =
      authPayload.email || (req as any).userEmail;

    if (!email) {
      res.status(401).json({ error: "No authenticated email" });
      return;
    }

    const { code } = req.body as { code?: string };
    if (!code) {
      res.status(400).json({ error: "Code is required" });
      return;
    }

    const user = loadLandlordByEmail(email);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (!user.totpSecret) {
      res.status(400).json({ error: "TOTP not initialized" });
      return;
    }

    const isValid = verifyTotpCode(user.totpSecret, code);
    if (!isValid) {
      res.status(400).json({ error: "Invalid TOTP code" });
      return;
    }

    const methods = Array.from(
      new Set([...(user.twoFactorMethods ?? []), "totp"])
    );
    const backupCodes = generateBackupCodes();

    user.twoFactorEnabled = true;
    user.twoFactorMethods = methods;
    user.backupCodes = backupCodes;

    saveLandlord(user);

    res.json({ success: true, backupCodes });
  }
);

router.post(
  "/2fa/backup-codes/regenerate",
  authenticateJwt,
  rateLimit("2fa-backup-regenerate"),
  async (req: any, res: Response) => {
    const authPayload: any = (req as any).user || {};
    const email: string | undefined =
      authPayload.email || (req as any).userEmail;

    if (!email) {
      res.status(401).json({ error: "No authenticated email" });
      return;
    }

    const { code } = req.body as { code?: string };
    if (!code) {
      res.status(400).json({ error: "Code is required" });
      return;
    }

    const user = loadLandlordByEmail(email);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (user.twoFactorEnabled !== true) {
      res.status(400).json({ error: "2FA is not enabled" });
      return;
    }

    if (!user.totpSecret) {
      res.status(400).json({ error: "TOTP not initialized" });
      return;
    }

    const isValid = verifyTotpCode(user.totpSecret, code);
    if (!isValid) {
      res.status(400).json({ error: "Invalid TOTP code" });
      return;
    }

    user.backupCodes = generateBackupCodes();
    saveLandlord(user);

    res.json({ success: true, backupCodes: user.backupCodes });
  }
);

router.post(
  "/2fa/disable",
  authenticateJwt,
  rateLimit("2fa-disable"),
  async (req: any, res: Response) => {
    const authPayload: any = (req as any).user || {};
    const email: string | undefined =
      authPayload.email || (req as any).userEmail;

    if (!email) {
      res.status(401).json({ error: "No authenticated email" });
      return;
    }

    const { code } = req.body as { code?: string };
    if (!code) {
      res.status(400).json({ error: "Code is required" });
      return;
    }

    const user = loadLandlordByEmail(email);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (user.twoFactorEnabled !== true) {
      res.status(400).json({ error: "2FA is not enabled" });
      return;
    }

    const verification = validateCodeWithBackup(user, code);
    if (!verification.ok) {
      res.status(400).json({ error: "Invalid 2FA code" });
      return;
    }

    user.twoFactorEnabled = false;
    user.twoFactorMethods = [];
    user.totpSecret = null;
    user.backupCodes = [];

    saveLandlord(user);

    res.json({ success: true });
  }
);

router.post(
  "/2fa/trust-device",
  authenticateJwt,
  rateLimit("2fa-trust-device"),
  async (req: any, res: Response) => {
    const authPayload: any = (req as any).user || {};
    const email: string | undefined =
      authPayload.email || (req as any).userEmail;

    if (!email) {
      res.status(401).json({ error: "No authenticated email" });
      return;
    }

    const { code, deviceName } = req.body as {
      code?: string;
      deviceName?: string;
    };

    if (!code) {
      res.status(400).json({ error: "Code is required" });
      return;
    }

    const user = loadLandlordByEmail(email);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (user.twoFactorEnabled !== true) {
      res.status(400).json({ error: "2FA is not enabled" });
      return;
    }

    const verification = validateCodeWithBackup(user, code);
    if (!verification.ok) {
      res.status(400).json({ error: "Invalid 2FA code" });
      return;
    }

    saveLandlord(user);

    const trustedDeviceToken = jwt.sign(
      {
        sub: user.id,
        type: "trusted_device",
        jti: crypto.randomUUID(),
        deviceName: deviceName || "trusted-device",
      },
      JWT_SECRET,
      { expiresIn: TRUSTED_DEVICE_EXPIRY }
    );

    res.json({ success: true, trustedDeviceToken });
  }
);

router.get(
  "/me",
  authenticateJwt,
  (req: any, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const profile = getLandlordProfile(req.user.id);

    res.status(200).json({
      user: {
        id: req.user.id,
        email: req.user.email,
        screeningCredits: profile?.screeningCredits ?? 0,
      },
    });
  }
);

router.post("/logout", (_req, res) => {
  res.status(200).json({ message: "Logged out" });
});

router.get("/demo", (_req, res) => {
  res.json({ email: DEMO_LANDLORD_EMAIL });
});

export default router;
