// rentchain-frontend/src/api/payments.ts

export interface PaymentRecord {
  id: string;
  tenantId: string | null;
  propertyId?: string | null;
  amount: number;
  paidAt: string | null; // ISO string
  method: string;
  notes?: string | null;
  monthlyRent?: number | null;
  dueDate?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

/**
 * Fetch payments.
 * - If tenantId is provided, returns payments for that tenant.
 * - Otherwise, returns recent payments.
 */
export async function fetchPayments(
  tenantId?: string
): Promise<PaymentRecord[]> {
  const url = new URL(`${API_BASE_URL}/api/payments`);

  if (tenantId) {
    url.searchParams.set("tenantId", tenantId);
  }

  const res = await fetch(url.toString());

  if (!res.ok) {
    let message = `Failed to fetch payments: ${res.status}`;
    try {
      const text = await res.text();
      const parsed = JSON.parse(text);
      if (parsed?.error) message = parsed.error;
    } catch {
      // ignore parse error
    }
    throw new Error(message);
  }

  return res.json();
}

/**
 * Convenience helper: explicitly fetch for a given tenant.
 */
export async function fetchPaymentsForTenant(
  tenantId: string
): Promise<PaymentRecord[]> {
  return fetchPayments(tenantId);
}

/**
 * Update a payment (amount, notes, method, date, etc.)
 * PATCH /api/payments/:id
 */
export async function updatePayment(
  id: string,
  payload: {
    amount?: number;
    paidAt?: string;
    method?: string;
    notes?: string;
  }
): Promise<PaymentRecord> {
  const res = await fetch(`${API_BASE_URL}/api/payments/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let message = `Failed to update payment: ${res.status}`;
    try {
      const text = await res.text();
      const parsed = JSON.parse(text);
      if (parsed?.error) message = parsed.error;
    } catch {
      // Ignore JSON parse error
    }
    throw new Error(message);
  }

  return res.json();
}

// 🔎 Debug log so we know this module is actually being loaded
console.log("[payments.ts] module loaded");
