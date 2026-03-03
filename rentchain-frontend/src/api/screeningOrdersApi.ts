import { apiFetch } from "./apiFetch";

export type ScreeningOrderStatus =
  | "unpaid"
  | "paid"
  | "processing"
  | "failed"
  | "refunded";

export type ScreeningOrderStatusView = {
  applicationId: string | null;
  orderId: string | null;
  status: ScreeningOrderStatus;
  paidAt: number | null;
  amountTotalCents: number;
  currency: string;
  stripePaymentIntentId: string | null;
  stripeCheckoutSessionId: string | null;
  lastUpdatedAt: number | null;
};

export async function getScreeningOrderStatus(params: {
  applicationId?: string;
  orderId?: string;
}): Promise<{ ok: boolean; data?: ScreeningOrderStatusView; error?: string }> {
  const query = new URLSearchParams();
  if (params.applicationId) query.set("applicationId", params.applicationId);
  if (params.orderId) query.set("orderId", params.orderId);
  const res: any = await apiFetch(`/screening/orders/status?${query.toString()}`);
  return res as { ok: boolean; data?: ScreeningOrderStatusView; error?: string };
}

export async function reconcileScreeningOrder(params: {
  applicationId?: string;
  orderId?: string;
}): Promise<{ ok: boolean; data?: ScreeningOrderStatusView; error?: string }> {
  const res: any = await apiFetch(`/screening/orders/reconcile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params || {}),
  });
  return res as { ok: boolean; data?: ScreeningOrderStatusView; error?: string };
}

