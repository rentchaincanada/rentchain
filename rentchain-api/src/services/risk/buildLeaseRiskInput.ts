import { db } from "../../config/firebase";
import { listLedgerEventsV2 } from "../ledgerEventsFirestoreService";
import { computeTenantSignals } from "../tenantSignalsService";
import type { RiskInput } from "./riskTypes";

type LeaseRiskSourceContext = {
  landlordId: string;
  propertyId: string;
  unitId?: string | null;
  tenantIds: string[];
  monthlyRent?: number | null;
};

function numberOrNull(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const numeric = numberOrNull(value);
    if (numeric != null) return numeric;
  }
  return null;
}

function boolOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function mapScreeningBandToCreditEstimate(scoreBand: unknown): number | null {
  switch (String(scoreBand || "").trim().toUpperCase()) {
    case "A":
      return 775;
    case "B":
      return 720;
    case "C":
      return 665;
    case "D":
      return 610;
    case "E":
      return 540;
    default:
      return null;
  }
}

function monthlyIncomeFromApplication(application: any): number | null {
  const direct = firstNumber(application?.monthlyIncome);
  if (direct != null && direct > 0) return direct;

  const employment = application?.applicantProfile?.employment || {};
  const amountCents = firstNumber(employment?.incomeAmountCents);
  const frequency = String(employment?.incomeFrequency || "monthly").trim().toLowerCase();
  if (amountCents != null && amountCents > 0) {
    const amount = amountCents / 100;
    return frequency === "annual" ? Math.round(amount / 12) : Math.round(amount);
  }
  return null;
}

function employmentMonthsFromApplication(application: any): number | null {
  return firstNumber(
    application?.applicantProfile?.employment?.monthsAtJob,
    application?.employment?.monthsAtJob,
    application?.employmentMonths
  );
}

async function loadTenantDocs(tenantIds: string[]) {
  const docs = await Promise.all(
    tenantIds.map(async (tenantId) => {
      try {
        const snap = await db.collection("tenants").doc(tenantId).get();
        return snap.exists ? { id: snap.id, ...(snap.data() as any) } : null;
      } catch {
        return null;
      }
    })
  );
  return docs.filter(Boolean) as any[];
}

async function loadApplicationDocs(tenantIds: string[], propertyId: string, landlordId: string) {
  const entries = await Promise.all(
    tenantIds.map(async (tenantId) => {
      const queries = [
        db.collection("applications").where("tenantId", "==", tenantId).limit(5).get().catch(() => ({ docs: [] } as any)),
        db.collection("applications").where("convertedTenantId", "==", tenantId).limit(5).get().catch(() => ({ docs: [] } as any)),
      ];
      const results = await Promise.all(queries);
      return results.flatMap((result) => result.docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() as any) }));
    })
  );

  const seen = new Map<string, any>();
  for (const app of entries.flat()) {
    if (!app?.id) continue;
    if (String(app.landlordId || "").trim() && String(app.landlordId || "").trim() !== landlordId) continue;
    if (String(app.propertyId || "").trim() && String(app.propertyId || "").trim() !== propertyId) continue;
    seen.set(app.id, app);
  }
  return Array.from(seen.values());
}

async function buildPaymentHistoryInput(tenantIds: string[], landlordId: string) {
  let paymentCount = 0;
  let latePayments = 0;
  for (const tenantId of tenantIds) {
    try {
      const paymentSnap = await db.collection("payments").where("tenantId", "==", tenantId).limit(24).get();
      paymentCount += (paymentSnap.docs || []).length;
    } catch {
      // ignore payment read failures for risk input
    }
    try {
      const events = await listLedgerEventsV2({ landlordId, tenantId, limit: 50 });
      const signals = computeTenantSignals(events.items || [], tenantId, landlordId);
      latePayments += signals.latePaymentsCount;
    } catch {
      // ignore ledger read failures for risk input
    }
  }

  const onTimePaymentRatio = paymentCount + latePayments > 0 ? paymentCount / (paymentCount + latePayments) : null;
  return {
    latePayments: latePayments > 0 ? latePayments : null,
    onTimePaymentRatio: onTimePaymentRatio != null ? Number(onTimePaymentRatio.toFixed(2)) : null,
  };
}

export async function buildLeaseRiskInput(context: LeaseRiskSourceContext): Promise<RiskInput> {
  const tenantIds = context.tenantIds.map((value) => String(value || "").trim()).filter(Boolean);
  const [tenantDocs, applicationDocs, paymentHistory] = await Promise.all([
    loadTenantDocs(tenantIds),
    loadApplicationDocs(tenantIds, context.propertyId, context.landlordId),
    buildPaymentHistoryInput(tenantIds, context.landlordId),
  ]);

  const monthlyIncome = tenantDocs.reduce((sum, tenant) => {
    const value = firstNumber(tenant?.monthlyIncome, tenant?.income, tenant?.incomeAmount);
    return sum + (value != null ? value : 0);
  }, 0) || applicationDocs.reduce((sum, app) => sum + (monthlyIncomeFromApplication(app) || 0), 0) || null;

  const primaryTenant = tenantDocs[0] || null;
  const primaryApplication = applicationDocs[0] || null;

  return {
    creditScore: firstNumber(
      primaryTenant?.creditScore,
      primaryApplication?.creditScore,
      primaryApplication?.screening?.score,
      mapScreeningBandToCreditEstimate(primaryApplication?.screeningResultSummary?.scoreBand)
    ),
    monthlyIncome,
    monthlyRent: firstNumber(context.monthlyRent),
    employmentMonths: firstNumber(
      primaryTenant?.employmentMonths,
      primaryTenant?.monthsAtJob,
      employmentMonthsFromApplication(primaryApplication)
    ),
    onTimePaymentRatio: paymentHistory.onTimePaymentRatio,
    latePayments: paymentHistory.latePayments,
    coTenantCount: tenantIds.length || null,
    hasGuarantor:
      boolOrNull(primaryTenant?.hasGuarantor) ??
      boolOrNull(primaryTenant?.guarantorApproved) ??
      boolOrNull(primaryApplication?.cosignerRequested) ??
      boolOrNull(primaryApplication?.hasGuarantor) ??
      (primaryApplication?.cosignerApplication ? true : null),
  };
}
