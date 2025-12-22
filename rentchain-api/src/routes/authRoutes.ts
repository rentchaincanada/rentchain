// src/routes/authRoutes.ts
import { Router, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import {
  generateJwtForLandlord,
  validateLandlordCredentials,
} from "../services/authService";
import {
  authenticateJwt,
  AuthenticatedRequest,
} from "../middleware/authMiddleware";
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
} from "../services/landlordProfileService";
import { setPlan } from "../services/accountService";
import { resolvePlan } from "../entitlements/plans";

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

function rateLimit(key: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
  const { email, password } = req.body as {
    email?: string;
    password?: string;
  };
  const passwordLoginEnabled = process.env.PASSWORD_LOGIN_ENABLED === "true";

  if (!email || !password) {
    return res.status(400).json({ code: "MISSING_CREDENTIALS" });
  }

  try {
    console.log("[auth/login] hit", { email, passwordLoginEnabled });
    console.log("[auth/login] request", {
      email,
      passwordLoginEnabled,
      envPasswordEnabled: process.env.PASSWORD_LOGIN_ENABLED,
    });
    if (process.env.NODE_ENV !== "production") {
      if (email === DEMO_LANDLORD_EMAIL && password === "demo") {
        const rawPlan =
          req.headers["x-rentchain-plan"] ||
          req.headers["X-Rentchain-Plan"] ||
          (req.headers as any)["x-rentchain-plan".toLowerCase()];
        const planHeader = Array.isArray(rawPlan) ? rawPlan[0] : (rawPlan as string | undefined);
        const plan = resolvePlan(planHeader || "elite");
        const user = ensureLandlordEntry({
          id: DEMO_LANDLORD.id,
          email,
          role: "landlord",
          landlordId: DEMO_LANDLORD.id,
          plan,
        } as any);

        console.log("DEV LOGIN plan header=", planHeader, "resolved=", plan);

        console.log("DEV AUTH resolved plan=", plan, "user.plan=", (user as any).plan);
        const token = generateJwtForLandlord({ ...user, plan } as any, "7d");
        const profile = ensureLandlordProfile(user.id, user.email);

        return res.status(200).json({
          token,
          user: {
            ...user,
            screeningCredits: profile?.screeningCredits ?? 0,
          },
        });
      }

      return res.status(401).json({ code: "INVALID_CREDENTIALS" });
    }

    if (!passwordLoginEnabled) {
      return res.status(503).json({
        error: "password_login_disabled",
        message:
          "Password login is disabled. Set PASSWORD_LOGIN_ENABLED=true to allow credentials login.",
      });
    }

    const validUser = await validateLandlordCredentials(email, password);
    if (!validUser) {
      return res.status(401).json({ code: "INVALID_CREDENTIALS" });
    }

    const plan = resolvePlan(validUser.plan || "starter");
    const user = ensureLandlordEntry({
      id: validUser.id,
      email: validUser.email,
      role: validUser.role || "landlord",
      landlordId: validUser.landlordId || validUser.id,
      plan,
    } as any);

    const token = generateJwtForLandlord({ ...user, plan } as any);
    const profile = ensureLandlordProfile(user.id, user.email);

    return res.status(200).json({
      token,
      user: {
        ...user,
        screeningCredits: profile?.screeningCredits ?? 0,
      },
    });
  } catch (err: any) {
    console.error("[auth/login] error", err);
    return res.status(500).json({ error: "login_failed", message: err?.message || "Login failed" });
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
  async (req: AuthenticatedRequest, res: Response) => {
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
  async (req: AuthenticatedRequest, res: Response) => {
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
  async (req: AuthenticatedRequest, res: Response) => {
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
  async (req: AuthenticatedRequest, res: Response) => {
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
  async (req: AuthenticatedRequest, res: Response) => {
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
  (req: AuthenticatedRequest, res: Response) => {
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
