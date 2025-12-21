// src/routes/monthlyChargeSchedulerRoutes.ts
import { Router, Request, Response } from "express";
import { firestore } from "../events/firestore";
import { Lease } from "../types/lease";
import {
  createEventEnvelope,
  type StreamType,
} from "../events/blockchainEnvelope";

const router = Router();

/**
 * GET /admin/charges/run-monthly
 *
 * Detects all active leases that should be charged today,
 * and emits RentCharged events with full blockchain envelope.
 */
router.get(
  "/run-monthly",
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const today = new Date();
      const todayDay = today.getDate();
      const todayIso = today.toISOString().slice(0, 10);
      const period = `${today.getFullYear()}-${String(
        today.getMonth() + 1
      ).padStart(2, "0")}`;

      // STEP 1: Load all active leases
      const snapshot = await firestore
        .collection("leases")
        .where("status", "==", "active")
        .get();

      const leases: Lease[] = snapshot.docs.map((d) => ({
        ...(d.data() as any),
        id: d.id,
      }));

      const chargesCreated: any[] = [];

      for (const lease of leases) {
        const chargeDay = lease.nextChargeDay ?? 1;

        // Only charge if today matches the lease's charge day
        if (todayDay !== chargeDay) continue;

        // Monthly rent
        const amount = lease.monthlyRent;
        if (!amount || amount <= 0) continue;

        const tenantId = lease.tenantId;
        if (!tenantId) continue;

        // Compute dueDate for this month
        const dueDate = `${period}-${String(chargeDay).padStart(2, "0")}`;

        // Compute prevHash (latest chain anchor for that tenant)
        let prevHash: string | null = null;

        const evSnap = await firestore
          .collection("events")
          .where("tenantId", "==", tenantId)
          .get();

        let latestTs = 0;
        evSnap.forEach((doc) => {
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

        // Build event
        const streamType: StreamType = "tenant";
        const eventType = "RentCharged";

        const envelope = createEventEnvelope({
          streamType,
          streamId: tenantId,
          eventType,
          payload: {
            tenantId,
            leaseId: lease.id,
            amount,
            period,
            dueDate,
            description: `Monthly rent for ${period}`,
          },
          metadata: {
            source: "charges/monthlyScheduler",
          },
          prevHash,
        });

        const ts = Date.parse(dueDate) || Date.now();

        // Write to Firestore
        await firestore
          .collection("events")
          .doc(envelope.envelopeId)
          .set({
            ...envelope,
            tenantId,
            type: eventType,
            timestamp: ts,
          });

        chargesCreated.push({
          tenantId,
          leaseId: lease.id,
          amount,
          period,
          dueDate,
          eventId: envelope.envelopeId,
        });
      }

      res.json({
        success: true,
        date: todayIso,
        chargesGenerated: chargesCreated.length,
        items: chargesCreated,
      });
    } catch (err) {
      console.error("[run-monthly error]", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({
        error: "Failed to run monthly charge scheduler",
        detail: message,
      });
    }
  }
);

export default router;
