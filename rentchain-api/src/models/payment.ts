// BACKEND: rentchain-api/src/models/payment.ts

export type PaymentStatus = "on_time" | "late" | "partial" | "early" | "unpaid";

export interface PaymentInput {
  tenantId: string;
  propertyId?: string | null;
  unitId?: string | null;
  monthlyRent: number;
  amount: number;
  dueDate: string; // ISO date string: "2025-02-01"
  paidAt: string;  // ISO date string: "2025-02-03"
  method?: string; // e.g. "e-transfer" | "cash" | "cheque"
  notes?: string | null;
}

export interface PaymentRecord extends PaymentInput {
  id: string;
  status: PaymentStatus;
  daysLate: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Evaluate payment timing & status (on_time, late, partial, etc.)
 */
export function evaluatePaymentStatus(input: PaymentInput): {
  status: PaymentStatus;
  daysLate: number;
} {
  const due = new Date(input.dueDate);
  const paid = new Date(input.paidAt);

  const msPerDay = 1000 * 60 * 60 * 24;
  const diffMs = paid.getTime() - due.getTime();
  const daysLateRaw = diffMs / msPerDay;
  const daysLate = daysLateRaw > 0 ? Math.floor(daysLateRaw) : 0;

  const { amount, monthlyRent } = input;

  if (amount <= 0) {
    return { status: "unpaid", daysLate };
  }

  if (amount < monthlyRent) {
    return { status: "partial", daysLate };
  }

  if (daysLate > 0) {
    return { status: "late", daysLate };
  }

  if (daysLate < 0) {
    return { status: "early", daysLate: 0 };
  }

  return { status: "on_time", daysLate: 0 };
}
