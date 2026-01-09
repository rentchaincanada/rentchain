import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { appendLedgerEvent, verifyLedgerChain } from "../services/ledger/ledgerService";
import { db } from "../config/firebase";

const router = Router();

const parseLimit = (raw: any, def: number, max: number) => {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(Math.max(Math.floor(n), 1), max);
};

function getLandlordId(req: any): string | null {
  return req.user?.landlordId || req.user?.id || null;
}

router.get("/", requireAuth, async (req: any, res) => {
  const landlordId = getLandlordId(req);
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

  if (req.user?.role === "tenant") {
    return res.status(403).json({ ok: false, error: "Tenant ledger access not enabled yet" });
  }

  const limit = parseLimit(req.query?.limit, 50, 200);
  const tenantId = req.query?.tenantId ? String(req.query.tenantId) : null;
  const propertyId = req.query?.propertyId ? String(req.query.propertyId) : null;

  try {
    let q: FirebaseFirestore.Query = db.collection("ledgerEvents").where("landlordId", "==", landlordId);
    if (tenantId) {
      q = q.where("tenantId", "==", tenantId);
    } else if (propertyId) {
      q = q.where("propertyId", "==", propertyId);
    }
    q = q.orderBy("seq", "desc").orderBy("ts", "desc");

    const snap = await q.limit(limit).get();
    let items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    // Optional in-memory secondary filter if both params provided
    if (tenantId && propertyId) {
      items = items.filter((i) => i.propertyId === propertyId);
    }

    return res.json({ ok: true, items });
  } catch (err: any) {
    console.error("[ledger GET] primary query error", {
      message: err?.message,
      stack: err?.stack,
      code: err?.code,
    });
    try {
      let q: FirebaseFirestore.Query = db.collection("ledgerEvents").where("landlordId", "==", landlordId);
      if (tenantId) {
        q = q.where("tenantId", "==", tenantId);
      } else if (propertyId) {
        q = q.where("propertyId", "==", propertyId);
      }
      q = q.orderBy("ts", "desc");
      const snap = await q.limit(limit).get();
      let items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      if (tenantId && propertyId) {
        items = items.filter((i) => i.propertyId === propertyId);
      }
      return res.json({ ok: true, items, note: "fallback_ts_order" });
    } catch (e: any) {
      console.error("[ledger GET] fallback error", {
        message: e?.message,
        stack: e?.stack,
        code: e?.code,
      });
      const isProd = process.env.NODE_ENV === "production";
      const body = isProd
        ? { ok: false, error: "Failed to load ledger" }
        : { ok: false, error: "Failed to load ledger", detail: String(e?.message || e) };
      return res.status(500).json(body);
    }
  }
});

router.post("/events", requireAuth, async (req: any, res) => {
  const landlordId = getLandlordId(req);
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
  if (req.user?.role === "tenant") {
    return res.status(403).json({ ok: false, error: "Tenants cannot write ledger events" });
  }

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
        route: req.originalUrl || "ledgerRoutes",
        requestId: req.headers["x-request-id"] || req.requestId,
        ip: req.ip,
      },
    });
    return res.json({ ok: true, item: event });
  } catch (err: any) {
    console.error("[ledger POST /events] error", {
      message: err?.message,
      stack: err?.stack,
      code: err?.code,
    });
    const isProd = process.env.NODE_ENV === "production";
    const body = isProd
      ? { ok: false, error: "Failed to append ledger event" }
      : { ok: false, error: "Failed to append ledger event", detail: String(err?.message || err) };
    return res.status(500).json(body);
  }
});

router.get("/verify", requireAuth, async (req: any, res) => {
  const landlordId = getLandlordId(req);
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
  if (req.user?.role === "tenant") {
    return res.status(403).json({ ok: false, error: "Tenants cannot verify ledger" });
  }

  const limit = parseLimit(req.query?.limit, 500, 1000);

  try {
    const result = await verifyLedgerChain(landlordId, limit);
    return res.json({ ok: true, result });
  } catch (err: any) {
    console.error("[ledger GET /verify] error", {
      message: err?.message,
      stack: err?.stack,
      code: err?.code,
    });
    const isProd = process.env.NODE_ENV === "production";
    const body = isProd
      ? { ok: false, error: "Failed to verify ledger" }
      : { ok: false, error: "Failed to verify ledger", detail: String(err?.message || err) };
    return res.status(500).json(body);
  }
});

export default router;
