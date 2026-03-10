// src/routes/authRoutes.ts
import { Router, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import admin from "firebase-admin";
import { generateJwtForLandlord } from "../services/authService";
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
} from "../services/landlordProfileService";
import { setPlan } from "../services/accountService";
import { resolvePlan } from "../entitlements/plans";
import { z } from "zod";
import { maybeGrantMicroLiveFromLead } from "../services/microLiveGrant";
import { signAuthToken } from "../auth/jwt";
import { validateLandlordCredentials } from "../services/authService";
import { getOrCreateAccount } from "../services/accountService";
import { getOrCreateLandlordProfile } from "../services/landlordProfileService";
import { db } from "../config/firebase";
import { rateLimitAuth, rateLimitSimple } from "../middleware/rateLimit";
import { requireAuth } from "../middleware/requireAuth";
import { buildCanonicalSessionUserFromClaims } from "../services/sessionUserService";
import { sendEmail } from "../services/emailService";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const TRUSTED_DEVICE_EXPIRY = "30d";
let didWarnDevAuth = false;
const PASSWORD_RESET_CONFIRM_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ONBOARD_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const rateLimitPasswordResetConfirmation = rateLimitSimple({
  windowMs: 15 * 60 * 1000,
  max: 20,
});

type Landlord2FAUser = {
  id: string;
  email: string;
  twoFactorEnabled?: boolean;
  twoFactorMethods?: string[];
  totpSecret?: string | null;
  backupCodes?: string[];
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

function loginError(res: any, status: number, code: string, detail?: string) {
  return res.status(status).json({
    ok: false,
    code,
    error: status === 401 ? "UNAUTHORIZED" : "LOGIN_FAILED",
    detail,
  });
}

function maskEmail(value: string): string {
  const email = String(value || "").trim().toLowerCase();
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  if (local.length <= 2) return `${local[0] || "*"}*@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

function tokenFingerprint(value: string): string {
  const token = String(value || "").trim();
  if (!token) return "none";
  return `${token.slice(0, 6)}…${token.slice(-4)}`;
}

function hashToken(input: string) {
  return crypto.createHash("sha256").update(String(input || "").trim()).digest("hex");
}

function normalizeUserRole(req: any): string {
  const actorRole = String(req.user?.actorRole || "").trim().toLowerCase();
  const role = String(req.user?.role || "").trim().toLowerCase();
  return actorRole || role;
}

function onboardLog(event: string, extra?: Record<string, unknown>) {
  // Operator verification: filter Cloud Run logs by `auth.onboard.` prefix.
  console.info(`[auth.onboard.${event}]`, extra || {});
}

function signTenantJwt(payload: any) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET missing");
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

type OnboardResolveResult = {
  ok: boolean;
  token: string;
  inviteType: "landlord" | "tenant" | "contractor" | "unknown";
  role: "landlord" | "tenant" | "contractor" | "admin" | null;
  email: string | null;
  maskedEmail: string | null;
  status: "valid" | "expired" | "invalid" | "accepted";
  requiresAuth: boolean;
  requiresSignup: boolean;
  requiresExistingAccount: boolean;
  alreadyAccepted: boolean;
  workspaceId: string | null;
  propertyId: string | null;
  inviteId: string | null;
  redirectTo: string | null;
  legacyRedirectTo?: string | null;
  suggestedAuthMethod?: "password" | "magic_link" | "password_or_magic" | null;
  copy: {
    title: string;
    description: string;
    cta: string;
  };
  meta?: Record<string, unknown>;
};

async function resolveOnboardToken(token: string, sourceHint = ""): Promise<OnboardResolveResult> {
  const now = Date.now();
  const tokenValue = String(token || "").trim();
  const hint = String(sourceHint || "").trim().toLowerCase();

  const sourceOrder = (() => {
    if (hint === "contractor") return ["contractor", "tenant", "landlord"] as const;
    if (hint === "tenant") return ["tenant", "contractor", "landlord"] as const;
    if (hint === "landlord") return ["landlord", "contractor", "tenant"] as const;
    return ["contractor", "tenant", "landlord"] as const;
  })();

  const notFound = (): OnboardResolveResult => ({
    ok: false,
    token: tokenValue,
    inviteType: "unknown",
    role: null,
    email: null,
    maskedEmail: null,
    status: "invalid",
    requiresAuth: false,
    requiresSignup: false,
    requiresExistingAccount: false,
    alreadyAccepted: false,
    workspaceId: null,
    propertyId: null,
    inviteId: null,
    redirectTo: null,
    copy: {
      title: "Invite not found",
      description: "This invite is invalid or no longer available.",
      cta: "Back to login",
    },
  });

  for (const source of sourceOrder) {
    if (source === "contractor") {
      const snap = await db.collection("contractorInvites").where("token", "==", tokenValue).limit(1).get();
      if (!snap.empty) {
        const doc = snap.docs[0];
        const item = doc.data() as any;
        const statusRaw = String(item?.status || "pending").toLowerCase();
        const expiresAtMs = Number(item?.expiresAtMs || 0);
        const expired = expiresAtMs > 0 && now >= expiresAtMs;
        const status = statusRaw === "accepted" ? "accepted" : expired ? "expired" : "valid";
        return {
          ok: status === "valid" || status === "accepted",
          token: tokenValue,
          inviteType: "contractor",
          role: "contractor",
          email: String(item?.email || "").trim().toLowerCase() || null,
          maskedEmail: item?.email ? maskEmail(String(item.email)) : null,
          status,
          requiresAuth: true,
          requiresSignup: true,
          requiresExistingAccount: false,
          alreadyAccepted: status === "accepted",
          workspaceId: String(item?.landlordId || "").trim() || null,
          propertyId: null,
          inviteId: doc.id,
          redirectTo: "/contractor",
          suggestedAuthMethod: "password",
          copy:
            status === "expired"
              ? {
                  title: "Invite expired",
                  description: "This invite has expired. Request a new invite to continue.",
                  cta: "Request a new invite",
                }
              : status === "accepted"
              ? {
                  title: "Invite already accepted",
                  description: "This contractor invite has already been accepted.",
                  cta: "Continue",
                }
              : {
                  title: "You’re invited to join RentChain",
                  description: "Accept this invite to access your contractor workspace.",
                  cta: "Accept invite",
                },
        };
      }
    }

    if (source === "tenant") {
      const doc = await db.collection("tenantInvites").doc(tokenValue).get();
      if (doc.exists) {
        const item = doc.data() as any;
        const statusRaw = String(item?.status || "pending").toLowerCase();
        const expiresAt = Number(item?.expiresAt || 0);
        const expired = expiresAt > 0 && now >= expiresAt;
        const accepted = statusRaw !== "pending";
        const status = accepted ? "accepted" : expired ? "expired" : "valid";
        return {
          ok: status === "valid" || status === "accepted",
          token: tokenValue,
          inviteType: "tenant",
          role: "tenant",
          email: String(item?.tenantEmail || item?.email || "").trim().toLowerCase() || null,
          maskedEmail:
            item?.tenantEmail || item?.email
              ? maskEmail(String(item?.tenantEmail || item?.email))
              : null,
          status,
          requiresAuth: false,
          requiresSignup: false,
          requiresExistingAccount: false,
          alreadyAccepted: status === "accepted",
          workspaceId: String(item?.landlordId || "").trim() || null,
          propertyId: String(item?.propertyId || "").trim() || null,
          inviteId: doc.id,
          redirectTo: "/tenant",
          suggestedAuthMethod: "password_or_magic",
          copy:
            status === "expired"
              ? {
                  title: "Invite expired",
                  description: "This invite has expired. Request a new invite to continue.",
                  cta: "Request a new invite",
                }
              : status === "accepted"
              ? {
                  title: "Invite already accepted",
                  description: "This tenant invite has already been accepted.",
                  cta: "Continue",
                }
              : {
                  title: "You’re invited to join RentChain",
                  description: "Accept this invite to access your tenant portal.",
                  cta: "Accept invite",
                },
        };
      }
    }

    if (source === "landlord") {
      const inviteHash = hashToken(tokenValue);
      const inviteDoc = await db.collection("landlordInvites").doc(inviteHash).get();
      if (inviteDoc.exists) {
        const item = inviteDoc.data() as any;
        const used = item?.status === "used" || Boolean(item?.usedAt);
        const expired = item?.expiresAt && now > Number(item.expiresAt);
        const status = used ? "accepted" : expired ? "expired" : "valid";
        return {
          ok: status === "valid" || status === "accepted",
          token: tokenValue,
          inviteType: "landlord",
          role: "landlord",
          email: String(item?.email || "").trim().toLowerCase() || null,
          maskedEmail: item?.email ? maskEmail(String(item.email)) : null,
          status,
          requiresAuth: false,
          requiresSignup: true,
          requiresExistingAccount: false,
          alreadyAccepted: status === "accepted",
          workspaceId: null,
          propertyId: null,
          inviteId: inviteDoc.id,
          redirectTo: status === "accepted" ? "/login" : null,
          legacyRedirectTo: status === "valid" ? `/invite/${encodeURIComponent(tokenValue)}` : null,
          suggestedAuthMethod: "password",
          copy:
            status === "expired"
              ? {
                  title: "Invite expired",
                  description: "This invite has expired. Request a new invite to continue.",
                  cta: "Request a new invite",
                }
              : status === "accepted"
              ? {
                  title: "Invite already accepted",
                  description: "This landlord invite has already been accepted.",
                  cta: "Continue",
                }
              : {
                  title: "Create your account",
                  description: "Complete account setup to accept this invite.",
                  cta: "Continue to signup",
                },
        };
      }

      const referralCode = tokenValue.toUpperCase();
      const referralSnap = await db.collection("referrals").where("referralCode", "==", referralCode).limit(1).get();
      if (!referralSnap.empty) {
        const item = referralSnap.docs[0].data() as any;
        const statusRaw = String(item?.status || "").toLowerCase();
        const status = statusRaw === "approved" ? "accepted" : statusRaw === "expired" ? "expired" : "valid";
        return {
          ok: status === "valid" || status === "accepted",
          token: tokenValue,
          inviteType: "landlord",
          role: "landlord",
          email: String(item?.refereeEmail || "").trim().toLowerCase() || null,
          maskedEmail: item?.refereeEmail ? maskEmail(String(item.refereeEmail)) : null,
          status,
          requiresAuth: false,
          requiresSignup: true,
          requiresExistingAccount: false,
          alreadyAccepted: status === "accepted",
          workspaceId: String(item?.referrerLandlordId || "").trim() || null,
          propertyId: null,
          inviteId: referralSnap.docs[0].id,
          redirectTo: status === "accepted" ? "/login" : null,
          legacyRedirectTo: status === "valid" ? `/invite/${encodeURIComponent(tokenValue)}` : null,
          suggestedAuthMethod: "password",
          copy:
            status === "expired"
              ? {
                  title: "Invite expired",
                  description: "This invite has expired. Request a new invite to continue.",
                  cta: "Request a new invite",
                }
              : status === "accepted"
              ? {
                  title: "Invite already accepted",
                  description: "This invite has already been used.",
                  cta: "Continue",
                }
              : {
                  title: "Create your account",
                  description: "Complete account setup to accept this invite.",
                  cta: "Continue to signup",
                },
        };
      }
    }
  }

  return notFound();
}

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().trim().max(160).optional(),
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
    ensureLandlordProfile(existing.id, existing.email);
    landlordStoreById[existing.id] = existing;
    return existing;
  }

  const initialized: Landlord2FAUser = {
    ...base,
    twoFactorEnabled: base.twoFactorEnabled ?? false,
    twoFactorMethods: base.twoFactorMethods ?? [],
    totpSecret: base.totpSecret ?? null,
    backupCodes: base.backupCodes ?? [],
  };

  landlordStoreByEmail[initialized.email] = initialized;
  landlordStoreById[initialized.id] = initialized;
  ensureLandlordProfile(initialized.id, initialized.email);
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

router.post("/signup", rateLimitAuth, async (req, res) => {
  const parsed = SignupSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return loginError(res, 400, "BAD_REQUEST", "Invalid signup payload");
  }

  const email = String(parsed.data.email || "").trim().toLowerCase();
  const password = String(parsed.data.password || "");
  const fullName = String(parsed.data.fullName || "").trim();
  const now = Date.now();

  try {
    let userRecord: admin.auth.UserRecord;
    try {
      userRecord = await admin.auth().createUser({
        email,
        password,
        emailVerified: true,
        displayName: fullName || undefined,
        disabled: false,
      });
    } catch (err: any) {
      if (String(err?.code || "") === "auth/email-already-exists") {
        return res.status(409).json({
          ok: false,
          code: "EMAIL_ALREADY_EXISTS",
          error: "Email already exists",
        });
      }
      throw err;
    }

    const uid = userRecord.uid;
    const userDoc = {
      id: uid,
      email,
      role: "landlord",
      landlordId: uid,
      status: "active",
      plan: "free",
      approved: true,
      approvedAt: now,
      approvedBy: "self_signup",
      createdAt: now,
      updatedAt: now,
    };

    await db.collection("users").doc(uid).set(userDoc, { merge: true });
    await db.collection("accounts").doc(uid).set(
      {
        id: uid,
        email,
        role: "landlord",
        landlordId: uid,
        status: "active",
        plan: "free",
        approved: true,
        approvedAt: now,
        approvedBy: "self_signup",
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    );
    await db.collection("landlords").doc(uid).set(
      {
        id: uid,
        email,
        role: "landlord",
        landlordId: uid,
        plan: "free",
        approved: true,
        approvedAt: now,
        approvedBy: "self_signup",
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

    const token = signAuthToken({
      sub: uid,
      email,
      role: "landlord",
      landlordId: uid,
      permissions: [],
      revokedPermissions: [],
    });

    return res.status(201).json({
      ok: true,
      token,
      user: {
        id: uid,
        email,
        role: "landlord",
        landlordId: uid,
        plan: "free",
        approved: true,
      },
    });
  } catch (err: any) {
    console.error("[auth/signup] failed", {
      message: err?.message,
      code: err?.code,
    });
    return res.status(500).json({
      ok: false,
      code: "SIGNUP_FAILED",
      error: "Signup failed",
    });
  }
});

router.post("/password-reset/confirmation", rateLimitPasswordResetConfirmation, async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!email || !PASSWORD_RESET_CONFIRM_EMAIL_RE.test(email)) {
    return res.status(400).json({ ok: false, error: "invalid_email" });
  }

  const from = String(process.env.EMAIL_FROM || process.env.FROM_EMAIL || "").trim();
  if (!from) {
    console.warn("[auth/password-reset/confirmation] email sender not configured");
    return res.status(503).json({ ok: false, error: "email_not_configured" });
  }

  try {
    await sendEmail({
      to: email,
      from,
      subject: "Your RentChain password was changed",
      text: [
        "Your RentChain password was changed successfully.",
        "",
        "If you made this change, no further action is required.",
        "",
        "If you did not make this change, please contact RentChain support immediately and secure your email account.",
      ].join("\n"),
      html: [
        "<p>Your <strong>RentChain</strong> password was changed successfully.</p>",
        "<p>If you made this change, no further action is required.</p>",
        "<p>If you did not make this change, please contact RentChain support immediately and secure your email account.</p>",
      ].join(""),
    });

    console.info("[auth/password-reset/confirmation] sent", {
      to: maskEmail(email),
    });
    return res.status(204).send();
  } catch (err: any) {
    console.error("[auth/password-reset/confirmation] send failed", {
      to: maskEmail(email),
      message: String(err?.message || err),
    });
    return res.status(500).json({ ok: false, error: "email_send_failed" });
  }
});

router.get("/onboard/resolve", async (req: any, res) => {
  const token = String(req.query?.token || "").trim();
  const source = String(req.query?.source || "").trim().toLowerCase();
  if (!token) {
    onboardLog("invalid", { reason: "missing_token" });
    return res.status(400).json({
      ok: false,
      status: "invalid",
      copy: {
        title: "Invite not found",
        description: "This invite is invalid or no longer available.",
        cta: "Back to login",
      },
    });
  }

  try {
    const result = await resolveOnboardToken(token, source);
    const event =
      result.status === "valid"
        ? "resolved"
        : result.status === "expired"
        ? "expired"
        : result.status === "accepted"
        ? "already_accepted"
        : "invalid";
    onboardLog(event, {
      inviteType: result.inviteType,
      status: result.status,
      token: tokenFingerprint(token),
      inviteId: result.inviteId || null,
    });
    return res.status(result.ok ? 200 : result.status === "expired" ? 410 : 404).json(result);
  } catch (err: any) {
    console.error("[auth.onboard.resolve] failed", {
      token: tokenFingerprint(token),
      message: String(err?.message || err),
    });
    return res.status(500).json({
      ok: false,
      status: "invalid",
      copy: {
        title: "Invite not found",
        description: "This invite is invalid or no longer available.",
        cta: "Back to login",
      },
    });
  }
});

router.post("/onboard/accept", async (req: any, res) => {
  const token = String(req.body?.token || "").trim();
  const source = String(req.body?.source || req.query?.source || "").trim().toLowerCase();
  if (!token) {
    return res.status(400).json({ ok: false, code: "invalid_token", message: "Token is required." });
  }

  try {
    const resolved = await resolveOnboardToken(token, source);
    onboardLog("accept_clicked", {
      inviteType: resolved.inviteType,
      token: tokenFingerprint(token),
      inviteId: resolved.inviteId || null,
    });
    if (!resolved.ok && resolved.status === "invalid") {
      onboardLog("invalid", { token: tokenFingerprint(token), inviteType: resolved.inviteType });
      return res.status(404).json({ ok: false, code: "invalid", message: "Invite not found." });
    }
    if (resolved.status === "expired") {
      onboardLog("expired", { token: tokenFingerprint(token), inviteType: resolved.inviteType });
      return res.status(410).json({ ok: false, code: "expired", message: "Invite expired." });
    }
    if (resolved.status === "accepted") {
      return res.json({
        ok: true,
        accepted: true,
        role: resolved.role,
        redirectTo: resolved.redirectTo || null,
        workspaceId: resolved.workspaceId || null,
        message: "Invite already accepted.",
      });
    }

    if (resolved.inviteType === "landlord") {
      onboardLog("signup_required", { token: tokenFingerprint(token), inviteType: resolved.inviteType });
      return res.status(409).json({
        ok: false,
        code: "signup_required",
        message: "Complete account setup to accept this invite.",
        redirectTo: resolved.legacyRedirectTo || `/invite/${encodeURIComponent(token)}`,
      });
    }

    if (resolved.inviteType === "contractor") {
      const userId = String(req.user?.id || "").trim();
      const userEmail = String(req.user?.email || "").trim().toLowerCase();
      const role = normalizeUserRole(req);
      if (!userId || !userEmail) {
        onboardLog("login_required", { token: tokenFingerprint(token), inviteType: "contractor" });
        return res.status(401).json({ ok: false, code: "login_required", message: "Sign in to continue." });
      }
      if (role === "admin" || role === "landlord") {
        onboardLog("wrong_account", { token: tokenFingerprint(token), inviteType: "contractor", role });
        return res.status(409).json({
          ok: false,
          code: "wrong_account",
          expectedEmail: resolved.email,
          maskedExpectedEmail: resolved.maskedEmail,
          message: "This invite belongs to a different exact email address.",
        });
      }
      if (resolved.email && resolved.email !== userEmail) {
        onboardLog("wrong_account", { token: tokenFingerprint(token), inviteType: "contractor", role });
        return res.status(409).json({
          ok: false,
          code: "wrong_account",
          expectedEmail: resolved.email,
          maskedExpectedEmail: resolved.maskedEmail,
          message: "This invite belongs to a different exact email address.",
        });
      }

      const snap = await db.collection("contractorInvites").where("token", "==", token).limit(1).get();
      if (snap.empty) return res.status(404).json({ ok: false, code: "invalid", message: "Invite not found." });
      const inviteDoc = snap.docs[0];
      const invite = inviteDoc.data() as any;
      const now = Date.now();
      const expiresAtMs = Number(invite?.expiresAtMs || 0);
      if (expiresAtMs > 0 && now >= expiresAtMs) {
        await inviteDoc.ref.set({ status: "expired", updatedAtMs: now }, { merge: true });
        return res.status(410).json({ ok: false, code: "expired", message: "Invite expired." });
      }
      if (String(invite?.status || "").toLowerCase() === "accepted") {
        return res.json({
          ok: true,
          accepted: true,
          role: "contractor",
          redirectTo: "/contractor",
          workspaceId: String(invite?.landlordId || "").trim() || null,
          message: "Invite already accepted.",
        });
      }

      await inviteDoc.ref.set(
        {
          status: "accepted",
          acceptedAtMs: now,
          acceptedByUserId: userId,
          updatedAtMs: now,
        },
        { merge: true }
      );

      const profileRef = db.collection("contractorProfiles").doc(userId);
      const profileSnap = await profileRef.get();
      const prev = (profileSnap.data() as any) || {};
      const landlordId = String(invite?.landlordId || "").trim();
      const invitedBy = Array.from(
        new Set(
          [String(prev?.invitedByLandlordIds || ""), landlordId]
            .flatMap((v: any) => (Array.isArray(v) ? v : [v]))
            .map((v) => String(v || "").trim())
            .filter(Boolean)
        )
      );
      await profileRef.set(
        {
          id: userId,
          userId,
          email: userEmail,
          businessName: String(prev?.businessName || "").trim(),
          contactName: String(prev?.contactName || "").trim(),
          phone: String(prev?.phone || "").trim(),
          serviceCategories: Array.isArray(prev?.serviceCategories) ? prev.serviceCategories : [],
          serviceAreas: Array.isArray(prev?.serviceAreas) ? prev.serviceAreas : [],
          bio: String(prev?.bio || "").trim(),
          isActive: true,
          invitedByLandlordIds: invitedBy,
          createdAtMs: Number(prev?.createdAtMs || now),
          updatedAtMs: now,
        },
        { merge: true }
      );

      await Promise.all([
        db.collection("users").doc(userId).set(
          {
            role: "contractor",
            contractorId: userId,
            contractorLandlordIds: invitedBy,
            landlordId: null,
            updatedAt: now,
          },
          { merge: true }
        ),
        db.collection("accounts").doc(userId).set(
          {
            role: "contractor",
            contractorId: userId,
            contractorLandlordIds: invitedBy,
            landlordId: null,
            updatedAt: now,
          },
          { merge: true }
        ),
      ]);

      onboardLog("accept_succeeded", {
        token: tokenFingerprint(token),
        inviteType: "contractor",
        inviteId: inviteDoc.id,
      });
      return res.json({
        ok: true,
        accepted: true,
        role: "contractor",
        redirectTo: "/contractor",
        workspaceId: landlordId || null,
        message: "Invite accepted successfully.",
      });
    }

    if (resolved.inviteType === "tenant") {
      const role = normalizeUserRole(req);
      if (role === "landlord" || role === "admin" || role === "contractor") {
        onboardLog("wrong_account", { token: tokenFingerprint(token), inviteType: "tenant", role });
        return res.status(409).json({
          ok: false,
          code: "wrong_account",
          expectedEmail: resolved.email,
          maskedExpectedEmail: resolved.maskedEmail,
          message: "This invite belongs to a different exact email address.",
        });
      }

      const ref = db.collection("tenantInvites").doc(token);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ ok: false, code: "invalid", message: "Invite not found." });
      const inv: any = snap.data();
      const now = Date.now();
      if (inv.expiresAt && now > Number(inv.expiresAt)) {
        return res.status(410).json({ ok: false, code: "expired", message: "Invite expired." });
      }
      if (inv.status && String(inv.status) !== "pending") {
        return res.json({
          ok: true,
          accepted: true,
          role: "tenant",
          redirectTo: "/tenant",
          workspaceId: String(inv.landlordId || "").trim() || null,
          message: "Invite already accepted.",
        });
      }

      const email = String(inv.tenantEmail || inv.email || "").trim().toLowerCase();
      if (!email || !ONBOARD_EMAIL_RE.test(email)) {
        return res.status(400).json({ ok: false, code: "invite_invalid", message: "Invite invalid." });
      }

      const tenantId = crypto
        .createHash("sha256")
        .update(`${inv.landlordId}:${email}`.toLowerCase())
        .digest("hex")
        .slice(0, 24);

      await db.collection("tenants").doc(tenantId).set(
        {
          id: tenantId,
          tenantId,
          landlordId: inv.landlordId,
          email,
          fullName: inv.tenantName || inv.fullName || null,
          propertyId: inv.propertyId || null,
          unitId: inv.unitId || null,
          leaseId: inv.leaseId || null,
          source: "invite",
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      await ref.set(
        {
          status: "redeemed",
          redeemedAt: now,
          tenantId,
          updatedAt: now,
        },
        { merge: true }
      );

      const tenantToken = signTenantJwt({
        sub: tenantId,
        role: "tenant",
        tenantId,
        landlordId: inv.landlordId,
        email,
        propertyId: inv.propertyId || null,
        unitId: inv.unitId || null,
        leaseId: inv.leaseId || null,
      });

      onboardLog("accept_succeeded", { token: tokenFingerprint(token), inviteType: "tenant", inviteId: token });
      return res.json({
        ok: true,
        accepted: true,
        role: "tenant",
        redirectTo: "/tenant",
        workspaceId: String(inv.landlordId || "").trim() || null,
        propertyId: String(inv.propertyId || "").trim() || null,
        tenantToken,
        message: "Invite accepted successfully.",
      });
    }

    onboardLog("accept_failed", { token: tokenFingerprint(token), inviteType: resolved.inviteType });
    return res.status(400).json({ ok: false, code: "unsupported", message: "Unsupported invite type." });
  } catch (err: any) {
    onboardLog("accept_failed", {
      token: tokenFingerprint(token),
      message: String(err?.message || err),
    });
    console.error("[auth.onboard.accept] failed", {
      token: tokenFingerprint(token),
      message: String(err?.message || err),
    });
    return res.status(500).json({ ok: false, code: "server_error", message: "Unable to complete onboarding." });
  }
});

router.post("/login", rateLimitAuth, async (req, res) => {
  const requestId = (req as any).requestId || `req-${Math.random().toString(36).slice(2, 8)}`;
  (req as any).requestId = requestId;
  res.setHeader("x-auth-login-rev", "debug-2026-01-06-v1");
  res.setHeader("x-auth-login-rev", "debug-2026-01-05-v1");
  res.setHeader("x-auth-login-rev", "debug-step-detail-v1");
  const loginEnabled =
    (process.env.AUTH_LOGIN_ENABLED || process.env.PASSWORD_LOGIN_ENABLED || "true")
      .toString()
      .toLowerCase() === "true";

  if (!loginEnabled) {
    return loginError(res, 403, "LOGIN_DISABLED");
  }

  const parsed = LoginSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return loginError(res, 400, "BAD_REQUEST", "Invalid request payload");
  }

  const email = String(parsed.data.email || "").trim().toLowerCase();
  const password = String(parsed.data.password || "");
  const passwordLoginEnabled =
    (process.env.PASSWORD_LOGIN_ENABLED || "true").toString().trim().toLowerCase() === "true";

  let step = "start";

  try {
    console.log("[auth/login] flags", {
      AUTH_LOGIN_ENABLED: process.env.AUTH_LOGIN_ENABLED,
      PASSWORD_LOGIN_ENABLED: process.env.PASSWORD_LOGIN_ENABLED,
    });
    console.log("[auth/login] hit", { email, passwordLoginEnabled });
    console.log("[auth/login] request", {
      email,
      passwordLoginEnabled,
      envPasswordEnabled: process.env.PASSWORD_LOGIN_ENABLED,
    });

    if (!passwordLoginEnabled) {
      return loginError(res, 403, "LOGIN_DISABLED");
    }

    step = "firebase_signin";
    const fbUser = await validateLandlordCredentials(email, password);
    if (!fbUser) {
      return loginError(res, 401, "INVALID_CREDENTIALS");
    }

    step = "ensure_profile";
    const profile = await getOrCreateLandlordProfile({ uid: fbUser.id, email: fbUser.email });
    const account = await getOrCreateAccount(profile.landlordId || fbUser.id);
    const plan = resolvePlan(String(profile.plan || account.plan || "screening"));

    const user = ensureLandlordEntry({
      id: profile.id || fbUser.id,
      email: profile.email || fbUser.email,
      role: profile.role || "landlord",
      landlordId: profile.landlordId || fbUser.id,
      plan,
      permissions: [],
      revokedPermissions: [],
    } as any);

    step = "jwt_sign";
    const claimsUser = user as any;
    const claims = {
      sub: user.id,
      email: user.email,
      role: claimsUser.role || "landlord",
      landlordId: claimsUser.landlordId || user.id,
      permissions: claimsUser.permissions ?? [],
      revokedPermissions: claimsUser.revokedPermissions ?? [],
    } as const;
    const token = signAuthToken(
      claims,
      { expiresIn: "7d" }
    );

    try {
      step = "micro_live_grant";
      const landlordId = user.id;
      await maybeGrantMicroLiveFromLead(user.email, landlordId);
    } catch (e) {
      console.warn("[micro-live] grant attempt failed (non-blocking)", (e as any)?.message || e);
    }

    step = "session_user";
    const sessionUser = await buildCanonicalSessionUserFromClaims({ ...claims, ver: 1 }, {
      requestCache: {},
    });

    return res.status(200).json({
      ok: true,
      token,
      user: sessionUser,
    });
  } catch (err: any) {
    try {
      const msg = String(err?.message || "");
      const code = String(err?.code || "");
      if (code === "FIREBASE_API_KEY_NOT_CONFIGURED") {
        return loginError(res, 500, "FIREBASE_API_KEY_MISSING");
      }
      if (code === "EMAIL_NOT_VERIFIED") {
        return loginError(res, 403, "EMAIL_NOT_VERIFIED", "Email verification required");
      }
      const looksLikeAuthFailure =
        code.includes("auth/") ||
        code === "UNAUTHORIZED" ||
        code === "INVALID_CREDENTIALS" ||
        /invalid|expired|revoked|credential|password|token|unauthorized/i.test(msg);

      if (looksLikeAuthFailure) {
        return loginError(res, 401, "UNAUTHORIZED", msg || code || undefined);
      }
    } catch {
      // fall through to generic error
    }

    console.error("[auth/login] failed", {
      requestId,
      step,
      message: err?.message,
      code: err?.code,
      stack: err?.stack,
      email: (req as any)?.body?.email,
    });
    return res.status(500).json({
      ok: false,
      code: "INTERNAL",
      error: "Login failed",
      requestId,
      step,
      detail: String(err?.message || ""),
      errCode: String(err?.code || ""),
    });
  }
});

router.get("/health", (req, res) => {
  const loginEnabled =
    (process.env.AUTH_LOGIN_ENABLED || process.env.PASSWORD_LOGIN_ENABLED || "true")
      .toString()
      .toLowerCase() === "true";
  const passwordLoginEnabled =
    (process.env.PASSWORD_LOGIN_ENABLED || "true").toString().trim().toLowerCase() === "true";
  const hasFirebaseKey = Boolean(process.env.FIREBASE_API_KEY);

  res.setHeader("x-route-source", "authRoutes:/health");
  if (!hasFirebaseKey) {
    return res.status(500).json({
      ok: false,
      error: "FIREBASE_API_KEY missing",
      loginEnabled,
      passwordLoginEnabled,
    });
  }

  return res.json({
    ok: true,
    loginEnabled,
    passwordLoginEnabled,
    hasFirebaseKey,
  });
});

router.post("/login/demo", rateLimitAuth, async (_req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).end();
  }

  const demoPlan =
    process.env.DEMO_PLAN === "screening" ||
    process.env.DEMO_PLAN === "starter" ||
    process.env.DEMO_PLAN === "pro" ||
    process.env.DEMO_PLAN === "elite"
      ? (process.env.DEMO_PLAN as any)
      : process.env.NODE_ENV === "production"
      ? "screening"
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
  ensureLandlordProfile(user.id, user.email);

  try {
    await maybeGrantMicroLiveFromLead(user.email, user.id);
  } catch (e: any) {
    console.warn("[micro-live] grant attempt failed (non-blocking)", e?.message || e);
  }

  return res.json({
    token,
    user,
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
  ensureLandlordProfile(user.id, user.email);

  res.status(200).json({
    token,
    user: {
      id: user.id,
      email: user.email,
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
  requireAuth,
  (req: any, res: Response) => {
    if (!req.user) {
      res.status(401).json({ ok: false, error: "unauthenticated" });
      return;
    }
    res.status(200).json({
      ok: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
        landlordId: req.user.landlordId,
        tenantId: req.user.tenantId,
        plan: req.user.plan,
        capabilities: Array.isArray(req.user.capabilities) ? req.user.capabilities : [],
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
