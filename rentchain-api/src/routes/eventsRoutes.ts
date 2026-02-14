import express from "express";
import crypto from "crypto";
import { db } from "../config/firebase";
import { incrementCounter } from "../services/telemetryService";

const router = express.Router();

const ALLOWED_EVENT_PATTERNS = [
  /^pricing_cta_/,
  /^demo_/,
  /^gating_/,
  /^upgrade_modal_/,
];

const SESSION_COOKIE = "rc_sid";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 365;

const isAllowedEventName = (name: string) => {
  return ALLOWED_EVENT_PATTERNS.some((pattern) => pattern.test(name));
};

const parseTimestamp = (value: unknown) => {
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
};

const getSessionId = (req: express.Request, res: express.Response) => {
  const existing = typeof req.cookies?.[SESSION_COOKIE] === "string" ? req.cookies[SESSION_COOKIE].trim() : "";
  if (existing) return existing;

  const sessionId = crypto.randomBytes(16).toString("hex");
  res.cookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS * 1000,
    path: "/",
  });
  return sessionId;
};

router.get("/", async (req: any, res) => {
  res.setHeader("x-route-source", "eventsRoutes.ts");
  const landlordId = req.user?.landlordId || req.user?.id;
  const { tenantId, propertyId, limit = "25" } = req.query as any;

  res.json({
    items: [],
    landlordId,
    tenantId: tenantId || null,
    propertyId: propertyId || null,
    limit: Number(limit),
  });
});

router.post("/track", async (req: any, res) => {
  res.setHeader("x-route-source", "eventsRoutes.ts");
  const name = String(req.body?.name || "").trim();
  const props = req.body?.props;

  if (!name || !isAllowedEventName(name)) {
    return res.status(400).json({ ok: false, error: "invalid_event_name" });
  }

  if (props != null && (typeof props !== "object" || Array.isArray(props))) {
    return res.status(400).json({ ok: false, error: "invalid_props" });
  }

  const ts = parseTimestamp(req.body?.ts);
  const userId = typeof req.user?.id === "string" ? req.user.id : null;
  const sessionId = userId ? null : getSessionId(req, res);

  try {
    await db.collection("events").add({
      name,
      ts,
      userId,
      sessionId,
      props: props || null,
      createdAt: Date.now(),
    });

    await incrementCounter({ name });

    return res.json({ ok: true });
  } catch (error: any) {
    console.error("[events/track] failed", error?.message || error);
    return res.status(500).json({ ok: false, error: "track_failed" });
  }
});

export default router;
