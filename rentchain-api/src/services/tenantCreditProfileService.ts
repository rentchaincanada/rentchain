import { db } from "../config/firebase";

export type CreditPeriodStatus =
  | "on_time"
  | "late_1_29"
  | "late_30_59"
  | "late_60_plus"
  | "partial"
  | "unpaid"
  | "no_data";

export interface CreditPeriod {
  period: string; // YYYY-MM
  rentAmount?: number | null;
  dueDate?: string | null;
  amountPaid: number;
  paidAt?: string | null;
  daysLate?: number | null;
  status: CreditPeriodStatus;
}

export interface TenantCreditHistory {
  schemaVersion: "1.0";
  source: "rentchain-ledger";
  generatedAt: string;
  tenantId: string;
  leaseId?: string | null;
  periods: CreditPeriod[];
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function parseDate(date?: string | null): Date | null {
  if (!date) return null;
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Derives a credit-ready rental history for a tenant from rent charges and payments.
 * Default window: last 24 months.
 */
export async function getTenantCreditHistory(params: {
  tenantId: string;
  landlordId?: string;
  months?: number;
}): Promise<TenantCreditHistory> {
  const { tenantId, landlordId, months = 24 } = params;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  // Fetch rent charges for tenant within window (by dueDate month) and payments.
  const chargesSnap = await db
    .collection("rentCharges")
    .where("tenantId", "==", tenantId)
    .get();

  const paymentsSnap = await db
    .collection("payments")
    .where("tenantId", "==", tenantId)
    .get();

  const charges = chargesSnap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as any) }))
    .filter((c) => {
      const due = parseDate(c.dueDate);
      return due ? due >= start : true;
    });

  const payments = paymentsSnap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as any) }))
    .filter((p) => {
      const paidAt = parseDate(p.paidAt);
      const due = parseDate(p.dueDate);
      const candidate = paidAt || due;
      return candidate ? candidate >= start : true;
    });

  const periods: CreditPeriod[] = [];
  const monthsKeys: string[] = [];
  for (let i = 0; i < months; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthsKeys.push(monthKey(d));
  }

  const leaseId = charges[0]?.leaseId ?? null;

  monthsKeys.forEach((period) => {
    const charge = charges.find((c) => {
      if (c.period) return c.period === period;
      const due = parseDate(c.dueDate);
      return due ? monthKey(due) === period : false;
    });

    const rentAmount = charge?.amount ?? null;
    const dueDate = charge?.dueDate ?? null;

    const chargePayments = payments.filter((p) => {
      if (charge?.id && p.rentChargeId && p.rentChargeId === charge.id) return true;
      if (p.dueDate) {
        const dk = monthKey(new Date(p.dueDate));
        if (dk === period) return true;
      }
      return false;
    });

    const amountPaid = chargePayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const paidAt =
      chargePayments
        .map((p) => parseDate(p.paidAt || p.createdAt))
        .filter(Boolean)
        .sort((a, b) => (a!.getTime() || 0) - (b!.getTime() || 0))[0]?.toISOString() ?? null;

    let status: CreditPeriodStatus = "no_data";
    let daysLate: number | null = null;

    if (!charge && amountPaid === 0) {
      status = "no_data";
    } else if (!rentAmount || !dueDate) {
      status = "no_data";
    } else if (amountPaid === 0) {
      status = "unpaid";
    } else if (amountPaid < rentAmount) {
      status = "partial";
    } else {
      const due = parseDate(dueDate);
      const paid = parseDate(paidAt);
      if (!due || !paid) {
        status = "no_data";
      } else {
        const diffDays = Math.round((paid.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
        daysLate = diffDays;
        if (diffDays <= 0) {
          status = "on_time";
        } else if (diffDays >= 60) {
          status = "late_60_plus";
        } else if (diffDays >= 30) {
          status = "late_30_59";
        } else {
          status = "late_1_29";
        }
      }
    }

    periods.push({
      period,
      rentAmount,
      dueDate,
      amountPaid,
      paidAt,
      daysLate,
      status,
    });
  });

  return {
    schemaVersion: "1.0",
    source: "rentchain-ledger",
    generatedAt: new Date().toISOString(),
    tenantId,
    leaseId,
    periods: periods.reverse(), // chronological ascending
  };
}
