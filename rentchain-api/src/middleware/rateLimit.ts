import type { Request, Response, NextFunction } from "express";
import { jsonError } from "../lib/httpResponse";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function rateLimit(opts: { windowMs: number; max: number; key?: (req: Request) => string }) {
  const windowMs = opts.windowMs;
  const max = opts.max;

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const keyFn =
      opts.key ||
      ((r) => {
        const u: any = (r as any).user;
        return String(u?.landlordId || u?.id || r.ip || "anon");
      });

    const key = keyFn(req);
    const b = buckets.get(key);

    if (!b || now >= b.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    b.count += 1;
    if (b.count > max) {
      const retryAfterSec = Math.ceil((b.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfterSec));
      return jsonError(
        res,
        429,
        "RATE_LIMITED",
        "Too many requests",
        { windowMs, max, retryAfterSec },
        req.requestId
      );
    }

    return next();
  };
}
