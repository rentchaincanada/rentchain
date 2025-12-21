// src/routes/debugBlockchainRoutes.ts
import { Router, Request, Response } from "express";
import { firestore } from "../events/firestore";
import {
  createEventEnvelope,
  type StreamType,
} from "../events/blockchainEnvelope";

const router = Router();

/**
 * POST /debug/blockchain/tenant-event
 *
 * Body:
 * {
 *   "tenantId": "t1",
 *   "eventType": "RentPaymentRecorded",
 *   "payload": { ...any fields... }
 * }
 *
 * This will:
 *  - look up the latest event for that tenant (to link prevHash)
 *  - build a blockchain-ready envelope
 *  - save to Firestore "events" collection
 *  - return the envelope
 */
router.post(
  "/tenant-event",
  async (req: Request, res: Response): Promise<void> => {
    const { tenantId, eventType, payload } = req.body || {};

    if (!tenantId || typeof tenantId !== "string") {
      res.status(400).json({ error: "tenantId is required" });
      return;
    }

    if (!eventType || typeof eventType !== "string") {
      res.status(400).json({ error: "eventType is required" });
      return;
    }

    const streamType: StreamType = "tenant";

    try {
      // 1) Find the latest event for this tenant to get prevHash
      const snap = await firestore
        .collection("events")
        .where("tenantId", "==", tenantId)
        .get();

      let prevHash: string | null = null;
      let latestTs = 0;

      snap.forEach((doc) => {
        const data = doc.data() as any;
        const ts =
          typeof data.timestamp === "number"
            ? data.timestamp
            : typeof data.timestamp === "string"
            ? Number(data.timestamp)
            : 0;

        if (ts > latestTs && data.hash?.contentHash) {
          latestTs = ts;
          prevHash = data.hash.contentHash;
        }
      });

      // 2) Build envelope
      const envelope = createEventEnvelope({
        streamType,
        streamId: tenantId,
        eventType,
        payload: payload ?? {},
        metadata: {
          source: "debug/blockchain",
        },
        prevHash,
      });

      // 3) Save into Firestore "events" collection
      const docRef = firestore
        .collection("events")
        .doc(envelope.envelopeId);

      const nowTs = Date.now();

      await docRef.set({
        ...envelope,
        // denormalized fields for simpler queries
        tenantId,
        type: eventType,
        timestamp: nowTs,
      });

      res.json({
        success: true,
        tenantId,
        envelope,
      });
    } catch (err) {
      console.error("[POST /debug/blockchain/tenant-event] error", err);
      const message =
        err instanceof Error ? err.message : "Unknown error";
      res
        .status(500)
        .json({ error: "Failed to create debug blockchain event", detail: message });
    }
  }
);

export default router;
