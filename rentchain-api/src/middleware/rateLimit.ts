import expressRateLimit from "express-rate-limit";
import type { Request } from "express";
import { safeOperationalLog } from "../lib/logging/safeLogger";

type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyGenerator: (req: Request) => string;
  profileName?: string;
};

type SimpleRateLimitOptions = {
  windowMs: number;
  max: number;
};

type RateLimitKeyStrategy = "ip" | "actor-or-ip";

export type RateLimitProfile = {
  profileName: string;
  windowMs: number;
  max: number;
  keyStrategy: RateLimitKeyStrategy;
  description: string;
};

export const RATE_LIMIT_PROFILES = {
  authSensitive: {
    profileName: "auth-sensitive",
    windowMs: 15 * 60 * 1000,
    max: 20,
    keyStrategy: "ip",
    description: "Login, signup, demo login, and password-reset confirmation routes.",
  },
  publicToken: {
    profileName: "public-token",
    windowMs: 15 * 60 * 1000,
    max: 60,
    keyStrategy: "ip",
    description: "Public invite, access, landlord invite, tenant invite alias, and application-link token surfaces.",
  },
  tenantWorkspaceEntry: {
    profileName: "tenant-workspace-entry",
    windowMs: 15 * 60 * 1000,
    max: 90,
    keyStrategy: "actor-or-ip",
    description: "Tenant workspace invite/session entry points.",
  },
  evidenceExportReview: {
    profileName: "evidence-export-review",
    windowMs: 15 * 60 * 1000,
    max: 120,
    keyStrategy: "actor-or-ip",
    description: "Landlord evidence, export, review timeline, and operator review surfaces.",
  },
  internalJob: {
    profileName: "internal-job",
    windowMs: 15 * 60 * 1000,
    max: 300,
    keyStrategy: "ip",
    description: "Internal job-token routes. Lenient to preserve legitimate retries.",
  },
  diagnostics: {
    profileName: "diagnostics",
    windowMs: 5 * 60 * 1000,
    max: 120,
    keyStrategy: "ip",
    description: "Public debug, probe, echo, build, and status diagnostics.",
  },
} satisfies Record<string, RateLimitProfile>;

const allowlist = String(process.env.RATE_LIMIT_ALLOWLIST || "")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);

function requestIp(req: Request) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0]?.trim();
  return String(req.ip || forwarded || req.socket?.remoteAddress || "unknown");
}

function safeIpKey(req: Request) {
  return requestIp(req);
}

function actorKey(req: Request) {
  const user = (req as any).user || {};
  return String(
    user?.id ||
      user?.uid ||
      user?.sub ||
      user?.tenantId ||
      user?.landlordId ||
      user?.actorLandlordId ||
      ""
  ).trim();
}

function keyForProfile(profile: Pick<RateLimitProfile, "profileName" | "keyStrategy">) {
  return (req: Request) => {
    if (profile.keyStrategy === "actor-or-ip") {
      const actor = actorKey(req);
      if (actor) return `${profile.profileName}:actor:${actor}`;
    }
    return `${profile.profileName}:ip:${safeIpKey(req)}`;
  };
}

const handler = (req: Request, res: any, _next: any, options: any, profileName?: string) => {
  const retryAfterSeconds = Math.ceil(Number(options?.windowMs || 0) / 1000) || undefined;
  safeOperationalLog("warn", "[rate-limit] request limited", {
    profileName: profileName || "rate-limit",
    route: req.originalUrl || req.path,
    method: req.method,
    retryAfterSeconds,
    authHeaderPresent: Boolean(req.get("authorization")),
  });
  return res.status(429).json({
    ok: false,
    code: "RATE_LIMITED",
    error: "rate_limited",
    detail: "Too many requests. Please try again later.",
  });
};

function createLimiter(opts: RateLimitOptions) {
  return expressRateLimit({
    windowMs: opts.windowMs,
    max: opts.max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: opts.keyGenerator,
    handler: (req, res, next, options) => handler(req, res, next, options, opts.profileName),
    skip: (req) => {
      const ip = requestIp(req);
      return allowlist.includes(ip);
    },
  });
}

export function createRateLimiter(profile: RateLimitProfile) {
  return createLimiter({
    windowMs: profile.windowMs,
    max: profile.max,
    keyGenerator: keyForProfile(profile),
    profileName: profile.profileName,
  });
}

export function rateLimitSimple(opts: SimpleRateLimitOptions) {
  return createLimiter({
    windowMs: opts.windowMs,
    max: opts.max,
    keyGenerator: keyForProfile({
      profileName: `simple-${opts.windowMs}-${opts.max}`,
      keyStrategy: "ip",
    }),
    profileName: `simple-${opts.windowMs}-${opts.max}`,
  });
}

// Backwards-compatible export used by older route modules.
export const rateLimit = rateLimitSimple;

export const rateLimitPublicApply = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: keyForProfile({ profileName: "public-apply", keyStrategy: "ip" }),
  profileName: "public-apply",
});

export const rateLimitLeads = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: keyForProfile({ profileName: "leads", keyStrategy: "ip" }),
  profileName: "leads",
});

export const rateLimitAuth = createRateLimiter(RATE_LIMIT_PROFILES.authSensitive);

export const rateLimitScreeningUser = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 30,
  keyGenerator: keyForProfile({ profileName: "screening-user", keyStrategy: "actor-or-ip" }),
  profileName: "screening-user",
});

export const rateLimitScreeningIp = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 60,
  keyGenerator: keyForProfile({ profileName: "screening-ip", keyStrategy: "ip" }),
  profileName: "screening-ip",
});

export const rateLimitTenantInvitesUser = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 30,
  keyGenerator: keyForProfile({ profileName: "tenant-invites-user", keyStrategy: "actor-or-ip" }),
  profileName: "tenant-invites-user",
});

export const rateLimitReferralsUser = createLimiter({
  windowMs: 24 * 60 * 60 * 1000,
  max: 10,
  keyGenerator: keyForProfile({ profileName: "referrals-user", keyStrategy: "actor-or-ip" }),
  profileName: "referrals-user",
});

export const rateLimitPublicToken = createRateLimiter(RATE_LIMIT_PROFILES.publicToken);
export const rateLimitTenantWorkspaceEntry = createRateLimiter(RATE_LIMIT_PROFILES.tenantWorkspaceEntry);
export const rateLimitEvidenceExportReview = createRateLimiter(RATE_LIMIT_PROFILES.evidenceExportReview);
export const rateLimitInternalJob = createRateLimiter(RATE_LIMIT_PROFILES.internalJob);
export const rateLimitDiagnostics = createRateLimiter(RATE_LIMIT_PROFILES.diagnostics);
