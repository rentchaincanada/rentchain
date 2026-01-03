import { Router } from "express";
import { db, FieldValue } from "../config/firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";

const router = Router();

type EventType =
  | "LEASE_STARTED"
  | "RENT_PAID"
  | "RENT_LATE"
  | "NOTICE_SERVED"
  | "LEASE_ENDED";

type Severity = "positive" | "neutral" | "negative";

const ALLOWED_TYPES: EventType[] = [
  "LEASE_STARTED",
  "RENT_PAID",
  "RENT_LATE",
  "NOTICE_SERVED",
  "LEASE_ENDED",
];

function inferSeverity(type: EventType): Severity {
  switch (type) {
    case "RENT_PAID":
    case "LEASE_STARTED":
      return "positive";
    case "RENT_LATE":
    case "NOTICE_SERVED":
      return "negative";
    case "LEASE_ENDED":
      return "neutral";
    default:
      return "neutral";
  }
}

function defaultTitle(type: EventType): string {
  switch (type) {
    case "LEASE_STARTED":
      return "Lease started";
    case "RENT_PAID":
      return "Rent paid";
    case "RENT_LATE":
      return "Rent paid late";
    case "NOTICE_SERVED":
      return "Notice served";
    case "LEASE_ENDED":
      return "Lease ended";
    default:
      return "Tenant event";
  }
}

function clampInt(n: any, min: number, max: number): number | undefined {
  const v = Number(n);
  if (!Number.isFinite(v)) return undefined;
  const i = Math.trunc(v);
  return Math.min(Math.max(i, min), max);
}

function clampMoneyCents(n: any): number | undefined {
  const v = Number(n);
  if (!Number.isFinite(v)) return undefined;
  const i = Math.trunc(v);
  if (i < 0) return undefined;
  return Math.min(i, 50_000_000);
}

/**
 * POST /api/tenant-events
 * Body:
 * {
 *   tenantId: string,
 *   type: EventType,
 *   occurredAt?: string|number (optional; defaults to now),
 *   title?: string,
 *   description?: string,
 *   propertyId?: string,
 *   unitId?: string,
 *   amountCents?: number,
 *   currency?: string,
 *   daysLate?: number,
 *   noticeType?: string
 * }
 */
router.post("/tenant-events", requireAuth, requireLandlord, async (req: any, res) => {
  res.setHeader("x-route-source", "tenantEventsWriteRoutes");

  const landlordId = req.user?.landlordId || req.user?.id;
  const createdByUserId = req.user?.id || req.user?.sub || undefined;

  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const tenantId = String(req.body?.tenantId || "");
  const type = String(req.body?.type || "") as EventType;

  if (!tenantId) return res.status(400).json({ ok: false, error: "Missing tenantId" });
  if (!ALLOWED_TYPES.includes(type)) {
    return res.status(400).json({
      ok: false,
      error: "BAD_TYPE",
      message: `type must be one of: ${ALLOWED_TYPES.join(", ")}`,
    });
  }

  // Ensure tenant belongs to landlord
  const tSnap = await db.collection("tenants").doc(tenantId).get();
  if (!tSnap.exists) return res.status(404).json({ ok: false, error: "Tenant not found" });
  const tenant = tSnap.data() as any;
  if (tenant?.landlordId !== landlordId) {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }

  // occurredAt default now
  let occurredAtDate = new Date();
  const rawOccurredAt = req.body?.occurredAt;
  if (rawOccurredAt != null && rawOccurredAt !== "") {
    const d =
      typeof rawOccurredAt === "number"
        ? new Date(rawOccurredAt)
        : new Date(String(rawOccurredAt));
    if (!isNaN(d.getTime())) occurredAtDate = d;
  }

  const title = String(req.body?.title || defaultTitle(type)).slice(0, 120);
  const description =
    req.body?.description != null && String(req.body.description).trim()
      ? String(req.body.description).slice(0, 2000)
      : undefined;

  const propertyId =
    req.body?.propertyId != null && String(req.body.propertyId).trim()
      ? String(req.body.propertyId)
      : undefined;

  const unitId =
    req.body?.unitId != null && String(req.body.unitId).trim()
      ? String(req.body.unitId)
      : undefined;

  const currency =
    req.body?.currency != null && String(req.body.currency).trim()
      ? String(req.body.currency).toUpperCase().slice(0, 8)
      : undefined;

  const amountCents = clampMoneyCents(req.body?.amountCents);
  const daysLate = clampInt(req.body?.daysLate, 0, 365);
  const noticeType =
    req.body?.noticeType != null && String(req.body.noticeType).trim()
      ? String(req.body.noticeType).slice(0, 64)
      : undefined;

  const severity: Severity = inferSeverity(type);

  const doc = {
    tenantId,
    landlordId,
    propertyId,
    unitId,

    type,
    severity,
    title,
    description,

    occurredAt: occurredAtDate,
    createdAt: FieldValue.serverTimestamp(),

    source: "landlord",
    createdByUserId,

    amountCents,
    currency,
    daysLate,
    noticeType,

    // anchoring placeholders
    anchorStatus: "none",
  };

  const ref = await db.collection("tenantEvents").add(doc);

  return res.json({
    ok: true,
    id: ref.id,
    item: { id: ref.id, ...doc, createdAt: undefined },
  });
});

export default router;
