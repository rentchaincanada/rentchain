import { Router } from "express";
import crypto from "crypto";
import { authenticateJwt } from "../middleware/authMiddleware";
import { db } from "../config/firebase";
import { listLedgerEventsV2 } from "../services/ledgerEventsFirestoreService";

const COLLECTION = "tenantHistoryShares";
const MAX_EVENTS = 200;

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function timingSafeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a, "hex");
  const bBuf = Buffer.from(b, "hex");
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function buildShareUrl(shareId: string, token: string) {
  const base = (process.env.PUBLIC_APP_URL || "").replace(/\/$/, "");
  const path = `/api/public/tenant-history/${encodeURIComponent(shareId)}?token=${encodeURIComponent(token)}`;
  return base ? `${base}${path}` : path;
}

const protectedRouter = Router();
protectedRouter.use(authenticateJwt);

protectedRouter.post("/share", async (req: any, res) => {
  const landlordId = req.user?.landlordId || req.user?.id;
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const tenantId = String(req.body?.tenantId || "").trim();
  if (!tenantId) return res.status(400).json({ ok: false, error: "tenantId is required" });

  const daysRaw = Number(req.body?.expiresInDays ?? 7);
  const expiresInDays = Number.isFinite(daysRaw) ? Math.min(Math.max(daysRaw, 1), 30) : 7;
  const now = Date.now();
  const expiresAt = now + expiresInDays * 24 * 60 * 60 * 1000;

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256Hex(token);

  const ref = db.collection(COLLECTION).doc();
  await ref.set({
    id: ref.id,
    landlordId,
    tenantId,
    createdAt: now,
    expiresAt,
    tokenHash,
    revoked: false,
  });

  return res.json({
    ok: true,
    shareId: ref.id,
    url: buildShareUrl(ref.id, token),
    expiresAt,
  });
});

protectedRouter.post("/share/:shareId/revoke", async (req: any, res) => {
  const landlordId = req.user?.landlordId || req.user?.id;
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const shareId = String(req.params?.shareId || "").trim();
  if (!shareId) return res.status(400).json({ ok: false, error: "shareId required" });

  const ref = db.collection(COLLECTION).doc(shareId);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ ok: false, error: "Not found" });
  const data = snap.data() as any;
  if (data.landlordId !== landlordId) {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }

  await ref.set({ revoked: true, revokedAt: Date.now() }, { merge: true });
  return res.json({ ok: true, shareId, revoked: true });
});

export const publicRouter = Router();

publicRouter.get("/tenant-history/:shareId", async (req, res) => {
  const shareId = String(req.params?.shareId || "").trim();
  const token = String(req.query?.token || "").trim();
  if (!shareId || !token) {
    return res.status(400).json({ ok: false, error: "Invalid token or shareId" });
  }

  const ref = db.collection(COLLECTION).doc(shareId);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ ok: false, error: "Not found" });
  const data = snap.data() as any;

  if (data.revoked) return res.status(403).json({ ok: false, error: "Revoked" });
  if (typeof data.expiresAt === "number" && data.expiresAt < Date.now()) {
    return res.status(403).json({ ok: false, error: "Expired" });
  }

  const storedHash = String(data.tokenHash || "");
  const incomingHash = sha256Hex(token);
  if (!storedHash || !timingSafeEqual(storedHash, incomingHash)) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const landlordId = data.landlordId;
  const tenantId = data.tenantId;

  const tenantSnap = await db.collection("tenants").doc(String(tenantId)).get();
  const tenantData = tenantSnap.exists ? tenantSnap.data() || {} : {};

  const ledgerResult = await listLedgerEventsV2({
    landlordId,
    tenantId,
    limit: MAX_EVENTS,
  });

  const events = (ledgerResult.items || []).map((ev: any) => ({
    id: ev.id,
    occurredAt: ev.occurredAt,
    createdAt: ev.createdAt,
    eventType: ev.eventType,
    title: ev.title,
    summary: ev.summary,
    amount: ev.amount,
    currency: ev.currency,
    propertyId: ev.propertyId,
    tenantId: ev.tenantId,
    leaseId: ev.leaseId,
    paymentId: ev.paymentId,
  }));

  // best-effort last access update
  ref.set({ lastAccessedAt: Date.now() }, { merge: true }).catch(() => {});

  return res.json({
    ok: true,
    tenant: {
      id: tenantSnap.id || tenantId,
      fullName: tenantData?.fullName || null,
      email: tenantData?.email || null,
      phone: tenantData?.phone || null,
      status: tenantData?.status || null,
      propertyId: tenantData?.propertyId || null,
      unit: tenantData?.unit || null,
    },
    events,
    generatedAt: Date.now(),
    expiresAt: data.expiresAt || null,
  });
});

export default protectedRouter;
