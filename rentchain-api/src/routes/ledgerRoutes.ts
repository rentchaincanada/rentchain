import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { appendLedgerEvent, getLatestLedgerEvent, verifyLedgerChain } from "../services/ledger/ledgerService";
import { db } from "../config/firebase";

const router = Router();

// Helper: derive landlordId from user
function getLandlordId(req: any): string | null {
  return req.user?.landlordId || req.user?.id || null;
}

// GET /api/ledger
router.get("/", requireAuth, async (req: any, res) => {
  const landlordId = getLandlordId(req);
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const limitRaw = Number(req.query?.limit ?? 50);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;
  const tenantId = req.query?.tenantId ? String(req.query.tenantId) : null;
  const propertyId = req.query?.propertyId ? String(req.query.propertyId) : null;

  try {
    let q: FirebaseFirestore.Query = db.collection("ledgerEvents").where("landlordId", "==", landlordId);
    if (tenantId) q = q.where("tenantId", "==", tenantId);
    if (propertyId) q = q.where("propertyId", "==", propertyId);

    q = q.orderBy("seq", "desc").orderBy("ts", "desc");

    const snap = await q.limit(limit).get();
    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    return res.json({ ok: true, items });
  } catch (err: any) {
    // Fallback if index missing: try order by ts only
    try {
      let q: FirebaseFirestore.Query = db.collection("ledgerEvents").where("landlordId", "==", landlordId);
      if (tenantId) q = q.where("tenantId", "==", tenantId);
      if (propertyId) q = q.where("propertyId", "==", propertyId);
      q = q.orderBy("ts", "desc");
      const snap = await q.limit(limit).get();
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      return res.json({ ok: true, items, note: "fallback_ts_order" });
    } catch (e: any) {
      console.error("[ledger GET] error", e?.message || e);
      return res.status(500).json({ ok: false, error: "Failed to load ledger" });
    }
  }
});

// POST /api/ledger/events
router.post("/events", requireAuth, async (req: any, res) => {
  const landlordId = getLandlordId(req);
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const { type, tenantId, propertyId, unitId, payload } = req.body || {};
  if (!type || payload === undefined) {
    return res.status(400).json({ ok: false, error: "type and payload are required" });
  }

  try {
    const actor = {
      userId: req.user?.id,
      role: req.user?.role,
      email: req.user?.email,
    };
    const event = await appendLedgerEvent({
      landlordId,
      tenantId,
      propertyId,
      unitId,
      actor,
      type,
      ts: Date.now(),
      payload,
      source: {
        route: "ledgerRoutes",
        requestId: req.requestId,
        ip: req.ip,
      },
    });
    return res.json({ ok: true, event });
  } catch (err: any) {
    console.error("[ledger POST /events] error", err?.message || err);
    return res.status(500).json({ ok: false, error: "Failed to append ledger event" });
  }
});

// GET /api/ledger/verify
router.get("/verify", requireAuth, async (req: any, res) => {
  const landlordId = getLandlordId(req);
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const limitRaw = Number(req.query?.limit ?? 500);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 1000) : 500;

  try {
    const result = await verifyLedgerChain(landlordId, limit);
    return res.json(result);
  } catch (err: any) {
    console.error("[ledger GET /verify] error", err?.message || err);
    return res.status(500).json({ ok: false, error: "Failed to verify ledger" });
  }
});

export default router;
