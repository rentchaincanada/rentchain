// src/services/aiPaymentInsightService.ts
import { db } from "../config/firebase";
import { RentPaymentRecordedData } from "../events/financial/RentPaymentRecorded";
import { RentPaymentAIInsightData } from "../events/ai/RentPaymentAIInsightGenerated";

interface PaymentWithTimestamp extends RentPaymentRecordedData {
  timestamp: string;
}

/**
 * Analyze a tenant's payment history and return an AI-style insight object.
 * For now this is rule-based logic, but later we can plug in a real LLM.
 */
export async function analyzeTenantPayments(
  tenantId: string
): Promise<RentPaymentAIInsightData | null> {
  // Fetch all RentPaymentRecorded events for this tenant
  const snapshot = await db
    .collection("ledgerEvents")
    .where("eventType", "==", "RentPaymentRecorded")
    .where("data.tenantId", "==", tenantId)
    .orderBy("timestamp", "desc")
    .get();

  if (snapshot.empty) {
    return null;
  }

  const payments: PaymentWithTimestamp[] = snapshot.docs.map((doc) => {
    const data = doc.data() as any;
    return {
      ...(data.data as RentPaymentRecordedData),
      timestamp: data.timestamp as string,
    };
  });

  const totalPayments = payments.length;

  let onTimePayments = 0;
  let latePayments = 0;
  let totalDaysLate = 0;

  for (const p of payments) {
    const due = new Date(p.dueDate);
    const paid = new Date(p.paidAt);

    // Days late = floor((paid - due) / 1 day)
    const msDiff = paid.getTime() - due.getTime();
    const daysLate = Math.floor(msDiff / (1000 * 60 * 60 * 24));

    if (daysLate <= 0) {
      onTimePayments++;
    } else {
      latePayments++;
      totalDaysLate += daysLate;
    }
  }

  const onTimePercentage =
    totalPayments > 0 ? Math.round((onTimePayments / totalPayments) * 100) : 0;

  const avgDaysLate =
    latePayments > 0 ? +(totalDaysLate / latePayments).toFixed(1) : undefined;

  // Simple risk model
  let riskScore = 0.2;
  let riskLevel: "Low" | "Medium" | "High" = "Low";

  if (totalPayments < 2) {
    riskScore = 0.3;
    riskLevel = "Low";
  } else if (onTimePercentage >= 90 && (!avgDaysLate || avgDaysLate <= 1)) {
    riskScore = 0.2;
    riskLevel = "Low";
  } else if (onTimePercentage >= 70) {
    riskScore = 0.5;
    riskLevel = "Medium";
  } else {
    riskScore = 0.8;
    riskLevel = "High";
  }

  // Human-readable summary
  const parts: string[] = [];

  parts.push(
    `Tenant has made ${totalPayments} recorded rent payment${
      totalPayments === 1 ? "" : "s"
    }.`
  );

  parts.push(
    `${onTimePayments} on-time (${onTimePercentage}% on-time) and ${latePayments} late.`
  );

  if (avgDaysLate !== undefined) {
    parts.push(`Average lateness is about ${avgDaysLate} day(s).`);
  }

  if (riskLevel === "Low") {
    parts.push(
      "Overall payment behavior appears reliable with low risk of serious delinquency, assuming no major life changes."
    );
  } else if (riskLevel === "Medium") {
    parts.push(
      "There is a moderate risk of late payments; consider gentle reminders and closer monitoring."
    );
  } else {
    parts.push(
      "There is a high risk of continued late or missed payments. Consider stricter follow-up, payment plans, or further screening."
    );
  }

  const summary = parts.join(" ");

  const insight: RentPaymentAIInsightData = {
    tenantId,
    totalPayments,
    onTimePayments,
    latePayments,
    onTimePercentage,
    avgDaysLate,
    riskScore,
    riskLevel,
    summary,
    generatedAt: new Date().toISOString(),
  };

  return insight;
}
