// src/services/eventProcessorService.ts
import { db } from "../config/firebase";
import { analyzeTenantPayments } from "./aiPaymentInsightService";
import { createLedgerEvent } from "../events/envelope";
import { ledgerService } from "./ledgerService";
import { RentPaymentAIInsightData } from "../events/ai/RentPaymentAIInsightGenerated";
import { RentPaymentRecordedData } from "../events/financial/RentPaymentRecorded";
import { LedgerEvent } from "../events/envelope";

interface ProcessPaymentsResult {
  scannedEvents: number;
  processedTenants: number;
  writtenInsights: number;
}

/**
 * Simple skeleton processor:
 * - Reads recent RentPaymentRecorded events
 * - For each unique tenant, runs analyzeTenantPayments
 * - Writes RentPaymentAIInsightGenerated back to ledger
 */
export async function processRecentPaymentEvents(
  limit = 50
): Promise<ProcessPaymentsResult> {
  const snapshot = await db
    .collection("ledgerEvents")
    .where("eventType", "==", "RentPaymentRecorded")
    .orderBy("timestamp", "desc")
    .limit(limit)
    .get();

  if (snapshot.empty) {
    return {
      scannedEvents: 0,
      processedTenants: 0,
      writtenInsights: 0,
    };
  }

  const events: LedgerEvent<RentPaymentRecordedData>[] = snapshot.docs.map(
    (doc) => doc.data() as LedgerEvent<RentPaymentRecordedData>
  );

  const tenantIds = new Set<string>();
  for (const ev of events) {
    if (ev.data && ev.data.tenantId) {
      tenantIds.add(ev.data.tenantId);
    }
  }

  let writtenInsights = 0;

  for (const tenantId of tenantIds) {
    const insight = await analyzeTenantPayments(tenantId);

    if (!insight) {
      continue;
    }

    const event = createLedgerEvent<RentPaymentAIInsightData>(
      "RentPaymentAIInsightGenerated",
      insight,
      { system: "event-processor" }
    );

    const result = await ledgerService.logEvent(event);
    if (result.success) {
      writtenInsights++;
    }
  }

  return {
    scannedEvents: events.length,
    processedTenants: tenantIds.size,
    writtenInsights,
  };
}
