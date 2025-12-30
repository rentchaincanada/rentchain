import { Router } from "express";
import { authenticateJwt } from "../middleware/authMiddleware";
import {
  createLedgerNoteV2,
  getLedgerEventV2,
  listLedgerEventsV2,
} from "../services/ledgerEventsFirestoreService";
import { computeLedgerEventHashV1 } from "../utils/ledgerHash";

const router = Router();
router.use(authenticateJwt);
router.use((req, _res, next) => {
  console.log("[ledgerV2Routes] hit", req.method, req.path);
  next();
});

router.get("/", async (req: any, res) => {
  res.setHeader("x-route-source", "ledgerV2Routes");
  const landlordId = req.user?.landlordId || req.user?.id;
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const started = Date.now();
  const limitRaw = Number(req.query?.limit ?? 50);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 50;
  const cursor = req.query?.cursor ? Number(req.query.cursor) : undefined;
  const propertyId = req.query?.propertyId ? String(req.query.propertyId) : undefined;
  const tenantId = req.query?.tenantId ? String(req.query.tenantId) : undefined;
  const eventType = req.query?.eventType ? String(req.query.eventType) : undefined;

  try {
    const timeoutMs = 5000;
    const result = await Promise.race([
      listLedgerEventsV2({
        landlordId,
        limit,
        cursor,
        propertyId,
        tenantId,
        eventType,
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), timeoutMs)),
    ]);
    const ms = Date.now() - started;
    res.setHeader("x-duration-ms", String(ms));
    return res.json({ ok: true, ...(result as any) });
  } catch (err: any) {
    const ms = Date.now() - started;
    console.error("[ledgerV2Routes] list error", { ms, err: err?.message, stack: err?.stack });
    if (err?.message === "TIMEOUT") {
      return res.status(504).json({ ok: false, error: "Request timed out" });
    }
    return res.status(500).json({
      ok: false,
      error: "Failed to load ledger",
      code: (err as any)?.code || undefined,
      message: err?.message || undefined,
    });
  }
});

router.post("/", async (req: any, res) => {
  res.setHeader("x-route-source", "ledgerV2Routes");
  const landlordId = req.user?.landlordId || req.user?.id;
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const { title, summary, propertyId, tenantId, occurredAt } = req.body || {};
  if (!title || typeof title !== "string") {
    return res.status(400).json({ ok: false, error: "title is required" });
  }

  const note = await createLedgerNoteV2({
    landlordId,
    title: title.trim(),
    summary: summary ? String(summary) : undefined,
    propertyId: propertyId ? String(propertyId) : undefined,
    tenantId: tenantId ? String(tenantId) : undefined,
    occurredAt: occurredAt ? Number(occurredAt) : undefined,
    actor: {
      type: "LANDLORD",
      userId: req.user?.id,
      email: req.user?.email,
    },
  });

  return res.status(201).json({ ok: true, item: note });
});

router.get("/verify", async (req: any, res) => {
  res.setHeader("x-route-source", "ledgerV2Routes");
  const landlordId = req.user?.landlordId || req.user?.id;
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const limitRaw = Number(req.query?.limit ?? 100);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 100;

  const result = await listLedgerEventsV2({ landlordId, limit });
  const eventsDesc = result.items || [];
  const events = [...eventsDesc].reverse(); // oldest first

  let firstBadIndex: number | undefined;
  let firstBadId: string | undefined;

  for (let i = 0; i < events.length; i++) {
    const ev = events[i] as any;
    const expectedPrev = i === 0 ? null : events[i - 1]?.hash ?? null;
    if ((ev.prevHash ?? null) !== expectedPrev) {
      firstBadIndex = i;
      firstBadId = ev.id;
      break;
    }
    if (!ev.hash) {
      firstBadIndex = i;
      firstBadId = ev.id;
      break;
    }
    const expectedHash = computeLedgerEventHashV1(ev, ev.prevHash ?? null);
    if (ev.hash !== expectedHash) {
      firstBadIndex = i;
      firstBadId = ev.id;
      break;
    }
  }

  if (firstBadIndex !== undefined) {
    return res.json({
      ok: false,
      checked: events.length,
      firstBadIndex,
      firstBadId,
    });
  }

  return res.json({ ok: true, checked: events.length });
});

router.get("/:id", async (req: any, res) => {
  res.setHeader("x-route-source", "ledgerV2Routes");
  const landlordId = req.user?.landlordId || req.user?.id;
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
  const id = String(req.params.id || "");
  const item = await getLedgerEventV2(id, landlordId);
  if (!item) return res.status(404).json({ ok: false, error: "Not found" });
  return res.json({ ok: true, item });
});

export default router;
