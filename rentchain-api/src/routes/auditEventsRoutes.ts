import { Router } from "express";
import {
  getEventsForProperty,
  getEventsForTenant,
  getRecentEvents,
  getAuditEventById,
} from "../services/auditEventService";
import { relayAuditEventToChain } from "../services/blockchainWriterService";

const router = Router();

router.get("/events/recent", async (req, res) => {
  try {
    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : 50;
    const events = await getRecentEvents(Number.isNaN(limit) ? 50 : limit);
    res.json(events);
  } catch (err) {
    console.error("[GET /events/recent] error", err);
    res.status(500).json({ error: "Failed to load recent events" });
  }
});

router.get("/tenants/:tenantId/events", async (req, res) => {
  try {
    const { tenantId } = req.params;
    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : 50;
    const events = await getEventsForTenant(
      tenantId,
      Number.isNaN(limit) ? 50 : limit
    );
    res.json(events);
  } catch (err) {
    console.error("[GET /tenants/:tenantId/events] error", err);
    res.status(500).json({ error: "Failed to load tenant events" });
  }
});

router.get("/properties/:propertyId/events", async (req, res) => {
  try {
    const { propertyId } = req.params;
    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : 50;
    const events = await getEventsForProperty(
      propertyId,
      Number.isNaN(limit) ? 50 : limit
    );
    res.json(events);
  } catch (err) {
    console.error("[GET /properties/:propertyId/events] error", err);
    res.status(500).json({ error: "Failed to load property events" });
  }
});

router.post("/debug/events/:eventId/relay", async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await getAuditEventById(eventId);

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    const result = await relayAuditEventToChain(event);

    return res.json({
      event,
      txHash: result.txHash,
      payload: result.payload,
      simulated: result.simulated,
    });
  } catch (err) {
    console.error("[POST /debug/events/:eventId/relay] error", err);
    return res
      .status(500)
      .json({ error: "Failed to relay event to blockchain" });
  }
});

export default router;
