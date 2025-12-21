// src/routes/papMandateRoutes.ts
import { Router, Request, Response } from "express";
import { firestore } from "../events/firestore";
import {
  createPapMandate,
  getPapMandateById,
  getPapMandatesForTenant,
  updatePapMandateStatus,
  PapMandate,
} from "../services/papMandateService";
import {
  createEventEnvelope,
  type StreamType,
} from "../events/blockchainEnvelope";

const router = Router();

/**
 * Helper: find latest hash in events chain for a tenant
 */
async function getLatestHashForTenant(tenantId: string): Promise<string | null> {
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

  return prevHash;
}

/**
 * POST /api/pap-mandates
 *
 * Creates a new PAP mandate linked to a tenant (and optionally lease + docs).
 * Also emits a PAPMandateCreated ledger event for the tenant.
 */
router.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      tenantId,
      leaseId,
      bankName,
      institutionNumber,
      transitNumber,
      accountMasked,
      accountNumberHash,
      maxDebitAmount,
      frequency,
      dayOfMonth,
      signedAt,
      signedBy,
      mandateDocumentId,
      linkedLeaseDocumentId,
      status,
    } = req.body || {};

    if (!tenantId || typeof tenantId !== "string") {
      res.status(400).json({ error: "tenantId is required" });
      return;
    }

    const mandate = await createPapMandate({
      tenantId,
      leaseId,
      bankName,
      institutionNumber,
      transitNumber,
      accountMasked,
      accountNumberHash,
      maxDebitAmount,
      frequency,
      dayOfMonth,
      signedAt,
      signedBy,
      mandateDocumentId,
      linkedLeaseDocumentId,
      status,
    });

    // Emit blockchain event
    const streamType: StreamType = "tenant";
    const eventType = "PAPMandateCreated";
    const prevHash = await getLatestHashForTenant(tenantId);

    const envelope = createEventEnvelope({
      streamType,
      streamId: tenantId,
      eventType,
      payload: {
        mandateId: mandate.id,
        tenantId: mandate.tenantId,
        leaseId: mandate.leaseId ?? null,
        status: mandate.status,
        maxDebitAmount: mandate.maxDebitAmount ?? null,
        frequency: mandate.frequency ?? null,
        dayOfMonth: mandate.dayOfMonth ?? null,
        signedAt: mandate.signedAt ?? null,
        signedBy: mandate.signedBy ?? null,
        mandateDocumentId: mandate.mandateDocumentId ?? null,
        linkedLeaseDocumentId: mandate.linkedLeaseDocumentId ?? null,
      },
      metadata: {
        source: "papMandates/create",
      },
      prevHash,
    });

    const ts = Date.now();
    await firestore
      .collection("events")
      .doc(envelope.envelopeId)
      .set({
        ...envelope,
        tenantId,
        type: eventType,
        timestamp: ts,
      });

    res.status(201).json({
      success: true,
      mandate,
      ledgerEvent: envelope,
    });
  } catch (err) {
    console.error("[POST /api/pap-mandates] error", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({
      error: "Failed to create PAP mandate",
      detail: message,
    });
  }
});

/**
 * GET /api/pap-mandates/:id
 *
 * Fetch a single PAP mandate by ID.
 */
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const mandate = await getPapMandateById(id);
    if (!mandate) {
      res.status(404).json({ error: "PAP mandate not found" });
      return;
    }
    res.json(mandate);
  } catch (err) {
    console.error("[GET /api/pap-mandates/:id] error", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({
      error: "Failed to fetch PAP mandate",
      detail: message,
    });
  }
});

/**
 * GET /api/pap-mandates/by-tenant/:tenantId
 *
 * Fetch all PAP mandates for a given tenant.
 */
router.get(
  "/by-tenant/:tenantId",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.params;
      const mandates = await getPapMandatesForTenant(tenantId);
      res.json(mandates);
    } catch (err) {
      console.error("[GET /api/pap-mandates/by-tenant/:tenantId] error", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({
        error: "Failed to fetch PAP mandates for tenant",
        detail: message,
      });
    }
  }
);

/**
 * PATCH /api/pap-mandates/:id/revoke
 *
 * Marks a PAP mandate as revoked and emits PAPMandateRevoked event.
 *
 * Optional body:
 * { "reason": "Tenant requested cancellation" }
 */
router.patch(
  "/:id/revoke",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { reason } = req.body || {};

      const existing = await getPapMandateById(id);
      if (!existing) {
        res.status(404).json({ error: "PAP mandate not found" });
        return;
      }

      const updated = await updatePapMandateStatus(id, "revoked");
      if (!updated) {
        res.status(500).json({ error: "Failed to update PAP mandate status" });
        return;
      }

      const tenantId = updated.tenantId;
      const streamType: StreamType = "tenant";
      const eventType = "PAPMandateRevoked";

      const prevHash = await getLatestHashForTenant(tenantId);

      const envelope = createEventEnvelope({
        streamType,
        streamId: tenantId,
        eventType,
        payload: {
          mandateId: updated.id,
          tenantId: updated.tenantId,
          leaseId: updated.leaseId ?? null,
          status: updated.status,
          revokedAt: updated.updatedAt,
          reason: reason ?? null,
        },
        metadata: {
          source: "papMandates/revoke",
        },
        prevHash,
      });

      const ts = Date.now();
      await firestore
        .collection("events")
        .doc(envelope.envelopeId)
        .set({
          ...envelope,
          tenantId,
          type: eventType,
          timestamp: ts,
        });

      res.json({
        success: true,
        mandate: updated,
        ledgerEvent: envelope,
      });
    } catch (err) {
      console.error("[PATCH /api/pap-mandates/:id/revoke] error", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({
        error: "Failed to revoke PAP mandate",
        detail: message,
      });
    }
  }
);

export default router;
