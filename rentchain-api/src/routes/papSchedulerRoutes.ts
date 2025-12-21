// src/routes/papSchedulerRoutes.ts
import { Router, Request, Response } from "express";
import { firestore } from "../events/firestore";
import { PapMandate } from "../services/papMandateService";
import {
  createEventEnvelope,
  type StreamType,
} from "../events/blockchainEnvelope";

const router = Router();

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
 * GET /admin/pap/run-schedule
 *
 * Very simple scheduler endpoint:
 *  - Finds active monthly PAP mandates whose dayOfMonth is today
 *  - Emits a RentPaymentAttempted event for each
 *
 * This is the hook for a future Cloud Scheduler / cron job.
 */
router.get(
  "/run-schedule",
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const today = new Date();
      const day = today.getDate();
      const todayIso = today.toISOString().slice(0, 10); // YYYY-MM-DD

      // Load active monthly mandates for today's dayOfMonth
      const snap = await firestore
        .collection("papMandates")
        .where("status", "==", "active")
        .where("frequency", "==", "monthly")
        .where("dayOfMonth", "==", day)
        .get();

      const created: any[] = [];

      const streamType: StreamType = "tenant";
      const eventType = "RentPaymentAttempted";

      for (const doc of snap.docs) {
        const mandate = doc.data() as PapMandate;

        const tenantId = mandate.tenantId;
        const amount = mandate.maxDebitAmount ?? null;
        if (!tenantId || amount == null) {
          // skip mandates missing critical data
          continue;
        }

        const numericAmount =
          typeof amount === "number" ? amount : Number(amount);
        if (Number.isNaN(numericAmount) || numericAmount <= 0) {
          continue;
        }

        // Basic uniqueness: paymentId for a given (mandate, day)
        const paymentId = `pap_${mandate.id}_${todayIso.replace(/-/g, "")}`;

        const prevHash = await getLatestHashForTenant(tenantId);

        const envelope = createEventEnvelope({
          streamType,
          streamId: tenantId,
          eventType,
          payload: {
            tenantId,
            paymentId,
            attemptedAmount: numericAmount,
            scheduledDate: todayIso,
            paymentMethod: "preauthorized",
            status: "attempted",
            mandateId: mandate.id,
          },
          metadata: {
            source: "papScheduler/run",
          },
          prevHash,
        });

        const ts = Date.parse(todayIso) || Date.now();

        await firestore
          .collection("events")
          .doc(envelope.envelopeId)
          .set({
            ...envelope,
            tenantId,
            type: eventType,
            timestamp: ts,
          });

        created.push({
          tenantId,
          mandateId: mandate.id,
          paymentId,
          amount: numericAmount,
          scheduledDate: todayIso,
        });
      }

      res.json({
        success: true,
        date: todayIso,
        attemptsCreated: created.length,
        items: created,
      });
    } catch (err) {
      console.error("[GET /admin/pap/run-schedule] error", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({
        error: "Failed to run PAP schedule",
        detail: message,
      });
    }
  }
);

export default router;
