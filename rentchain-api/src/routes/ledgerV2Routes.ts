import { Router } from "express";
import { authenticateJwt } from "../middleware/authMiddleware";
import {
  createLedgerNoteV2,
  getLedgerEventV2,
  listLedgerEventsV2,
} from "../services/ledgerEventsFirestoreService";

const router = Router();
router.use(authenticateJwt);

router.get("/", async (req: any, res) => {
  res.setHeader("x-route-source", "ledgerV2Routes:list");
  const landlordId = req.user?.landlordId || req.user?.id;
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const limitRaw = Number(req.query?.limit ?? 50);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;
  const cursor = req.query?.cursor ? Number(req.query.cursor) : undefined;
  const propertyId = req.query?.propertyId ? String(req.query.propertyId) : undefined;
  const tenantId = req.query?.tenantId ? String(req.query.tenantId) : undefined;
  const eventType = req.query?.eventType ? String(req.query.eventType) : undefined;

  const result = await listLedgerEventsV2({
    landlordId,
    limit,
    cursor,
    propertyId,
    tenantId,
    eventType,
  });
  return res.json({ ok: true, ...result });
});

router.get("/:id", async (req: any, res) => {
  res.setHeader("x-route-source", "ledgerV2Routes:get");
  const landlordId = req.user?.landlordId || req.user?.id;
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
  const id = String(req.params.id || "");
  const item = await getLedgerEventV2(id, landlordId);
  if (!item) return res.status(404).json({ ok: false, error: "Not found" });
  return res.json({ ok: true, item });
});

router.post("/", async (req: any, res) => {
  res.setHeader("x-route-source", "ledgerV2Routes:create");
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

export default router;
