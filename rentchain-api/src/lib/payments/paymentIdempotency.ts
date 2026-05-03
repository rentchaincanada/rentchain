import type { PaymentProvider, PaymentPurpose } from "./paymentTypes";

type ProviderWebhookIdempotencyInput = {
  provider: PaymentProvider;
  providerEventId: string;
};

type SessionCreationIdempotencyInput = {
  provider: PaymentProvider;
  purpose: PaymentPurpose;
  subjectId: string;
  amount: number;
  currency: string;
};

type ManualPaymentIdempotencyInput = {
  landlordId: string;
  subjectId: string;
  amount: number;
  receivedAt?: string | number | Date | null;
};

function cleanPart(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeAmount(amount: unknown): string {
  const next = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(next)) return "amount_invalid";
  return String(Math.round(next));
}

function normalizeReceivedAt(value: ManualPaymentIdempotencyInput["receivedAt"]): string {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value).toISOString();
  const raw = String(value || "").trim();
  if (!raw) return "received_at_missing";
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : raw;
}

export function buildProviderWebhookIdempotencyKey(input: ProviderWebhookIdempotencyInput): string {
  return ["provider_event", cleanPart(input.provider), cleanPart(input.providerEventId || "event_missing")].join(":");
}

export function buildSessionCreationIdempotencyKey(input: SessionCreationIdempotencyInput): string {
  return [
    "payment_session",
    cleanPart(input.provider),
    cleanPart(input.purpose),
    cleanPart(input.subjectId || "subject_missing"),
    normalizeAmount(input.amount),
    cleanPart(input.currency || "currency_missing"),
  ].join(":");
}

export function buildManualPaymentIdempotencyKey(input: ManualPaymentIdempotencyInput): string {
  return [
    "manual_payment",
    "manual",
    cleanPart(input.landlordId || "landlord_missing"),
    cleanPart(input.subjectId || "subject_missing"),
    normalizeAmount(input.amount),
    cleanPart(normalizeReceivedAt(input.receivedAt)),
  ].join(":");
}
