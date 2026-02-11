import expressRateLimit from "express-rate-limit";

type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyGenerator: (req: any) => string;
};

type SimpleRateLimitOptions = {
  windowMs: number;
  max: number;
};

const allowlist = String(process.env.RATE_LIMIT_ALLOWLIST || "")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);

const handler = (_req: any, res: any) => {
  return res.status(429).json({
    ok: false,
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
    handler,
    skip: (req) => {
      const ip = req.ip || "";
      return allowlist.includes(ip);
    },
  });
}

export function rateLimitSimple(opts: SimpleRateLimitOptions) {
  return createLimiter({
    windowMs: opts.windowMs,
    max: opts.max,
    keyGenerator: keyByIp,
  });
}

// Backwards-compatible export used by older route modules.
export const rateLimit = rateLimitSimple;

const keyByIp = (req: any) => String(req.ip || "unknown");
const keyByUser = (req: any) =>
  String(req.user?.id || req.user?.uid || req.user?.landlordId || req.ip || "unknown");

export const rateLimitPublicApply = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: keyByIp,
});

export const rateLimitLeads = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: keyByIp,
});

export const rateLimitAuth = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: keyByIp,
});

export const rateLimitScreeningUser = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 30,
  keyGenerator: keyByUser,
});

export const rateLimitScreeningIp = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 60,
  keyGenerator: keyByIp,
});

export const rateLimitTenantInvitesUser = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 30,
  keyGenerator: keyByUser,
});
