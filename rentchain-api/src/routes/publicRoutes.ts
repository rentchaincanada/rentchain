import { Router, Request, Response } from "express";
import { db } from "../firebase";

const router = Router();

// In-memory rate limit (MVP ok)
const bucket = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX = 20;

function hit(ip: string) {
  const now = Date.now();
  const b = bucket.get(ip);
  if (!b || now > b.resetAt) {
    bucket.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true as const };
  }
  if (b.count >= MAX) {
    return {
      ok: false as const,
      retryAfterSec: Math.ceil((b.resetAt - now) / 1000),
    };
  }
  b.count += 1;
  return { ok: true as const };
}

function normalizeEmail(raw: string) {
  return String(raw || "").trim().toLowerCase();
}

function emailKey(email: string) {
  return email
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "")
    .slice(0, 180);
}

router.post("/waitlist", async (req: Request, res: Response) => {
  try {
    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "unknown";

    const rl = hit(ip);
    if (!rl.ok) {
      return res
        .status(429)
        .json({
          ok: false,
          error: "Rate limited",
          retryAfterSec: rl.retryAfterSec,
        });
    }

    const email = normalizeEmail(req.body?.email);
    const name = String(req.body?.name || "").trim() || null;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ ok: false, error: "Invalid email" });
    }

    const docId = emailKey(email);
    const ref = db.collection("waitlist").doc(docId);
    const snap = await ref.get();

    if (snap.exists) {
      return res.json({ ok: true, already: true });
    }

    const userAgent = String(req.headers["user-agent"] || "");
    await ref.set({
      email,
      name,
      createdAt: new Date().toISOString(),
      ip,
      userAgent,
      source: String(req.body?.source || "landing"),
      utm: req.body?.utm || null,
    });

    return res.json({ ok: true, already: false });
  } catch (e: any) {
    console.error("[POST /api/waitlist] error", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

export default router;
