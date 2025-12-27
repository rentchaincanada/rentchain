// src/services/paymentsService.ts
import axios from "axios";
import API_BASE from "../config/apiBase";

const API_BASE_URL = API_BASE.replace(/\/$/, "");

export interface Payment {
  id: string;
  tenantId: string;
  amount: number;
  paidAt: string; // ISO date string
  method: string;
  notes?: string | null;
}

export async function fetchPaymentsForTenant(
  tenantId: string
): Promise<Payment[]> {
  if (!tenantId) return [];

  const res = await axios.get<Payment[]>(`${API_BASE_URL}/api/payments`, {
    params: { tenantId },
  });

  // Make sure we always hand back an array
  return Array.isArray(res.data) ? res.data : [];
}
